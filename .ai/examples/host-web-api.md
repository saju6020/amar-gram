# The Api Host — a worked example

A complete vertical slice through the single host, from HTTP to database and back. This is the
shape every feature should match.

Feature: **record a certificate for a product**.

---

## 1. `Program.cs`

The full host composition is in `.ai/host-composition.md`. The parts this slice adds:

```csharp
builder.Services.AddInMemoryBusServices();          // registers IInMemoryDispatcher (Scoped)
// AddServiceBusProvider(...) — REMOVED, no RabbitMQ

// The one seam the platform declares but does not fill (ADR-018):
builder.Services.AddScoped<IUserContextProvider, DevUserContextProvider>();

builder.Services.AddDbContext<AmarGramDbContext>(o =>
    o.UseNpgsql(builder.Configuration.GetConnectionString("AmarGram")));
builder.Services.AddScoped(typeof(IAggregateRootRepository<>), typeof(EfAggregateRootRepository<>));

builder.Services.AddScoped<ICommandHandlerAsync<RecordCertificateCommand>,
                           RecordCertificateCommandHandler>();
builder.Services.AddScoped<IValidator<RecordCertificateCommand>,
                           RecordCertificateCommandValidator>();
builder.Services.AddScoped<IQueryHandlerAsync<GetCertificateHistoryQuery,
                                              IReadOnlyList<CertificateHistoryItem>>,
                           GetCertificateHistoryQueryHandler>();
```

---

## 2. Controller

Thin: mint the id, stamp the context, dispatch, map.

```csharp
namespace AmarGram.Api.Controllers;

[ApiController]
[Route("api/staff/products/{productId:guid}/certificates")]
public sealed class CertificateController(IInMemoryDispatcher dispatcher) : ControllerBase
{
    [HttpPost]
    public async Task<IActionResult> Record(
        Guid productId, [FromBody] RecordCertificateRequest request)
    {
        var command = new RecordCertificateCommand
        {
            ProductId               = productId,
            CertificationId           = request.CertificationId,
            BatchId             = request.BatchId,
            IssuedOn      = request.IssuedOn,
            AdministeredByVetId = request.AdministeredByVetId,
            Notes               = request.Notes,
            CorrelationId       = HttpContext.TraceIdentifier,
            UserContext         = HttpContext.GetUserContext()
        };

        var response = await dispatcher.SendAsync(command);

        return response.IsSuccess
            ? CreatedAtAction(nameof(GetHistory), new { productId }, response.Result)
            : BadRequest(response.ValidationResult);
    }

    [HttpGet]
    public async Task<IActionResult> GetHistory(Guid productId)
    {
        var response = await dispatcher.GetResultAsync(
            new GetCertificateHistoryQuery { ProductId = productId });

        return Ok(response.Result);
    }
}
```

What is **no longer** here, compared with the previous Api controller:

- No `IBusMessageDispatcher`, no `SendAsync` to a queue, no `QueueName` stamp.
- No `202 Accepted` — the response carries the created id.
- No manual `await validator.ValidateAsync(...)`: the platform's `IValidationService` runs the
  registered `IValidator<TCommand>` before the handler.
- No subscription to a notification channel to find out whether the command succeeded.

> **Verified against Core 1.0.34.** `IInMemoryDispatcher` exposes exactly
> `SendAsync(Command)`, `GetResultAsync<TResult>(IQuery<TResult>)` and
> `GetResult<TResult>(IQuery<TResult>)`. `PublishAsync` was removed in 1.0.33 — domain events are
> dispatched by the EF aggregate repository, not through the dispatcher (ADR-020). It deliberately
> has **no** `SendBusMessageAsync` or `PublishBusMessageAsync` — those live on `IDispatcher`, which
> is why controllers inject `IInMemoryDispatcher` instead (ADR-019).

---

## 3. Command + validator

```csharp
public sealed class RecordCertificateCommand : Command
{
    public required Guid ProductId { get; init; }
    public required Guid CertificationId { get; init; }
    public required Guid BatchId { get; init; }
    public required DateOnly IssuedOn { get; init; }
    public required Guid AdministeredByVetId { get; init; }
    public string? Notes { get; init; }
}

public sealed class RecordCertificateCommandValidator
    : AbstractValidator<RecordCertificateCommand>
{
    public RecordCertificateCommandValidator()
    {
        RuleFor(x => x.ProductId).NotEmpty();
        RuleFor(x => x.CertificationId).NotEmpty();
        RuleFor(x => x.BatchId).NotEmpty();
        RuleFor(x => x.IssuedOn)
            .LessThanOrEqualTo(_ => DateOnly.FromDateTime(DateTime.UtcNow))
            .WithMessage("A certificate cannot be recorded with a future date.");
    }
}
```

---

## 4. Handler — loads the aggregate itself

```csharp
public sealed class RecordCertificateCommandHandler(
    ILogger<RecordCertificateCommandHandler> logger,
    IAggregateRootRepository<ProductAggregate> productRepository)
    : ICommandHandlerAsync<RecordCertificateCommand>
{
    public async Task<CommandResponse> HandleAsync(RecordCertificateCommand command)
    {
        var product = await productRepository.GetByIdAsync(command.ProductId);
        if (product is null)
        {
            var validation = new ValidationResponse();
            validation.AddError(
                errorMessage: $"Product '{command.ProductId}' was not found.",
                propertyName: nameof(command.ProductId),
                errorCode: BusinessViolationCodes.ProductNotFound,
                resourceName: nameof(ProductAggregate));

            return new CommandResponse { IsSuccess = false, ValidationResult = validation };
        }

        product.RecordCertificate(command.ToDomainDto());   // invariants + domain event inside

        // EventPublishOption is a required argument. InMemoryPublishOnly publishes the
        // aggregate's domain events in-process. Never QueuePublishOnly — there is no queue.
        await productRepository.UpdateAsync(product, EventPublishOption.InMemoryPublishOnly);

        return new CommandResponse { IsSuccess = true, Result = product.Id };
    }
}
```

**No CommandService, no `IBusMessageDispatcher` injected into the handler, no rejection event,
and `InMemoryPublishOnly` in place of `QueuePublishOnly`.** Three constructor parameters became
two, and the failure path became four lines.

---

## 5. Aggregate — where the rules actually live

```csharp
public class ProductAggregate : AggregateRoot
{
    private readonly List<Certificate> _certificates = new();
    public IReadOnlyList<Certificate> Certificates => _certificates;

    public void RecordCertificate(RecordCertificateDto dto)
    {
        // an invariant of THIS product's own state — so it lives here, not in the handler
        if (_certificates.Any(v => v.CertificationId == dto.CertificationId
                                && v.IssuedOn == dto.IssuedOn))
            throw new InvalidOperationException(
                "This certification has already been recorded for this product on this date.");

        var certificate = Certificate.Create(dto);
        _certificates.Add(certificate);

        AddDomainEvent(new CertificateRecordedEvent
        {
            ProductId         = Id,
            CertificationId     = dto.CertificationId,
            ExpiresOn     = certificate.ExpiresOn,
            CorrelationId = dto.CorrelationId,
            UserContext   = dto.UserContext
        });

        UpdateVersion();
    }
}
```

---

## 6. Query side

```csharp
public sealed class GetCertificateHistoryQueryHandler(
    ILogger<GetCertificateHistoryQueryHandler> logger,
    AmarGramDbContext db)
    : IQueryHandlerAsync<GetCertificateHistoryQuery, IReadOnlyList<CertificateHistoryItem>>
{
    public async Task<QueryResponse<IReadOnlyList<CertificateHistoryItem>>> HandleAsync(
        GetCertificateHistoryQuery query)
    {
        var items = await db.Products
            .AsNoTracking()
            .Where(c => c.Id == query.ProductId)
            .SelectMany(c => c.Certificates)
            .OrderByDescending(v => v.IssuedOn)
            .Select(v => new CertificateHistoryItem(
                v.CertificationId, v.IssuedOn, v.ExpiresOn))
            .ToListAsync();

        return new QueryResponse<IReadOnlyList<CertificateHistoryItem>> { Result = items };
    }
}
```

The `GET` immediately after the `POST` returns the new row. No projection to wait for — that
immediacy is the practical gain from ADR-012.

---

## 7. What happens on dispatch, in order

```
POST /api/staff/products/{id}/certificates
  │
  ├─ IValidationService runs IValidator<RecordCertificateCommand>   → invalid? 400
  ├─ IDispatcher resolves ICommandHandlerAsync<RecordCertificateCommand> from DI
  ├─ handler: repository.GetByIdAsync → product.RecordCertificate(...)
  │            → repository.UpdateAsync(product, EventPublishOption.InMemoryPublishOnly)
  ├─ repository: SaveChangesAsync, then publishes the domain events in-process
  ├─ IEventHandlerAsync<CertificateRecordedEvent> runs (recompute status, queue an SMS via outbox)
  └─ 201 Created { id }

  … seconds later, the outbox dispatcher delivers the SMS, out of band
```

Compare with the old path: `Api → RabbitMQ → CommandWorker → domain → event queue → EventWorker →
projection → notification → client`. Seven hops became one call stack.

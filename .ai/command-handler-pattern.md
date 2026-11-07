# Command Handler Pattern Implementation Guide

The standard pattern for Commands, Validators and Command Handlers on the
`Platform.Infrastructure.*` libraries, with **in-memory dispatch in a single host**.

> **Two changes from the previous version of this document:**
>
> 1. **No CommandService layer.** The handler loads its aggregate from
>    `IAggregateRootRepository<TAggregate>` itself. A service is introduced only when a genuine
>    **Domain Service** is needed — see §5.
> 2. **No rejection event, no `202`.** The handler runs inside the request, so
>    `CommandResponse` becomes the HTTP response. ADR-005 is superseded by ADR-014.

---

## 1. Command Definition

Immutable, data only.

- Inherit `Platform.Infrastructure.Core.Commands.Command`.
- Use `required` and `init`.
- Located in `src/Application/Commands/[ContextName]/`.

```csharp
namespace AmarGram.Application.Commands.Product;

public sealed class RecordCertificateCommand : Command
{
    public required Guid ProductId { get; init; }
    public required Guid CertificationId { get; init; }
    public required Guid BatchId { get; init; }
    public required DateOnly IssuedOn { get; init; }
    public required Guid AdministeredByVetId { get; init; }
    public string? Notes { get; init; }
}
```

`Command` still carries `CorrelationId` and `UserContext`. Keep stamping them in the controller —
they remain how a request is traced through logs and how the audit trail attributes a change
(SRS FR-ACC-12), even though nothing is queued.

---

## 2. Command Validator

Shape validation only.

- Inherit FluentValidation's `AbstractValidator<TCommand>`.
- Registered as `IValidator<TCommand>` in `Program.cs`. The platform's `IValidationService` /
  `FluentValidationProvider` resolves it from DI — there is no `GetValidator()` override.
- Located in `src/Application/CommandHandlers/Validators/` (flat).

```csharp
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

## 3. Command Handler

The handler orchestrates: **load the aggregate, call one method on it, save it.**

- Implement `ICommandHandlerAsync<TCommand>` directly. There is no base class —
  `HandleAsync(TCommand)` returning `Task<CommandResponse>` is the entire contract.
- **Inject `IAggregateRootRepository<TAggregate>` and load the aggregate here.** Not through a
  service.
- Use a **primary constructor**.
- Located in `src/Application/CommandHandlers/[ContextName]/`.

```csharp
using Platform.Infrastructure.Core.Commands;
using Platform.Infrastructure.Core.Domain;
using Platform.Infrastructure.Core.Validation;

namespace AmarGram.Application.CommandHandlers.Product;

public sealed class RecordCertificateCommandHandler(
    ILogger<RecordCertificateCommandHandler> logger,
    IAggregateRootRepository<ProductAggregate> productRepository)
    : ICommandHandlerAsync<RecordCertificateCommand>
{
    public async Task<CommandResponse> HandleAsync(RecordCertificateCommand command)
    {
        logger.LogInformation(
            "Recording certificate for product {ProductId}. CorrelationId: {CorrelationId}",
            command.ProductId, command.CorrelationId);

        // 1. Load the aggregate — directly, no service layer.
        var product = await productRepository.GetByIdAsync(command.ProductId);
        if (product is null)
            return Violation(
                $"Product '{command.ProductId}' was not found.",
                nameof(command.ProductId),
                BusinessViolationCodes.ProductNotFound);

        // 2. The aggregate enforces its own invariants and raises its own domain events.
        product.RecordCertificate(command.ToDomainDto());

        // 3. Persist. EventPublishOption is REQUIRED — InMemoryPublishOnly publishes the
        //    aggregate's domain events in-process (Core 1.0.34). Never QueuePublishOnly:
        //    there is no queue.
        await productRepository.UpdateAsync(product, EventPublishOption.InMemoryPublishOnly);

        return new CommandResponse { IsSuccess = true, Result = product.Id };
    }

    private static CommandResponse Violation(string message, string property, string code)
    {
        var validationResponse = new ValidationResponse();
        validationResponse.AddError(
            errorMessage: message,
            propertyName: property,
            errorCode: code,
            resourceName: nameof(ProductAggregate));

        return new CommandResponse { IsSuccess = false, ValidationResult = validationResponse };
    }
}
```

That is the whole handler. Compare it with the previous version, which injected an
`ICommandService`, an `IBusMessageDispatcher` and a repository, and published a rejection event on
every failure path.

### Where the violation goes now

Into the response body:

```
POST /api/staff/products/{id}/certificates
400 Bad Request
{ "errors": [ { "propertyName": "ProductId", "errorCode": "ProductNotFound",
                "errorMessage": "Product '…' was not found." } ] }
```

No rejection event, no `INotifiedByEventHandler`, no notification subsystem, no polling. ADR-005
existed only because a `202` had already been returned and there was no response body left to
carry the violation. That constraint is gone.

---

## 4. A uniqueness check

Still a repository call, still in the handler:

```csharp
var exists = await productRepository.ExistAsync(c => c.Barcode == command.Barcode);
if (exists)
    return Violation($"A product with barcode '{command.Barcode}' is already registered.",
                     nameof(command.Barcode), BusinessViolationCodes.ResourceAlreadyExists);
```

A uniqueness lookup is not domain logic and does not need a service to wrap it. If the same check
appears in three handlers, extract a method on the repository — not a service layer.

---

## 5. When a Domain Service **is** warranted

Only when the logic is **domain logic belonging to no single aggregate**, typically because it
must see several.

```csharp
namespace AmarGram.Domain.DomainServices;

/// FEFO allocation is a rule about the relationship between many batches.
/// No single BatchAggregate can express it.
public interface IStockAllocationService
{
    Task<IReadOnlyList<BatchAllocation>> AllocateAsync(Guid skuId, int quantity);
}
```

| Rule | Where it lives |
|---|---|
| "A product cannot get the same certification twice on one day" | **`ProductAggregate`** — its own state |
| "A certificate expires 12 months after issue" | **`ProductAggregate`** — its own data |
| "A product cannot be listed as certified organic if its certificate has expired" | **`ProductAggregate`** exposes the status; the handler checks it |
| "Allocate from the soonest-expiring batch (FEFO)" | **Domain Service** — spans many batches |
| "Is there enough sellable stock for this order?" (batches + locations + reservations) | **Domain Service** — spans three aggregates |
| "Does this barcode already exist?" | **Handler**, via repository. Not domain logic |

Rules for a Domain Service:

- Lives in `src/Domain/DomainServices/`, namespace `AmarGram.Domain.DomainServices`.
- Takes and returns **domain types**, never Commands or ViewModels.
- Depends only on repository interfaces — no `DbContext`, no HTTP client, no logger-driven flow.
- Is registered explicitly in `Program.cs` as Scoped.

**If you are about to create a service that only wraps one repository call, do not.** Put the call
in the handler.

---

## 6. Where each kind of rule lives

| Rule | Lives in |
|---|---|
| "ProductId must not be empty" | Validator |
| "Administered date cannot be in the future" | Validator |
| "Product must exist" | Handler — repository load, null check |
| "Barcode must be unique" | Handler — repository filter |
| "Cannot record the same certification twice on the same day" | **Aggregate** |
| "Expiry date is 12 months out" | **Aggregate** |
| "Illegal status transition" | **Aggregate** — may throw |
| "Allocate stock FEFO" | **Domain Service** |

If a rule can be broken by looking only at the aggregate's own state, it belongs **in the
aggregate**. Moving it out is how a DDD model quietly turns anaemic — which is exactly what the
Command Service layer was doing.

---

## Summary of rules

1. **The handler loads and saves the aggregate itself**, through
   `IAggregateRootRepository<TAggregate>`. Verified contract:
   `GetByIdAsync(Guid)` · `GetByFilterAsync(Expression<Func<T,bool>>)` ·
   `ExistAsync(Expression<Func<T,bool>>)` · `SaveAsync(T, EventPublishOption)` ·
   `UpdateAsync(T, EventPublishOption)` · `UpdateAsync(T, int expectedVersion, EventPublishOption)`.
   Always pass **`EventPublishOption.InMemoryPublishOnly`**.
2. **No Command Service layer.** Domain Services only, and only for cross-aggregate domain logic.
3. **No manual input validation** — register `IValidator<TCommand>`; the platform runs it.
4. **Primary constructors** for DI.
5. **Implement `ICommandHandlerAsync<TCommand>` directly.** Build `CommandResponse` explicitly.
6. **All state mutation inside the aggregate.** The handler never sets aggregate state.
7. **One aggregate mutated per command.** Two is a signal the boundary is wrong.
8. **Violations return `CommandResponse { IsSuccess = false }`** — never thrown for control flow,
   never published as an event.
9. Register the handler and its validator in `Program.cs` — there is no assembly scanning.

using AmarGram.Api.Authorization;
using AmarGram.Domain.Aggregates.Account;
using AmarGram.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AmarGram.IntegrationTests;

/// <summary>
/// HO-XCT-001 I-A5. Exists only in the test assembly, and only <see cref="XctApiFactory"/> adds it as an application part, so it
/// can never be reachable from the shipped host. It provokes a refused hard delete through real HTTP: a code path that calls
/// <c>DbContext.Remove</c> on a retained record must answer 409 RecordIsRetained and leave the row in place.
/// </summary>
[ApiController]
[Route("api/test-only/xct")]
public sealed class XctTestOnlyController(AmarGramDbContext db) : ControllerBase
{
    [HttpPost("remove-customer/{customerId:guid}")]
    [PublicEndpoint]
    [CsrfExempt]
    public async Task<IActionResult> RemoveCustomer(Guid customerId)
    {
        var customer = await db.Set<CustomerAccountAggregate>().FirstAsync(c => c.Id == customerId);
        db.Remove(customer);
        await db.SaveChangesAsync();
        return NoContent();
    }
}

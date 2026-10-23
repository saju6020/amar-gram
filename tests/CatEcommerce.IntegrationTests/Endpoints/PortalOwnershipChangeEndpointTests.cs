using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using CatEcommerce.Shared.Common.Constants;
using Xunit;

namespace CatEcommerce.IntegrationTests.Endpoints;

/// <summary>
/// HO-POR-001 ADR-261 (IDOR) beyond "two customers": the dashboard follows the account's CURRENT identity.
/// TEST gate addition (2026-10-10): a merged-away (duplicate) customer's records never appear on a third customer's dashboard. The merge is
/// done through the owning module's staff endpoint, never by editing rows.
/// </summary>
public sealed class PortalOwnershipChangeEndpointTests(PortalApiFactory factory) : PortalIntegrationTestBase(factory)
{
    private static List<Guid> Ids(JsonElement board, string section, string idName, string list = "items") =>
        board.GetProperty(section).GetProperty("data").GetProperty(list).EnumerateArray().Select(i => i.GetProperty(idName).GetGuid()).ToList();

    [Fact]
    public async Task AMergedAwayCustomersRecords_NeverAppearOnAThirdCustomersDashboard()
    {
        var branch = await SeedBranchAsync();
        var taxClassId = await PrepareBillingAsync(branch);
        var survivor = await RegisterCustomerAsync("Survivor Owner");
        var duplicate = await RegisterCustomerAsync("Duplicate Owner");
        var bystander = await RegisterCustomerAsync("Bystander Owner");

        var duplicateInvoice = await IssueInvoiceAsync(branch, taxClassId, duplicate.CustomerId, 450m);

        var shared = NewMobile();   // the merge rule: the two records must share a contact number
        foreach (var customer in new[] { survivor, duplicate })
            await ExpectAsync(HttpStatusCode.NoContent, await customer.Client.PutAsJsonAsync("/api/customers/me",
                new { fullName = customer.FullName, additionalPhoneNumbers = new[] { shared } }, Json));

        var (admin, _) = await SignInNewStaffAsync(StaffRoles.Administrator);
        var merge = await admin.PostAsJsonAsync($"/api/staff/customers/{duplicate.CustomerId}/merge", new { survivingCustomerId = survivor.CustomerId, reason = "Same person" }, Json);
        await ExpectAsync(HttpStatusCode.OK, merge);

        // The merged-away account's own session is dead: it cannot read a dashboard any more (SECURITY gate: MergeInto rotates the security stamp).
        var staleSession = await duplicate.Client.GetAsync("/api/portal/dashboard");
        Assert.Equal(HttpStatusCode.Unauthorized, staleSession.StatusCode);

        var bystanderBoard = await GetDashboardAsync(bystander.Client);
        Assert.DoesNotContain(duplicateInvoice.ToString(), bystanderBoard.ToString(), StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("Duplicate Owner", bystanderBoard.ToString());
        Assert.DoesNotContain("Survivor Owner", bystanderBoard.ToString());
        Assert.Equal("Bystander Owner", bystanderBoard.GetProperty("customer").GetProperty("data").GetProperty("fullName").GetString());

        // The surviving account still gets its own dashboard (its own name; a forged id is still ignored).
        var survivorBoard = await GetDashboardAsync(survivor.Client);
        Assert.Equal("Survivor Owner", survivorBoard.GetProperty("customer").GetProperty("data").GetProperty("fullName").GetString());
        Assert.DoesNotContain("Bystander Owner", survivorBoard.ToString());
        // Billing folds the merged-away customer into the survivor (its ADR-192): the duplicate's issued invoice is the survivor's to see.
        Assert.Contains(duplicateInvoice, Ids(survivorBoard, "balances", "invoiceId", "invoices"));
    }
}

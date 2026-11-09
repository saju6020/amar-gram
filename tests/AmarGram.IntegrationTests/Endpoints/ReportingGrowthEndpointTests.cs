using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using AmarGram.Shared.Common.Constants;
using Xunit;

namespace AmarGram.IntegrationTests.Endpoints;

/// <summary>
/// HO-RPT-001 section 16 F -- I-F1, I-F2, I-F3 and I-F7 (US-RPT-04): new and returning customers, lifetime value, cohort retention and a merged customer counted once, over invoices issued through HO-BIL-001's own
/// endpoints. Growth reports cannot be branch-scoped by customer, so every assertion is on customers this test created (section 16.1 rule 2). The clock is moved to the next local month for the "again next month" cases.
/// </summary>
public sealed class ReportingGrowthEndpointTests(ReportingApiFactory factory) : ReportingIntegrationTestBase(factory)
{
    private static readonly TimeSpan Dhaka = TimeSpan.FromHours(6);

    private static decimal Money(JsonElement cell) => decimal.Parse(cell.GetProperty("amount").GetString()!, CultureInfo.InvariantCulture);

    /// <summary>Moves the shared clock to the 5th of the next local month at noon -- exactly one calendar month on, whatever day the suite runs.</summary>
    private async Task NextMonthAsync(BillingContext context)
    {
        var local = Factory.Clock.GetUtcNow().ToOffset(Dhaka);
        var target = new DateTimeOffset(local.Year, local.Month, 1, 12, 0, 0, Dhaka).AddMonths(1).AddDays(4);
        Factory.Clock.SetUtcNow(target.ToUniversalTime());
        await ReSignInAsync(context);
    }

    private static string Month(DateOnly date) => date.ToString("yyyy-MM", CultureInfo.InvariantCulture);

    /// <summary>The start of the local month, and the day before the clock reads (so a window holds "today").</summary>
    private DateOnly MonthStart() => new(Today.Year, Today.Month, 1);

    // ── I-F1 / I-F2 / I-F3 on one scenario ───────────────────────────────────────────────────────────────────
    [Fact]
    public async Task I_F1_I_F2_I_F3_NewAndReturning_LifetimeValue_AndRetention_ForCustomersOfThisTest()
    {
        var context = await CreateBillingContextAsync();
        var returning = await SeedCustomerAsync(context, "Returning Owner");
        var fresh = await SeedCustomerAsync(context, "Fresh Owner");

        // Month 1: only the returning customer is invoiced (shop 600).
        var firstMonth = Month(Today);
        var firstMonthStart = MonthStart();
        await IssueSimpleInvoiceAsync(context, returning, 600m);

        // Month 2: the returning customer buys again (a 400 fee through a manual charge), and a new customer appears.
        await NextMonthAsync(context);
        var chargeId = await RecordChargeAsync(context, returning, 400m, 1m, itemKind: AmarGram.Shared.Common.Enums.ItemKind.Fee,
            sourceKind: AmarGram.Shared.Common.Enums.ChargeSourceKind.Manual, taxClassId: context.ZeroTaxClassId, description: "Service fee");
        await IssueFromChargesAsync(context.Admin, returning, [chargeId]);
        await IssueSimpleInvoiceAsync(context, fresh, 250m);
        var secondMonth = Month(Today);
        var secondMonthStart = MonthStart();
        Assert.NotEqual(firstMonth, secondMonth);

        // I-F1 -- in the second month: two active customers, one new (the fresh one), one returning.
        var growth = await RunReportAsync(context.Admin, ReportCatalogue.CustomersNewVsReturningKey, context, "groupBy=Month", secondMonthStart, Today);
        var october = Rows(growth).Single(r => r.GetProperty("bucket").GetString() == secondMonth);
        Assert.Equal(2, october.GetProperty("activeCustomers").GetInt64());
        Assert.Equal(1, october.GetProperty("newCustomers").GetInt64());
        Assert.Equal(1, october.GetProperty("returningCustomers").GetInt64());
        Assert.Equal(1, october.GetProperty("newReception").GetInt64()); // both were registered by staff; the acquisition source is how they registered

        var firstMonthRow = Rows(await RunReportAsync(context.Admin, ReportCatalogue.CustomersNewVsReturningKey, context, "groupBy=Month", firstMonthStart, firstMonthStart.AddMonths(1).AddDays(-1)))
            .Single(r => r.GetProperty("bucket").GetString() == firstMonth);
        Assert.Equal(1, firstMonthRow.GetProperty("newCustomers").GetInt64());

        // I-F2 -- customers first seen in the second month: only the fresh one; their lifetime value is their invoices.
        var ltv = await RunReportAsync(context.Admin, ReportCatalogue.CustomerLifetimeValueKey, context, from: secondMonthStart, to: Today);
        var top = Rows(ltv).Single(r => r.GetProperty("section").GetString() == "Top 50");
        Assert.Equal("Fresh Owner", top.GetProperty("label").GetString());
        Assert.Equal(250m, Money(top.GetProperty("averageLtv")));

        // ... and for the first month's customer, the value runs to the end of the range.
        var returningLtv = await RunReportAsync(context.Admin, ReportCatalogue.CustomerLifetimeValueKey, context, from: firstMonthStart, to: Today);
        var returningRow = Rows(returningLtv).Single(r => r.GetProperty("section").GetString() == "Top 50" && r.GetProperty("label").GetString() == "Returning Owner");
        Assert.Equal(1000m, Money(returningRow.GetProperty("averageLtv"))); // 600 + 400

        // I-F3 -- the first month's cohort: the returning customer came back one month later.
        var cohorts = await RunReportAsync(context.Admin, ReportCatalogue.CohortRetentionKey, context, from: firstMonthStart, to: firstMonthStart.AddMonths(1).AddDays(-1));
        var cohort = Rows(cohorts).Single(r => r.GetProperty("cohortMonth").GetString() == firstMonth);
        Assert.Equal(1, cohort.GetProperty("cohortSize").GetInt64());
        Assert.Equal("100.0", cohort.GetProperty("month1").GetString());
        Assert.Equal(JsonValueKind.Null, cohort.GetProperty("month6").ValueKind); // not yet happened

        var purchases = await RunReportAsync(context.Admin, ReportCatalogue.CohortRetentionKey, context, "measure=RepeatPurchase", firstMonthStart, firstMonthStart.AddMonths(1).AddDays(-1));
        Assert.Equal("100.0", Rows(purchases).Single().GetProperty("month1").GetString());  // the month-2 fee is a shop-line invoice
    }

    // ── I-F7: a merged customer is counted once ──────────────────────────────────────────────────────────────
    [Fact]
    public async Task I_F7_AMergedCustomer_IsCountedOnceUnderTheSurvivor()
    {
        var context = await CreateBillingContextAsync();
        var (survivorClient, survivorId) = await RegisterAndSignInCustomerAsync();
        var (duplicateClient, duplicateId) = await RegisterAndSignInCustomerAsync();
        var shared = NewMobile();
        await ShareContactNumberAsync(survivorClient, shared);
        await ShareContactNumberAsync(duplicateClient, shared);

        await IssueSimpleInvoiceAsync(context, survivorId, 300m);
        await IssueSimpleInvoiceAsync(context, duplicateId, 500m);

        var before = await RunReportAsync(context.Admin, ReportCatalogue.CustomersNewVsReturningKey, context, "groupBy=Month", MonthStart(), Today);
        Assert.Equal(2, Rows(before).Single().GetProperty("activeCustomers").GetInt64());

        await ExpectAsync(HttpStatusCode.OK, await context.Admin.PostAsJsonAsync($"/api/staff/customers/{duplicateId}/merge",
            new { survivingCustomerId = survivorId, reason = "Same person registered twice" }, Json));

        var after = await RunReportAsync(context.Admin, ReportCatalogue.CustomersNewVsReturningKey, context, "groupBy=Month", MonthStart(), Today);
        Assert.Equal(1, Rows(after).Single().GetProperty("activeCustomers").GetInt64());

        var ltv = await RunReportAsync(context.Admin, ReportCatalogue.CustomerLifetimeValueKey, context, from: MonthStart(), to: Today);
        var only = Assert.Single(Rows(ltv), r => r.GetProperty("section").GetString() == "Top 50");
        Assert.Equal(800m, Money(only.GetProperty("averageLtv"))); // both customers' invoices, under the survivor
    }

    [Fact]
    public async Task TheGrowthReports_AreForAdministratorsOnly_AndTheUndeliveredOnesAreAbsentFromTheCatalogue()
    {
        var (context, accountant) = await ContextWithRoleAsync(StaffRoles.Accountant);
        Assert.Equal(HttpStatusCode.Forbidden, (await accountant.GetAsync($"/api/staff/reports/{ReportCatalogue.CohortRetentionKey}" + Query(context, Today, Today))).StatusCode);

        var catalogue = await ReadAsync(await context.Admin.GetAsync("/api/staff/reports"));
        var keys = catalogue.EnumerateArray().Select(e => e.GetProperty("key").GetString()).ToList();
        Assert.Contains(ReportCatalogue.CohortRetentionKey, keys);
        Assert.DoesNotContain("subscription-health", keys);   // HO-SUB-001 is not merged
        Assert.DoesNotContain("cross-line-conversion", keys); // there is only one business line
        Assert.DoesNotContain("cart-abandonment", keys);      // HO-ORD-001 has not built the reminders
    }
}

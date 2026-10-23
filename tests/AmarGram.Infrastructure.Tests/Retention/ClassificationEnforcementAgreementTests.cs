using System.Security.Cryptography;
using System.Text;
using AmarGram.Infrastructure.Persistence.Migrations;
using AmarGram.Infrastructure.Retention;
using AmarGram.Shared.Common.Constants;
using AmarGram.Shared.Common.Enums;

namespace AmarGram.Infrastructure.Tests.Retention;

/// <summary>
/// HO-XCT-001 ADR-298/299 amendment 2026-10-12 (ARCHITECTURE gate HIGH 1): classification and enforcement are ONE statement. There is no exemption list:
/// the six draft/re-costable line tables are <c>CurrentState</c>/<c>AggregateOnly</c> in their areas' own partials, so the schedule endpoint and the
/// interceptor agree, and no table is both Forbidden and deletable.
/// </summary>
public sealed class ClassificationEnforcementAgreementTests
{
    private static readonly (string Schema, string Table)[] ReclassifiedLineTables =
    [
        ("billing", "invoice_line"), ("inventory", "purchase_order_line"), ("inventory", "consignment_cost"),
        ("inventory", "consignment_exchange_rate"), ("inventory", "consignment_landed_cost_line"), ("inventory", "consignment_hs_code"),
    ];

    [Fact]
    public void TheSixReplaceableLineTables_AreCurrentStateAggregateOnly_NotForbidden()
    {
        foreach (var (schema, table) in ReclassifiedLineTables)
        {
            var entry = RecordClassification.Find(schema, table);
            Assert.NotNull(entry);
            Assert.Equal(RecordClass.CurrentState, entry!.RecordClass);
            Assert.Equal(HardDeletePolicy.AggregateOnly, entry.HardDeletePolicy);
        }
    }

    [Fact]
    public void NoAggregateOnlyOrPurgeableTable_CarriesTheBlanketTriggerFromTheBaseline()
    {
        var notForbidden = RecordClassification.All.Where(e => e.HardDeletePolicy != HardDeletePolicy.Forbidden).Select(e => $"{e.Schema}.{e.Table}").ToHashSet();

        Assert.DoesNotContain(InitialAmarGramSql.TablesAtMigration, t => notForbidden.Contains($"{t.Schema}.{t.Table}"));
    }

    [Fact]
    public void TheFrozenMigrationList_HasNotBeenEdited()
    {
        // Pins InitialAmarGramSql.TablesAtMigration (gate fix 2026-10-12, re-pinned for the HO-P1 baseline): a later edit would silently change what an applied migration does.
        var canonical = string.Join('\n', InitialAmarGramSql.TablesAtMigration.Select(t => $"{t.Schema}.{t.Table}").OrderBy(s => s, StringComparer.Ordinal));
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(canonical))).ToLowerInvariant();

        Assert.Equal(88, InitialAmarGramSql.TablesAtMigration.Count);
        Assert.Equal(ExpectedHash, hash);
    }

    private const string ExpectedHash = "328655205685345ca9ce36b516fc06bcffd8b99824912ceb4b9f5a8fe1ad4628";
}

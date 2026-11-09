using AmarGram.Infrastructure.Fakes.Administration;

namespace AmarGram.Infrastructure.Tests.Fakes.Administration;

public sealed class InMemoryBusinessSettingsTests
{
    [Fact]
    public void An_unknown_key_returns_the_type_default()
    {
        var sut = new InMemoryBusinessSettings();

        Assert.Equal(0, sut.GetInt("inventory.defaultReorderPoint"));
        Assert.Equal(0m, sut.GetDecimal("ordering.depositPercent"));
        Assert.False(sut.GetBool("system.maintenanceMode"));
    }

    [Fact]
    public void A_configured_global_override_is_returned()
    {
        var sut = new InMemoryBusinessSettings(new Dictionary<string, object> { ["inventory.defaultReorderPoint"] = 10 });

        Assert.Equal(10, sut.GetInt("inventory.defaultReorderPoint"));
    }

    [Fact]
    public void A_branch_scoped_override_wins_over_the_global_one()
    {
        var branchId = Guid.NewGuid();
        var sut = new InMemoryBusinessSettings(new Dictionary<string, object>
        {
            ["ordering.depositPercent"] = 30m,
            [$"ordering.depositPercent:{branchId}"] = 50m
        });

        Assert.Equal(50m, sut.GetDecimal("ordering.depositPercent", branchId));
        Assert.Equal(30m, sut.GetDecimal("ordering.depositPercent"));
    }
}

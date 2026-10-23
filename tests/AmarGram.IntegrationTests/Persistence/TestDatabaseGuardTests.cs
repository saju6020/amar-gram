namespace AmarGram.IntegrationTests.Persistence;

/// <summary>Issues.md #2: no integration test may ever reach amargram_dev, the running app's database.</summary>
public sealed class TestDatabaseGuardTests
{
    [Theory]
    [InlineData("Host=localhost;Port=5432;Database=amargram_dev;Username=postgres;Password=postgres")]
    [InlineData("Host=localhost;Database=AMARGRAM_DEV;Username=postgres")]
    public void TheDevDatabase_IsRefused(string configured) =>
        Assert.Throws<InvalidOperationException>(() => TestDatabase.Resolve(configured));

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    public void NothingConfigured_UsesTheSharedTestDatabase(string? configured) =>
        Assert.Contains("Database=amargram_test", TestDatabase.Resolve(configured));

    [Fact]
    public void ABranchDatabase_IsUsedAsGiven()
    {
        const string branch = "Host=localhost;Database=amargram_brd;Username=postgres;Password=postgres";
        Assert.Equal(branch, TestDatabase.Resolve(branch));
    }

    [Fact]
    public void TheResolvedConnection_IsNeverTheDevDatabase() =>
        Assert.DoesNotContain(TestDatabase.DevDatabaseName, TestDatabase.ConnectionString, StringComparison.OrdinalIgnoreCase);
}

using AmarGram.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql;

namespace AmarGram.IntegrationTests.Persistence;

/// <summary>
/// SHP backlog row 44 -- HO-SHP-001 §12.1: the storefront filter indexes cover Active products only,
/// the protein-source index is gone (HO-P2 §1.3), and the "newest" index is DESC. Applies every migration to a
/// scratch database (same pattern as <c>CatSchemaIndexTests</c>) and reads <c>pg_indexes</c>.
/// </summary>
public sealed class ProductSchemaIndexTests : IAsyncLifetime
{
    private const string AdminConnectionString =
        "Host=localhost;Port=5432;Database=postgres;Username=postgres;Password=postgres";

    private readonly string _databaseName = $"amargram_product_index_test_{Guid.NewGuid():N}";

    private string ScratchConnectionString =>
        $"Host=localhost;Port=5432;Database={_databaseName};Username=postgres;Password=postgres";

    public async Task InitializeAsync()
    {
        await using var admin = new NpgsqlConnection(AdminConnectionString);
        await admin.OpenAsync();
        await using var create = new NpgsqlCommand($"""CREATE DATABASE "{_databaseName}" """, admin);
        await create.ExecuteNonQueryAsync();
    }

    public async Task DisposeAsync()
    {
        NpgsqlConnection.ClearAllPools();

        await using var admin = new NpgsqlConnection(AdminConnectionString);
        await admin.OpenAsync();

        await using (var terminate = new NpgsqlCommand(
            """SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = @name AND pid <> pg_backend_pid()""", admin))
        {
            terminate.Parameters.AddWithValue("name", _databaseName);
            await terminate.ExecuteNonQueryAsync();
        }

        await using var drop = new NpgsqlCommand($"""DROP DATABASE IF EXISTS "{_databaseName}" """, admin);
        await drop.ExecuteNonQueryAsync();
    }

    [Fact]
    public async Task EveryMigration_AppliedFromEmpty_ProducesTheSpecifiedProductFilterIndexes()
    {
        var options = new DbContextOptionsBuilder<AmarGramDbContext>().UseNpgsql(ScratchConnectionString).Options;
        await using (var context = new AmarGramDbContext(options))
            await context.GetService<IMigrator>().MigrateAsync();

        await using var connection = new NpgsqlConnection(ScratchConnectionString);
        await connection.OpenAsync();

        async Task<string> IndexDefAsync(string name)
        {
            await using var command = new NpgsqlCommand("SELECT indexdef FROM pg_indexes WHERE indexname = @name", connection);
            command.Parameters.AddWithValue("name", name);
            return await command.ExecuteScalarAsync() as string ?? "";
        }

        foreach (var name in new[] { "ix_product_brand", "ix_product_country_of_origin" })
        {
            var def = await IndexDefAsync(name);
            Assert.True(def.Length > 0, $"Expected index {name}.");
            Assert.Contains("WHERE", def);
            Assert.Contains("status", def);
        }

        Assert.Equal("", await IndexDefAsync("ix_product_food_protein_source")); // HO-P2 §1.3: the protein-source index is gone

        var newest = await IndexDefAsync("ix_product_first_published_on_desc");
        Assert.Contains("first_published_on DESC", newest);
    }
}

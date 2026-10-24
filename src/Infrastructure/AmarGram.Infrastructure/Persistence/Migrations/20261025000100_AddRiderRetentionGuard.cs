using AmarGram.Infrastructure.Retention;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AmarGram.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// HO-P4 BG-5 (C-ALL-1) -- <c>ordering.rider</c> is classified <c>Forbidden</c> (a shipment points at a rider, so it is deactivated, never deleted); a table classified
    /// Forbidden after <see cref="InitialAmarGramSql"/> attaches the two retention triggers in its own migration, with <see cref="RetentionGuardSql.AttachTo"/> (never an edit to
    /// that frozen list). The table itself comes from <c>InitialAmarGram</c>, which was regenerated with it. Hand-written: no model change, so no model snapshot of its own.
    /// </summary>
    [DbContext(typeof(AmarGramDbContext))]
    [Migration("20261025000100_AddRiderRetentionGuard")]
    public partial class AddRiderRetentionGuard : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(RetentionGuardSql.AttachTo("ordering", "rider"));
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(RetentionGuardSql.DetachFrom("ordering", "rider"));
        }
    }
}

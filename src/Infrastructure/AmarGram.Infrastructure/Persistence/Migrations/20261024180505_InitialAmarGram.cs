using System;
using System.Net;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace AmarGram.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InitialAmarGram : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "billing");

            migrationBuilder.EnsureSchema(
                name: "audit");

            migrationBuilder.EnsureSchema(
                name: "ops");

            migrationBuilder.EnsureSchema(
                name: "ordering");

            migrationBuilder.EnsureSchema(
                name: "inventory");

            migrationBuilder.EnsureSchema(
                name: "admin");

            migrationBuilder.EnsureSchema(
                name: "product");

            migrationBuilder.EnsureSchema(
                name: "account");

            migrationBuilder.EnsureSchema(
                name: "notify");

            migrationBuilder.EnsureSchema(
                name: "report");

            migrationBuilder.EnsureSchema(
                name: "files");

            // Hand-added (HO-P1 §5): payment.receipt_number defaults to nextval of this sequence, so it must exist before the table.
            // Every raw-SQL object of the baseline is in InitialAmarGramSql.
            migrationBuilder.CreateSequence<long>(
                name: "receipt_number_seq",
                schema: "billing");

            migrationBuilder.CreateTable(
                name: "accounting_export_run",
                schema: "billing",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    range_from = table.Column<DateOnly>(type: "date", nullable: false),
                    range_to = table.Column<DateOnly>(type: "date", nullable: false),
                    branch_id = table.Column<Guid>(type: "uuid", nullable: true),
                    invoice_count = table.Column<int>(type: "integer", nullable: false),
                    invoice_line_count = table.Column<int>(type: "integer", nullable: false),
                    payment_count = table.Column<int>(type: "integer", nullable: false),
                    allocation_count = table.Column<int>(type: "integer", nullable: false),
                    credit_note_count = table.Column<int>(type: "integer", nullable: false),
                    refund_count = table.Column<int>(type: "integer", nullable: false),
                    sha256 = table.Column<string>(type: "char(64)", nullable: false),
                    run_by = table.Column<Guid>(type: "uuid", nullable: false),
                    run_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Language = table.Column<string>(type: "text", nullable: true),
                    LastUpdatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tags = table.Column<string[]>(type: "text[]", nullable: true),
                    VerticalId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceId = table.Column<string>(type: "text", nullable: true),
                    IsMarkedToDelete = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_accounting_export_run", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "audit_entry",
                schema: "audit",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    EntityType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    EntityId = table.Column<Guid>(type: "uuid", nullable: false),
                    Action = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Reason = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    ActorUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    OccurredOn = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    BeforeValue = table.Column<string>(type: "text", nullable: true),
                    AfterValue = table.Column<string>(type: "text", nullable: true),
                    ip_address = table.Column<IPAddress>(type: "inet", nullable: true),
                    category = table.Column<int>(type: "integer", nullable: false),
                    correlation_id = table.Column<Guid>(type: "uuid", nullable: true),
                    is_recorded = table.Column<bool>(type: "boolean", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Language = table.Column<string>(type: "text", nullable: true),
                    LastUpdatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tags = table.Column<string[]>(type: "text[]", nullable: true),
                    VerticalId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceId = table.Column<string>(type: "text", nullable: true),
                    IsMarkedToDelete = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_audit_entry", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "backup_run",
                schema: "ops",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    kind = table.Column<string>(type: "text", nullable: false),
                    started_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    finished_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    succeeded = table.Column<bool>(type: "boolean", nullable: false),
                    repository = table.Column<string>(type: "text", nullable: false),
                    backup_label = table.Column<string>(type: "text", nullable: true),
                    size_bytes = table.Column<long>(type: "bigint", nullable: true),
                    wal_archived_until = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    error_summary = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_backup_run", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "bank_match",
                schema: "billing",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    statement_id = table.Column<Guid>(type: "uuid", nullable: false),
                    statement_line_id = table.Column<Guid>(type: "uuid", nullable: false),
                    payment_id = table.Column<Guid>(type: "uuid", nullable: false),
                    method = table.Column<int>(type: "integer", nullable: false),
                    matched_by = table.Column<Guid>(type: "uuid", nullable: false),
                    matched_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    unmatched_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    unmatched_by = table.Column<Guid>(type: "uuid", nullable: true),
                    unmatch_reason = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Language = table.Column<string>(type: "text", nullable: true),
                    LastUpdatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tags = table.Column<string[]>(type: "text[]", nullable: true),
                    VerticalId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceId = table.Column<string>(type: "text", nullable: true),
                    IsMarkedToDelete = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_bank_match", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "bank_statement",
                schema: "billing",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    branch_id = table.Column<Guid>(type: "uuid", nullable: false),
                    bank_account_label = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    period_from = table.Column<DateOnly>(type: "date", nullable: false),
                    period_to = table.Column<DateOnly>(type: "date", nullable: false),
                    source_file_name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    source_sha256 = table.Column<string>(type: "char(64)", nullable: false),
                    imported_by = table.Column<Guid>(type: "uuid", nullable: false),
                    imported_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Language = table.Column<string>(type: "text", nullable: true),
                    LastUpdatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tags = table.Column<string[]>(type: "text[]", nullable: true),
                    VerticalId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceId = table.Column<string>(type: "text", nullable: true),
                    IsMarkedToDelete = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_bank_statement", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "bank_transfer_account",
                schema: "ordering",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    account_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    account_number = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    bank_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    branch_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    routing_number = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Language = table.Column<string>(type: "text", nullable: true),
                    LastUpdatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tags = table.Column<string[]>(type: "text[]", nullable: true),
                    VerticalId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceId = table.Column<string>(type: "text", nullable: true),
                    IsMarkedToDelete = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_bank_transfer_account", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "billing_profile",
                schema: "billing",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    legal_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    tax_registration_number = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    address_lines = table.Column<string[]>(type: "text[]", nullable: false),
                    phone = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    email = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    invoice_footer = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Language = table.Column<string>(type: "text", nullable: true),
                    LastUpdatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tags = table.Column<string[]>(type: "text[]", nullable: true),
                    VerticalId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceId = table.Column<string>(type: "text", nullable: true),
                    IsMarkedToDelete = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_billing_profile", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "branch",
                schema: "admin",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    code = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    time_zone_id = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    address_line = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    phone_number = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    email = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Language = table.Column<string>(type: "text", nullable: true),
                    LastUpdatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tags = table.Column<string[]>(type: "text[]", nullable: true),
                    VerticalId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceId = table.Column<string>(type: "text", nullable: true),
                    IsMarkedToDelete = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_branch", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "branch_closure",
                schema: "admin",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    branch_id = table.Column<Guid>(type: "uuid", nullable: false),
                    starts_on = table.Column<DateOnly>(type: "date", nullable: false),
                    ends_on = table.Column<DateOnly>(type: "date", nullable: false),
                    kind = table.Column<int>(type: "integer", nullable: false),
                    reason = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    partial_from = table.Column<TimeOnly>(type: "time", nullable: true),
                    partial_to = table.Column<TimeOnly>(type: "time", nullable: true),
                    is_cancelled = table.Column<bool>(type: "boolean", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Language = table.Column<string>(type: "text", nullable: true),
                    LastUpdatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tags = table.Column<string[]>(type: "text[]", nullable: true),
                    VerticalId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceId = table.Column<string>(type: "text", nullable: true),
                    IsMarkedToDelete = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_branch_closure", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "business_settings",
                schema: "admin",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Language = table.Column<string>(type: "text", nullable: true),
                    LastUpdatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tags = table.Column<string[]>(type: "text[]", nullable: true),
                    VerticalId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceId = table.Column<string>(type: "text", nullable: true),
                    IsMarkedToDelete = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_business_settings", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "cart",
                schema: "ordering",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    owner_kind = table.Column<int>(type: "integer", nullable: false),
                    customer_id = table.Column<Guid>(type: "uuid", nullable: true),
                    guest_token_hash = table.Column<string>(type: "char(64)", nullable: true),
                    status = table.Column<int>(type: "integer", nullable: false),
                    merged_into_cart_id = table.Column<Guid>(type: "uuid", nullable: true),
                    last_activity_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Language = table.Column<string>(type: "text", nullable: true),
                    LastUpdatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tags = table.Column<string[]>(type: "text[]", nullable: true),
                    VerticalId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceId = table.Column<string>(type: "text", nullable: true),
                    IsMarkedToDelete = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_cart", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "cash_up",
                schema: "billing",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    branch_id = table.Column<Guid>(type: "uuid", nullable: false),
                    business_date = table.Column<DateOnly>(type: "date", nullable: false),
                    status = table.Column<int>(type: "integer", nullable: false),
                    counted_cash = table.Column<decimal>(type: "numeric(12,2)", nullable: true),
                    counted_by = table.Column<Guid>(type: "uuid", nullable: true),
                    counted_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    variance = table.Column<decimal>(type: "numeric(12,2)", nullable: true),
                    explanation = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    closed_by = table.Column<Guid>(type: "uuid", nullable: true),
                    closed_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    expected_cash_total = table.Column<decimal>(type: "numeric(12,2)", nullable: true),
                    expected_cash_count = table.Column<int>(type: "integer", nullable: true),
                    expected_card_total = table.Column<decimal>(type: "numeric(12,2)", nullable: true),
                    expected_card_count = table.Column<int>(type: "integer", nullable: true),
                    expected_transfer_total = table.Column<decimal>(type: "numeric(12,2)", nullable: true),
                    expected_transfer_count = table.Column<int>(type: "integer", nullable: true),
                    expected_cash_refunds = table.Column<decimal>(type: "numeric(12,2)", nullable: true),
                    expected_cash_reversals = table.Column<decimal>(type: "numeric(12,2)", nullable: true),
                    expected_carried_in = table.Column<decimal>(type: "numeric(12,2)", nullable: true),
                    expected_cash = table.Column<decimal>(type: "numeric(12,2)", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Language = table.Column<string>(type: "text", nullable: true),
                    LastUpdatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tags = table.Column<string[]>(type: "text[]", nullable: true),
                    VerticalId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceId = table.Column<string>(type: "text", nullable: true),
                    IsMarkedToDelete = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_cash_up", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "charge",
                schema: "billing",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    customer_id = table.Column<Guid>(type: "uuid", nullable: false),
                    branch_id = table.Column<Guid>(type: "uuid", nullable: false),
                    business_line = table.Column<int>(type: "integer", nullable: false),
                    item_kind = table.Column<int>(type: "integer", nullable: false),
                    source_kind = table.Column<int>(type: "integer", nullable: false),
                    source_id = table.Column<Guid>(type: "uuid", nullable: false),
                    source_line_ref = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    description = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    quantity = table.Column<decimal>(type: "numeric(10,3)", nullable: false),
                    unit_price_amount = table.Column<decimal>(type: "numeric(12,2)", nullable: false),
                    line_discount_amount = table.Column<decimal>(type: "numeric(12,2)", nullable: false),
                    currency_code = table.Column<string>(type: "char(3)", nullable: false),
                    tax_class_id = table.Column<Guid>(type: "uuid", nullable: false),
                    service_date = table.Column<DateOnly>(type: "date", nullable: false),
                    reporting_tag = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    status = table.Column<int>(type: "integer", nullable: false),
                    recorded_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    recorded_by = table.Column<Guid>(type: "uuid", nullable: false),
                    voided_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    voided_by = table.Column<Guid>(type: "uuid", nullable: true),
                    void_reason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Language = table.Column<string>(type: "text", nullable: true),
                    LastUpdatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tags = table.Column<string[]>(type: "text[]", nullable: true),
                    VerticalId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceId = table.Column<string>(type: "text", nullable: true),
                    IsMarkedToDelete = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_charge", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "cod_remittance",
                schema: "billing",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    branch_id = table.Column<Guid>(type: "uuid", nullable: false),
                    courier_code = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    received_on = table.Column<DateOnly>(type: "date", nullable: false),
                    amount = table.Column<decimal>(type: "numeric(12,2)", nullable: false),
                    currency_code = table.Column<string>(type: "char(3)", nullable: false),
                    method = table.Column<int>(type: "integer", nullable: false),
                    reference = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    recorded_by = table.Column<Guid>(type: "uuid", nullable: false),
                    recorded_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Language = table.Column<string>(type: "text", nullable: true),
                    LastUpdatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tags = table.Column<string[]>(type: "text[]", nullable: true),
                    VerticalId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceId = table.Column<string>(type: "text", nullable: true),
                    IsMarkedToDelete = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_cod_remittance", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "consignment",
                schema: "inventory",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    reference = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    branch_id = table.Column<Guid>(type: "uuid", nullable: false),
                    origin_country_code = table.Column<string>(type: "character(2)", fixedLength: true, maxLength: 2, nullable: false),
                    shipment_reference = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    purchase_order_ids = table.Column<Guid[]>(type: "uuid[]", nullable: false),
                    import_permit_number = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: true),
                    health_certificate_number = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: true),
                    customs_declaration_number = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: true),
                    expected_arrival_on = table.Column<DateOnly>(type: "date", nullable: true),
                    status = table.Column<int>(type: "integer", nullable: false),
                    cancellation_reason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    cleared_on = table.Column<DateOnly>(type: "date", nullable: true),
                    allocated_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    allocated_by = table.Column<Guid>(type: "uuid", nullable: true),
                    costs_changed_since_allocation = table.Column<bool>(type: "boolean", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Language = table.Column<string>(type: "text", nullable: true),
                    LastUpdatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tags = table.Column<string[]>(type: "text[]", nullable: true),
                    VerticalId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceId = table.Column<string>(type: "text", nullable: true),
                    IsMarkedToDelete = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_consignment", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "content_item",
                schema: "admin",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    kind = table.Column<int>(type: "integer", nullable: false),
                    slug = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    draft_body = table.Column<string>(type: "character varying(50000)", maxLength: 50000, nullable: false),
                    published_body = table.Column<string>(type: "character varying(50000)", maxLength: 50000, nullable: true),
                    published_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    status = table.Column<int>(type: "integer", nullable: false),
                    placement = table.Column<int>(type: "integer", nullable: true),
                    link_url = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    visible_from = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    visible_to = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    sort_order = table.Column<int>(type: "integer", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Language = table.Column<string>(type: "text", nullable: true),
                    LastUpdatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tags = table.Column<string[]>(type: "text[]", nullable: true),
                    VerticalId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceId = table.Column<string>(type: "text", nullable: true),
                    IsMarkedToDelete = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_content_item", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "courier",
                schema: "ordering",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    tracking_url_template = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    supports_cod = table.Column<bool>(type: "boolean", nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Language = table.Column<string>(type: "text", nullable: true),
                    LastUpdatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tags = table.Column<string[]>(type: "text[]", nullable: true),
                    VerticalId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceId = table.Column<string>(type: "text", nullable: true),
                    IsMarkedToDelete = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_courier", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "credit_note",
                schema: "billing",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    invoice_id = table.Column<Guid>(type: "uuid", nullable: false),
                    branch_id = table.Column<Guid>(type: "uuid", nullable: false),
                    customer_id = table.Column<Guid>(type: "uuid", nullable: false),
                    currency_code = table.Column<string>(type: "char(3)", nullable: false),
                    number = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    financial_year = table.Column<string>(type: "character varying(9)", maxLength: 9, nullable: false),
                    sequence_number = table.Column<long>(type: "bigint", nullable: false),
                    kind = table.Column<int>(type: "integer", nullable: false),
                    reason = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    net_total = table.Column<decimal>(type: "numeric(12,2)", nullable: false),
                    tax_total = table.Column<decimal>(type: "numeric(12,2)", nullable: false),
                    total = table.Column<decimal>(type: "numeric(12,2)", nullable: false),
                    released_to_customer_credit = table.Column<decimal>(type: "numeric(12,2)", nullable: false),
                    issued_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    issue_date = table.Column<DateOnly>(type: "date", nullable: false),
                    issued_by = table.Column<Guid>(type: "uuid", nullable: false),
                    idempotency_key = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Language = table.Column<string>(type: "text", nullable: true),
                    LastUpdatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tags = table.Column<string[]>(type: "text[]", nullable: true),
                    VerticalId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceId = table.Column<string>(type: "text", nullable: true),
                    IsMarkedToDelete = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_credit_note", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "customer_account",
                schema: "account",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    full_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    mobile_number = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    email_address = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    password_hash = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    password_algorithm = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    password_set_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    failed_login_count = table.Column<int>(type: "integer", nullable: false),
                    locked_until = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    last_failed_login_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    security_stamp = table.Column<Guid>(type: "uuid", nullable: false),
                    registration_channel = table.Column<int>(type: "integer", nullable: false),
                    status = table.Column<int>(type: "integer", nullable: false),
                    additional_phone_numbers = table.Column<string[]>(type: "character varying(20)[]", nullable: false),
                    last_successful_login_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    merged_into_customer_id = table.Column<Guid>(type: "uuid", nullable: true),
                    merged_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    anonymised_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    last_personal_data_export_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Language = table.Column<string>(type: "text", nullable: true),
                    LastUpdatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tags = table.Column<string[]>(type: "text[]", nullable: true),
                    VerticalId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceId = table.Column<string>(type: "text", nullable: true),
                    IsMarkedToDelete = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_customer_account", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "customer_address_book",
                schema: "account",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    default_address_id = table.Column<Guid>(type: "uuid", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Language = table.Column<string>(type: "text", nullable: true),
                    LastUpdatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tags = table.Column<string[]>(type: "text[]", nullable: true),
                    VerticalId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceId = table.Column<string>(type: "text", nullable: true),
                    IsMarkedToDelete = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_customer_address_book", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "customer_notification_preferences",
                schema: "account",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    preferred_channel = table.Column<int>(type: "integer", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Language = table.Column<string>(type: "text", nullable: true),
                    LastUpdatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tags = table.Column<string[]>(type: "text[]", nullable: true),
                    VerticalId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceId = table.Column<string>(type: "text", nullable: true),
                    IsMarkedToDelete = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_customer_notification_preferences", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "customer_session",
                schema: "account",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    customer_account_id = table.Column<Guid>(type: "uuid", nullable: false),
                    token_hash = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    issued_for_security_stamp = table.Column<Guid>(type: "uuid", nullable: false),
                    issued_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    expires_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    ended_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    end_reason = table.Column<int>(type: "integer", nullable: true),
                    ip_address = table.Column<string>(type: "character varying(45)", maxLength: 45, nullable: true),
                    user_agent = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    csrf_token_hash = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Language = table.Column<string>(type: "text", nullable: true),
                    LastUpdatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tags = table.Column<string[]>(type: "text[]", nullable: true),
                    VerticalId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceId = table.Column<string>(type: "text", nullable: true),
                    IsMarkedToDelete = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_customer_session", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "delivery_zone",
                schema: "ordering",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    branch_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    priority = table.Column<int>(type: "integer", nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    cod_enabled = table.Column<bool>(type: "boolean", nullable: false),
                    cod_max_order_value = table.Column<decimal>(type: "numeric(12,2)", nullable: true),
                    currency_code = table.Column<string>(type: "char(3)", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Language = table.Column<string>(type: "text", nullable: true),
                    LastUpdatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tags = table.Column<string[]>(type: "text[]", nullable: true),
                    VerticalId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceId = table.Column<string>(type: "text", nullable: true),
                    IsMarkedToDelete = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_delivery_zone", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "discount_code",
                schema: "ordering",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    code = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    description = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    kind = table.Column<int>(type: "integer", nullable: false),
                    percent = table.Column<decimal>(type: "numeric(5,2)", nullable: true),
                    amount = table.Column<decimal>(type: "numeric(12,2)", nullable: true),
                    currency_code = table.Column<string>(type: "char(3)", nullable: false),
                    minimum_spend = table.Column<decimal>(type: "numeric(12,2)", nullable: true),
                    scope = table.Column<int>(type: "integer", nullable: false),
                    product_ids = table.Column<string>(type: "jsonb", nullable: false),
                    category_ids = table.Column<string>(type: "jsonb", nullable: false),
                    first_order_only = table.Column<bool>(type: "boolean", nullable: false),
                    usage_limit = table.Column<int>(type: "integer", nullable: true),
                    per_customer_limit = table.Column<int>(type: "integer", nullable: true),
                    valid_from = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    valid_to = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    times_redeemed = table.Column<int>(type: "integer", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Language = table.Column<string>(type: "text", nullable: true),
                    LastUpdatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tags = table.Column<string[]>(type: "text[]", nullable: true),
                    VerticalId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceId = table.Column<string>(type: "text", nullable: true),
                    IsMarkedToDelete = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_discount_code", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "document_number_series",
                schema: "billing",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    branch_id = table.Column<Guid>(type: "uuid", nullable: false),
                    financial_year = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    document_kind = table.Column<int>(type: "integer", nullable: false),
                    next_sequence = table.Column<long>(type: "bigint", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Language = table.Column<string>(type: "text", nullable: true),
                    LastUpdatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tags = table.Column<string[]>(type: "text[]", nullable: true),
                    VerticalId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceId = table.Column<string>(type: "text", nullable: true),
                    IsMarkedToDelete = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_document_number_series", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "erasure_request",
                schema: "ops",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    requested_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    source = table.Column<int>(type: "integer", nullable: false),
                    status = table.Column<int>(type: "integer", nullable: false),
                    completed_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Language = table.Column<string>(type: "text", nullable: true),
                    LastUpdatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tags = table.Column<string[]>(type: "text[]", nullable: true),
                    VerticalId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceId = table.Column<string>(type: "text", nullable: true),
                    IsMarkedToDelete = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_erasure_request", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "goods_receipt",
                schema: "inventory",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    number = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    branch_id = table.Column<Guid>(type: "uuid", nullable: false),
                    supplier_id = table.Column<Guid>(type: "uuid", nullable: true),
                    purchase_order_id = table.Column<Guid>(type: "uuid", nullable: true),
                    consignment_id = table.Column<Guid>(type: "uuid", nullable: true),
                    received_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    received_by = table.Column<Guid>(type: "uuid", nullable: false),
                    delivery_reference = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Language = table.Column<string>(type: "text", nullable: true),
                    LastUpdatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tags = table.Column<string[]>(type: "text[]", nullable: true),
                    VerticalId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceId = table.Column<string>(type: "text", nullable: true),
                    IsMarkedToDelete = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_goods_receipt", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "idempotency_record",
                schema: "ops",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    scope = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    key = table.Column<Guid>(type: "uuid", nullable: false),
                    request_hash = table.Column<string>(type: "char(64)", nullable: false),
                    state = table.Column<int>(type: "integer", nullable: false),
                    response_status = table.Column<int>(type: "integer", nullable: true),
                    response_content_type = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    response_body = table.Column<byte[]>(type: "bytea", nullable: true),
                    created_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    completed_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_idempotency_record", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "inbound_webhook_receipt",
                schema: "ops",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    provider = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    event_id = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    received_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_inbound_webhook_receipt", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "invoice",
                schema: "billing",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    branch_id = table.Column<Guid>(type: "uuid", nullable: false),
                    customer_id = table.Column<Guid>(type: "uuid", nullable: false),
                    status = table.Column<int>(type: "integer", nullable: false),
                    currency_code = table.Column<string>(type: "char(3)", nullable: false),
                    number = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    financial_year = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    sequence_number = table.Column<long>(type: "bigint", nullable: true),
                    issued_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    issue_date = table.Column<DateOnly>(type: "date", nullable: true),
                    due_on = table.Column<DateOnly>(type: "date", nullable: true),
                    seller_legal_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    seller_tax_registration_number = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    seller_address_text = table.Column<string>(type: "character varying(1100)", maxLength: 1100, nullable: true),
                    seller_phone = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    seller_email = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    seller_invoice_footer = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    seller_bank_accounts_json = table.Column<string>(type: "text", nullable: true),
                    bill_to_full_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    bill_to_mobile = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    bill_to_email = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    bill_to_address_text = table.Column<string>(type: "character varying(600)", maxLength: 600, nullable: true),
                    net_total = table.Column<decimal>(type: "numeric(12,2)", nullable: false),
                    discount_total = table.Column<decimal>(type: "numeric(12,2)", nullable: false),
                    tax_total = table.Column<decimal>(type: "numeric(12,2)", nullable: false),
                    total = table.Column<decimal>(type: "numeric(12,2)", nullable: false),
                    paid_total = table.Column<decimal>(type: "numeric(12,2)", nullable: false),
                    credited_total = table.Column<decimal>(type: "numeric(12,2)", nullable: false),
                    loyalty_points = table.Column<int>(type: "integer", nullable: true),
                    loyalty_value = table.Column<decimal>(type: "numeric(12,2)", nullable: true),
                    loyalty_entry_id = table.Column<Guid>(type: "uuid", nullable: true),
                    corrects_invoice_id = table.Column<Guid>(type: "uuid", nullable: true),
                    corrects_credit_note_id = table.Column<Guid>(type: "uuid", nullable: true),
                    notes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    drafted_by = table.Column<Guid>(type: "uuid", nullable: false),
                    issued_by = table.Column<Guid>(type: "uuid", nullable: true),
                    issue_idempotency_key = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Language = table.Column<string>(type: "text", nullable: true),
                    LastUpdatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tags = table.Column<string[]>(type: "text[]", nullable: true),
                    VerticalId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceId = table.Column<string>(type: "text", nullable: true),
                    IsMarkedToDelete = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_invoice", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "leave_request",
                schema: "admin",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    staff_account_id = table.Column<Guid>(type: "uuid", nullable: false),
                    starts_on = table.Column<DateOnly>(type: "date", nullable: false),
                    ends_on = table.Column<DateOnly>(type: "date", nullable: false),
                    kind = table.Column<int>(type: "integer", nullable: false),
                    note = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    status = table.Column<int>(type: "integer", nullable: false),
                    decided_by = table.Column<Guid>(type: "uuid", nullable: true),
                    decided_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    decision_note = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Language = table.Column<string>(type: "text", nullable: true),
                    LastUpdatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tags = table.Column<string[]>(type: "text[]", nullable: true),
                    VerticalId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceId = table.Column<string>(type: "text", nullable: true),
                    IsMarkedToDelete = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_leave_request", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "loyalty_account",
                schema: "billing",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    balance = table.Column<int>(type: "integer", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Language = table.Column<string>(type: "text", nullable: true),
                    LastUpdatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tags = table.Column<string[]>(type: "text[]", nullable: true),
                    VerticalId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceId = table.Column<string>(type: "text", nullable: true),
                    IsMarkedToDelete = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_loyalty_account", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "loyalty_entry",
                schema: "billing",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    customer_id = table.Column<Guid>(type: "uuid", nullable: false),
                    kind = table.Column<int>(type: "integer", nullable: false),
                    points = table.Column<int>(type: "integer", nullable: false),
                    invoice_id = table.Column<Guid>(type: "uuid", nullable: true),
                    credit_note_id = table.Column<Guid>(type: "uuid", nullable: true),
                    source_customer_id = table.Column<Guid>(type: "uuid", nullable: true),
                    shortfall = table.Column<int>(type: "integer", nullable: false),
                    idempotent_source = table.Column<bool>(type: "boolean", nullable: false),
                    occurred_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Language = table.Column<string>(type: "text", nullable: true),
                    LastUpdatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tags = table.Column<string[]>(type: "text[]", nullable: true),
                    VerticalId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceId = table.Column<string>(type: "text", nullable: true),
                    IsMarkedToDelete = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_loyalty_entry", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "notification",
                schema: "notify",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    request_id = table.Column<Guid>(type: "uuid", nullable: false),
                    template_key = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    template_version = table.Column<int>(type: "integer", nullable: false),
                    locale = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    category = table.Column<int>(type: "integer", nullable: false),
                    urgency = table.Column<int>(type: "integer", nullable: false),
                    contains_secret = table.Column<bool>(type: "boolean", nullable: false),
                    recipient_kind = table.Column<int>(type: "integer", nullable: false),
                    recipient_id = table.Column<Guid>(type: "uuid", nullable: false),
                    subject_kind = table.Column<int>(type: "integer", nullable: true),
                    subject_id = table.Column<Guid>(type: "uuid", nullable: true),
                    subject_ref = table.Column<Guid>(type: "uuid", nullable: true),
                    subject_due_on = table.Column<DateOnly>(type: "date", nullable: true),
                    subject_stamp = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    attachment_kind = table.Column<int>(type: "integer", nullable: true),
                    attachment_id = table.Column<Guid>(type: "uuid", nullable: true),
                    branch_id = table.Column<Guid>(type: "uuid", nullable: true),
                    channel = table.Column<int>(type: "integer", nullable: false),
                    destination = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    subject = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    title = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    body = table.Column<string>(type: "character varying(10000)", maxLength: 10000, nullable: false),
                    html_body = table.Column<string>(type: "text", nullable: true),
                    link_path = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    status = table.Column<int>(type: "integer", nullable: false),
                    not_before = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    deferred_for_quiet_hours = table.Column<bool>(type: "boolean", nullable: false),
                    not_after = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    next_attempt_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    lease_expires_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    attempt_count = table.Column<int>(type: "integer", nullable: false),
                    claim_count = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    fallback_from_id = table.Column<Guid>(type: "uuid", nullable: true),
                    resend_of_id = table.Column<Guid>(type: "uuid", nullable: true),
                    resent_by = table.Column<Guid>(type: "uuid", nullable: true),
                    resend_ordinal = table.Column<int>(type: "integer", nullable: true),
                    unsubscribe_token_hash = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    unsubscribe_link = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    read_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    created_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    sent_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    closed_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    close_reason = table.Column<int>(type: "integer", nullable: true),
                    redacted_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    redacted_reason = table.Column<int>(type: "integer", nullable: true),
                    anonymised_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Language = table.Column<string>(type: "text", nullable: true),
                    LastUpdatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tags = table.Column<string[]>(type: "text[]", nullable: true),
                    VerticalId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceId = table.Column<string>(type: "text", nullable: true),
                    IsMarkedToDelete = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_notification", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "notification_request",
                schema: "notify",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    template_key = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    recipient_kind = table.Column<int>(type: "integer", nullable: false),
                    recipient_id = table.Column<Guid>(type: "uuid", nullable: false),
                    variables = table.Column<string>(type: "jsonb", nullable: false),
                    channel_hint = table.Column<int>(type: "integer", nullable: true),
                    subject_kind = table.Column<int>(type: "integer", nullable: true),
                    subject_id = table.Column<Guid>(type: "uuid", nullable: true),
                    subject_ref = table.Column<Guid>(type: "uuid", nullable: true),
                    subject_due_on = table.Column<DateOnly>(type: "date", nullable: true),
                    branch_id = table.Column<Guid>(type: "uuid", nullable: true),
                    deduplication_key = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    not_after = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    send_after = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    subject_stamp = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    attachment_kind = table.Column<int>(type: "integer", nullable: true),
                    attachment_id = table.Column<Guid>(type: "uuid", nullable: true),
                    contains_secret = table.Column<bool>(type: "boolean", nullable: false),
                    status = table.Column<int>(type: "integer", nullable: false),
                    suppression_reason = table.Column<int>(type: "integer", nullable: true),
                    requested_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    processed_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    requested_by = table.Column<Guid>(type: "uuid", nullable: false),
                    correlation_id = table.Column<Guid>(type: "uuid", nullable: false),
                    variables_redacted_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    attempt_count = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    last_attempt_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Language = table.Column<string>(type: "text", nullable: true),
                    LastUpdatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tags = table.Column<string[]>(type: "text[]", nullable: true),
                    VerticalId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceId = table.Column<string>(type: "text", nullable: true),
                    IsMarkedToDelete = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_notification_request", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "notification_template",
                schema: "notify",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    key = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    locale = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    content_version = table.Column<int>(type: "integer", nullable: false),
                    last_edited_by = table.Column<Guid>(type: "uuid", nullable: false),
                    last_edited_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Language = table.Column<string>(type: "text", nullable: true),
                    LastUpdatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tags = table.Column<string[]>(type: "text[]", nullable: true),
                    VerticalId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceId = table.Column<string>(type: "text", nullable: true),
                    IsMarkedToDelete = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_notification_template", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "order_refund",
                schema: "ordering",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    order_id = table.Column<Guid>(type: "uuid", nullable: false),
                    return_request_id = table.Column<Guid>(type: "uuid", nullable: true),
                    method = table.Column<int>(type: "integer", nullable: false),
                    amount = table.Column<decimal>(type: "numeric(12,2)", nullable: false),
                    currency_code = table.Column<string>(type: "char(3)", nullable: false),
                    reference = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    reason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    issued_by = table.Column<Guid>(type: "uuid", nullable: false),
                    issued_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    credit_note_id = table.Column<Guid>(type: "uuid", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Language = table.Column<string>(type: "text", nullable: true),
                    LastUpdatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tags = table.Column<string[]>(type: "text[]", nullable: true),
                    VerticalId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceId = table.Column<string>(type: "text", nullable: true),
                    IsMarkedToDelete = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_order_refund", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "password_reset_token",
                schema: "account",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    account_kind = table.Column<int>(type: "integer", nullable: false),
                    account_id = table.Column<Guid>(type: "uuid", nullable: false),
                    token_hash = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    issued_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    expires_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    issued_for_security_stamp = table.Column<Guid>(type: "uuid", nullable: false),
                    channel = table.Column<int>(type: "integer", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Language = table.Column<string>(type: "text", nullable: true),
                    LastUpdatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tags = table.Column<string[]>(type: "text[]", nullable: true),
                    VerticalId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceId = table.Column<string>(type: "text", nullable: true),
                    IsMarkedToDelete = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_password_reset_token", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "payment",
                schema: "billing",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    branch_id = table.Column<Guid>(type: "uuid", nullable: false),
                    customer_id = table.Column<Guid>(type: "uuid", nullable: false),
                    method = table.Column<int>(type: "integer", nullable: false),
                    amount = table.Column<decimal>(type: "numeric(12,2)", nullable: false),
                    currency_code = table.Column<string>(type: "char(3)", nullable: false),
                    received_on = table.Column<DateOnly>(type: "date", nullable: false),
                    external_reference = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    collector_kind = table.Column<int>(type: "integer", nullable: true),
                    collector_staff_account_id = table.Column<Guid>(type: "uuid", nullable: true),
                    collector_courier_code = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    collector_courier_name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    earmark_kind = table.Column<int>(type: "integer", nullable: true),
                    earmark_source_id = table.Column<Guid>(type: "uuid", nullable: true),
                    earmark_label = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    earmark_released_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    earmark_released_by = table.Column<Guid>(type: "uuid", nullable: true),
                    earmark_release_reason = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    status = table.Column<int>(type: "integer", nullable: false),
                    recorded_by = table.Column<Guid>(type: "uuid", nullable: false),
                    recorded_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    notes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    approved_by = table.Column<Guid>(type: "uuid", nullable: true),
                    approved_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    rejected_by = table.Column<Guid>(type: "uuid", nullable: true),
                    rejected_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    rejection_reason = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    accepted_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    business_date = table.Column<DateOnly>(type: "date", nullable: true),
                    receipt_number = table.Column<long>(type: "bigint", nullable: true, defaultValueSql: "nextval('billing.receipt_number_seq')"),
                    reversed_by = table.Column<Guid>(type: "uuid", nullable: true),
                    reversed_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    reversal_reason = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    reversal_business_date = table.Column<DateOnly>(type: "date", nullable: true),
                    refunded_total = table.Column<decimal>(type: "numeric(12,2)", nullable: false),
                    idempotency_key = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    approval_waiver_reason = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Language = table.Column<string>(type: "text", nullable: true),
                    LastUpdatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tags = table.Column<string[]>(type: "text[]", nullable: true),
                    VerticalId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceId = table.Column<string>(type: "text", nullable: true),
                    IsMarkedToDelete = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_payment", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "policy_acceptance",
                schema: "admin",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    customer_account_id = table.Column<Guid>(type: "uuid", nullable: false),
                    policy_key = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    version_number = table.Column<int>(type: "integer", nullable: false),
                    accepted_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    ip_address = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Language = table.Column<string>(type: "text", nullable: true),
                    LastUpdatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tags = table.Column<string[]>(type: "text[]", nullable: true),
                    VerticalId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceId = table.Column<string>(type: "text", nullable: true),
                    IsMarkedToDelete = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_policy_acceptance", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "policy_document",
                schema: "admin",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    key = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    requires_acceptance = table.Column<bool>(type: "boolean", nullable: false),
                    current_version_number = table.Column<int>(type: "integer", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Language = table.Column<string>(type: "text", nullable: true),
                    LastUpdatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tags = table.Column<string[]>(type: "text[]", nullable: true),
                    VerticalId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceId = table.Column<string>(type: "text", nullable: true),
                    IsMarkedToDelete = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_policy_document", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "policy_version",
                schema: "admin",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    policy_key = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    version_number = table.Column<int>(type: "integer", nullable: false),
                    body = table.Column<string>(type: "character varying(50000)", maxLength: 50000, nullable: false),
                    published_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    change_summary = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    requires_acceptance = table.Column<bool>(type: "boolean", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Language = table.Column<string>(type: "text", nullable: true),
                    LastUpdatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tags = table.Column<string[]>(type: "text[]", nullable: true),
                    VerticalId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceId = table.Column<string>(type: "text", nullable: true),
                    IsMarkedToDelete = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_policy_version", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "product",
                schema: "product",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    kind = table.Column<int>(type: "integer", nullable: false),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    brand = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    description = table.Column<string>(type: "character varying(5000)", maxLength: 5000, nullable: false),
                    category = table.Column<int>(type: "integer", nullable: false),
                    subcategory = table.Column<int>(type: "integer", nullable: true),
                    slug = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    status = table.Column<int>(type: "integer", nullable: false),
                    first_published_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    tax_class_id = table.Column<Guid>(type: "uuid", nullable: false),
                    country_of_origin_code = table.Column<string>(type: "character(2)", fixedLength: true, maxLength: 2, nullable: true),
                    district_of_origin = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: true),
                    is_expiry_tracked = table.Column<bool>(type: "boolean", nullable: false),
                    listed_on_storefront = table.Column<bool>(type: "boolean", nullable: false),
                    search_text = table.Column<string>(type: "text", nullable: false),
                    food_ingredient_list = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    food_storage_instructions = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    food_shelf_life = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    food_net_weight = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    food_allergens = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    food_organic_certifier = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    food_organic_certificate_number = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    tags = table.Column<string[]>(type: "text[]", nullable: false),
                    certifications = table.Column<int[]>(type: "integer[]", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Language = table.Column<string>(type: "text", nullable: true),
                    LastUpdatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    VerticalId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceId = table.Column<string>(type: "text", nullable: true),
                    IsMarkedToDelete = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_product", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "product_review",
                schema: "product",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    product_id = table.Column<Guid>(type: "uuid", nullable: false),
                    sku_id = table.Column<Guid>(type: "uuid", nullable: false),
                    customer_id = table.Column<Guid>(type: "uuid", nullable: false),
                    rating = table.Column<int>(type: "integer", nullable: false),
                    title = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    body = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    status = table.Column<int>(type: "integer", nullable: false),
                    submitted_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    moderated_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    moderated_by = table.Column<Guid>(type: "uuid", nullable: true),
                    rejection_reason = table.Column<int>(type: "integer", nullable: true),
                    moderation_note = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Language = table.Column<string>(type: "text", nullable: true),
                    LastUpdatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tags = table.Column<string[]>(type: "text[]", nullable: true),
                    VerticalId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceId = table.Column<string>(type: "text", nullable: true),
                    IsMarkedToDelete = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_product_review", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "product_sales_stats",
                schema: "product",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    units_sold_90d = table.Column<int>(type: "integer", nullable: false),
                    as_of = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Language = table.Column<string>(type: "text", nullable: true),
                    LastUpdatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tags = table.Column<string[]>(type: "text[]", nullable: true),
                    VerticalId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceId = table.Column<string>(type: "text", nullable: true),
                    IsMarkedToDelete = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_product_sales_stats", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "product_storage_profile",
                schema: "inventory",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    condition = table.Column<int>(type: "integer", nullable: false),
                    min_temperature_c = table.Column<decimal>(type: "numeric(4,1)", precision: 4, scale: 1, nullable: true),
                    max_temperature_c = table.Column<decimal>(type: "numeric(4,1)", precision: 4, scale: 1, nullable: true),
                    handling_notes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Language = table.Column<string>(type: "text", nullable: true),
                    LastUpdatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tags = table.Column<string[]>(type: "text[]", nullable: true),
                    VerticalId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceId = table.Column<string>(type: "text", nullable: true),
                    IsMarkedToDelete = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_product_storage_profile", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "purchase_order",
                schema: "inventory",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    number = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    supplier_id = table.Column<Guid>(type: "uuid", nullable: false),
                    branch_id = table.Column<Guid>(type: "uuid", nullable: false),
                    deliver_to_location_id = table.Column<Guid>(type: "uuid", nullable: false),
                    currency_code = table.Column<string>(type: "character(3)", fixedLength: true, maxLength: 3, nullable: false),
                    expected_delivery_on = table.Column<DateOnly>(type: "date", nullable: false),
                    notes = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    status = table.Column<int>(type: "integer", nullable: false),
                    status_reason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    issued_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Language = table.Column<string>(type: "text", nullable: true),
                    LastUpdatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tags = table.Column<string[]>(type: "text[]", nullable: true),
                    VerticalId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceId = table.Column<string>(type: "text", nullable: true),
                    IsMarkedToDelete = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_purchase_order", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "reconciliation_issue",
                schema: "ordering",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    order_id = table.Column<Guid>(type: "uuid", nullable: true),
                    branch_id = table.Column<Guid>(type: "uuid", nullable: true),
                    kind = table.Column<int>(type: "integer", nullable: false),
                    payment_method = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    amount = table.Column<decimal>(type: "numeric(12,2)", nullable: false),
                    currency_code = table.Column<string>(type: "char(3)", nullable: false),
                    payment_reference = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    payment_received_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    error_summary = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    correlation_id = table.Column<Guid>(type: "uuid", nullable: false),
                    raised_by = table.Column<Guid>(type: "uuid", nullable: false),
                    raised_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    status = table.Column<int>(type: "integer", nullable: false),
                    resolved_by = table.Column<Guid>(type: "uuid", nullable: true),
                    resolved_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    resolution_note = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Language = table.Column<string>(type: "text", nullable: true),
                    LastUpdatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tags = table.Column<string[]>(type: "text[]", nullable: true),
                    VerticalId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceId = table.Column<string>(type: "text", nullable: true),
                    IsMarkedToDelete = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_reconciliation_issue", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "refund",
                schema: "billing",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    payment_id = table.Column<Guid>(type: "uuid", nullable: false),
                    credit_note_id = table.Column<Guid>(type: "uuid", nullable: true),
                    branch_id = table.Column<Guid>(type: "uuid", nullable: false),
                    customer_id = table.Column<Guid>(type: "uuid", nullable: false),
                    method = table.Column<int>(type: "integer", nullable: false),
                    amount = table.Column<decimal>(type: "numeric(12,2)", nullable: false),
                    currency_code = table.Column<string>(type: "char(3)", nullable: false),
                    reference = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    reason = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    issued_by = table.Column<Guid>(type: "uuid", nullable: false),
                    issued_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    business_date = table.Column<DateOnly>(type: "date", nullable: false),
                    idempotency_key = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Language = table.Column<string>(type: "text", nullable: true),
                    LastUpdatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tags = table.Column<string[]>(type: "text[]", nullable: true),
                    VerticalId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceId = table.Column<string>(type: "text", nullable: true),
                    IsMarkedToDelete = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_refund", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "reorder_policy",
                schema: "inventory",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    sku_id = table.Column<Guid>(type: "uuid", nullable: false),
                    location_id = table.Column<Guid>(type: "uuid", nullable: false),
                    reorder_point = table.Column<decimal>(type: "numeric(12,3)", precision: 12, scale: 3, nullable: false),
                    reorder_quantity = table.Column<decimal>(type: "numeric(12,3)", precision: 12, scale: 3, nullable: true),
                    preferred_supplier_id = table.Column<Guid>(type: "uuid", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Language = table.Column<string>(type: "text", nullable: true),
                    LastUpdatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tags = table.Column<string[]>(type: "text[]", nullable: true),
                    VerticalId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceId = table.Column<string>(type: "text", nullable: true),
                    IsMarkedToDelete = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_reorder_policy", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "report_schedule",
                schema: "report",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    report_key = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    branch_id = table.Column<Guid>(type: "uuid", nullable: true),
                    period = table.Column<int>(type: "integer", nullable: false),
                    parameters = table.Column<string>(type: "jsonb", nullable: false),
                    format = table.Column<int>(type: "integer", nullable: false),
                    frequency = table.Column<int>(type: "integer", nullable: false),
                    day_of_week = table.Column<int>(type: "integer", nullable: true),
                    day_of_month = table.Column<int>(type: "integer", nullable: true),
                    last_day_of_month = table.Column<bool>(type: "boolean", nullable: false),
                    send_at_local = table.Column<TimeOnly>(type: "time without time zone", nullable: false),
                    recipient_ids = table.Column<Guid[]>(type: "uuid[]", nullable: false),
                    status = table.Column<int>(type: "integer", nullable: false),
                    next_run_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    last_run_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    last_run_due_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Language = table.Column<string>(type: "text", nullable: true),
                    LastUpdatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tags = table.Column<string[]>(type: "text[]", nullable: true),
                    VerticalId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceId = table.Column<string>(type: "text", nullable: true),
                    IsMarkedToDelete = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_report_schedule", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "restore_test_record",
                schema: "ops",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    performed_on = table.Column<DateOnly>(type: "date", nullable: false),
                    performed_by_staff_id = table.Column<Guid>(type: "uuid", nullable: false),
                    environment = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    backup_set_label = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    simulated_failure_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    recovered_to = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    restore_started_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    restore_completed_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    achieved_rpo_minutes = table.Column<decimal>(type: "numeric(8,2)", nullable: false),
                    achieved_rto_minutes = table.Column<decimal>(type: "numeric(8,2)", nullable: false),
                    outcome = table.Column<int>(type: "integer", nullable: false),
                    drill_output = table.Column<string>(type: "character varying(20000)", maxLength: 20000, nullable: false),
                    notes = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    supersedes_id = table.Column<Guid>(type: "uuid", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Language = table.Column<string>(type: "text", nullable: true),
                    LastUpdatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tags = table.Column<string[]>(type: "text[]", nullable: true),
                    VerticalId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceId = table.Column<string>(type: "text", nullable: true),
                    IsMarkedToDelete = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_restore_test_record", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "retention_run",
                schema: "ops",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    trigger = table.Column<int>(type: "integer", nullable: false),
                    requested_by = table.Column<Guid>(type: "uuid", nullable: false),
                    requested_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    started_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    finished_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    status = table.Column<int>(type: "integer", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Language = table.Column<string>(type: "text", nullable: true),
                    LastUpdatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tags = table.Column<string[]>(type: "text[]", nullable: true),
                    VerticalId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceId = table.Column<string>(type: "text", nullable: true),
                    IsMarkedToDelete = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_retention_run", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "return_request",
                schema: "ordering",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    order_id = table.Column<Guid>(type: "uuid", nullable: false),
                    customer_id = table.Column<Guid>(type: "uuid", nullable: true),
                    kind = table.Column<int>(type: "integer", nullable: false),
                    status = table.Column<int>(type: "integer", nullable: false),
                    requested_by = table.Column<Guid>(type: "uuid", nullable: false),
                    requested_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    decided_by = table.Column<Guid>(type: "uuid", nullable: true),
                    decided_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    decision_note = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    received_by = table.Column<Guid>(type: "uuid", nullable: true),
                    received_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    closed_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Language = table.Column<string>(type: "text", nullable: true),
                    LastUpdatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tags = table.Column<string[]>(type: "text[]", nullable: true),
                    VerticalId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceId = table.Column<string>(type: "text", nullable: true),
                    IsMarkedToDelete = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_return_request", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "roster_exception",
                schema: "admin",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    staff_account_id = table.Column<Guid>(type: "uuid", nullable: false),
                    branch_id = table.Column<Guid>(type: "uuid", nullable: false),
                    date = table.Column<DateOnly>(type: "date", nullable: false),
                    kind = table.Column<int>(type: "integer", nullable: false),
                    starts = table.Column<TimeOnly>(type: "time", nullable: false),
                    ends = table.Column<TimeOnly>(type: "time", nullable: false),
                    reason = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    is_cancelled = table.Column<bool>(type: "boolean", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Language = table.Column<string>(type: "text", nullable: true),
                    LastUpdatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tags = table.Column<string[]>(type: "text[]", nullable: true),
                    VerticalId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceId = table.Column<string>(type: "text", nullable: true),
                    IsMarkedToDelete = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_roster_exception", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "sales_order",
                schema: "ordering",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    order_number = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    channel = table.Column<int>(type: "integer", nullable: false),
                    customer_id = table.Column<Guid>(type: "uuid", nullable: true),
                    branch_id = table.Column<Guid>(type: "uuid", nullable: false),
                    fulfilment_method = table.Column<int>(type: "integer", nullable: false),
                    payment_method = table.Column<int>(type: "integer", nullable: false),
                    status = table.Column<int>(type: "integer", nullable: false),
                    currency_code = table.Column<string>(type: "char(3)", nullable: false),
                    recipient_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    recipient_phone = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    address_line1 = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    address_line2 = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    address_city = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    address_district = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    address_postal_code = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    delivery_instructions = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    delivery_zone_id = table.Column<Guid>(type: "uuid", nullable: true),
                    zone_name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    service_level = table.Column<int>(type: "integer", nullable: true),
                    slot_date = table.Column<DateOnly>(type: "date", nullable: true),
                    slot_window_label = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    slot_window_start = table.Column<TimeOnly>(type: "time", nullable: true),
                    slot_window_end = table.Column<TimeOnly>(type: "time", nullable: true),
                    pickup_branch_id = table.Column<Guid>(type: "uuid", nullable: true),
                    rider_note = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    subtotal = table.Column<decimal>(type: "numeric(12,2)", nullable: false),
                    line_discount_total = table.Column<decimal>(type: "numeric(12,2)", nullable: false),
                    order_discount = table.Column<decimal>(type: "numeric(12,2)", nullable: false),
                    delivery_charge = table.Column<decimal>(type: "numeric(12,2)", nullable: false),
                    tax_total = table.Column<decimal>(type: "numeric(12,2)", nullable: false),
                    grand_total = table.Column<decimal>(type: "numeric(12,2)", nullable: false),
                    delivery_tax_amount = table.Column<decimal>(type: "numeric(12,2)", nullable: false),
                    discount_code_id = table.Column<Guid>(type: "uuid", nullable: true),
                    discount_code_text = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    discount_released = table.Column<bool>(type: "boolean", nullable: false),
                    quote_fingerprint = table.Column<string>(type: "char(64)", nullable: false),
                    idempotency_key = table.Column<Guid>(type: "uuid", nullable: true),
                    placed_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    payment_due_by = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    customer_transfer_reference = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    transfer_reported_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    held_amount = table.Column<decimal>(type: "numeric(12,2)", nullable: true),
                    held_reference = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    held_received_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    held_recorded_by = table.Column<Guid>(type: "uuid", nullable: true),
                    held_recorded_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    held_payment_id = table.Column<Guid>(type: "uuid", nullable: true),
                    invoice_id = table.Column<Guid>(type: "uuid", nullable: true),
                    invoice_number = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    credit_note_ids = table.Column<string>(type: "jsonb", nullable: false),
                    amount_paid = table.Column<decimal>(type: "numeric(12,2)", nullable: false),
                    amount_refunded = table.Column<decimal>(type: "numeric(12,2)", nullable: false),
                    refund_due = table.Column<decimal>(type: "numeric(12,2)", nullable: false),
                    change_given = table.Column<decimal>(type: "numeric(12,2)", nullable: false),
                    shipment_courier_id = table.Column<Guid>(type: "uuid", nullable: true),
                    shipment_courier_name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    shipment_tracking_number = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    shipment_tracking_url = table.Column<string>(type: "character varying(700)", maxLength: 700, nullable: true),
                    shipment_dispatched_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    shipment_dispatched_by = table.Column<Guid>(type: "uuid", nullable: true),
                    shipment_last_status = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    shipment_last_event_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    ready_for_collection_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    collect_by_date = table.Column<DateOnly>(type: "date", nullable: true),
                    delivered_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    delivery_recorded_by = table.Column<Guid>(type: "uuid", nullable: true),
                    cod_amount = table.Column<decimal>(type: "numeric(12,2)", nullable: true),
                    cod_collector_kind = table.Column<int>(type: "integer", nullable: true),
                    cod_collector_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    cod_collector_staff_id = table.Column<Guid>(type: "uuid", nullable: true),
                    cod_collected_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    cod_recorded_by = table.Column<Guid>(type: "uuid", nullable: true),
                    delivery_failure_reason = table.Column<int>(type: "integer", nullable: true),
                    cancellation_reason = table.Column<int>(type: "integer", nullable: true),
                    cancellation_note = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    cancelled_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    cancelled_by = table.Column<Guid>(type: "uuid", nullable: true),
                    cancelled_by_customer = table.Column<bool>(type: "boolean", nullable: false),
                    confirmed_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    packing_started_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    customer_anonymised = table.Column<bool>(type: "boolean", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Language = table.Column<string>(type: "text", nullable: true),
                    LastUpdatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tags = table.Column<string[]>(type: "text[]", nullable: true),
                    VerticalId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceId = table.Column<string>(type: "text", nullable: true),
                    IsMarkedToDelete = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_sales_order", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "scheduled_report_run",
                schema: "report",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    schedule_id = table.Column<Guid>(type: "uuid", nullable: false),
                    due_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    trigger = table.Column<int>(type: "integer", nullable: false),
                    status = table.Column<int>(type: "integer", nullable: false),
                    period_from = table.Column<DateOnly>(type: "date", nullable: false),
                    period_to = table.Column<DateOnly>(type: "date", nullable: false),
                    time_zone_id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    format = table.Column<int>(type: "integer", nullable: false),
                    file_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    content_type = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    content_length = table.Column<long>(type: "bigint", nullable: false),
                    content_sha256 = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    row_count = table.Column<int>(type: "integer", nullable: false),
                    columns_included = table.Column<string[]>(type: "text[]", nullable: false),
                    attachment_omitted = table.Column<bool>(type: "boolean", nullable: false),
                    file_id = table.Column<Guid>(type: "uuid", nullable: true),
                    failure_code = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: true),
                    generated_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    purged_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Language = table.Column<string>(type: "text", nullable: true),
                    LastUpdatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tags = table.Column<string[]>(type: "text[]", nullable: true),
                    VerticalId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceId = table.Column<string>(type: "text", nullable: true),
                    IsMarkedToDelete = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_scheduled_report_run", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "sku_price",
                schema: "product",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    sku_id = table.Column<Guid>(type: "uuid", nullable: false),
                    amount = table.Column<decimal>(type: "numeric(12,2)", nullable: false),
                    currency_code = table.Column<string>(type: "char(3)", nullable: false),
                    effective_from = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    set_by = table.Column<Guid>(type: "uuid", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Language = table.Column<string>(type: "text", nullable: true),
                    LastUpdatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tags = table.Column<string[]>(type: "text[]", nullable: true),
                    VerticalId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceId = table.Column<string>(type: "text", nullable: true),
                    IsMarkedToDelete = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_sku_price", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "sourcing_origin",
                schema: "product",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    country_code = table.Column<string>(type: "character(2)", fixedLength: true, maxLength: 2, nullable: false),
                    sourcing_notes = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    is_featured = table.Column<bool>(type: "boolean", nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Language = table.Column<string>(type: "text", nullable: true),
                    LastUpdatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tags = table.Column<string[]>(type: "text[]", nullable: true),
                    VerticalId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceId = table.Column<string>(type: "text", nullable: true),
                    IsMarkedToDelete = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_sourcing_origin", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "staff_account",
                schema: "account",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    full_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    mobile_number = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    email_address = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    password_hash = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    password_algorithm = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    password_set_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    failed_login_count = table.Column<int>(type: "integer", nullable: false),
                    locked_until = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    last_failed_login_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    security_stamp = table.Column<Guid>(type: "uuid", nullable: false),
                    last_successful_login_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    role_ids = table.Column<string[]>(type: "character varying(50)[]", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Language = table.Column<string>(type: "text", nullable: true),
                    LastUpdatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tags = table.Column<string[]>(type: "text[]", nullable: true),
                    VerticalId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceId = table.Column<string>(type: "text", nullable: true),
                    IsMarkedToDelete = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_staff_account", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "staff_branch_assignment",
                schema: "admin",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    branch_ids = table.Column<Guid[]>(type: "uuid[]", nullable: false),
                    primary_branch_id = table.Column<Guid>(type: "uuid", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Language = table.Column<string>(type: "text", nullable: true),
                    LastUpdatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tags = table.Column<string[]>(type: "text[]", nullable: true),
                    VerticalId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceId = table.Column<string>(type: "text", nullable: true),
                    IsMarkedToDelete = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_staff_branch_assignment", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "staff_roster",
                schema: "admin",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    staff_account_id = table.Column<Guid>(type: "uuid", nullable: false),
                    branch_id = table.Column<Guid>(type: "uuid", nullable: false),
                    next_pattern_effective_from = table.Column<DateOnly>(type: "date", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Language = table.Column<string>(type: "text", nullable: true),
                    LastUpdatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tags = table.Column<string[]>(type: "text[]", nullable: true),
                    VerticalId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceId = table.Column<string>(type: "text", nullable: true),
                    IsMarkedToDelete = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_staff_roster", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "staff_session",
                schema: "account",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    staff_account_id = table.Column<Guid>(type: "uuid", nullable: false),
                    token_hash = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    issued_for_security_stamp = table.Column<Guid>(type: "uuid", nullable: false),
                    issued_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    expires_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    last_activity_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    ended_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    end_reason = table.Column<int>(type: "integer", nullable: true),
                    ip_address = table.Column<string>(type: "character varying(45)", maxLength: 45, nullable: true),
                    user_agent = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    csrf_token_hash = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Language = table.Column<string>(type: "text", nullable: true),
                    LastUpdatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tags = table.Column<string[]>(type: "text[]", nullable: true),
                    VerticalId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceId = table.Column<string>(type: "text", nullable: true),
                    IsMarkedToDelete = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_staff_session", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "stock_adjustment",
                schema: "inventory",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    number = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    branch_id = table.Column<Guid>(type: "uuid", nullable: false),
                    location_id = table.Column<Guid>(type: "uuid", nullable: false),
                    reason = table.Column<int>(type: "integer", nullable: false),
                    note = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    status = table.Column<int>(type: "integer", nullable: false),
                    value_base = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: false),
                    currency_code = table.Column<string>(type: "character(3)", fixedLength: true, maxLength: 3, nullable: false),
                    requested_by = table.Column<Guid>(type: "uuid", nullable: false),
                    requested_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    decided_by = table.Column<Guid>(type: "uuid", nullable: true),
                    decided_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    decision_note = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Language = table.Column<string>(type: "text", nullable: true),
                    LastUpdatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tags = table.Column<string[]>(type: "text[]", nullable: true),
                    VerticalId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceId = table.Column<string>(type: "text", nullable: true),
                    IsMarkedToDelete = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_stock_adjustment", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "stock_alert",
                schema: "inventory",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    kind = table.Column<int>(type: "integer", nullable: false),
                    branch_id = table.Column<Guid>(type: "uuid", nullable: false),
                    sku_id = table.Column<Guid>(type: "uuid", nullable: true),
                    batch_id = table.Column<Guid>(type: "uuid", nullable: true),
                    location_id = table.Column<Guid>(type: "uuid", nullable: true),
                    threshold_days = table.Column<int>(type: "integer", nullable: true),
                    quantity_at_raise = table.Column<decimal>(type: "numeric(12,3)", precision: 12, scale: 3, nullable: true),
                    reference_kind = table.Column<int>(type: "integer", nullable: true),
                    reference_id = table.Column<Guid>(type: "uuid", nullable: true),
                    dedup_key = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    raised_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    status = table.Column<int>(type: "integer", nullable: false),
                    acknowledged_by = table.Column<Guid>(type: "uuid", nullable: true),
                    acknowledged_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    resolved_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    resolution_note = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Language = table.Column<string>(type: "text", nullable: true),
                    LastUpdatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tags = table.Column<string[]>(type: "text[]", nullable: true),
                    VerticalId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceId = table.Column<string>(type: "text", nullable: true),
                    IsMarkedToDelete = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_stock_alert", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "stock_alert",
                schema: "product",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    customer_id = table.Column<Guid>(type: "uuid", nullable: false),
                    sku_id = table.Column<Guid>(type: "uuid", nullable: false),
                    status = table.Column<int>(type: "integer", nullable: false),
                    closure_reason = table.Column<int>(type: "integer", nullable: true),
                    requested_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    notified_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Language = table.Column<string>(type: "text", nullable: true),
                    LastUpdatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tags = table.Column<string[]>(type: "text[]", nullable: true),
                    VerticalId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceId = table.Column<string>(type: "text", nullable: true),
                    IsMarkedToDelete = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_stock_alert", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "stock_count",
                schema: "inventory",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    number = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    branch_id = table.Column<Guid>(type: "uuid", nullable: false),
                    location_id = table.Column<Guid>(type: "uuid", nullable: false),
                    scope = table.Column<int>(type: "integer", nullable: false),
                    sku_ids = table.Column<Guid[]>(type: "uuid[]", nullable: false),
                    status = table.Column<int>(type: "integer", nullable: false),
                    variance_value_base = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: true),
                    currency_code = table.Column<string>(type: "character(3)", fixedLength: true, maxLength: 3, nullable: true),
                    opened_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    opened_by = table.Column<Guid>(type: "uuid", nullable: false),
                    submitted_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    submitted_by = table.Column<Guid>(type: "uuid", nullable: true),
                    commit_requested_by = table.Column<Guid>(type: "uuid", nullable: true),
                    committed_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    decided_by = table.Column<Guid>(type: "uuid", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Language = table.Column<string>(type: "text", nullable: true),
                    LastUpdatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tags = table.Column<string[]>(type: "text[]", nullable: true),
                    VerticalId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceId = table.Column<string>(type: "text", nullable: true),
                    IsMarkedToDelete = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_stock_count", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "stock_location",
                schema: "inventory",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    branch_id = table.Column<Guid>(type: "uuid", nullable: false),
                    code = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    kind = table.Column<int>(type: "integer", nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Language = table.Column<string>(type: "text", nullable: true),
                    LastUpdatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tags = table.Column<string[]>(type: "text[]", nullable: true),
                    VerticalId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceId = table.Column<string>(type: "text", nullable: true),
                    IsMarkedToDelete = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_stock_location", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "stock_transfer",
                schema: "inventory",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    number = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    branch_id = table.Column<Guid>(type: "uuid", nullable: false),
                    from_location_id = table.Column<Guid>(type: "uuid", nullable: false),
                    to_location_id = table.Column<Guid>(type: "uuid", nullable: false),
                    reason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    transferred_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    transferred_by = table.Column<Guid>(type: "uuid", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Language = table.Column<string>(type: "text", nullable: true),
                    LastUpdatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tags = table.Column<string[]>(type: "text[]", nullable: true),
                    VerticalId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceId = table.Column<string>(type: "text", nullable: true),
                    IsMarkedToDelete = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_stock_transfer", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "storage_breach_report",
                schema: "inventory",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    branch_id = table.Column<Guid>(type: "uuid", nullable: false),
                    location_id = table.Column<Guid>(type: "uuid", nullable: false),
                    observed_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    condition = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    temperature_c = table.Column<decimal>(type: "numeric(5,1)", precision: 5, scale: 1, nullable: true),
                    duration_minutes = table.Column<int>(type: "integer", nullable: true),
                    affected_batch_ids = table.Column<Guid[]>(type: "uuid[]", nullable: false),
                    status = table.Column<int>(type: "integer", nullable: false),
                    reported_by = table.Column<Guid>(type: "uuid", nullable: false),
                    reported_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    quarantined_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    quarantined_by = table.Column<Guid>(type: "uuid", nullable: true),
                    closed_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    closed_by = table.Column<Guid>(type: "uuid", nullable: true),
                    closing_note = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Language = table.Column<string>(type: "text", nullable: true),
                    LastUpdatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tags = table.Column<string[]>(type: "text[]", nullable: true),
                    VerticalId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceId = table.Column<string>(type: "text", nullable: true),
                    IsMarkedToDelete = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_storage_breach_report", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "stored_file",
                schema: "files",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Purpose = table.Column<int>(type: "integer", nullable: false),
                    ContentType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    SizeInBytes = table.Column<long>(type: "bigint", nullable: false),
                    Sha256 = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    OriginalFileName = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    StorageKey = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    UploadedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    UploadedOn = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    ScannerName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    RetainUntil = table.Column<DateOnly>(type: "date", nullable: true),
                    LegalHold = table.Column<bool>(type: "boolean", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Language = table.Column<string>(type: "text", nullable: true),
                    LastUpdatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tags = table.Column<string[]>(type: "text[]", nullable: true),
                    VerticalId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceId = table.Column<string>(type: "text", nullable: true),
                    IsMarkedToDelete = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_stored_file", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "supplier",
                schema: "inventory",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    code = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    country_code = table.Column<string>(type: "character(2)", fixedLength: true, maxLength: 2, nullable: false),
                    contact_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    contact_phone = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    contact_email = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    contact_address = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    currency_code = table.Column<string>(type: "character(3)", fixedLength: true, maxLength: 3, nullable: false),
                    lead_time_days = table.Column<int>(type: "integer", nullable: false),
                    payment_terms = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    payment_term_days = table.Column<int>(type: "integer", nullable: true),
                    notes = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Language = table.Column<string>(type: "text", nullable: true),
                    LastUpdatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tags = table.Column<string[]>(type: "text[]", nullable: true),
                    VerticalId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceId = table.Column<string>(type: "text", nullable: true),
                    IsMarkedToDelete = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_supplier", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "system_status",
                schema: "admin",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    maintenance_mode = table.Column<bool>(type: "boolean", nullable: false),
                    maintenance_message = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    changed_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Language = table.Column<string>(type: "text", nullable: true),
                    LastUpdatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tags = table.Column<string[]>(type: "text[]", nullable: true),
                    VerticalId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceId = table.Column<string>(type: "text", nullable: true),
                    IsMarkedToDelete = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_system_status", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "tax_class",
                schema: "admin",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    code = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Language = table.Column<string>(type: "text", nullable: true),
                    LastUpdatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tags = table.Column<string[]>(type: "text[]", nullable: true),
                    VerticalId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceId = table.Column<string>(type: "text", nullable: true),
                    IsMarkedToDelete = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_tax_class", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "tax_rate",
                schema: "admin",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    tax_class_id = table.Column<Guid>(type: "uuid", nullable: false),
                    rate_percent = table.Column<decimal>(type: "numeric(5,2)", nullable: false),
                    effective_from = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Language = table.Column<string>(type: "text", nullable: true),
                    LastUpdatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tags = table.Column<string[]>(type: "text[]", nullable: true),
                    VerticalId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceId = table.Column<string>(type: "text", nullable: true),
                    IsMarkedToDelete = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_tax_rate", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "web_vital_batch",
                schema: "ops",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    received_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    build_id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Language = table.Column<string>(type: "text", nullable: true),
                    LastUpdatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tags = table.Column<string[]>(type: "text[]", nullable: true),
                    VerticalId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceId = table.Column<string>(type: "text", nullable: true),
                    IsMarkedToDelete = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_web_vital_batch", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "wishlist",
                schema: "product",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Language = table.Column<string>(type: "text", nullable: true),
                    LastUpdatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tags = table.Column<string[]>(type: "text[]", nullable: true),
                    VerticalId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceId = table.Column<string>(type: "text", nullable: true),
                    IsMarkedToDelete = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_wishlist", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "bank_statement_line",
                schema: "billing",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    line_number = table.Column<int>(type: "integer", nullable: false),
                    transaction_date = table.Column<DateOnly>(type: "date", nullable: false),
                    amount = table.Column<decimal>(type: "numeric(12,2)", nullable: false),
                    direction = table.Column<int>(type: "integer", nullable: false),
                    reference = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    bank_transaction_id = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    statement_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_bank_statement_line", x => x.id);
                    table.ForeignKey(
                        name: "FK_bank_statement_line_bank_statement_statement_id",
                        column: x => x.statement_id,
                        principalSchema: "billing",
                        principalTable: "bank_statement",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "billing_profile_bank_account",
                schema: "billing",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    bank_name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    account_name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    account_number = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    branch_name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    routing_number = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    sort_order = table.Column<int>(type: "integer", nullable: false),
                    billing_profile_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_billing_profile_bank_account", x => x.id);
                    table.ForeignKey(
                        name: "FK_billing_profile_bank_account_billing_profile_billing_profil~",
                        column: x => x.billing_profile_id,
                        principalSchema: "billing",
                        principalTable: "billing_profile",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "branch_opening_interval",
                schema: "admin",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    day_of_week = table.Column<int>(type: "integer", nullable: false),
                    opens = table.Column<TimeOnly>(type: "time", nullable: false),
                    closes = table.Column<TimeOnly>(type: "time", nullable: false),
                    branch_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_branch_opening_interval", x => x.id);
                    table.ForeignKey(
                        name: "FK_branch_opening_interval_branch_branch_id",
                        column: x => x.branch_id,
                        principalSchema: "admin",
                        principalTable: "branch",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "business_settings_value",
                schema: "admin",
                columns: table => new
                {
                    key = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    business_settings_id = table.Column<Guid>(type: "uuid", nullable: false),
                    value = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_business_settings_value", x => new { x.business_settings_id, x.key });
                    table.ForeignKey(
                        name: "FK_business_settings_value_business_settings_business_settings~",
                        column: x => x.business_settings_id,
                        principalSchema: "admin",
                        principalTable: "business_settings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "cart_line",
                schema: "ordering",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    sku_id = table.Column<Guid>(type: "uuid", nullable: false),
                    quantity = table.Column<int>(type: "integer", nullable: false),
                    price_when_added = table.Column<decimal>(type: "numeric(12,2)", nullable: false),
                    currency_code = table.Column<string>(type: "char(3)", nullable: false),
                    added_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    updated_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    cart_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_cart_line", x => x.id);
                    table.ForeignKey(
                        name: "FK_cart_line_cart_cart_id",
                        column: x => x.cart_id,
                        principalSchema: "ordering",
                        principalTable: "cart",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "cod_remittance_line",
                schema: "billing",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    payment_id = table.Column<Guid>(type: "uuid", nullable: false),
                    amount_remitted = table.Column<decimal>(type: "numeric(12,2)", nullable: false),
                    remittance_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_cod_remittance_line", x => x.id);
                    table.ForeignKey(
                        name: "FK_cod_remittance_line_cod_remittance_remittance_id",
                        column: x => x.remittance_id,
                        principalSchema: "billing",
                        principalTable: "cod_remittance",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "consignment_cost",
                schema: "inventory",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    kind = table.Column<int>(type: "integer", nullable: false),
                    amount = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: false),
                    currency_code = table.Column<string>(type: "character(3)", fixedLength: true, maxLength: 3, nullable: false),
                    note = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    consignment_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_consignment_cost", x => x.Id);
                    table.ForeignKey(
                        name: "FK_consignment_cost_consignment_consignment_id",
                        column: x => x.consignment_id,
                        principalSchema: "inventory",
                        principalTable: "consignment",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "consignment_document",
                schema: "inventory",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    kind = table.Column<int>(type: "integer", nullable: false),
                    document_number = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: true),
                    issued_on = table.Column<DateOnly>(type: "date", nullable: true),
                    file_name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    storage_key = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    content_type = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    size_in_bytes = table.Column<long>(type: "bigint", nullable: false),
                    uploaded_by = table.Column<Guid>(type: "uuid", nullable: false),
                    uploaded_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    superseded_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    superseded_by = table.Column<Guid>(type: "uuid", nullable: true),
                    consignment_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_consignment_document", x => x.Id);
                    table.ForeignKey(
                        name: "FK_consignment_document_consignment_consignment_id",
                        column: x => x.consignment_id,
                        principalSchema: "inventory",
                        principalTable: "consignment",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "consignment_exchange_rate",
                schema: "inventory",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    currency_code = table.Column<string>(type: "character(3)", fixedLength: true, maxLength: 3, nullable: false),
                    rate_to_base = table.Column<decimal>(type: "numeric(18,6)", precision: 18, scale: 6, nullable: false),
                    recorded_on = table.Column<DateOnly>(type: "date", nullable: false),
                    consignment_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_consignment_exchange_rate", x => x.Id);
                    table.ForeignKey(
                        name: "FK_consignment_exchange_rate_consignment_consignment_id",
                        column: x => x.consignment_id,
                        principalSchema: "inventory",
                        principalTable: "consignment",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "consignment_hs_code",
                schema: "inventory",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    code = table.Column<string>(type: "character varying(12)", maxLength: 12, nullable: false),
                    description = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    consignment_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_consignment_hs_code", x => x.Id);
                    table.ForeignKey(
                        name: "FK_consignment_hs_code_consignment_consignment_id",
                        column: x => x.consignment_id,
                        principalSchema: "inventory",
                        principalTable: "consignment",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "consignment_landed_cost_line",
                schema: "inventory",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    batch_id = table.Column<Guid>(type: "uuid", nullable: false),
                    quantity = table.Column<decimal>(type: "numeric(12,3)", precision: 12, scale: 3, nullable: false),
                    purchase_cost_base = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    allocated_cost_base = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    landed_unit_cost_base = table.Column<decimal>(type: "numeric(14,4)", precision: 14, scale: 4, nullable: false),
                    consignment_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_consignment_landed_cost_line", x => x.Id);
                    table.ForeignKey(
                        name: "FK_consignment_landed_cost_line_consignment_consignment_id",
                        column: x => x.consignment_id,
                        principalSchema: "inventory",
                        principalTable: "consignment",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "consignment_status_change",
                schema: "inventory",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    from_status = table.Column<int>(type: "integer", nullable: false),
                    to_status = table.Column<int>(type: "integer", nullable: false),
                    changed_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    changed_by = table.Column<Guid>(type: "uuid", nullable: false),
                    effective_on = table.Column<DateOnly>(type: "date", nullable: true),
                    sequence = table.Column<int>(type: "integer", nullable: false),
                    consignment_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_consignment_status_change", x => x.Id);
                    table.ForeignKey(
                        name: "FK_consignment_status_change_consignment_consignment_id",
                        column: x => x.consignment_id,
                        principalSchema: "inventory",
                        principalTable: "consignment",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "credit_note_line",
                schema: "billing",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    invoice_line_id = table.Column<Guid>(type: "uuid", nullable: false),
                    description = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    quantity = table.Column<decimal>(type: "numeric(10,3)", nullable: true),
                    requested_amount = table.Column<decimal>(type: "numeric(12,2)", nullable: true),
                    net_amount = table.Column<decimal>(type: "numeric(12,2)", nullable: false),
                    tax_rate_percent = table.Column<decimal>(type: "numeric(5,2)", nullable: false),
                    tax_amount = table.Column<decimal>(type: "numeric(12,2)", nullable: false),
                    gross_amount = table.Column<decimal>(type: "numeric(12,2)", nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false),
                    credit_note_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_credit_note_line", x => x.id);
                    table.ForeignKey(
                        name: "FK_credit_note_line_credit_note_credit_note_id",
                        column: x => x.credit_note_id,
                        principalSchema: "billing",
                        principalTable: "credit_note",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "customer_delivery_address",
                schema: "account",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Label = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Line1 = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Line2 = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    City = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    District = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    PostalCode = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    DeliveryInstructions = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    AddedOn = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    LastChangedOn = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    customer_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_customer_delivery_address", x => x.Id);
                    table.ForeignKey(
                        name: "FK_customer_delivery_address_customer_address_book_customer_id",
                        column: x => x.customer_id,
                        principalSchema: "account",
                        principalTable: "customer_address_book",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "customer_marketing_consent",
                schema: "account",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    channel = table.Column<int>(type: "integer", nullable: false),
                    is_granted = table.Column<bool>(type: "boolean", nullable: false),
                    recorded_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    source = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    customer_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_customer_marketing_consent", x => x.Id);
                    table.ForeignKey(
                        name: "FK_customer_marketing_consent_customer_notification_preference~",
                        column: x => x.customer_id,
                        principalSchema: "account",
                        principalTable: "customer_notification_preferences",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "delivery_zone_coverage",
                schema: "ordering",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    district = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    postal_codes = table.Column<string>(type: "jsonb", nullable: false),
                    delivery_zone_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_delivery_zone_coverage", x => x.id);
                    table.ForeignKey(
                        name: "FK_delivery_zone_coverage_delivery_zone_delivery_zone_id",
                        column: x => x.delivery_zone_id,
                        principalSchema: "ordering",
                        principalTable: "delivery_zone",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "delivery_zone_service",
                schema: "ordering",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    service_level = table.Column<int>(type: "integer", nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    base_charge = table.Column<decimal>(type: "numeric(12,2)", nullable: false),
                    free_over_order_value = table.Column<decimal>(type: "numeric(12,2)", nullable: true),
                    lead_time_days = table.Column<int>(type: "integer", nullable: false),
                    weight_bands = table.Column<string>(type: "jsonb", nullable: false),
                    slot_windows = table.Column<string>(type: "jsonb", nullable: false),
                    delivery_zone_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_delivery_zone_service", x => x.id);
                    table.ForeignKey(
                        name: "FK_delivery_zone_service_delivery_zone_delivery_zone_id",
                        column: x => x.delivery_zone_id,
                        principalSchema: "ordering",
                        principalTable: "delivery_zone",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "erasure_scope",
                schema: "ops",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    context_key = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    status = table.Column<int>(type: "integer", nullable: false),
                    held_until = table.Column<DateOnly>(type: "date", nullable: true),
                    held_basis = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    attempts = table.Column<int>(type: "integer", nullable: false),
                    last_attempt_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    last_error_code = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    completed_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    erasure_request_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_erasure_scope", x => x.Id);
                    table.ForeignKey(
                        name: "FK_erasure_scope_erasure_request_erasure_request_id",
                        column: x => x.erasure_request_id,
                        principalSchema: "ops",
                        principalTable: "erasure_request",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "batch",
                schema: "inventory",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    sku_id = table.Column<Guid>(type: "uuid", nullable: false),
                    sku_code = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    display_name = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    stock_unit = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    stock_class = table.Column<int>(type: "integer", nullable: false),
                    branch_id = table.Column<Guid>(type: "uuid", nullable: false),
                    lot_number = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    manufactured_on = table.Column<DateOnly>(type: "date", nullable: true),
                    expires_on = table.Column<DateOnly>(type: "date", nullable: true),
                    goods_receipt_id = table.Column<Guid>(type: "uuid", nullable: false),
                    goods_receipt_line_id = table.Column<Guid>(type: "uuid", nullable: false),
                    consignment_id = table.Column<Guid>(type: "uuid", nullable: true),
                    supplier_id = table.Column<Guid>(type: "uuid", nullable: true),
                    origin_country_code = table.Column<string>(type: "character(2)", fixedLength: true, maxLength: 2, nullable: true),
                    received_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    received_quantity = table.Column<decimal>(type: "numeric(12,3)", precision: 12, scale: 3, nullable: false),
                    purchase_unit_cost_amount = table.Column<decimal>(type: "numeric(14,4)", precision: 14, scale: 4, nullable: false),
                    purchase_unit_cost_currency = table.Column<string>(type: "character(3)", fixedLength: true, maxLength: 3, nullable: false),
                    purchase_unit_cost_base = table.Column<decimal>(type: "numeric(14,4)", precision: 14, scale: 4, nullable: false),
                    status = table.Column<int>(type: "integer", nullable: false),
                    status_reason = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    status_changed_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    status_changed_by = table.Column<Guid>(type: "uuid", nullable: false),
                    recall_number = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    recall_reason = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    recall_customer_advice = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    recall_declared_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    recall_declared_by = table.Column<Guid>(type: "uuid", nullable: true),
                    recall_notified_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    recall_notified_by = table.Column<Guid>(type: "uuid", nullable: true),
                    recall_notified_recipient_count = table.Column<int>(type: "integer", nullable: true),
                    recall_notification_runs = table.Column<int>(type: "integer", nullable: true),
                    recall_closed_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    recall_closing_note = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Language = table.Column<string>(type: "text", nullable: true),
                    LastUpdatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tags = table.Column<string[]>(type: "text[]", nullable: true),
                    VerticalId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceId = table.Column<string>(type: "text", nullable: true),
                    IsMarkedToDelete = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_batch", x => x.Id);
                    table.ForeignKey(
                        name: "FK_batch_goods_receipt_goods_receipt_id",
                        column: x => x.goods_receipt_id,
                        principalSchema: "inventory",
                        principalTable: "goods_receipt",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "goods_receipt_line",
                schema: "inventory",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    sku_id = table.Column<Guid>(type: "uuid", nullable: false),
                    sku_code = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    display_name = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    stock_unit = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    purchase_order_line_id = table.Column<Guid>(type: "uuid", nullable: true),
                    lot_number = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    manufactured_on = table.Column<DateOnly>(type: "date", nullable: true),
                    expires_on = table.Column<DateOnly>(type: "date", nullable: true),
                    quantity_accepted = table.Column<decimal>(type: "numeric(12,3)", precision: 12, scale: 3, nullable: false),
                    quantity_rejected = table.Column<decimal>(type: "numeric(12,3)", precision: 12, scale: 3, nullable: false),
                    rejection_reason = table.Column<int>(type: "integer", nullable: true),
                    rejection_note = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    location_id = table.Column<Guid>(type: "uuid", nullable: false),
                    hold_for_inspection = table.Column<bool>(type: "boolean", nullable: false),
                    unit_cost_amount = table.Column<decimal>(type: "numeric(14,4)", precision: 14, scale: 4, nullable: true),
                    unit_cost_currency = table.Column<string>(type: "character(3)", fixedLength: true, maxLength: 3, nullable: true),
                    exchange_rate_to_base = table.Column<decimal>(type: "numeric(18,6)", precision: 18, scale: 6, nullable: true),
                    batch_id = table.Column<Guid>(type: "uuid", nullable: true),
                    goods_receipt_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_goods_receipt_line", x => x.Id);
                    table.ForeignKey(
                        name: "FK_goods_receipt_line_goods_receipt_goods_receipt_id",
                        column: x => x.goods_receipt_id,
                        principalSchema: "inventory",
                        principalTable: "goods_receipt",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "invoice_line",
                schema: "billing",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    charge_id = table.Column<Guid>(type: "uuid", nullable: true),
                    corrects_invoice_line_id = table.Column<Guid>(type: "uuid", nullable: true),
                    business_line = table.Column<int>(type: "integer", nullable: false),
                    item_kind = table.Column<int>(type: "integer", nullable: false),
                    source_kind = table.Column<int>(type: "integer", nullable: false),
                    source_id = table.Column<Guid>(type: "uuid", nullable: false),
                    description = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    quantity = table.Column<decimal>(type: "numeric(10,3)", nullable: false),
                    unit_price = table.Column<decimal>(type: "numeric(12,2)", nullable: false),
                    line_discount = table.Column<decimal>(type: "numeric(12,2)", nullable: false),
                    invoice_discount_share = table.Column<decimal>(type: "numeric(12,2)", nullable: false),
                    tax_class_id = table.Column<Guid>(type: "uuid", nullable: false),
                    tax_class_code = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    tax_rate_percent = table.Column<decimal>(type: "numeric(5,2)", nullable: false),
                    net_amount = table.Column<decimal>(type: "numeric(12,2)", nullable: false),
                    tax_amount = table.Column<decimal>(type: "numeric(12,2)", nullable: false),
                    gross_amount = table.Column<decimal>(type: "numeric(12,2)", nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false),
                    invoice_discarded = table.Column<bool>(type: "boolean", nullable: false),
                    is_frozen = table.Column<bool>(type: "boolean", nullable: false),
                    invoice_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_invoice_line", x => x.id);
                    table.ForeignKey(
                        name: "FK_invoice_line_invoice_invoice_id",
                        column: x => x.invoice_id,
                        principalSchema: "billing",
                        principalTable: "invoice",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "notification_attempt",
                schema: "notify",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    attempted_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    outcome = table.Column<int>(type: "integer", nullable: false),
                    provider_name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    provider_message_id = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    provider_response = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    notification_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_notification_attempt", x => x.Id);
                    table.ForeignKey(
                        name: "FK_notification_attempt_notification_notification_id",
                        column: x => x.notification_id,
                        principalSchema: "notify",
                        principalTable: "notification",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "notification_template_content",
                schema: "notify",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    channel = table.Column<int>(type: "integer", nullable: false),
                    subject = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    title = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    body = table.Column<string>(type: "character varying(10000)", maxLength: 10000, nullable: false),
                    link_path = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    template_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_notification_template_content", x => x.Id);
                    table.ForeignKey(
                        name: "FK_notification_template_content_notification_template_templat~",
                        column: x => x.template_id,
                        principalSchema: "notify",
                        principalTable: "notification_template",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "payment_allocation_entry",
                schema: "billing",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    kind = table.Column<int>(type: "integer", nullable: false),
                    invoice_id = table.Column<Guid>(type: "uuid", nullable: false),
                    amount = table.Column<decimal>(type: "numeric(12,2)", nullable: false),
                    occurred_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    performed_by = table.Column<Guid>(type: "uuid", nullable: false),
                    release_reason = table.Column<int>(type: "integer", nullable: true),
                    payment_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_payment_allocation_entry", x => x.id);
                    table.ForeignKey(
                        name: "FK_payment_allocation_entry_payment_payment_id",
                        column: x => x.payment_id,
                        principalSchema: "billing",
                        principalTable: "payment",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "payment_requested_allocation",
                schema: "billing",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    invoice_id = table.Column<Guid>(type: "uuid", nullable: false),
                    amount = table.Column<decimal>(type: "numeric(12,2)", nullable: false),
                    payment_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_payment_requested_allocation", x => x.id);
                    table.ForeignKey(
                        name: "FK_payment_requested_allocation_payment_payment_id",
                        column: x => x.payment_id,
                        principalSchema: "billing",
                        principalTable: "payment",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "bundle_component",
                schema: "product",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    component_sku_id = table.Column<Guid>(type: "uuid", nullable: false),
                    quantity = table.Column<int>(type: "integer", nullable: false),
                    product_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_bundle_component", x => x.Id);
                    table.ForeignKey(
                        name: "FK_bundle_component_product_product_id",
                        column: x => x.product_id,
                        principalSchema: "product",
                        principalTable: "product",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "product_image",
                schema: "product",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    sku_id = table.Column<Guid>(type: "uuid", nullable: true),
                    file_id = table.Column<Guid>(type: "uuid", nullable: false),
                    alt_text = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false),
                    is_primary = table.Column<bool>(type: "boolean", nullable: false),
                    product_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_product_image", x => x.Id);
                    table.ForeignKey(
                        name: "FK_product_image_product_product_id",
                        column: x => x.product_id,
                        principalSchema: "product",
                        principalTable: "product",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "product_translation",
                schema: "product",
                columns: table => new
                {
                    locale = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    product_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    description = table.Column<string>(type: "character varying(5000)", maxLength: 5000, nullable: true),
                    ingredient_list = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_product_translation", x => new { x.locale, x.product_id });
                    table.ForeignKey(
                        name: "FK_product_translation_product_product_id",
                        column: x => x.product_id,
                        principalSchema: "product",
                        principalTable: "product",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "related_product",
                schema: "product",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    related_product_id = table.Column<Guid>(type: "uuid", nullable: false),
                    kind = table.Column<int>(type: "integer", nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false),
                    product_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_related_product", x => x.Id);
                    table.ForeignKey(
                        name: "FK_related_product_product_product_id",
                        column: x => x.product_id,
                        principalSchema: "product",
                        principalTable: "product",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "sku",
                schema: "product",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    code = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    barcode = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: true),
                    size_or_weight = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    flavour = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    colour = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    pack_quantity = table.Column<int>(type: "integer", nullable: true),
                    shipping_weight_grams = table.Column<int>(type: "integer", nullable: true),
                    status = table.Column<int>(type: "integer", nullable: false),
                    product_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_sku", x => x.Id);
                    table.ForeignKey(
                        name: "FK_sku_product_product_id",
                        column: x => x.product_id,
                        principalSchema: "product",
                        principalTable: "product",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "purchase_order_line",
                schema: "inventory",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    sku_id = table.Column<Guid>(type: "uuid", nullable: false),
                    sku_code = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    display_name = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    stock_unit = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    ordered_quantity = table.Column<decimal>(type: "numeric(12,3)", precision: 12, scale: 3, nullable: false),
                    unit_cost_amount = table.Column<decimal>(type: "numeric(14,4)", precision: 14, scale: 4, nullable: false),
                    purchase_order_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_purchase_order_line", x => x.Id);
                    table.ForeignKey(
                        name: "FK_purchase_order_line_purchase_order_purchase_order_id",
                        column: x => x.purchase_order_id,
                        principalSchema: "inventory",
                        principalTable: "purchase_order",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "restore_check_result",
                schema: "ops",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    passed = table.Column<bool>(type: "boolean", nullable: false),
                    detail = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    restore_test_record_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_restore_check_result", x => x.Id);
                    table.ForeignKey(
                        name: "FK_restore_check_result_restore_test_record_restore_test_recor~",
                        column: x => x.restore_test_record_id,
                        principalSchema: "ops",
                        principalTable: "restore_test_record",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "retention_pass_result",
                schema: "ops",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    kind = table.Column<int>(type: "integer", nullable: false),
                    cutoff = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    examined = table.Column<int>(type: "integer", nullable: false),
                    affected = table.Column<int>(type: "integer", nullable: false),
                    held = table.Column<int>(type: "integer", nullable: false),
                    failed = table.Column<int>(type: "integer", nullable: false),
                    error_codes = table.Column<string[]>(type: "text[]", nullable: false),
                    duration_ms = table.Column<int>(type: "integer", nullable: false),
                    retention_run_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_retention_pass_result", x => x.Id);
                    table.ForeignKey(
                        name: "FK_retention_pass_result_retention_run_retention_run_id",
                        column: x => x.retention_run_id,
                        principalSchema: "ops",
                        principalTable: "retention_run",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "return_line",
                schema: "ordering",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    order_line_id = table.Column<Guid>(type: "uuid", nullable: false),
                    quantity = table.Column<int>(type: "integer", nullable: false),
                    reason_code = table.Column<int>(type: "integer", nullable: false),
                    condition = table.Column<int>(type: "integer", nullable: false),
                    customer_note = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    requires_defect_confirmation = table.Column<bool>(type: "boolean", nullable: false),
                    defect_confirmed = table.Column<bool>(type: "boolean", nullable: false),
                    defect_note = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    quantity_received = table.Column<int>(type: "integer", nullable: false),
                    receipts = table.Column<string>(type: "jsonb", nullable: false),
                    return_request_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_return_line", x => x.id);
                    table.ForeignKey(
                        name: "FK_return_line_return_request_return_request_id",
                        column: x => x.return_request_id,
                        principalSchema: "ordering",
                        principalTable: "return_request",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "order_line",
                schema: "ordering",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    line_number = table.Column<int>(type: "integer", nullable: false),
                    sku_id = table.Column<Guid>(type: "uuid", nullable: false),
                    product_id = table.Column<Guid>(type: "uuid", nullable: false),
                    product_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    variant_label = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    barcode = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: true),
                    return_class = table.Column<int>(type: "integer", nullable: false),
                    is_bundle = table.Column<bool>(type: "boolean", nullable: false),
                    quantity = table.Column<int>(type: "integer", nullable: false),
                    unit_price = table.Column<decimal>(type: "numeric(12,2)", nullable: false),
                    line_subtotal = table.Column<decimal>(type: "numeric(12,2)", nullable: false),
                    line_discount = table.Column<decimal>(type: "numeric(12,2)", nullable: false),
                    order_discount_share = table.Column<decimal>(type: "numeric(12,2)", nullable: false),
                    tax_class_id = table.Column<Guid>(type: "uuid", nullable: false),
                    tax_rate_percent = table.Column<decimal>(type: "numeric(5,2)", nullable: false),
                    tax_amount = table.Column<decimal>(type: "numeric(12,2)", nullable: false),
                    line_total = table.Column<decimal>(type: "numeric(12,2)", nullable: false),
                    quantity_returned = table.Column<int>(type: "integer", nullable: false),
                    components = table.Column<string>(type: "jsonb", nullable: false),
                    order_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_order_line", x => x.id);
                    table.ForeignKey(
                        name: "FK_order_line_sales_order_order_id",
                        column: x => x.order_id,
                        principalSchema: "ordering",
                        principalTable: "sales_order",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "order_payment_ref",
                schema: "ordering",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    payment_id = table.Column<Guid>(type: "uuid", nullable: false),
                    method = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    amount = table.Column<decimal>(type: "numeric(12,2)", nullable: false),
                    recorded_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    order_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_order_payment_ref", x => x.id);
                    table.ForeignKey(
                        name: "FK_order_payment_ref_sales_order_order_id",
                        column: x => x.order_id,
                        principalSchema: "ordering",
                        principalTable: "sales_order",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "order_status_change",
                schema: "ordering",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    from_status = table.Column<int>(type: "integer", nullable: true),
                    to_status = table.Column<int>(type: "integer", nullable: false),
                    changed_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    changed_by = table.Column<Guid>(type: "uuid", nullable: false),
                    note = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    order_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_order_status_change", x => x.id);
                    table.ForeignKey(
                        name: "FK_order_status_change_sales_order_order_id",
                        column: x => x.order_id,
                        principalSchema: "ordering",
                        principalTable: "sales_order",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "staff_roster_current_shift",
                schema: "admin",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    day_of_week = table.Column<int>(type: "integer", nullable: false),
                    starts = table.Column<TimeOnly>(type: "time", nullable: false),
                    ends = table.Column<TimeOnly>(type: "time", nullable: false),
                    staff_roster_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_staff_roster_current_shift", x => x.id);
                    table.ForeignKey(
                        name: "FK_staff_roster_current_shift_staff_roster_staff_roster_id",
                        column: x => x.staff_roster_id,
                        principalSchema: "admin",
                        principalTable: "staff_roster",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "staff_roster_next_shift",
                schema: "admin",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    day_of_week = table.Column<int>(type: "integer", nullable: false),
                    starts = table.Column<TimeOnly>(type: "time", nullable: false),
                    ends = table.Column<TimeOnly>(type: "time", nullable: false),
                    staff_roster_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_staff_roster_next_shift", x => x.id);
                    table.ForeignKey(
                        name: "FK_staff_roster_next_shift_staff_roster_staff_roster_id",
                        column: x => x.staff_roster_id,
                        principalSchema: "admin",
                        principalTable: "staff_roster",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "stock_adjustment_line",
                schema: "inventory",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    sku_id = table.Column<Guid>(type: "uuid", nullable: false),
                    batch_id = table.Column<Guid>(type: "uuid", nullable: false),
                    quantity_delta = table.Column<decimal>(type: "numeric(12,3)", precision: 12, scale: 3, nullable: false),
                    unit_cost_base = table.Column<decimal>(type: "numeric(14,4)", precision: 14, scale: 4, nullable: false),
                    stock_adjustment_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_stock_adjustment_line", x => x.Id);
                    table.ForeignKey(
                        name: "FK_stock_adjustment_line_stock_adjustment_stock_adjustment_id",
                        column: x => x.stock_adjustment_id,
                        principalSchema: "inventory",
                        principalTable: "stock_adjustment",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "stock_count_line",
                schema: "inventory",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    sku_id = table.Column<Guid>(type: "uuid", nullable: false),
                    batch_id = table.Column<Guid>(type: "uuid", nullable: false),
                    counted_quantity = table.Column<decimal>(type: "numeric(12,3)", precision: 12, scale: 3, nullable: false),
                    book_quantity = table.Column<decimal>(type: "numeric(12,3)", precision: 12, scale: 3, nullable: true),
                    variance = table.Column<decimal>(type: "numeric(12,3)", precision: 12, scale: 3, nullable: true),
                    unit_cost_base = table.Column<decimal>(type: "numeric(14,4)", precision: 14, scale: 4, nullable: false),
                    counted_by = table.Column<Guid>(type: "uuid", nullable: false),
                    counted_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    stock_count_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_stock_count_line", x => x.Id);
                    table.ForeignKey(
                        name: "FK_stock_count_line_stock_count_stock_count_id",
                        column: x => x.stock_count_id,
                        principalSchema: "inventory",
                        principalTable: "stock_count",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "stock_transfer_line",
                schema: "inventory",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    sku_id = table.Column<Guid>(type: "uuid", nullable: false),
                    batch_id = table.Column<Guid>(type: "uuid", nullable: false),
                    quantity = table.Column<decimal>(type: "numeric(12,3)", precision: 12, scale: 3, nullable: false),
                    stock_transfer_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_stock_transfer_line", x => x.Id);
                    table.ForeignKey(
                        name: "FK_stock_transfer_line_stock_transfer_stock_transfer_id",
                        column: x => x.stock_transfer_id,
                        principalSchema: "inventory",
                        principalTable: "stock_transfer",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "web_vital_sample",
                schema: "ops",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    metric = table.Column<int>(type: "integer", nullable: false),
                    value = table.Column<decimal>(type: "numeric(12,4)", nullable: false),
                    route_template = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    navigation_type = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    effective_connection_type = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    viewport_class = table.Column<int>(type: "integer", nullable: false),
                    web_vital_batch_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_web_vital_sample", x => x.Id);
                    table.ForeignKey(
                        name: "FK_web_vital_sample_web_vital_batch_web_vital_batch_id",
                        column: x => x.web_vital_batch_id,
                        principalSchema: "ops",
                        principalTable: "web_vital_batch",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "wishlist_item",
                schema: "product",
                columns: table => new
                {
                    sku_id = table.Column<Guid>(type: "uuid", nullable: false),
                    wishlist_id = table.Column<Guid>(type: "uuid", nullable: false),
                    product_id = table.Column<Guid>(type: "uuid", nullable: false),
                    added_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_wishlist_item", x => new { x.wishlist_id, x.sku_id });
                    table.ForeignKey(
                        name: "FK_wishlist_item_wishlist_wishlist_id",
                        column: x => x.wishlist_id,
                        principalSchema: "product",
                        principalTable: "wishlist",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "batch_status_change",
                schema: "inventory",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    from_status = table.Column<int>(type: "integer", nullable: false),
                    to_status = table.Column<int>(type: "integer", nullable: false),
                    reason = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    changed_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    changed_by = table.Column<Guid>(type: "uuid", nullable: false),
                    sequence = table.Column<int>(type: "integer", nullable: false),
                    batch_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_batch_status_change", x => x.Id);
                    table.ForeignKey(
                        name: "FK_batch_status_change_batch_batch_id",
                        column: x => x.batch_id,
                        principalSchema: "inventory",
                        principalTable: "batch",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "stock_ledger_entry",
                schema: "inventory",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    sequence = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityAlwaysColumn),
                    occurred_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    branch_id = table.Column<Guid>(type: "uuid", nullable: false),
                    location_id = table.Column<Guid>(type: "uuid", nullable: false),
                    sku_id = table.Column<Guid>(type: "uuid", nullable: false),
                    batch_id = table.Column<Guid>(type: "uuid", nullable: false),
                    kind = table.Column<int>(type: "integer", nullable: false),
                    quantity_delta = table.Column<decimal>(type: "numeric(12,3)", precision: 12, scale: 3, nullable: false),
                    consumes_reservation = table.Column<bool>(type: "boolean", nullable: false),
                    reference_kind = table.Column<int>(type: "integer", nullable: false),
                    reference_id = table.Column<Guid>(type: "uuid", nullable: false),
                    reference_line_id = table.Column<Guid>(type: "uuid", nullable: true),
                    reference_label = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: true),
                    customer_id = table.Column<Guid>(type: "uuid", nullable: true),
                    fefo_overridden = table.Column<bool>(type: "boolean", nullable: false),
                    override_reason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    performed_by = table.Column<Guid>(type: "uuid", nullable: false),
                    note = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Language = table.Column<string>(type: "text", nullable: true),
                    LastUpdatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tags = table.Column<string[]>(type: "text[]", nullable: true),
                    VerticalId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceId = table.Column<string>(type: "text", nullable: true),
                    IsMarkedToDelete = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_stock_ledger_entry", x => x.Id);
                    table.ForeignKey(
                        name: "FK_stock_ledger_entry_batch_batch_id",
                        column: x => x.batch_id,
                        principalSchema: "inventory",
                        principalTable: "batch",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_stock_ledger_entry_stock_location_location_id",
                        column: x => x.location_id,
                        principalSchema: "inventory",
                        principalTable: "stock_location",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "stock_reservation_entry",
                schema: "inventory",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    sequence = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityAlwaysColumn),
                    occurred_on = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    branch_id = table.Column<Guid>(type: "uuid", nullable: false),
                    location_id = table.Column<Guid>(type: "uuid", nullable: false),
                    sku_id = table.Column<Guid>(type: "uuid", nullable: false),
                    batch_id = table.Column<Guid>(type: "uuid", nullable: false),
                    kind = table.Column<int>(type: "integer", nullable: false),
                    quantity_delta = table.Column<decimal>(type: "numeric(12,3)", precision: 12, scale: 3, nullable: false),
                    reference_kind = table.Column<int>(type: "integer", nullable: false),
                    reference_id = table.Column<Guid>(type: "uuid", nullable: false),
                    reference_line_id = table.Column<Guid>(type: "uuid", nullable: false),
                    customer_id = table.Column<Guid>(type: "uuid", nullable: true),
                    fefo_overridden = table.Column<bool>(type: "boolean", nullable: false),
                    override_reason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    performed_by = table.Column<Guid>(type: "uuid", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Language = table.Column<string>(type: "text", nullable: true),
                    LastUpdatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUpdatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tags = table.Column<string[]>(type: "text[]", nullable: true),
                    VerticalId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceId = table.Column<string>(type: "text", nullable: true),
                    IsMarkedToDelete = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_stock_reservation_entry", x => x.Id);
                    table.ForeignKey(
                        name: "FK_stock_reservation_entry_batch_batch_id",
                        column: x => x.batch_id,
                        principalSchema: "inventory",
                        principalTable: "batch",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_stock_reservation_entry_stock_location_location_id",
                        column: x => x.location_id,
                        principalSchema: "inventory",
                        principalTable: "stock_location",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "order_line_allocation",
                schema: "ordering",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    sku_id = table.Column<Guid>(type: "uuid", nullable: false),
                    batch_id = table.Column<Guid>(type: "uuid", nullable: false),
                    lot_number = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    location_id = table.Column<Guid>(type: "uuid", nullable: false),
                    quantity = table.Column<decimal>(type: "numeric(14,3)", nullable: false),
                    batch_expires_on = table.Column<DateOnly>(type: "date", nullable: true),
                    order_line_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_order_line_allocation", x => x.id);
                    table.ForeignKey(
                        name: "FK_order_line_allocation_order_line_order_line_id",
                        column: x => x.order_line_id,
                        principalSchema: "ordering",
                        principalTable: "order_line",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_accounting_export_run_run_on",
                schema: "billing",
                table: "accounting_export_run",
                column: "run_on");

            migrationBuilder.CreateIndex(
                name: "ix_audit_entry_action_occurred",
                schema: "audit",
                table: "audit_entry",
                columns: new[] { "Action", "OccurredOn" });

            migrationBuilder.CreateIndex(
                name: "ix_audit_entry_actor_occurred",
                schema: "audit",
                table: "audit_entry",
                columns: new[] { "ActorUserId", "OccurredOn" });

            migrationBuilder.CreateIndex(
                name: "IX_audit_entry_correlation_id",
                schema: "audit",
                table: "audit_entry",
                column: "correlation_id");

            migrationBuilder.CreateIndex(
                name: "ix_audit_entry_entity_type_occurred",
                schema: "audit",
                table: "audit_entry",
                columns: new[] { "EntityType", "OccurredOn" });

            migrationBuilder.CreateIndex(
                name: "IX_audit_entry_EntityType_EntityId",
                schema: "audit",
                table: "audit_entry",
                columns: new[] { "EntityType", "EntityId" });

            migrationBuilder.CreateIndex(
                name: "IX_audit_entry_EntityType_EntityId_OccurredOn",
                schema: "audit",
                table: "audit_entry",
                columns: new[] { "EntityType", "EntityId", "OccurredOn" });

            migrationBuilder.CreateIndex(
                name: "ix_audit_entry_occurred",
                schema: "audit",
                table: "audit_entry",
                column: "OccurredOn");

            migrationBuilder.CreateIndex(
                name: "ix_backup_run_kind_finished_on",
                schema: "ops",
                table: "backup_run",
                columns: new[] { "kind", "finished_on" });

            migrationBuilder.CreateIndex(
                name: "ix_bank_match_line",
                schema: "billing",
                table: "bank_match",
                column: "statement_line_id",
                unique: true,
                filter: "unmatched_on IS NULL");

            migrationBuilder.CreateIndex(
                name: "ix_bank_match_payment",
                schema: "billing",
                table: "bank_match",
                column: "payment_id",
                unique: true,
                filter: "unmatched_on IS NULL");

            migrationBuilder.CreateIndex(
                name: "ix_bank_match_statement",
                schema: "billing",
                table: "bank_match",
                column: "statement_id");

            migrationBuilder.CreateIndex(
                name: "ix_bank_statement_branch_imported_on",
                schema: "billing",
                table: "bank_statement",
                columns: new[] { "branch_id", "imported_on" });

            migrationBuilder.CreateIndex(
                name: "ix_bank_statement_source",
                schema: "billing",
                table: "bank_statement",
                columns: new[] { "bank_account_label", "source_sha256" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_bank_statement_line_date",
                schema: "billing",
                table: "bank_statement_line",
                column: "transaction_date");

            migrationBuilder.CreateIndex(
                name: "IX_bank_statement_line_statement_id",
                schema: "billing",
                table: "bank_statement_line",
                column: "statement_id");

            migrationBuilder.CreateIndex(
                name: "ix_batch_branch_status",
                schema: "inventory",
                table: "batch",
                columns: new[] { "branch_id", "status" });

            migrationBuilder.CreateIndex(
                name: "ix_batch_consignment",
                schema: "inventory",
                table: "batch",
                column: "consignment_id");

            migrationBuilder.CreateIndex(
                name: "ix_batch_lot_number",
                schema: "inventory",
                table: "batch",
                column: "lot_number");

            migrationBuilder.CreateIndex(
                name: "ix_batch_recall_number",
                schema: "inventory",
                table: "batch",
                column: "recall_number",
                unique: true,
                filter: "recall_number IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_batch_receipt_lot",
                schema: "inventory",
                table: "batch",
                columns: new[] { "goods_receipt_id", "sku_id", "lot_number", "expires_on" },
                unique: true)
                .Annotation("Npgsql:NullsDistinct", false);

            migrationBuilder.CreateIndex(
                name: "ix_batch_sku_status_expires_on",
                schema: "inventory",
                table: "batch",
                columns: new[] { "sku_id", "status", "expires_on" });

            migrationBuilder.CreateIndex(
                name: "IX_batch_status_change_batch_id",
                schema: "inventory",
                table: "batch_status_change",
                column: "batch_id");

            migrationBuilder.CreateIndex(
                name: "IX_billing_profile_bank_account_billing_profile_id",
                schema: "billing",
                table: "billing_profile_bank_account",
                column: "billing_profile_id");

            migrationBuilder.CreateIndex(
                name: "ix_branch_code",
                schema: "admin",
                table: "branch",
                column: "code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_branch_closure_branch_range",
                schema: "admin",
                table: "branch_closure",
                columns: new[] { "branch_id", "starts_on", "ends_on" });

            migrationBuilder.CreateIndex(
                name: "IX_branch_opening_interval_branch_id",
                schema: "admin",
                table: "branch_opening_interval",
                column: "branch_id");

            migrationBuilder.CreateIndex(
                name: "ix_bundle_component_component_sku_id",
                schema: "product",
                table: "bundle_component",
                column: "component_sku_id");

            migrationBuilder.CreateIndex(
                name: "IX_bundle_component_product_id",
                schema: "product",
                table: "bundle_component",
                column: "product_id");

            migrationBuilder.CreateIndex(
                name: "ix_cart_active_customer",
                schema: "ordering",
                table: "cart",
                column: "customer_id",
                unique: true,
                filter: "status = 1 AND customer_id IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_cart_guest_purge",
                schema: "ordering",
                table: "cart",
                columns: new[] { "owner_kind", "status", "last_activity_on" });

            migrationBuilder.CreateIndex(
                name: "ix_cart_guest_token",
                schema: "ordering",
                table: "cart",
                column: "guest_token_hash",
                unique: true,
                filter: "guest_token_hash IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_cart_line_cart",
                schema: "ordering",
                table: "cart_line",
                column: "cart_id");

            migrationBuilder.CreateIndex(
                name: "ix_cash_up_branch_date",
                schema: "billing",
                table: "cash_up",
                columns: new[] { "branch_id", "business_date" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_charge_branch_service_date",
                schema: "billing",
                table: "charge",
                columns: new[] { "branch_id", "service_date" });

            migrationBuilder.CreateIndex(
                name: "ix_charge_customer_status",
                schema: "billing",
                table: "charge",
                columns: new[] { "customer_id", "status" });

            migrationBuilder.CreateIndex(
                name: "ix_charge_source",
                schema: "billing",
                table: "charge",
                columns: new[] { "source_kind", "source_id", "source_line_ref" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_cod_remittance_branch_courier",
                schema: "billing",
                table: "cod_remittance",
                columns: new[] { "branch_id", "courier_code", "received_on" });

            migrationBuilder.CreateIndex(
                name: "ix_cod_remittance_line_payment",
                schema: "billing",
                table: "cod_remittance_line",
                column: "payment_id");

            migrationBuilder.CreateIndex(
                name: "IX_cod_remittance_line_remittance_id",
                schema: "billing",
                table: "cod_remittance_line",
                column: "remittance_id");

            migrationBuilder.CreateIndex(
                name: "ix_consignment_branch_status",
                schema: "inventory",
                table: "consignment",
                columns: new[] { "branch_id", "status" });

            migrationBuilder.CreateIndex(
                name: "ix_consignment_reference",
                schema: "inventory",
                table: "consignment",
                column: "reference",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_consignment_cost_consignment_id",
                schema: "inventory",
                table: "consignment_cost",
                column: "consignment_id");

            migrationBuilder.CreateIndex(
                name: "IX_consignment_document_consignment_id",
                schema: "inventory",
                table: "consignment_document",
                column: "consignment_id");

            migrationBuilder.CreateIndex(
                name: "ix_consignment_exchange_rate_currency",
                schema: "inventory",
                table: "consignment_exchange_rate",
                columns: new[] { "consignment_id", "currency_code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_consignment_hs_code_consignment_id",
                schema: "inventory",
                table: "consignment_hs_code",
                column: "consignment_id");

            migrationBuilder.CreateIndex(
                name: "ix_consignment_landed_cost_line_batch",
                schema: "inventory",
                table: "consignment_landed_cost_line",
                column: "batch_id");

            migrationBuilder.CreateIndex(
                name: "IX_consignment_landed_cost_line_consignment_id",
                schema: "inventory",
                table: "consignment_landed_cost_line",
                column: "consignment_id");

            migrationBuilder.CreateIndex(
                name: "IX_consignment_status_change_consignment_id",
                schema: "inventory",
                table: "consignment_status_change",
                column: "consignment_id");

            migrationBuilder.CreateIndex(
                name: "ix_content_item_kind_slug",
                schema: "admin",
                table: "content_item",
                columns: new[] { "kind", "slug" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_courier_name",
                schema: "ordering",
                table: "courier",
                column: "name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_credit_note_customer_issued_on",
                schema: "billing",
                table: "credit_note",
                columns: new[] { "customer_id", "issued_on" });

            migrationBuilder.CreateIndex(
                name: "ix_credit_note_idempotency",
                schema: "billing",
                table: "credit_note",
                columns: new[] { "issued_by", "idempotency_key" },
                unique: true,
                filter: "idempotency_key IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_credit_note_invoice",
                schema: "billing",
                table: "credit_note",
                column: "invoice_id");

            migrationBuilder.CreateIndex(
                name: "ix_credit_note_number",
                schema: "billing",
                table: "credit_note",
                column: "number",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_credit_note_sequence",
                schema: "billing",
                table: "credit_note",
                columns: new[] { "branch_id", "financial_year", "sequence_number" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_credit_note_line_credit_note_id",
                schema: "billing",
                table: "credit_note_line",
                column: "credit_note_id");

            migrationBuilder.CreateIndex(
                name: "ix_credit_note_line_invoice_line",
                schema: "billing",
                table: "credit_note_line",
                column: "invoice_line_id");

            migrationBuilder.CreateIndex(
                name: "ix_customer_account_additional_phone_numbers",
                schema: "account",
                table: "customer_account",
                column: "additional_phone_numbers")
                .Annotation("Npgsql:IndexMethod", "GIN");

            migrationBuilder.CreateIndex(
                name: "ix_customer_account_email_address",
                schema: "account",
                table: "customer_account",
                column: "email_address",
                unique: true,
                filter: "email_address IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_customer_account_merged_into_customer_id",
                schema: "account",
                table: "customer_account",
                column: "merged_into_customer_id");

            migrationBuilder.CreateIndex(
                name: "ix_customer_account_mobile_number",
                schema: "account",
                table: "customer_account",
                column: "mobile_number",
                unique: true,
                filter: "mobile_number IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_customer_delivery_address_customer_id",
                schema: "account",
                table: "customer_delivery_address",
                column: "customer_id");

            migrationBuilder.CreateIndex(
                name: "IX_customer_marketing_consent_customer_id",
                schema: "account",
                table: "customer_marketing_consent",
                column: "customer_id");

            migrationBuilder.CreateIndex(
                name: "ix_customer_session_customer_account_id_expires_on",
                schema: "account",
                table: "customer_session",
                columns: new[] { "customer_account_id", "expires_on" });

            migrationBuilder.CreateIndex(
                name: "ix_customer_session_token_hash",
                schema: "account",
                table: "customer_session",
                column: "token_hash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_delivery_zone_branch_active",
                schema: "ordering",
                table: "delivery_zone",
                columns: new[] { "branch_id", "is_active" });

            migrationBuilder.CreateIndex(
                name: "ix_delivery_zone_name",
                schema: "ordering",
                table: "delivery_zone",
                column: "name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_delivery_zone_coverage_zone",
                schema: "ordering",
                table: "delivery_zone_coverage",
                column: "delivery_zone_id");

            migrationBuilder.CreateIndex(
                name: "ix_delivery_zone_service_level",
                schema: "ordering",
                table: "delivery_zone_service",
                columns: new[] { "delivery_zone_id", "service_level" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_discount_code_code",
                schema: "ordering",
                table: "discount_code",
                column: "code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_document_number_series",
                schema: "billing",
                table: "document_number_series",
                columns: new[] { "branch_id", "financial_year", "document_kind" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_erasure_request_status_requested_on",
                schema: "ops",
                table: "erasure_request",
                columns: new[] { "status", "requested_on" });

            migrationBuilder.CreateIndex(
                name: "ix_erasure_scope_request_context",
                schema: "ops",
                table: "erasure_scope",
                columns: new[] { "erasure_request_id", "context_key" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_erasure_scope_status_held_until",
                schema: "ops",
                table: "erasure_scope",
                columns: new[] { "status", "held_until" });

            migrationBuilder.CreateIndex(
                name: "ix_goods_receipt_branch_received_on",
                schema: "inventory",
                table: "goods_receipt",
                columns: new[] { "branch_id", "received_on" });

            migrationBuilder.CreateIndex(
                name: "ix_goods_receipt_consignment",
                schema: "inventory",
                table: "goods_receipt",
                column: "consignment_id");

            migrationBuilder.CreateIndex(
                name: "ix_goods_receipt_number",
                schema: "inventory",
                table: "goods_receipt",
                column: "number",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_goods_receipt_purchase_order",
                schema: "inventory",
                table: "goods_receipt",
                column: "purchase_order_id");

            migrationBuilder.CreateIndex(
                name: "ix_goods_receipt_line_batch",
                schema: "inventory",
                table: "goods_receipt_line",
                column: "batch_id");

            migrationBuilder.CreateIndex(
                name: "IX_goods_receipt_line_goods_receipt_id",
                schema: "inventory",
                table: "goods_receipt_line",
                column: "goods_receipt_id");

            migrationBuilder.CreateIndex(
                name: "ix_goods_receipt_line_purchase_order_line",
                schema: "inventory",
                table: "goods_receipt_line",
                column: "purchase_order_line_id");

            migrationBuilder.CreateIndex(
                name: "ix_idempotency_record_created_on",
                schema: "ops",
                table: "idempotency_record",
                column: "created_on");

            migrationBuilder.CreateIndex(
                name: "ix_idempotency_record_scope_key",
                schema: "ops",
                table: "idempotency_record",
                columns: new[] { "scope", "key" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_inbound_webhook_receipt_provider_event",
                schema: "ops",
                table: "inbound_webhook_receipt",
                columns: new[] { "provider", "event_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_invoice_branch_issue_date",
                schema: "billing",
                table: "invoice",
                columns: new[] { "branch_id", "issue_date" });

            migrationBuilder.CreateIndex(
                name: "ix_invoice_corrects_invoice",
                schema: "billing",
                table: "invoice",
                column: "corrects_invoice_id");

            migrationBuilder.CreateIndex(
                name: "ix_invoice_customer_status",
                schema: "billing",
                table: "invoice",
                columns: new[] { "customer_id", "status" });

            migrationBuilder.CreateIndex(
                name: "ix_invoice_idempotency",
                schema: "billing",
                table: "invoice",
                columns: new[] { "issued_by", "issue_idempotency_key" },
                unique: true,
                filter: "issue_idempotency_key IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_invoice_number",
                schema: "billing",
                table: "invoice",
                column: "number",
                unique: true,
                filter: "number IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_invoice_sequence",
                schema: "billing",
                table: "invoice",
                columns: new[] { "branch_id", "financial_year", "sequence_number" },
                unique: true,
                filter: "sequence_number IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_invoice_status_due_on",
                schema: "billing",
                table: "invoice",
                columns: new[] { "status", "due_on" });

            migrationBuilder.CreateIndex(
                name: "ix_invoice_line_charge",
                schema: "billing",
                table: "invoice_line",
                column: "charge_id",
                unique: true,
                filter: "charge_id IS NOT NULL AND NOT invoice_discarded");

            migrationBuilder.CreateIndex(
                name: "IX_invoice_line_invoice_id",
                schema: "billing",
                table: "invoice_line",
                column: "invoice_id");

            migrationBuilder.CreateIndex(
                name: "ix_leave_request_staff_range",
                schema: "admin",
                table: "leave_request",
                columns: new[] { "staff_account_id", "starts_on", "ends_on" });

            migrationBuilder.CreateIndex(
                name: "ix_leave_request_status",
                schema: "admin",
                table: "leave_request",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "ix_loyalty_entry_customer_occurred_on",
                schema: "billing",
                table: "loyalty_entry",
                columns: new[] { "customer_id", "occurred_on" });

            migrationBuilder.CreateIndex(
                name: "ix_loyalty_entry_kind_credit_note",
                schema: "billing",
                table: "loyalty_entry",
                columns: new[] { "kind", "credit_note_id" },
                unique: true,
                filter: "idempotent_source AND credit_note_id IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_loyalty_entry_kind_invoice",
                schema: "billing",
                table: "loyalty_entry",
                columns: new[] { "kind", "invoice_id" },
                unique: true,
                filter: "idempotent_source AND invoice_id IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_loyalty_entry_kind_source_customer",
                schema: "billing",
                table: "loyalty_entry",
                columns: new[] { "kind", "source_customer_id" },
                unique: true,
                filter: "idempotent_source AND source_customer_id IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_notification_created",
                schema: "notify",
                table: "notification",
                column: "created_on");

            migrationBuilder.CreateIndex(
                name: "ix_notification_destination_created",
                schema: "notify",
                table: "notification",
                columns: new[] { "destination", "created_on" });

            migrationBuilder.CreateIndex(
                name: "ix_notification_fallback_from_id",
                schema: "notify",
                table: "notification",
                column: "fallback_from_id");

            migrationBuilder.CreateIndex(
                name: "ix_notification_inbox",
                schema: "notify",
                table: "notification",
                columns: new[] { "recipient_id", "channel", "read_on", "created_on" });

            migrationBuilder.CreateIndex(
                name: "ix_notification_recipient_created",
                schema: "notify",
                table: "notification",
                columns: new[] { "recipient_id", "created_on" });

            migrationBuilder.CreateIndex(
                name: "ix_notification_request_id",
                schema: "notify",
                table: "notification",
                column: "request_id");

            migrationBuilder.CreateIndex(
                name: "ix_notification_resend_of_id",
                schema: "notify",
                table: "notification",
                column: "resend_of_id");

            migrationBuilder.CreateIndex(
                name: "ix_notification_resend_of_id_ordinal",
                schema: "notify",
                table: "notification",
                columns: new[] { "resend_of_id", "resend_ordinal" },
                unique: true,
                filter: "resend_of_id IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_notification_status_notbefore_nextattempt",
                schema: "notify",
                table: "notification",
                columns: new[] { "status", "not_before", "next_attempt_on" });

            migrationBuilder.CreateIndex(
                name: "ix_notification_templatekey_created",
                schema: "notify",
                table: "notification",
                columns: new[] { "template_key", "created_on" });

            migrationBuilder.CreateIndex(
                name: "ix_notification_unsubscribe_token_hash",
                schema: "notify",
                table: "notification",
                column: "unsubscribe_token_hash",
                unique: true,
                filter: "unsubscribe_token_hash IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_notification_attempt_notification_id",
                schema: "notify",
                table: "notification_attempt",
                column: "notification_id");

            migrationBuilder.CreateIndex(
                name: "ix_notification_request_dedup",
                schema: "notify",
                table: "notification_request",
                column: "deduplication_key",
                unique: true,
                filter: "deduplication_key IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_notification_request_status_requested_on",
                schema: "notify",
                table: "notification_request",
                columns: new[] { "status", "requested_on" });

            migrationBuilder.CreateIndex(
                name: "ix_notification_template_key",
                schema: "notify",
                table: "notification_template",
                column: "key",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_notification_template_content_template_channel",
                schema: "notify",
                table: "notification_template_content",
                columns: new[] { "template_id", "channel" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_order_line_order",
                schema: "ordering",
                table: "order_line",
                column: "order_id");

            migrationBuilder.CreateIndex(
                name: "ix_order_line_allocation_batch",
                schema: "ordering",
                table: "order_line_allocation",
                column: "batch_id");

            migrationBuilder.CreateIndex(
                name: "IX_order_line_allocation_order_line_id",
                schema: "ordering",
                table: "order_line_allocation",
                column: "order_line_id");

            migrationBuilder.CreateIndex(
                name: "ix_order_payment_ref_order",
                schema: "ordering",
                table: "order_payment_ref",
                column: "order_id");

            migrationBuilder.CreateIndex(
                name: "ix_order_refund_order",
                schema: "ordering",
                table: "order_refund",
                column: "order_id");

            migrationBuilder.CreateIndex(
                name: "ix_order_status_change_order",
                schema: "ordering",
                table: "order_status_change",
                column: "order_id");

            migrationBuilder.CreateIndex(
                name: "ix_password_reset_token_token_hash",
                schema: "account",
                table: "password_reset_token",
                column: "token_hash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_payment_branch_business_date",
                schema: "billing",
                table: "payment",
                columns: new[] { "branch_id", "business_date" });

            migrationBuilder.CreateIndex(
                name: "ix_payment_customer_status",
                schema: "billing",
                table: "payment",
                columns: new[] { "customer_id", "status" });

            migrationBuilder.CreateIndex(
                name: "ix_payment_earmark",
                schema: "billing",
                table: "payment",
                columns: new[] { "earmark_kind", "earmark_source_id" });

            migrationBuilder.CreateIndex(
                name: "ix_payment_idempotency",
                schema: "billing",
                table: "payment",
                columns: new[] { "recorded_by", "idempotency_key" },
                unique: true,
                filter: "idempotency_key IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_payment_method_status_received_on",
                schema: "billing",
                table: "payment",
                columns: new[] { "method", "status", "received_on" });

            migrationBuilder.CreateIndex(
                name: "ix_payment_status_recorded_on",
                schema: "billing",
                table: "payment",
                columns: new[] { "status", "recorded_on" });

            migrationBuilder.CreateIndex(
                name: "ix_payment_allocation_entry_invoice",
                schema: "billing",
                table: "payment_allocation_entry",
                column: "invoice_id");

            migrationBuilder.CreateIndex(
                name: "IX_payment_allocation_entry_payment_id",
                schema: "billing",
                table: "payment_allocation_entry",
                column: "payment_id");

            migrationBuilder.CreateIndex(
                name: "IX_payment_requested_allocation_payment_id",
                schema: "billing",
                table: "payment_requested_allocation",
                column: "payment_id");

            migrationBuilder.CreateIndex(
                name: "ix_policy_acceptance_customer_key_number",
                schema: "admin",
                table: "policy_acceptance",
                columns: new[] { "customer_account_id", "policy_key", "version_number" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_policy_document_key",
                schema: "admin",
                table: "policy_document",
                column: "key",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_policy_version_key_number",
                schema: "admin",
                table: "policy_version",
                columns: new[] { "policy_key", "version_number" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_product_brand",
                schema: "product",
                table: "product",
                column: "brand",
                filter: "status = 2");

            migrationBuilder.CreateIndex(
                name: "ix_product_country_of_origin",
                schema: "product",
                table: "product",
                column: "country_of_origin_code",
                filter: "status = 2");

            migrationBuilder.CreateIndex(
                name: "ix_product_first_published_on_desc",
                schema: "product",
                table: "product",
                column: "first_published_on",
                descending: new bool[0]);

            migrationBuilder.CreateIndex(
                name: "ix_product_slug",
                schema: "product",
                table: "product",
                column: "slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_product_status_listed_category_subcategory",
                schema: "product",
                table: "product",
                columns: new[] { "status", "listed_on_storefront", "category", "subcategory" });

            migrationBuilder.CreateIndex(
                name: "IX_product_image_product_id",
                schema: "product",
                table: "product_image",
                column: "product_id");

            migrationBuilder.CreateIndex(
                name: "ix_product_review_active_per_customer_product",
                schema: "product",
                table: "product_review",
                columns: new[] { "customer_id", "product_id" },
                unique: true,
                filter: "status <> 5");

            migrationBuilder.CreateIndex(
                name: "ix_product_review_product_status_submitted",
                schema: "product",
                table: "product_review",
                columns: new[] { "product_id", "status", "submitted_on" });

            migrationBuilder.CreateIndex(
                name: "ix_product_review_status_submitted",
                schema: "product",
                table: "product_review",
                columns: new[] { "status", "submitted_on" });

            migrationBuilder.CreateIndex(
                name: "IX_product_translation_product_id",
                schema: "product",
                table: "product_translation",
                column: "product_id");

            migrationBuilder.CreateIndex(
                name: "ix_purchase_order_branch_status",
                schema: "inventory",
                table: "purchase_order",
                columns: new[] { "branch_id", "status" });

            migrationBuilder.CreateIndex(
                name: "ix_purchase_order_number",
                schema: "inventory",
                table: "purchase_order",
                column: "number",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_purchase_order_supplier",
                schema: "inventory",
                table: "purchase_order",
                column: "supplier_id");

            migrationBuilder.CreateIndex(
                name: "ix_purchase_order_line_order_sku",
                schema: "inventory",
                table: "purchase_order_line",
                columns: new[] { "purchase_order_id", "sku_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_reconciliation_issue_branch_status_raised",
                schema: "ordering",
                table: "reconciliation_issue",
                columns: new[] { "branch_id", "status", "raised_on" });

            migrationBuilder.CreateIndex(
                name: "ix_reconciliation_issue_order",
                schema: "ordering",
                table: "reconciliation_issue",
                column: "order_id");

            migrationBuilder.CreateIndex(
                name: "ix_reconciliation_issue_status_raised",
                schema: "ordering",
                table: "reconciliation_issue",
                columns: new[] { "status", "raised_on" });

            migrationBuilder.CreateIndex(
                name: "ix_refund_branch_business_date",
                schema: "billing",
                table: "refund",
                columns: new[] { "branch_id", "business_date" });

            migrationBuilder.CreateIndex(
                name: "ix_refund_customer",
                schema: "billing",
                table: "refund",
                column: "customer_id");

            migrationBuilder.CreateIndex(
                name: "ix_refund_idempotency",
                schema: "billing",
                table: "refund",
                columns: new[] { "issued_by", "idempotency_key" },
                unique: true,
                filter: "idempotency_key IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_refund_payment",
                schema: "billing",
                table: "refund",
                column: "payment_id");

            migrationBuilder.CreateIndex(
                name: "IX_related_product_product_id",
                schema: "product",
                table: "related_product",
                column: "product_id");

            migrationBuilder.CreateIndex(
                name: "ix_reorder_policy_location",
                schema: "inventory",
                table: "reorder_policy",
                column: "location_id");

            migrationBuilder.CreateIndex(
                name: "ix_reorder_policy_sku_location",
                schema: "inventory",
                table: "reorder_policy",
                columns: new[] { "sku_id", "location_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_report_schedule_status_next_run_on",
                schema: "report",
                table: "report_schedule",
                columns: new[] { "status", "next_run_on" });

            migrationBuilder.CreateIndex(
                name: "IX_restore_check_result_restore_test_record_id",
                schema: "ops",
                table: "restore_check_result",
                column: "restore_test_record_id");

            migrationBuilder.CreateIndex(
                name: "ix_restore_test_record_outcome_performed_on",
                schema: "ops",
                table: "restore_test_record",
                columns: new[] { "outcome", "performed_on" });

            migrationBuilder.CreateIndex(
                name: "ix_restore_test_record_performed_on",
                schema: "ops",
                table: "restore_test_record",
                column: "performed_on");

            migrationBuilder.CreateIndex(
                name: "IX_retention_pass_result_retention_run_id",
                schema: "ops",
                table: "retention_pass_result",
                column: "retention_run_id");

            migrationBuilder.CreateIndex(
                name: "ix_retention_run_requested_on",
                schema: "ops",
                table: "retention_run",
                column: "requested_on");

            migrationBuilder.CreateIndex(
                name: "ix_retention_run_status",
                schema: "ops",
                table: "retention_run",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "ix_return_line_return",
                schema: "ordering",
                table: "return_line",
                column: "return_request_id");

            migrationBuilder.CreateIndex(
                name: "ix_return_request_customer",
                schema: "ordering",
                table: "return_request",
                column: "customer_id");

            migrationBuilder.CreateIndex(
                name: "ix_return_request_order",
                schema: "ordering",
                table: "return_request",
                column: "order_id");

            migrationBuilder.CreateIndex(
                name: "ix_return_request_status_requested",
                schema: "ordering",
                table: "return_request",
                columns: new[] { "status", "requested_on" });

            migrationBuilder.CreateIndex(
                name: "ix_roster_exception_branch_date",
                schema: "admin",
                table: "roster_exception",
                columns: new[] { "branch_id", "date" });

            migrationBuilder.CreateIndex(
                name: "ix_roster_exception_staff_date",
                schema: "admin",
                table: "roster_exception",
                columns: new[] { "staff_account_id", "date" });

            migrationBuilder.CreateIndex(
                name: "ix_sales_order_customer_idempotency",
                schema: "ordering",
                table: "sales_order",
                columns: new[] { "customer_id", "idempotency_key" },
                unique: true,
                filter: "idempotency_key IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_sales_order_customer_placed",
                schema: "ordering",
                table: "sales_order",
                columns: new[] { "customer_id", "placed_on" });

            migrationBuilder.CreateIndex(
                name: "ix_sales_order_discount_customer",
                schema: "ordering",
                table: "sales_order",
                columns: new[] { "discount_code_id", "customer_id" },
                filter: "discount_code_id IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_sales_order_expiry",
                schema: "ordering",
                table: "sales_order",
                columns: new[] { "status", "payment_method", "payment_due_by" });

            migrationBuilder.CreateIndex(
                name: "ix_sales_order_number",
                schema: "ordering",
                table: "sales_order",
                column: "order_number",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_sales_order_queue",
                schema: "ordering",
                table: "sales_order",
                columns: new[] { "branch_id", "status", "placed_on" });

            migrationBuilder.CreateIndex(
                name: "ix_sales_order_tracking",
                schema: "ordering",
                table: "sales_order",
                column: "shipment_tracking_number",
                filter: "shipment_tracking_number IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_scheduled_report_run_schedule_generated_on",
                schema: "report",
                table: "scheduled_report_run",
                columns: new[] { "schedule_id", "generated_on" });

            migrationBuilder.CreateIndex(
                name: "ix_scheduled_report_run_slot",
                schema: "report",
                table: "scheduled_report_run",
                columns: new[] { "schedule_id", "due_on" },
                unique: true,
                filter: "\"trigger\" = 1 AND status IN (1, 3)");

            migrationBuilder.CreateIndex(
                name: "ix_scheduled_report_run_status_generated_on",
                schema: "report",
                table: "scheduled_report_run",
                columns: new[] { "status", "generated_on" });

            migrationBuilder.CreateIndex(
                name: "ix_sku_barcode",
                schema: "product",
                table: "sku",
                column: "barcode",
                unique: true,
                filter: "barcode IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_sku_code",
                schema: "product",
                table: "sku",
                column: "code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_sku_id",
                schema: "product",
                table: "sku",
                column: "Id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_sku_product_status",
                schema: "product",
                table: "sku",
                columns: new[] { "product_id", "status" });

            migrationBuilder.CreateIndex(
                name: "ix_sku_price_sku_effective",
                schema: "product",
                table: "sku_price",
                columns: new[] { "sku_id", "effective_from" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_sourcing_origin_country",
                schema: "product",
                table: "sourcing_origin",
                column: "country_code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_staff_account_email_address",
                schema: "account",
                table: "staff_account",
                column: "email_address",
                unique: true,
                filter: "email_address IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_staff_account_mobile_number",
                schema: "account",
                table: "staff_account",
                column: "mobile_number",
                unique: true,
                filter: "mobile_number IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_staff_account_role_ids",
                schema: "account",
                table: "staff_account",
                column: "role_ids")
                .Annotation("Npgsql:IndexMethod", "GIN");

            migrationBuilder.CreateIndex(
                name: "ix_staff_roster_staff_branch",
                schema: "admin",
                table: "staff_roster",
                columns: new[] { "staff_account_id", "branch_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_staff_roster_current_shift_staff_roster_id",
                schema: "admin",
                table: "staff_roster_current_shift",
                column: "staff_roster_id");

            migrationBuilder.CreateIndex(
                name: "IX_staff_roster_next_shift_staff_roster_id",
                schema: "admin",
                table: "staff_roster_next_shift",
                column: "staff_roster_id");

            migrationBuilder.CreateIndex(
                name: "ix_staff_session_staff_account_id_expires_on",
                schema: "account",
                table: "staff_session",
                columns: new[] { "staff_account_id", "expires_on" });

            migrationBuilder.CreateIndex(
                name: "ix_staff_session_token_hash",
                schema: "account",
                table: "staff_session",
                column: "token_hash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_stock_adjustment_branch_status",
                schema: "inventory",
                table: "stock_adjustment",
                columns: new[] { "branch_id", "status" });

            migrationBuilder.CreateIndex(
                name: "ix_stock_adjustment_number",
                schema: "inventory",
                table: "stock_adjustment",
                column: "number",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_stock_adjustment_line_batch",
                schema: "inventory",
                table: "stock_adjustment_line",
                column: "batch_id");

            migrationBuilder.CreateIndex(
                name: "IX_stock_adjustment_line_stock_adjustment_id",
                schema: "inventory",
                table: "stock_adjustment_line",
                column: "stock_adjustment_id");

            migrationBuilder.CreateIndex(
                name: "ix_stock_alert_branch_status_kind",
                schema: "inventory",
                table: "stock_alert",
                columns: new[] { "branch_id", "status", "kind" });

            migrationBuilder.CreateIndex(
                name: "ix_stock_alert_dedup_key",
                schema: "inventory",
                table: "stock_alert",
                column: "dedup_key",
                unique: true,
                filter: "dedup_key IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_stock_alert_one_live_per_pair",
                schema: "inventory",
                table: "stock_alert",
                columns: new[] { "kind", "sku_id", "location_id" },
                unique: true,
                filter: "status <> 3 AND kind IN (3, 6)");

            migrationBuilder.CreateIndex(
                name: "ix_stock_alert_pending_per_customer_sku",
                schema: "product",
                table: "stock_alert",
                columns: new[] { "customer_id", "sku_id" },
                unique: true,
                filter: "status = 1");

            migrationBuilder.CreateIndex(
                name: "ix_stock_alert_status_sku",
                schema: "product",
                table: "stock_alert",
                columns: new[] { "status", "sku_id" });

            migrationBuilder.CreateIndex(
                name: "ix_stock_count_branch_status",
                schema: "inventory",
                table: "stock_count",
                columns: new[] { "branch_id", "status" });

            migrationBuilder.CreateIndex(
                name: "ix_stock_count_number",
                schema: "inventory",
                table: "stock_count",
                column: "number",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_stock_count_one_active",
                schema: "inventory",
                table: "stock_count",
                column: "location_id",
                unique: true,
                filter: "status IN (1, 2, 3)");

            migrationBuilder.CreateIndex(
                name: "ix_stock_count_line_count_sku_batch",
                schema: "inventory",
                table: "stock_count_line",
                columns: new[] { "stock_count_id", "sku_id", "batch_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_stock_ledger_entry_batch_sequence",
                schema: "inventory",
                table: "stock_ledger_entry",
                columns: new[] { "batch_id", "sequence" });

            migrationBuilder.CreateIndex(
                name: "ix_stock_ledger_entry_branch_kind_occurred_on",
                schema: "inventory",
                table: "stock_ledger_entry",
                columns: new[] { "branch_id", "kind", "occurred_on" });

            migrationBuilder.CreateIndex(
                name: "ix_stock_ledger_entry_customer",
                schema: "inventory",
                table: "stock_ledger_entry",
                column: "customer_id",
                filter: "customer_id IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_stock_ledger_entry_location_id",
                schema: "inventory",
                table: "stock_ledger_entry",
                column: "location_id");

            migrationBuilder.CreateIndex(
                name: "ix_stock_ledger_entry_occurred_on",
                schema: "inventory",
                table: "stock_ledger_entry",
                column: "occurred_on");

            migrationBuilder.CreateIndex(
                name: "ix_stock_ledger_entry_reference",
                schema: "inventory",
                table: "stock_ledger_entry",
                columns: new[] { "reference_kind", "reference_id" });

            migrationBuilder.CreateIndex(
                name: "ix_stock_ledger_entry_sku_location_occurred_on",
                schema: "inventory",
                table: "stock_ledger_entry",
                columns: new[] { "sku_id", "location_id", "occurred_on" });

            migrationBuilder.CreateIndex(
                name: "ix_stock_location_branch_code",
                schema: "inventory",
                table: "stock_location",
                columns: new[] { "branch_id", "code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_stock_location_one_quarantine",
                schema: "inventory",
                table: "stock_location",
                column: "branch_id",
                unique: true,
                filter: "kind = 5 AND is_active");

            migrationBuilder.CreateIndex(
                name: "ix_stock_reservation_entry_batch",
                schema: "inventory",
                table: "stock_reservation_entry",
                column: "batch_id");

            migrationBuilder.CreateIndex(
                name: "IX_stock_reservation_entry_location_id",
                schema: "inventory",
                table: "stock_reservation_entry",
                column: "location_id");

            migrationBuilder.CreateIndex(
                name: "ix_stock_reservation_entry_reference",
                schema: "inventory",
                table: "stock_reservation_entry",
                columns: new[] { "reference_kind", "reference_id", "reference_line_id" });

            migrationBuilder.CreateIndex(
                name: "ix_stock_transfer_branch_transferred_on",
                schema: "inventory",
                table: "stock_transfer",
                columns: new[] { "branch_id", "transferred_on" });

            migrationBuilder.CreateIndex(
                name: "ix_stock_transfer_number",
                schema: "inventory",
                table: "stock_transfer",
                column: "number",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_stock_transfer_line_batch",
                schema: "inventory",
                table: "stock_transfer_line",
                column: "batch_id");

            migrationBuilder.CreateIndex(
                name: "IX_stock_transfer_line_stock_transfer_id",
                schema: "inventory",
                table: "stock_transfer_line",
                column: "stock_transfer_id");

            migrationBuilder.CreateIndex(
                name: "ix_storage_breach_report_branch_status",
                schema: "inventory",
                table: "storage_breach_report",
                columns: new[] { "branch_id", "status" });

            migrationBuilder.CreateIndex(
                name: "ix_storage_breach_report_location",
                schema: "inventory",
                table: "storage_breach_report",
                column: "location_id");

            migrationBuilder.CreateIndex(
                name: "IX_stored_file_Purpose_UploadedOn",
                schema: "files",
                table: "stored_file",
                columns: new[] { "Purpose", "UploadedOn" });

            migrationBuilder.CreateIndex(
                name: "IX_stored_file_Sha256",
                schema: "files",
                table: "stored_file",
                column: "Sha256");

            migrationBuilder.CreateIndex(
                name: "IX_stored_file_UploadedBy",
                schema: "files",
                table: "stored_file",
                column: "UploadedBy");

            migrationBuilder.CreateIndex(
                name: "ix_supplier_code",
                schema: "inventory",
                table: "supplier",
                column: "code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_tax_class_code",
                schema: "admin",
                table: "tax_class",
                column: "code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_tax_rate_class_effective",
                schema: "admin",
                table: "tax_rate",
                columns: new[] { "tax_class_id", "effective_from" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_web_vital_batch_received_on",
                schema: "ops",
                table: "web_vital_batch",
                column: "received_on");

            migrationBuilder.CreateIndex(
                name: "ix_web_vital_sample_route_metric_viewport",
                schema: "ops",
                table: "web_vital_sample",
                columns: new[] { "route_template", "metric", "viewport_class" });

            migrationBuilder.CreateIndex(
                name: "IX_web_vital_sample_web_vital_batch_id",
                schema: "ops",
                table: "web_vital_sample",
                column: "web_vital_batch_id");

            migrationBuilder.CreateIndex(
                name: "ix_wishlist_item_sku_id",
                schema: "product",
                table: "wishlist_item",
                column: "sku_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "accounting_export_run",
                schema: "billing");

            migrationBuilder.DropTable(
                name: "audit_entry",
                schema: "audit");

            migrationBuilder.DropTable(
                name: "backup_run",
                schema: "ops");

            migrationBuilder.DropTable(
                name: "bank_match",
                schema: "billing");

            migrationBuilder.DropTable(
                name: "bank_statement_line",
                schema: "billing");

            migrationBuilder.DropTable(
                name: "bank_transfer_account",
                schema: "ordering");

            migrationBuilder.DropTable(
                name: "batch_status_change",
                schema: "inventory");

            migrationBuilder.DropTable(
                name: "billing_profile_bank_account",
                schema: "billing");

            migrationBuilder.DropTable(
                name: "branch_closure",
                schema: "admin");

            migrationBuilder.DropTable(
                name: "branch_opening_interval",
                schema: "admin");

            migrationBuilder.DropTable(
                name: "bundle_component",
                schema: "product");

            migrationBuilder.DropTable(
                name: "business_settings_value",
                schema: "admin");

            migrationBuilder.DropTable(
                name: "cart_line",
                schema: "ordering");

            migrationBuilder.DropTable(
                name: "cash_up",
                schema: "billing");

            migrationBuilder.DropTable(
                name: "charge",
                schema: "billing");

            migrationBuilder.DropTable(
                name: "cod_remittance_line",
                schema: "billing");

            migrationBuilder.DropTable(
                name: "consignment_cost",
                schema: "inventory");

            migrationBuilder.DropTable(
                name: "consignment_document",
                schema: "inventory");

            migrationBuilder.DropTable(
                name: "consignment_exchange_rate",
                schema: "inventory");

            migrationBuilder.DropTable(
                name: "consignment_hs_code",
                schema: "inventory");

            migrationBuilder.DropTable(
                name: "consignment_landed_cost_line",
                schema: "inventory");

            migrationBuilder.DropTable(
                name: "consignment_status_change",
                schema: "inventory");

            migrationBuilder.DropTable(
                name: "content_item",
                schema: "admin");

            migrationBuilder.DropTable(
                name: "courier",
                schema: "ordering");

            migrationBuilder.DropTable(
                name: "credit_note_line",
                schema: "billing");

            migrationBuilder.DropTable(
                name: "customer_account",
                schema: "account");

            migrationBuilder.DropTable(
                name: "customer_delivery_address",
                schema: "account");

            migrationBuilder.DropTable(
                name: "customer_marketing_consent",
                schema: "account");

            migrationBuilder.DropTable(
                name: "customer_session",
                schema: "account");

            migrationBuilder.DropTable(
                name: "delivery_zone_coverage",
                schema: "ordering");

            migrationBuilder.DropTable(
                name: "delivery_zone_service",
                schema: "ordering");

            migrationBuilder.DropTable(
                name: "discount_code",
                schema: "ordering");

            migrationBuilder.DropTable(
                name: "document_number_series",
                schema: "billing");

            migrationBuilder.DropTable(
                name: "erasure_scope",
                schema: "ops");

            migrationBuilder.DropTable(
                name: "goods_receipt_line",
                schema: "inventory");

            migrationBuilder.DropTable(
                name: "idempotency_record",
                schema: "ops");

            migrationBuilder.DropTable(
                name: "inbound_webhook_receipt",
                schema: "ops");

            migrationBuilder.DropTable(
                name: "invoice_line",
                schema: "billing");

            migrationBuilder.DropTable(
                name: "leave_request",
                schema: "admin");

            migrationBuilder.DropTable(
                name: "loyalty_account",
                schema: "billing");

            migrationBuilder.DropTable(
                name: "loyalty_entry",
                schema: "billing");

            migrationBuilder.DropTable(
                name: "notification_attempt",
                schema: "notify");

            migrationBuilder.DropTable(
                name: "notification_request",
                schema: "notify");

            migrationBuilder.DropTable(
                name: "notification_template_content",
                schema: "notify");

            migrationBuilder.DropTable(
                name: "order_line_allocation",
                schema: "ordering");

            migrationBuilder.DropTable(
                name: "order_payment_ref",
                schema: "ordering");

            migrationBuilder.DropTable(
                name: "order_refund",
                schema: "ordering");

            migrationBuilder.DropTable(
                name: "order_status_change",
                schema: "ordering");

            migrationBuilder.DropTable(
                name: "password_reset_token",
                schema: "account");

            migrationBuilder.DropTable(
                name: "payment_allocation_entry",
                schema: "billing");

            migrationBuilder.DropTable(
                name: "payment_requested_allocation",
                schema: "billing");

            migrationBuilder.DropTable(
                name: "policy_acceptance",
                schema: "admin");

            migrationBuilder.DropTable(
                name: "policy_document",
                schema: "admin");

            migrationBuilder.DropTable(
                name: "policy_version",
                schema: "admin");

            migrationBuilder.DropTable(
                name: "product_image",
                schema: "product");

            migrationBuilder.DropTable(
                name: "product_review",
                schema: "product");

            migrationBuilder.DropTable(
                name: "product_sales_stats",
                schema: "product");

            migrationBuilder.DropTable(
                name: "product_storage_profile",
                schema: "inventory");

            migrationBuilder.DropTable(
                name: "product_translation",
                schema: "product");

            migrationBuilder.DropTable(
                name: "purchase_order_line",
                schema: "inventory");

            migrationBuilder.DropTable(
                name: "reconciliation_issue",
                schema: "ordering");

            migrationBuilder.DropTable(
                name: "refund",
                schema: "billing");

            migrationBuilder.DropTable(
                name: "related_product",
                schema: "product");

            migrationBuilder.DropTable(
                name: "reorder_policy",
                schema: "inventory");

            migrationBuilder.DropTable(
                name: "report_schedule",
                schema: "report");

            migrationBuilder.DropTable(
                name: "restore_check_result",
                schema: "ops");

            migrationBuilder.DropTable(
                name: "retention_pass_result",
                schema: "ops");

            migrationBuilder.DropTable(
                name: "return_line",
                schema: "ordering");

            migrationBuilder.DropTable(
                name: "roster_exception",
                schema: "admin");

            migrationBuilder.DropTable(
                name: "scheduled_report_run",
                schema: "report");

            migrationBuilder.DropTable(
                name: "sku",
                schema: "product");

            migrationBuilder.DropTable(
                name: "sku_price",
                schema: "product");

            migrationBuilder.DropTable(
                name: "sourcing_origin",
                schema: "product");

            migrationBuilder.DropTable(
                name: "staff_account",
                schema: "account");

            migrationBuilder.DropTable(
                name: "staff_branch_assignment",
                schema: "admin");

            migrationBuilder.DropTable(
                name: "staff_roster_current_shift",
                schema: "admin");

            migrationBuilder.DropTable(
                name: "staff_roster_next_shift",
                schema: "admin");

            migrationBuilder.DropTable(
                name: "staff_session",
                schema: "account");

            migrationBuilder.DropTable(
                name: "stock_adjustment_line",
                schema: "inventory");

            migrationBuilder.DropTable(
                name: "stock_alert",
                schema: "inventory");

            migrationBuilder.DropTable(
                name: "stock_alert",
                schema: "product");

            migrationBuilder.DropTable(
                name: "stock_count_line",
                schema: "inventory");

            migrationBuilder.DropTable(
                name: "stock_ledger_entry",
                schema: "inventory");

            migrationBuilder.DropTable(
                name: "stock_reservation_entry",
                schema: "inventory");

            migrationBuilder.DropTable(
                name: "stock_transfer_line",
                schema: "inventory");

            migrationBuilder.DropTable(
                name: "storage_breach_report",
                schema: "inventory");

            migrationBuilder.DropTable(
                name: "stored_file",
                schema: "files");

            migrationBuilder.DropTable(
                name: "supplier",
                schema: "inventory");

            migrationBuilder.DropTable(
                name: "system_status",
                schema: "admin");

            migrationBuilder.DropTable(
                name: "tax_class",
                schema: "admin");

            migrationBuilder.DropTable(
                name: "tax_rate",
                schema: "admin");

            migrationBuilder.DropTable(
                name: "web_vital_sample",
                schema: "ops");

            migrationBuilder.DropTable(
                name: "wishlist_item",
                schema: "product");

            migrationBuilder.DropTable(
                name: "bank_statement",
                schema: "billing");

            migrationBuilder.DropTable(
                name: "billing_profile",
                schema: "billing");

            migrationBuilder.DropTable(
                name: "branch",
                schema: "admin");

            migrationBuilder.DropTable(
                name: "business_settings",
                schema: "admin");

            migrationBuilder.DropTable(
                name: "cart",
                schema: "ordering");

            migrationBuilder.DropTable(
                name: "cod_remittance",
                schema: "billing");

            migrationBuilder.DropTable(
                name: "consignment",
                schema: "inventory");

            migrationBuilder.DropTable(
                name: "credit_note",
                schema: "billing");

            migrationBuilder.DropTable(
                name: "customer_address_book",
                schema: "account");

            migrationBuilder.DropTable(
                name: "customer_notification_preferences",
                schema: "account");

            migrationBuilder.DropTable(
                name: "delivery_zone",
                schema: "ordering");

            migrationBuilder.DropTable(
                name: "erasure_request",
                schema: "ops");

            migrationBuilder.DropTable(
                name: "invoice",
                schema: "billing");

            migrationBuilder.DropTable(
                name: "notification",
                schema: "notify");

            migrationBuilder.DropTable(
                name: "notification_template",
                schema: "notify");

            migrationBuilder.DropTable(
                name: "order_line",
                schema: "ordering");

            migrationBuilder.DropTable(
                name: "payment",
                schema: "billing");

            migrationBuilder.DropTable(
                name: "purchase_order",
                schema: "inventory");

            migrationBuilder.DropTable(
                name: "restore_test_record",
                schema: "ops");

            migrationBuilder.DropTable(
                name: "retention_run",
                schema: "ops");

            migrationBuilder.DropTable(
                name: "return_request",
                schema: "ordering");

            migrationBuilder.DropTable(
                name: "product",
                schema: "product");

            migrationBuilder.DropTable(
                name: "staff_roster",
                schema: "admin");

            migrationBuilder.DropTable(
                name: "stock_adjustment",
                schema: "inventory");

            migrationBuilder.DropTable(
                name: "stock_count",
                schema: "inventory");

            migrationBuilder.DropTable(
                name: "batch",
                schema: "inventory");

            migrationBuilder.DropTable(
                name: "stock_location",
                schema: "inventory");

            migrationBuilder.DropTable(
                name: "stock_transfer",
                schema: "inventory");

            migrationBuilder.DropTable(
                name: "web_vital_batch",
                schema: "ops");

            migrationBuilder.DropTable(
                name: "wishlist",
                schema: "product");

            migrationBuilder.DropTable(
                name: "sales_order",
                schema: "ordering");

            migrationBuilder.DropTable(
                name: "goods_receipt",
                schema: "inventory");

            migrationBuilder.DropSequence(
                name: "receipt_number_seq",
                schema: "billing");
        }
    }
}

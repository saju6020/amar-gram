using AmarGram.Infrastructure.Billing;
using AmarGram.Infrastructure.Inventory;
using AmarGram.Infrastructure.Ordering;
using AmarGram.Infrastructure.Persistence.ReportingViews;
using AmarGram.Infrastructure.Retention;
using AmarGram.Shared.Common.Constants;
using AmarGram.Shared.Common.Enums;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AmarGram.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// HO-P1 §5 -- the hand-written half of the Amar Gram baseline. <c>InitialAmarGram</c> (EF-generated) creates every table, index and key
    /// of the model; this migration adds what EF cannot model and the old migration chain applied as raw SQL, minus everything clinic:
    /// extensions, sequences (but <c>billing.receipt_number_seq</c>, which <c>InitialAmarGram</c> creates before the payment table), the raw-SQL inventory tables, the billing, ordering, inventory and audit immutability triggers, the retention
    /// guards, the product and inventory views, the reporting views and the seed rows. Every enumeration value is written from the
    /// enumeration (U-X2, U-X3, U-X5), never typed as a literal.
    ///
    /// <b>History from here on.</b> This migration is now applied history: a later change to any object below is a NEW migration
    /// (<c>CREATE OR REPLACE</c> with its own text, or <see cref="RetentionGuardSql.AttachTo"/> for a newly added Forbidden table), never an
    /// edit to this file or to a helper string that this file calls.
    /// </summary>
    public partial class InitialAmarGramSql : Migration
    {
        /// <summary>
        /// The Forbidden tables that get the retention guard here (HO-XCT-001 ADR-299, frozen: a later edit would silently change what an
        /// applied migration does). <c>audit.audit_entry</c> is not listed: it has its own triggers (<see cref="RetentionGuardSql.DedicatedlyGuardedTables"/>).
        /// A table classified Forbidden later attaches the two triggers in its own migration (C-ALL-1).
        /// </summary>
        public static readonly IReadOnlyList<(string Schema, string Table)> TablesAtMigration =
        [
            ("account", "customer_account"),
            ("account", "staff_account"),
            ("admin", "branch"),
            ("admin", "branch_closure"),
            ("admin", "business_settings"),
            ("admin", "content_item"),
            ("admin", "leave_request"),
            ("admin", "policy_acceptance"),
            ("admin", "policy_document"),
            ("admin", "policy_version"),
            ("admin", "roster_exception"),
            ("admin", "staff_branch_assignment"),
            ("admin", "staff_roster"),
            ("admin", "system_status"),
            ("admin", "tax_class"),
            ("admin", "tax_rate"),
            ("billing", "accounting_export_run"),
            ("billing", "bank_match"),
            ("billing", "bank_statement"),
            ("billing", "bank_statement_line"),
            ("billing", "billing_profile"),
            ("billing", "cash_up"),
            ("billing", "charge"),
            ("billing", "cod_remittance"),
            ("billing", "cod_remittance_line"),
            ("billing", "credit_note"),
            ("billing", "credit_note_line"),
            ("billing", "document_number_series"),
            ("billing", "invoice"),
            ("billing", "loyalty_account"),
            ("billing", "loyalty_entry"),
            ("billing", "payment"),
            ("billing", "payment_allocation_entry"),
            ("billing", "refund"),
            ("inventory", "batch"),
            ("inventory", "batch_status_change"),
            ("inventory", "consignment"),
            ("inventory", "consignment_document"),
            ("inventory", "consignment_status_change"),
            ("inventory", "goods_receipt"),
            ("inventory", "goods_receipt_line"),
            ("inventory", "purchase_order"),
            ("inventory", "stock_adjustment"),
            ("inventory", "stock_adjustment_line"),
            ("inventory", "stock_alert"),
            ("inventory", "stock_count"),
            ("inventory", "stock_count_line"),
            ("inventory", "stock_ledger_entry"),
            ("inventory", "stock_location"),
            ("inventory", "stock_position"),
            ("inventory", "stock_reservation_entry"),
            ("inventory", "stock_transfer"),
            ("inventory", "stock_transfer_line"),
            ("inventory", "storage_breach_report"),
            ("inventory", "supplier"),
            ("notify", "notification"),
            ("notify", "notification_attempt"),
            ("notify", "notification_request"),
            ("notify", "notification_template"),
            ("ops", "erasure_request"),
            ("ops", "erasure_scope"),
            ("ops", "inbound_webhook_receipt"),
            ("ops", "restore_check_result"),
            ("ops", "restore_test_record"),
            ("ops", "retention_pass_result"),
            ("ops", "retention_run"),
            ("ordering", "bank_transfer_account"),
            ("ordering", "cart"),
            ("ordering", "courier"),
            ("ordering", "delivery_zone"),
            ("ordering", "discount_code"),
            ("ordering", "order_line"),
            ("ordering", "order_payment_ref"),
            ("ordering", "order_refund"),
            ("ordering", "order_status_change"),
            ("ordering", "reconciliation_issue"),
            ("ordering", "return_line"),
            ("ordering", "return_request"),
            ("ordering", "sales_order"),
            ("product", "product"),
            ("product", "product_review"),
            ("product", "sku"),
            ("product", "sku_price"),
            ("product", "sourcing_origin"),
            ("product", "stock_alert"),
            ("product", "wishlist"),
            ("report", "report_schedule"),
            ("report", "scheduled_report_run"),
        ];

        private static readonly int ProductActive = ProductStatus.Active.Value;
        private static readonly int SkuActive = SkuStatus.Active.Value;
        private static readonly int ReviewPublished = ProductReviewStatus.Published.Value;
        private static readonly int KindBundle = ProductKind.Bundle.Value;

        private static readonly string[] BillingAppendOnlyTables =
            ["payment_allocation_entry", "credit_note", "credit_note_line", "refund", "cod_remittance", "cod_remittance_line", "bank_statement", "bank_statement_line", "accounting_export_run", "loyalty_entry"];

        private static readonly string[] BillingNoDeleteTables = ["billing_profile", "document_number_series", "charge", "loyalty_account"];

        private static readonly string[] InventorySequences =
            ["po_number_seq", "consignment_number_seq", "grn_number_seq", "transfer_number_seq", "adjustment_number_seq", "count_number_seq", "recall_number_seq"];

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // ── Extensions and sequences ────────────────────────────────────────────────────────────────────
            // btree_gist: the leave overlap exclusion; pg_trgm: the catalogue search index. Down never drops an extension.
            migrationBuilder.Sql("CREATE EXTENSION IF NOT EXISTS btree_gist;");
            migrationBuilder.Sql("CREATE EXTENSION IF NOT EXISTS pg_trgm;");

            // billing.receipt_number_seq is created by InitialAmarGram itself: billing.payment's default reads it.
            foreach (var sequence in InventorySequences)
                migrationBuilder.Sql($"CREATE SEQUENCE IF NOT EXISTS inventory.{sequence} START WITH 1 INCREMENT BY 1;");
            migrationBuilder.Sql(OrderingMigrationSql.CreateOrderNumberSequence());

            // ── Seed rows ───────────────────────────────────────────────────────────────────────────────────
            SeedMainBranchAndLocations(migrationBuilder);
            migrationBuilder.Sql(DeliveryTaxClassSeed);

            // ── Audit (HO-ACC-001 §11.9, F33): audit rows are immutable, at the database ─────────────────────
            migrationBuilder.Sql("""
                CREATE OR REPLACE FUNCTION audit.audit_entry_immutable() RETURNS trigger AS $body$
                BEGIN
                    RAISE EXCEPTION 'audit.audit_entry rows are immutable and cannot be updated, deleted or truncated';
                END;
                $body$ LANGUAGE plpgsql;

                CREATE TRIGGER audit_entry_no_update_delete
                    BEFORE UPDATE OR DELETE ON audit.audit_entry
                    FOR EACH ROW EXECUTE FUNCTION audit.audit_entry_immutable();

                CREATE TRIGGER audit_entry_no_truncate
                    BEFORE TRUNCATE ON audit.audit_entry
                    FOR EACH STATEMENT EXECUTE FUNCTION audit.audit_entry_immutable();
                """);

            // ── Administration: no overlapping Requested/Approved leave for one staff member ─────────────────
            migrationBuilder.Sql($"""
                ALTER TABLE admin.leave_request
                ADD CONSTRAINT ex_leave_request_staff_no_overlap
                EXCLUDE USING gist (
                    staff_account_id WITH =,
                    daterange(starts_on, ends_on, '[]') WITH &&
                )
                WHERE (status IN ({LeaveStatus.Requested.Value}, {LeaveStatus.Approved.Value}));
                """);

            // ── Product: search indexes and the storefront views (HO-SHP-001 §12.1) ──────────────────────────
            migrationBuilder.Sql("CREATE INDEX ix_product_search_text_trgm ON product.product USING gin (search_text gin_trgm_ops);");
            migrationBuilder.Sql("CREATE INDEX IF NOT EXISTS ix_product_brand_lower ON product.product (lower(brand));");
            migrationBuilder.Sql(ProductRatingSummaryView);
            migrationBuilder.Sql(CatalogueTermView);
            migrationBuilder.Sql(StorefrontCatalogueView);

            // ── Inventory: stock ledger, reservations, sellable views, landed cost, sellable summary (HO-IMP-001 §12.1) ──
            migrationBuilder.Sql(InventoryLedgerSql.CreateStockPosition());
            migrationBuilder.Sql(InventoryLedgerSql.AddLedgerSignCheck());
            migrationBuilder.Sql(InventoryLedgerSql.PositionGuardFunctionAndTrigger());
            migrationBuilder.Sql(InventoryLedgerSql.ApplyLedgerFunctionAndTrigger());
            migrationBuilder.Sql(InventoryLedgerSql.BatchUsableFunctionAndLedgerTrigger());
            migrationBuilder.Sql(InventoryLedgerSql.RefuseMutationFunctionAndLedgerTriggers());
            migrationBuilder.Sql(InventoryLedgerSql.AddReservationSignCheck());
            migrationBuilder.Sql(InventoryLedgerSql.ApplyReservationFunctionAndTrigger());
            migrationBuilder.Sql(InventoryLedgerSql.BatchUsableReservationTrigger());
            migrationBuilder.Sql(InventoryLedgerSql.RefuseMutationReservationTriggers());
            migrationBuilder.Sql(InventoryLedgerSql.CreateSellableStockView());
            migrationBuilder.Sql(InventoryLedgerSql.CreateBatchUnitCostView());
            migrationBuilder.Sql(InventoryLedgerSql.CreateSkuSellableSummary());
            migrationBuilder.Sql(InventoryLedgerSql.RefreshSkuSellableFunction());
            migrationBuilder.Sql(InventoryLedgerSql.SummaryGuardFunctionAndTriggers());
            migrationBuilder.Sql(InventoryLedgerSql.SummaryDeferredRefresh());
            migrationBuilder.Sql(InventoryLedgerSql.SummaryMaintenanceTriggers());
            migrationBuilder.Sql(InventoryLedgerSql.CreateSkuSellableView());

            // ── Billing immutability (HO-BIL-001 D-5, D-6) ──────────────────────────────────────────────────
            migrationBuilder.Sql(BillingMigrationSql.InvoiceImmutability());
            migrationBuilder.Sql(BillingMigrationSql.PaymentImmutability());
            migrationBuilder.Sql(BillingMigrationSql.ClosedCashUpImmutability());
            foreach (var table in BillingNoDeleteTables)
                migrationBuilder.Sql(BillingMigrationSql.NoDelete(table));
            foreach (var table in BillingAppendOnlyTables)
                migrationBuilder.Sql(BillingMigrationSql.AppendOnly(table));
            migrationBuilder.Sql(BillingMigrationSql.AppendOnly("bank_match", "unmatched_on", "unmatched_by", "unmatch_reason"));
            migrationBuilder.Sql(BillingMigrationSql.NoTruncate()); // after every billing table exists: it guards each one

            // ── Ordering immutability (HO-ORD-001 ADR-211) ──────────────────────────────────────────────────
            migrationBuilder.Sql(OrderingMigrationSql.ImmutabilityTriggers());
            migrationBuilder.Sql(OrderingMigrationSql.RefundImmutabilityTriggers());

            // ── Retention guards (HO-XCT-001 ADR-299) ───────────────────────────────────────────────────────
            migrationBuilder.Sql(RetentionGuardSql.CreateFunction);
            foreach (var (schema, table) in TablesAtMigration)
                migrationBuilder.Sql(RetentionGuardSql.AttachTo(schema, table));

            // ── Reporting views (HO-RPT-001 §12.1, ADR-277: schema report only) ─────────────────────────────
            foreach (var sql in ReportingViewsUp())
                migrationBuilder.Sql(sql);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            foreach (var sql in ReportingViewsDown())
                migrationBuilder.Sql(sql);

            foreach (var (schema, table) in TablesAtMigration.Reverse())
                migrationBuilder.Sql(RetentionGuardSql.DetachFrom(schema, table));
            migrationBuilder.Sql($"DROP FUNCTION IF EXISTS {RetentionGuardSql.FunctionName}();");
            migrationBuilder.Sql("DROP SCHEMA IF EXISTS retention;");

            migrationBuilder.Sql(OrderingMigrationSql.DropRefundImmutabilityTriggers());
            migrationBuilder.Sql(OrderingMigrationSql.DropImmutabilityTriggers());

            migrationBuilder.Sql(BillingMigrationSql.DropNoTruncate());
            migrationBuilder.Sql(BillingMigrationSql.DropAppendOnly("bank_match"));
            foreach (var table in BillingAppendOnlyTables.Reverse())
                migrationBuilder.Sql(BillingMigrationSql.DropAppendOnly(table));
            foreach (var table in BillingNoDeleteTables.Reverse())
                migrationBuilder.Sql(BillingMigrationSql.DropNoDelete(table));
            migrationBuilder.Sql(BillingMigrationSql.DropClosedCashUpImmutability());
            migrationBuilder.Sql(BillingMigrationSql.DropPaymentImmutability());
            migrationBuilder.Sql(BillingMigrationSql.DropInvoiceImmutability());

            migrationBuilder.Sql(InventoryLedgerSql.DropSkuSellableSummaryObjects());
            migrationBuilder.Sql(InventoryLedgerSql.DropBatchUnitCostView());
            migrationBuilder.Sql(InventoryLedgerSql.DropReservationObjects());
            migrationBuilder.Sql(InventoryLedgerSql.DropStockLedgerObjects());
            migrationBuilder.Sql("ALTER TABLE inventory.stock_reservation_entry DROP CONSTRAINT IF EXISTS ck_stock_reservation_sign;");
            migrationBuilder.Sql("ALTER TABLE inventory.stock_ledger_entry DROP CONSTRAINT IF EXISTS ck_stock_ledger_consumes_reservation;");
            migrationBuilder.Sql("ALTER TABLE inventory.stock_ledger_entry DROP CONSTRAINT IF EXISTS ck_stock_ledger_sign;");

            migrationBuilder.Sql("DROP VIEW IF EXISTS product.storefront_catalogue_entry;");
            migrationBuilder.Sql("DROP VIEW IF EXISTS product.catalogue_term;");
            migrationBuilder.Sql("DROP VIEW IF EXISTS product.product_rating_summary;");
            migrationBuilder.Sql("DROP INDEX IF EXISTS product.ix_product_brand_lower;");
            migrationBuilder.Sql("DROP INDEX IF EXISTS product.ix_product_search_text_trgm;");

            migrationBuilder.Sql("ALTER TABLE admin.leave_request DROP CONSTRAINT IF EXISTS ex_leave_request_staff_no_overlap;");

            migrationBuilder.Sql("""
                DROP TRIGGER IF EXISTS audit_entry_no_update_delete ON audit.audit_entry;
                DROP TRIGGER IF EXISTS audit_entry_no_truncate ON audit.audit_entry;
                DROP FUNCTION IF EXISTS audit.audit_entry_immutable();
                """);

            // The seed rows go with their tables when InitialAmarGram is reverted.
            migrationBuilder.Sql(OrderingMigrationSql.DropOrderNumberSequence());
            foreach (var sequence in InventorySequences.Reverse())
                migrationBuilder.Sql($"DROP SEQUENCE IF EXISTS inventory.{sequence};");
        }

        /// <summary>The reporting views, in dependency order. Every statement targets schema <c>report</c> (ADR-277, U-X5).</summary>
        public static IReadOnlyList<string> ReportingViewsUp()
        {
            var counted = ReportingViewSql.List(InvoiceStatus.Issued, InvoiceStatus.PartPaid, InvoiceStatus.Paid, InvoiceStatus.Credited);
            return
            [
                ReportingViewSql.Load("rv_staff.v1"),
                ReportingViewSql.Load("rv_customer.v1"),
                ReportingViewSql.Load("rv_branch.v1"),
                ReportingViewSql.Load("rv_staff_branch.v1"),
                ReportingViewSql.Load("rv_stock_ledger.v1"),
                ReportingViewSql.Load("rv_batch.v1"),
                ReportingViewSql.Load("rv_stock_location.v1"),
                ReportingViewSql.Load("rv_consignment.v1"),
                ReportingViewSql.Load("rv_sku.v1"),
                ReportingViewSql.Load("rv_invoice_line.v1", ("ORDER_SOURCE", ChargeSourceKind.Order.Value.ToString())),
                ReportingViewSql.Load("rv_credit_note_line.v1"),
                ReportingViewSql.Load("rv_credit_note.v1"),
                ReportingViewSql.Load("rv_refund.v1"),
                ReportingViewSql.Load("rv_payment.v1"),
                ReportingViewSql.Load("rv_cash_up.v1"),
                ReportingViewSql.Load("rv_invoice_balance.v1", ("RECEIVABLE_STATUSES", counted)),
                ReportingViewSql.Load("rv_order.v1"),
                ReportingViewSql.Load("rv_order_return.v1"),
                ReportingViewSql.Load("rv_customer_activity.v2", ("COUNTED_STATUSES", counted)),
                ReportingViewSql.Load("rv_stock_position.v1"),
                ReportingViewSql.Load("rv_reorder_policy.v1"),
                ReportingViewSql.Load("rv_on_order.v1", ("ISSUED", PurchaseOrderStatus.Issued.Value.ToString())),
            ];
        }

        /// <summary>Drops the reporting views in reverse dependency order.</summary>
        public static IReadOnlyList<string> ReportingViewsDown() =>
        [
            ReportingViewSql.Drop("rv_on_order"),
            ReportingViewSql.Drop("rv_reorder_policy"),
            ReportingViewSql.Drop("rv_stock_position"),
            ReportingViewSql.Drop("rv_customer_activity"),
            ReportingViewSql.Drop("rv_order_return"),
            ReportingViewSql.Drop("rv_order"),
            ReportingViewSql.Drop("rv_invoice_balance"),
            ReportingViewSql.Drop("rv_cash_up"),
            ReportingViewSql.Drop("rv_payment"),
            ReportingViewSql.Drop("rv_refund"),
            ReportingViewSql.Drop("rv_credit_note"),
            ReportingViewSql.Drop("rv_credit_note_line"),
            ReportingViewSql.Drop("rv_invoice_line"),
            ReportingViewSql.Drop("rv_sku"),
            ReportingViewSql.Drop("rv_consignment"),
            ReportingViewSql.Drop("rv_stock_location"),
            ReportingViewSql.Drop("rv_batch"),
            ReportingViewSql.Drop("rv_stock_ledger"),
            ReportingViewSql.Drop("rv_staff_branch"),
            ReportingViewSql.Drop("rv_branch"),
            ReportingViewSql.Drop("rv_customer"),
            ReportingViewSql.Drop("rv_staff"),
        ];

        /// <summary>The seeded MAIN branch (<see cref="AdministrationSeed.MainBranchId"/>) and its three stock locations (<see cref="InventorySeed"/>).</summary>
        private static void SeedMainBranchAndLocations(MigrationBuilder migrationBuilder)
        {
            var seededOn = new DateTime(2026, 10, 24, 0, 0, 0, DateTimeKind.Utc);
            string[] bookkeeping = ["CreatedBy", "CreatedDate", "Language", "LastUpdatedDate", "LastUpdatedBy", "TenantId", "Tags", "VerticalId", "ServiceId", "IsMarkedToDelete", "Version"];
            object[] bookkeepingValues = [Guid.Empty, seededOn, null, seededOn, Guid.Empty, Guid.Empty, null, Guid.Empty, null, false, 1];

            migrationBuilder.InsertData(
                schema: "admin",
                table: "branch",
                columns: ["Id", "code", "name", "time_zone_id", "address_line", "phone_number", "email", "is_active", .. bookkeeping],
                values: [AdministrationSeed.MainBranchId, "MAIN", "Main outlet", "Asia/Dhaka", null, null, null, true, .. bookkeepingValues]);

            var locations = new (Guid Id, string Code, string Name, StockLocationKind Kind)[]
            {
                (InventorySeed.ShopLocationId, InventorySeed.ShopCode, "Shop floor", StockLocationKind.ShopFloor),
                (InventorySeed.WarehouseLocationId, InventorySeed.WarehouseCode, "Warehouse", StockLocationKind.Warehouse),
                (InventorySeed.QuarantineLocationId, InventorySeed.QuarantineCode, "Quarantine", StockLocationKind.Quarantine),
            };

            foreach (var location in locations)
            {
                migrationBuilder.InsertData(
                    schema: "inventory",
                    table: "stock_location",
                    columns: ["Id", "branch_id", "code", "name", "kind", "is_active", .. bookkeeping],
                    values: [location.Id, AdministrationSeed.MainBranchId, location.Code, location.Name, location.Kind.Value, true, .. bookkeepingValues]);
            }
        }

        /// <summary>
        /// HO-ORD-001-FU1 D3: the delivery charge's tax class, seeded at 0 %. An Administrator changes the delivery tax by adding an
        /// effective-dated rate to the DELIVERY class. Idempotent: an existing DELIVERY class is kept.
        /// </summary>
        private const string DeliveryTaxClassSeed = """
            INSERT INTO admin.tax_class ("Id", code, name, is_active, "CreatedBy", "CreatedDate", "Language", "LastUpdatedDate", "LastUpdatedBy", "TenantId", "Tags",
                                         "VerticalId", "ServiceId", "IsMarkedToDelete", "Version")
            SELECT 'd31e0a7c-5b1f-4c6e-9a42-0d0e11f00001', 'DELIVERY', 'Delivery charge', TRUE, '00000000-0000-0000-0000-000000000000', now(), NULL, now(),
                   '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000', NULL, '00000000-0000-0000-0000-000000000000', NULL, FALSE, 1
            WHERE NOT EXISTS (SELECT 1 FROM admin.tax_class WHERE code = 'DELIVERY');

            INSERT INTO admin.tax_rate ("Id", tax_class_id, rate_percent, effective_from, "CreatedBy", "CreatedDate", "Language", "LastUpdatedDate", "LastUpdatedBy", "TenantId", "Tags",
                                        "VerticalId", "ServiceId", "IsMarkedToDelete", "Version")
            SELECT 'd31e0a7c-5b1f-4c6e-9a42-0d0e11f00002', c."Id", 0, TIMESTAMPTZ '2000-01-01 00:00:00+00', '00000000-0000-0000-0000-000000000000', now(), NULL, now(),
                   '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000', NULL, '00000000-0000-0000-0000-000000000000', NULL, FALSE, 1
            FROM admin.tax_class c
            WHERE c.code = 'DELIVERY' AND NOT EXISTS (SELECT 1 FROM admin.tax_rate r WHERE r.tax_class_id = c."Id");
            """;

        private static string ProductRatingSummaryView => $"""
            CREATE VIEW product.product_rating_summary AS
            SELECT
                product_id,
                ROUND(AVG(rating)::numeric, 1) AS rating_average,
                COUNT(*)::int AS rating_count
            FROM product.product_review
            WHERE status = {ReviewPublished}
            GROUP BY product_id;
            """;

        private static string CatalogueTermView => $"""
            CREATE VIEW product.catalogue_term AS
            SELECT DISTINCT LOWER(brand) AS term
            FROM product.product
            WHERE status = {ProductActive} AND listed_on_storefront = true
            UNION
            SELECT DISTINCT LOWER(name) AS term
            FROM product.product
            WHERE status = {ProductActive} AND listed_on_storefront = true;
            """;

        /// <summary>
        /// One row per Active, listed product. Pricing is a per-product LATERAL over <c>ix_sku_price_sku_effective</c> (the latest price effective
        /// now of each Active SKU); <c>is_on_sale</c> is "has a priced Active SKU", and for a bundle also "every component is on sale".
        /// </summary>
        private static string StorefrontCatalogueView => $"""
            CREATE VIEW product.storefront_catalogue_entry AS
            SELECT
                p."Id" AS product_id,
                p.slug,
                p.name,
                p.brand,
                p.category,
                p.subcategory,
                p.kind,
                p.country_of_origin_code,
                p.district_of_origin,
                p.certifications,
                p.search_text,
                p.first_published_on,
                pricing.min_price,
                pricing.max_price,
                pricing.currency_code,
                CASE WHEN p.kind = {KindBundle} THEN (
                        EXISTS (
                            SELECT 1
                            FROM product.sku sb
                            JOIN product.sku_price spb ON spb.sku_id = sb."Id" AND spb.effective_from <= now()
                            WHERE sb.product_id = p."Id" AND sb.status = {SkuActive}
                        )
                        AND EXISTS (SELECT 1 FROM product.bundle_component bc0 WHERE bc0.product_id = p."Id")
                        AND NOT EXISTS (
                            SELECT 1
                            FROM product.bundle_component bc
                            LEFT JOIN product.sku cs ON cs."Id" = bc.component_sku_id
                            LEFT JOIN product.product cp ON cp."Id" = cs.product_id
                            WHERE bc.product_id = p."Id"
                              AND NOT (
                                cs.status = {SkuActive}
                                AND cp.status = {ProductActive}
                                AND cp.listed_on_storefront = true
                                AND EXISTS (SELECT 1 FROM product.sku_price csp WHERE csp.sku_id = cs."Id" AND csp.effective_from <= now())
                              )
                        )
                    ) ELSE pricing.min_price IS NOT NULL END AS is_on_sale,
                rating.rating_average,
                COALESCE(rating.rating_count, 0) AS rating_count,
                COALESCE(sales.units_sold_90d, 0) AS units_sold_90d,
                img.file_id AS primary_image_file_id,
                img.alt_text AS primary_image_alt_text
            FROM product.product p
            LEFT JOIN LATERAL (
                SELECT MIN(cp.amount) AS min_price, MAX(cp.amount) AS max_price, MIN(cp.currency_code) AS currency_code
                FROM product.sku s
                CROSS JOIN LATERAL (
                    SELECT sp.amount, sp.currency_code
                    FROM product.sku_price sp
                    WHERE sp.sku_id = s."Id" AND sp.effective_from <= now()
                    ORDER BY sp.effective_from DESC
                    LIMIT 1
                ) cp
                WHERE s.product_id = p."Id" AND s.status = {SkuActive}
            ) pricing ON true
            LEFT JOIN product.product_rating_summary rating ON rating.product_id = p."Id"
            LEFT JOIN product.product_sales_stats sales ON sales."Id" = p."Id"
            LEFT JOIN product.product_image img ON img.product_id = p."Id" AND img.sku_id IS NULL AND img.is_primary = true
            WHERE p.status = {ProductActive} AND p.listed_on_storefront = true;
            """;
    }
}

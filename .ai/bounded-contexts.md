# Bounded Contexts

The feature contexts in this solution, derived from `docs/SRS.md` §4. These are the `[Feature]` /
`[ContextName]` values used throughout `.ai/namespace-conventions.md`.

This is **one solution with the standard layers** (Api, Application, Domain, Read, Infrastructure,
Shared), not separate projects per context. A context is a folder and a namespace segment.

---

## The contexts

| Context | Aggregates | SRS |
|---|---|---|
| **Product** | `ProductAggregate`, SKUs, country of origin | §4.7 |
| **Supplier** | `SupplierAggregate`, `PurchaseOrderAggregate` | §4.8 |
| **Consignment** | `ConsignmentAggregate` — import permits, certificates, landed cost | §4.8 |
| **Batch** | `BatchAggregate` — lot, expiry, status; `StockLedgerEntry` | §4.8 |
| **Order** | `OrderAggregate`, `CartAggregate`, `SubscriptionAggregate` | §4.9, §4.10 |
| **Invoice** | `InvoiceAggregate`, `PaymentAggregate`, credit notes | §4.11 |
| **Notification** | Templates and the notification log | §4.12 |
| **Reporting** | `ReportScheduleAggregate`, `ScheduledReportRunAggregate` (schema `report`); read-only `report.rv_*` views over the other contexts, never materialised and no rows copied (HO-RPT-001 ADR-277/278). Writes only its own two tables, audit rows, notification requests (through `INotificationOutbox`) and export files (through the Files port, purpose `ReportExport`) | §8 |

---

## The one that matters most

**`ProductAggregate` is shared across every sales channel.** The same product and SKU record is
sold in the online shop, rung up at the counter, delivered on a subscription and received into
stock from a consignment. It is the reason this is one product rather than several.

Practical consequence: `ProductAggregate` is read by command handlers in several contexts. That is
expected. What it must **not** become is a dumping ground — stock detail belongs to `Batch` and the
stock ledger, order detail to `Order`, and the product keeps only what is true of the product
regardless of which channel is asking.

---

## Aggregate boundary rules

1. **One aggregate mutated per command.** If a use case appears to need two, the boundary is
   probably wrong — raise it rather than widening the transaction.
2. **Aggregates reference each other by id**, never by navigation property. An `OrderAggregate`
   line holds a `SkuId`, not a `ProductAggregate`.
3. **An aggregate must not load an unbounded collection.** The SKUs of a product are bounded and
   belong inside it. Price history, order history and stock ledger entries are not — keep them out
   of the aggregate and query them from the Read layer.
4. **Cross-aggregate domain logic goes to a Domain Service** in `Domain.DomainServices` — FEFO
   allocation, stock demand. Not to an application-layer service.

---

## Cross-context rules that span aggregates

These are the rules that most often tempt someone to reach across a boundary. Each is listed with
where it actually belongs:

| Rule | SRS | Belongs to |
|---|---|---|
| Expired batches are never sellable or usable | BR-3 | `BatchAggregate` — its own state |
| Allocate the soonest-expiring batch (FEFO) | BR-4 | **Domain Service** — spans many batches |
| A recall must trace every customer who received a batch | FR-IMP-11 | A query across order lines and the stock ledger — Read layer |

# Order Fulfilment Flow

## Status: Not Started

## What it does
Cart to delivery: catalogue browse, checkout, FEFO stock allocation, payment
recording, pick and pack, dispatch with tracking, delivery, and returns. SRS §4.9 (FR-ORD-1..22).

## Modules involved
| Module | Role |
|---|---|
| **Ordering** | Owns `Cart`, `Order`, `Shipment`, `Subscription` |
| **Catalog** | Product and SKU data (contract) |
| **Inventory** | Sellable stock, **FEFO batch allocation**, reservation (contract) |
| **Billing** | Invoice, payment recording, refunds |
| **Notifications** | Order status messages (outbox) |

## The flow
```
Browse / filter (incl. by country of origin) ──► Product page (live sellable stock + expiry)
      │
      ▼
Add to cart
      │
      ▼
Checkout ── address or pickup · delivery slot · payment method
      │        (COD · cash in store · card in store · bank transfer — NO gateway, SRS Phase 5)
      ▼
Re-validate price + availability ──► show any change, require acknowledgement
      │
      ▼
Payment recorded ──┬─ COD ──────────► confirmed, no prepayment
                   ├─ bank transfer ─► `pending_payment`, stock reserved,
                   │                    expires after the window and releases stock
                   └─ in store ──────► staff records it
      │
      ▼
FEFO ALLOCATION ── soonest-expiring non-expired batch first; expired never allocated
      │
      ▼
Pick list (by location + batch) ──► Pack ──► Dispatch (tracking) ──► Delivered
      │
      └─ [Return window] ──► approval ──► quarantine ──► restock or write off
```

## Key aggregates
- `CartAggregate`, `OrderAggregate` (status machine `pending_payment → confirmed → packing →
  dispatched → delivered`), `SubscriptionAggregate`

## Key invariants
- An order line records the **specific batch** allocated, so a recall can trace batch → order →
  customer (SRS D-4)
- An order cannot dispatch while any line is unallocated or its batch is recalled (BR-14)
- Opened food and used hygiene goods are non-returnable unless defective or recalled (BR-10)
- Duplicate submission is prevented by an idempotency key (FR-ORD-20) — still required even
  though nothing is queued, because users double-click

## Cross-module rules
- Stock reservation and FEFO allocation belong to **Inventory**, called through its contract.
  Ordering never picks a batch itself and never writes to `inventory.*`
- **No payment gateway** — see SRS ADR/§10 Phase 5. Payment is a record of money received, taken
  by a person

## Decisions made
- **HO-P4 back-office gaps BG-1..BG-8 (2026-10-25, owner approved). Status: Complete (backend).**
  - BG-4 `OrderStatus.Packed` (9, "packed, waiting for rider") via `MarkPacked` (`POST /api/staff/orders/{id}/packed`); an **optional** step -- `Packing` may still dispatch or be marked ready directly; from `Packed`: Dispatch, MarkReadyForCollection, staff Cancel. Pick ticks are `order_line.is_picked/picked_on/picked_by` (`PUT .../lines/{lineId}/picked`), informational, never gate a transition.
  - BG-5 `RiderAggregate` (`ordering.rider`, per branch, unique name per branch, never deleted) at `/api/staff/riders`; `DispatchOrderCommand` takes exactly one of `CourierId` / `RiderId`; `Shipment.CourierId` is now nullable, `Shipment.RiderId/RiderName` added, the customer sees the fixed carrier name `OrderRules.RiderCarrierName`. Dashboard tile `orders.cod-with-riders` (riders, orders, amount).
  - BG-2 `GET /api/staff/orders/status-counts` (same filters as the queue bar `status`, shared `StaffOrderFilter`); BG-3 queue rows carry `deliveryZone`, `deliveryDistrict`, `slotDate`, `slotWindowLabel`.
  - BG-1 `GET /api/staff/dashboard/sales-series` (`GetSalesSeriesQueryHandler`, net revenue from the revenue reports' own `RevenueLoader`/`RevenueBuilder`).
  - BG-6 `GET /api/staff/pos/browse`; BG-7 `tenderedCash` on the POS quote -> `changeDue` / `cashShort` from `TenderCalculator`; BG-8 anonymous sale, see ADR-216 amendment 2026-10-25.
  - Migrations: `InitialAmarGram` regenerated with the new columns/table; `AddRiderRetentionGuard` attaches the retention triggers to `ordering.rider` (C-ALL-1).
  - Key files: `src/Domain/.../DomainServices/OrderTransitionRules.cs`, `Aggregates/Order/{OrderAggregate,RiderAggregate}.cs`, `ValueObjects/Shipment.cs`; `src/Application/.../CommandHandlers/Order/{OrderFulfilmentCommandHandlers,RiderCommandHandlers,CompleteCounterSaleCommandHandler}.cs`; `src/Read/.../QueryHandlers/Order/{StaffOrderQueryHandlers,PosQueryHandlers,RiderQueryHandlers}.cs`, `QueryHandlers/Reporting/Dashboard/{GetSalesSeriesQueryHandler,DashboardTileSources}.cs`; `src/Api/.../Controllers/{StaffOrders,StaffRiders,StaffPos,StaffDashboard}Controller.cs`; tests `tests/AmarGram.IntegrationTests/Endpoints/OrderingBackOfficeGapsEndpointTests.cs`, `tests/AmarGram.Domain.Tests/Ordering/HoP4BackOfficeGapsTests.cs`.

## Remaining work
- Concurrent checkout on the last unit: exactly one succeeds (needs a reservation transaction)
- Bank-transfer hold expiry as a background job
- Courier integration (blocked by SRS Q-4) with CSV manifest fallback
- Returns quarantine and the restock/write-off decision
- Blocked by SRS Q-3 (COD policy — now the primary payment route), Q-3b, Q-5 (tax)

## HO-P3 backend gaps G1, G4, G5, G8 (2026-10-25) -- Status: Complete
- G1: `ProductAggregate.DistrictOfOrigin` (`ProductRules.DistrictMaxLength` 60; `InvalidDistrictOfOrigin`), set via the product details update; `district` catalogue filter, `districts` facet, `districtOfOrigin` on list item/detail/staff detail. View `product.storefront_catalogue_entry` gained `district_of_origin`.
- G4: `FulfilmentDetails.RiderNote` (`OrderRules.MaxRiderNoteLength` 300; redacted on anonymisation), `riderNote` on place-order request and on both order details (`fulfilment.riderNote`). Delivery orders only.
- G5: `GET /api/shop/delivery-promise` (anonymous) = storefront branch's primary zone (active, lowest priority then name, with an active Standard level), Standard level's `freeOverOrderValue` and `leadTimeDays`.
- G8: `CatalogueItem.Certifications` (names).
- Baseline `InitialAmarGram` / `InitialAmarGramSql` regenerated (not stacked); recreate test DBs.
- Key files: `ProductAggregate.cs`, `FulfilmentDetails.cs`, `GetCatalogueQueryHandler.cs`, `GetCatalogueFiltersQueryHandler.cs`, `OrderConfigurationQueryHandlers.cs` (`GetDeliveryPromiseQueryHandler`), `ShopCatalogueController.cs`, tests `StoreFrontGapsEndpointTests.cs`.

# HO-P5 — Wiring pass: surface the new backend data in the restyled screens (frontend, 5 slices)

Owner brief (2026-10-31, as given to this handover):
- HO-P3 (store front) and HO-P4 (back office) are merged and passed all five gates. Each left out designed elements whose backend did not exist: HO-P3 [§21](HO-P3-STORE-FRONT.md#21-backend-gaps-not-designed-here-for-a-later-backend-handover) G1, G4, G5, G8 and HO-P4 [Backend gaps](HO-P4-BACK-OFFICE.md#backend-gaps-not-built-in-ho-p4) BG-1 … BG-23.
- Those backend gaps have since been built in `src/` and merged on `feat/phase2-catalogue-theme` (`1aa6e76` G1/G4/G5/G8; `c908c35` BG-1 … BG-8; `bcc56fc` BG-9 … BG-18; `ba10c2f` BG-19, BG-22 fixes; the `aeb6103` worktree merge for BG-19 … BG-23; `6c5c89c` subscriptions).
- This pass wires that data into the existing restyled screens through `web/lib/**` (API clients, types, hooks) and `web/mocks/**` (MSW handlers and seed data), plus the **minimal** component and page changes each design describes.
- **Subscriptions (G2 / BG-15) are excluded.** They get their own later handover for the subscription screens. A BG item that touches subscriptions only in part is scoped to its non-subscription part.
- Process: lightweight, as HO-P3/HO-P4. Build, verify (typecheck, lint, Vitest, Playwright), then the five gates (§19). Slices run in small batches (§17).

---

## Gap inventory (read first) — verified against the code at `67691e9`

Every row was checked in `src/` (controllers, request contracts, view models, validators), not taken from commit messages. Paths are abbreviated: `Api/…` = `src/Api/AmarGram.Api/…`, `Read/…` = `src/Read/AmarGram.Read/…`, `Shared/…` = `src/Shared/AmarGram.Shared/Common/…`, `App/…` = `src/Application/AmarGram.Application/…`, `Domain/…` = `src/Domain/AmarGram.Domain/…`. Web paths are under `web/`.

### Summary

| Verdict | Count | Items |
|---|---|---|
| **wire** | 25 | G1, G4, G5, G8, BG-1 … BG-10, BG-12 … BG-14, BG-16 … BG-23 |
| **already wired** | 0 | (BG-5's dashboard *tile* renders through the generic tile renderer already; only its mock seed is missing — counted under BG-5 "wire") |
| **backend missing (stays open)** | 1 | BG-11 (Categories screen — dropped by HO-P4 as "not a defect"; backend unchanged, categories are still a fixed enumeration) |
| **subscriptions (deferred)** | 1 | BG-15 (and HO-P3 G2) |

Residual *parts* of wired items that stay open are listed in [Backend gaps still open after HO-P5](#backend-gaps-still-open-after-ho-p5) (G1 village, G4 on the packing slip, G5 basket hint, BG-22 design role set).

### Inventory

| Gap | Backend now provides (endpoint · DTO fields · file:line) | Existing web client / type | Screen(s) and component(s) (design ref) | Verdict · slice |
|---|---|---|---|---|
| **G1** District of origin | `GET /api/shop/products?district=` repeatable, ≤ 20 values, each ≤ 60 chars, case-insensitive (`Api/Controllers/ShopCatalogueController.cs:28,36-39`; `Shared/Constants/ProductRules.cs:12-13`). `CatalogueItem.DistrictOfOrigin` (`Read/ViewModels/CatalogueItem.cs:28-29`). `GET /api/shop/filters` → `districts[{ value, count }]` (`Read/Queries/Product/GetCatalogueFiltersQuery.cs:17-18`). `ProductDetail.DistrictOfOrigin` (`Read/ViewModels/ProductDetailViewModel.cs:21`). Staff write: `UpdateProductDetailsRequest.DistrictOfOrigin` (`Api/Contracts/Product/StaffProductRequests.cs:26-27`), validator `MaximumLength(60).NoControlCharacters()` (`App/CommandHandlers/Validators/UpdateProductDetailsCommandValidator.cs:15`). **No village field exists.** | None. `CatalogueItem` (`lib/api/shop-catalogue.ts:50-67`), `CatalogueFilters` (`:76-82`) and `ProductDetail` (`:129-151`) lack it; `MULTI_PARAMS` (`lib/shop/catalogueParams.ts:18`) has no `district` | Catalogue card eyebrow "DINAJPUR" (`docs/design/store/Catalogue.dc.html:113`) → `components/catalogue/ProductCard.tsx`; District filter group with counts (`Catalogue.dc.html:58`) → `components/catalogue/{CatalogueFilters,ActiveFilterChips,FiltersSheet}.tsx`; product "Grown in Birganj, Dinajpur" (`Product.dc.html:48`) → `components/product/ProductHeading.tsx`. Home "Village on every pack" stays out (no village; OQ-6) | **wire** · S1 (staff editor field = BG-12, S3) |
| **G4** Rider note at checkout | `PlaceOrderRequest.RiderNote` (`Api/Contracts/Order/PlaceOrderRequest.cs:17-18`), passed through at `Api/Controllers/CustomerOrdersController.cs:68`; validator ≤ 300, no control characters (`App/CommandHandlers/Validators/PlaceOrderCommandValidator.cs:24`; `Shared/Constants/OrderRules.cs:16`). Kept for Delivery, **silently dropped for Pickup** (`App/CommandHandlers/Order/OrderPlacement.cs:21-33`). Read back as `OrderFulfilmentViewModel.RiderNote` on the customer **and** staff order detail (`Read/ViewModels/OrderViewModels.cs:20-23`). **Not on the packing slip** (`Read/ViewModels/StaffOrderViewModels.cs:58-61`) | None. `PlaceOrderRequest` and its body (`lib/api/checkout.ts:167-171, 197-209`) and `OrderFulfilmentView` (`lib/api/my-orders.ts:70`) lack it | Checkout section 3 "Note for the rider (optional)" (`docs/design/store/Checkout.dc.html:68-70`) → `components/checkout/PaymentSection.tsx`, `CheckoutScreen.tsx`. Read-back (not drawn; OQ-7): `components/orders/OrderPanels.tsx` (customer), `components/orders/StaffOrderPanels.tsx` / `StaffOrderSidePanel.tsx` (staff) | **wire** · S1 (customer), S2 (staff read-back) |
| **G5** Public free-delivery threshold and lead time | `GET /api/shop/delivery-promise` (public, storefront, `Cache-Control: public, max-age=60`) → `{ currencyCode, freeOver: Money \| null, leadTimeDays: int \| null }`, all null when no zone (`Api/Controllers/ShopCatalogueController.cs:113-121`; `Read/Queries/Order/GetDeliveryPromiseQuery.cs:6-14`; handler `Read/QueryHandlers/Order/OrderConfigurationQueryHandlers.cs:138-162`: the storefront branch's active zone with the lowest `Priority` (then name) that has an active Standard service). **No zone name** (the controller's XML doc mentions `zoneName`; the view model has none — OQ-2). **No cart-level "amount to free delivery"** | None | Top strip "Free delivery over [AMOUNT] in Dhaka · Cash on delivery across Bangladesh" (`Home.dc.html:20`, `Catalogue.dc.html:19`) → `components/shop/ShopTopStrip.tsx`, `app/(shop)/layout.tsx`; product "Delivered in Dhaka within [DAYS]" (`Product.dc.html:83`) → `components/hearth/DeliveryPromise.tsx` (`DeliveryPromiseCard`). Basket "Add ৳X more for free delivery" (`BasketPhone.dc.html:136`) **cannot be built** without browser arithmetic (OQ-4) | **wire** (strip, product) · S1. Basket hint stays open (G5b) |
| **G8** Certifications on catalogue items | `CatalogueItem.Certifications` (`Read/ViewModels/CatalogueItem.cs:28-30`), same names as the product detail | None. `CatalogueItem` (`lib/api/shop-catalogue.ts:50-67`) lacks it | "Organic" pill on catalogue/home cards (`Catalogue.dc.html:110`) → `components/catalogue/ProductCard.tsx` | **wire** · S1 |
| **BG-1** 14-day sales series | `GET /api/staff/dashboard/sales-series?days=` (1–31, default 14; `Reports.SalesView`; 403 `BranchNotAssigned` without a branch) → `{ branchId, branchName, from, to, timeZoneId, currencyCode, total: Money, generatedOn, days[{ date, net: Money, orders }] }`, oldest first, every day present (`Api/Controllers/StaffDashboardController.cs:38-61`; `Read/ViewModels/SalesSeriesViewModels.cs:3-9`) | None. `lib/api/dashboard.ts:48` has `getDashboard` only | Dashboard chart (`docs/design/back-office/Dashboard.dc.html`; HO-P4 §11.2.5) → `components/dashboard/**`, `app/(staff)/staff/page.tsx` | **wire** · S2 |
| **BG-2** Order counts by status | `GET /api/staff/orders/status-counts` (queue filters bar `status`) → `{ total, counts[{ status, count }] }`, every status in pipeline order, zeros included (`Api/Controllers/StaffOrdersController.cs:139-158`; `Read/ViewModels/StaffOrderViewModels.cs:40-45`) | None. `listStaffOrders` (`lib/api/staff-orders.ts:174`) only | Dashboard "Orders in progress" pipeline; Orders status pill counts (HO-P4 §11.3.1, U18 "no counts") → `components/back-office-overview/Dashboard*.tsx`, `components/orders/StaffOrderQueue.tsx` | **wire** · S2. The "Subscription" channel tab is BG-15 (deferred) |
| **BG-3** Delivery area and slot on the list row | `StaffOrderRowViewModel` adds `deliveryZone`, `deliveryDistrict`, `slotDate` (`yyyy-MM-dd`), `slotWindowLabel`; null for pickup/counter/no slot (`Read/ViewModels/StaffOrderViewModels.cs:6-13`) | `StaffOrderRow` (`lib/api/staff-orders.ts:29-42`) lacks them | Orders list Fulfilment column (`Orders.dc.html`; HO-P4 §11.3.2) → `components/orders/StaffOrderQueue.tsx` | **wire** · S2 |
| **BG-4** "Packed, waiting for rider"; persisted pick-list ticks | `POST /api/staff/orders/{id}/packed` (`Packing → Packed`, optional step) and `PUT /api/staff/orders/{id}/lines/{lineId}/picked { picked }` (idempotent; 404 unknown order/line; `400 InvalidOrderTransition` once off the shelf) (`Api/Controllers/StaffOrdersController.cs:194-221`; `Api/Contracts/Order/OrderFulfilmentRequests.cs:12-16`). Line view adds `picked`, `pickedOn`, `pickedBy`; detail adds `packedOn` (`Read/ViewModels/StaffOrderViewModels.cs:17-19, 38`). New status **`Packed`** and action **`MarkPacked`**; `Packed` → Dispatch / ReadyForCollection / Cancel (`Domain/DomainServices/OrderTransitionRules.cs:21-22, 56, 62-64`). A customer cannot cancel from `Packed` (`:90`) | None. `OrderStatus` (`lib/api/my-orders.ts:17-38`) has no `Packed` — **today a customer order in `Packed` loses its tracker** (`lib/orders/tracker.ts:18-26` returns `null`); `StaffOrderLine` (`lib/api/staff-orders.ts:65-76`) has no `picked`; `StaffOrderAction` (`:120-128`) has no `MarkPacked` | Orders side panel pick list and "Packed" state (`Orders.dc.html:134-162`; HO-P4 §11.3.3) → `components/orders/StaffOrderSidePanel.tsx`, `StaffOrderPanels.tsx`; Dashboard pipeline "Packed" bar; customer tracker (`lib/orders/tracker.ts`) | **wire** · S0 (status, labels, tracker), S2 (staff) |
| **BG-5** In-house riders | `GET /api/staff/riders?activeOnly=` (`Orders.Fulfil`), `POST`/`PUT /api/staff/riders[/{id}] { name, mobileNumber?, isActive }` (`Riders.Manage`; `400 RiderNameAlreadyExists`, `404 RiderNotFound`) (`Api/Controllers/StaffRidersController.cs:14-63`; `Read/ViewModels/RiderViewModels.cs:3-4`; `Api/Contracts/Order/OrderFulfilmentRequests.cs:18-24`). Dispatch takes **exactly one** of `courierId` / `riderId` (`400 DispatchTargetInvalid`) (`OrderFulfilmentRequests.cs:3-10`; `StaffOrdersController.cs:223-238`). Shipment adds `riderId`, `riderName`; `courierId` nullable (`StaffOrderViewModels.cs:27-30`). Dashboard tile `orders.cod-with-riders` (figures `riders`, `orders`, `amount`) (`Read/QueryHandlers/Reporting/Dashboard/DashboardTileSources.cs:217-246`) | Dispatch is courier-only (`lib/api/staff-orders.ts:259, 328`); `StaffShipment.courierId: string` (`:102-110`). The dashboard renders tiles generically (`lib/api/dashboard.ts:30`), so the tile already shows against the real API; the mock does not seed it | Dispatch dialog "Rider" (`Orders.dc.html:111-113, 157`) → `components/orders/DispatchDialog.tsx`; shipment panel; Dashboard "COD out with riders" (`Dashboard.dc.html:146-153`) → mock seed only. Rider registry screen: **not designed** (OQ-9) | **wire** · S2 |
| **BG-6** Browse SKUs by category | `GET /api/staff/pos/browse?category=&pageNumber=&pageSize=` → paged `PosSku` (`Api/Controllers/StaffPosController.cs:50-52`; `Read/Queries/Order/PosQueries.cs:22-24`) | None. `searchPosSkus` (`lib/api/pos.ts:47`) only | Counter sale category tabs + tap grid (`CounterSale.dc.html`; HO-P4 §11.3.6) → `components/pos/**` | **wire** · S2 |
| **BG-7** Change due before completing | `POST /api/staff/pos/quote { …, tenderedCash? }` (> 0, ≤ 2 decimals) → `changeDue` **or** `cashShort` (both null without a tender) (`Api/Contracts/Order/PosRequests.cs:23-24`; `Read/ViewModels/PosViewModels.cs:12-17`) | `getCounterQuote` / `CounterQuote` (`lib/api/pos.ts:56-76`) lack both | Counter sale ticket (`CounterSale.dc.html`; HO-P4 §11.3.6 "no change shown before completion") → `components/pos/PosTenderPanel.tsx`, `PosScreen.tsx` | **wire** · S2 |
| **BG-8** Anonymous walk-in sale | `PosSaleRequest.CustomerName` / `CustomerMobile`: **both or neither**; neither = anonymous sale (`Api/Contracts/Order/PosRequests.cs:31-33`) | `CounterSaleInput` requires both (`lib/api/pos.ts:88-94`) | Ticket customer chip "Walk-in · add customer" (HO-P4 §11.3.6) → `components/pos/PosCustomerPanel.tsx` | **wire** · S2 |
| **BG-9** Product list: origin, pack sizes, price range, stock, thumbnail, organic | `StaffProductSummaryViewModel` adds `countryOfOrigin`, `packSizes[]`, `priceRange { min, max }` (Money), `availableStock` (number, active branch; null when unknown or bundle), `primaryImage` (signed 480 px `url`), `isOrganic` (`Read/ViewModels/StaffProductSummaryViewModel.cs:3-28`; branch from `Api/Controllers/StaffProductsController.cs:32-33`) | `StaffProductSummary` (`lib/api/staff-shop.ts:19`) lacks them | Products table (`Products.dc.html`; HO-P4 §11.4.3) → `components/staff-shop/StaffProductTable.tsx` | **wire** · S3 |
| **BG-10** Bulk publish/hide | `POST /api/staff/shop/products/bulk-status { productIds[≤100], action: Publish \| Unpublish }` → 200 `{ action, succeededCount, failedCount, items[{ productId, succeeded, status, errorCode, propertyName, message }] }`; 400 only for a malformed request (`InvalidBulkAction`) (`Api/Controllers/StaffProductsController.cs:280-296`; `StaffProductRequests.cs:94-99`; `ProductRules.cs:28-29`) | None (`transitionProduct`, `lib/api/staff-shop.ts:336-337`, one product with a version) | Products select column and bulk bar (HO-P4 §11.4.3) → `StaffProductTable.tsx`, `app/(staff)/staff/shop/products/page.tsx` | **wire** · S3 |
| **BG-11** Categories screen | **No change.** Categories remain the fixed `ProductCategory` enumeration | — | — (HO-P4 dropped the "Categories" button) | **backend missing (stays dropped, not a defect)** |
| **BG-12** District/region in the product editor | Same field as G1: request `StaffProductRequests.cs:26-27`, staff detail `Read/ViewModels/StaffProductDetailViewModel.cs:52`, validator `UpdateProductDetailsCommandValidator.cs:15` (`InvalidDistrictOfOrigin`, `Shared/Constants/BusinessViolationCodes.Shop.cs:44`) | `StaffProductDetail` / `UpdateProductDetailsRequest` (`lib/api/staff-shop.ts:135, 186`) lack it | Product editor Details → Organise card (HO-P4 §11.4.5) → `components/staff-shop/ProductDetailsForm.tsx` | **wire** · S3 |
| **BG-13** "Was" (compare-at) price | `POST /api/staff/shop/skus/{skuId}/prices { …, compareAtAmount? }` (`400 CompareAtMustExceedPrice`) (`Api/Controllers/StaffSkusController.cs:27-40`; `StaffProductRequests.cs:90-91`; `BusinessViolationCodes.Shop.cs:80-81`). Staff SKU adds `compareAtPrice`, `scheduledCompareAtPrice` (`StaffProductDetailViewModel.cs:23-25`). Also on the public `CatalogueItem.CompareAtPrice` and `DetailSku.CompareAtPrice` (`CatalogueItem.cs:31-32`; `ProductDetailViewModel.cs:12-13`) | `StaffSku` and `scheduleSkuPrice` (`lib/api/staff-shop.ts:75, 348-362`) lack it | Pack sizes & prices "Was" column (`ProductEditor.dc.html:87`; HO-P4 §11.4.7) → `components/staff-shop/VariantsTable.tsx`, `app/(staff)/staff/shop/products/[productId]/variants/page.tsx`. Store-side display: **not in the store design** (OQ-8) | **wire** (staff) · S3 |
| **BG-14** Organic certificate expiry and file | `PUT /api/staff/shop/products/{id}/food { …, organicCertificateExpiresOn?, organicCertificateFileId? }` (`Api/Contracts/Product/FoodAndOriginRequests.cs:14-18`; `StaffProductsController.cs:123-139`). Staff food view adds `organicCertificateExpiresOn`, `organicCertificateExpired` (server), `organicCertificateFileId`, signed `organicCertificateUrl` (`StaffProductDetailViewModel.cs:27-33`). Upload: `POST /api/staff/files?purpose=OrganicCertificate` (PDF/JPEG/PNG/WebP, 10 MB; `Shared/Constants/FileRules.cs:33-37`). Codes `OrganicCertificateExpired` (publish blocked), `InvalidCertificateFile` (`BusinessViolationCodes.Shop.cs:82-85`) | `StaffFoodDetail` / `SetFoodDetailsRequest` (`lib/api/staff-shop.ts:114, 214`) lack them; `FilePurpose` (`lib/api/files.ts:16`) and `lib/files/fileRules.ts` lack `OrganicCertificate` | Food & labelling "Certified organic" block (`ProductEditor.dc.html:114`; HO-P4 §11.4.6) → `components/staff-shop/FoodDetailsForm.tsx` | **wire** · S3 |
| **BG-15** Subscriptions | Built (`Api/Controllers/CustomerSubscriptionsController.cs`, `StaffSubscriptionsController.cs:51`; product `IsSubscribable` `StaffProductRequests.cs:32-33`) | — | Product editor "Can be subscribed to", Customers Subscriptions tab, "Subscriber" filter, Dashboard "Subscription orders due", Subscription channel | **subscriptions (deferred)** — later handover |
| **BG-16** Reorder level; batch received/supplier | `StockSummaryViewModel` adds `reorderLevel` (string), `reorderLevelIsDefault`, `belowReorderLevel` (`Read/ViewModels/InventoryStockViewModels.cs:21-30`); `StockMatrixBatchViewModel` adds `receivedOn`, `supplierId`, `supplierName` (`:49-52`) | `StockSummary` and `StockMatrixBatch` (`lib/api/inventory-stock.ts:12, 49`) lack them | Stock by item "Reorder at" and batch "Received", "Supplier" (`Inventory.dc.html:72, 87`; HO-P4 §11.5.3) → `components/back-office-stock/{StockBrowser,StockItemBatches}.tsx`, `components/stock/SkuStockMatrix.tsx` | **wire** · S3 |
| **BG-17** Consignments arriving this week | `GET /api/staff/inventory/alerts/summary?arrivalWindowDays=` (1–90, default 7) → `{ open: { total, byKind }, consignmentsArriving: { withinDays, count } }` (`Api/Controllers/StaffAlertsAndReorderController.cs:36-49`; `Read/ViewModels/AlertsAndReportsViewModels.cs:20-24`). Consignment list accepts `arrivingWithinDays` (`Api/Controllers/ProcurementConsignmentsController.cs:28-37`) | `AlertSummary` (`lib/api/inventory-alerts.ts:45-49`) lacks `consignmentsArriving` | Inventory overview tile (`Inventory.dc.html:67`; HO-P4 §11.5.2) → `components/inventory/InventoryOverview.tsx` | **wire** · S3 |
| **BG-18** Receipt drafts (autosave); receive into another branch | `GET/PUT/DELETE /api/staff/inventory/goods-receipt-drafts[/{id}]` — the caller's own drafts only (another's = 404), client-minted id, whole-form `PUT` → `{ draftId, version, branchId }`; `400 GoodsReceiptDraftLimitReached` past 20, `InvalidGoodsReceiptDraft` for over-long/negative fields; a posted or discarded draft is closed (404 on save) (`Api/Controllers/StaffGoodsReceiptDraftsController.cs:14-82`; `Api/Contracts/Inventory/StockRequests.cs:47-81`; `Read/ViewModels/InventoryStockViewModels.cs:32-45`). `PostGoodsReceiptRequest` adds `branchId?` (403 `BranchNotAssigned`) and `draftId?` (`StockRequests.cs:27-34`). PO, consignment and location lists accept `branchId` (`ProcurementPurchaseOrdersController.cs:24-27`; `ProcurementConsignmentsController.cs:28-31`; `StaffInventoryLocationsController.cs:21-24`) | `PostGoodsReceiptRequest` (`lib/api/inventory-receipts.ts:102-110`) lacks both; no drafts client; `getLocations` (`lib/api/inventory-lookup.ts:74`), `getPurchaseOrders` (`lib/api/procurement-orders.ts:75`), `getConsignments` (`lib/api/procurement-consignments.ts:166`) take no `branchId` | Receiving "Draft saved automatically", "Receive into" (`Receiving.dc.html:56, 65`; HO-P4 §11.5.6 "no autosave", "no Receive into select") → `components/inventory/GoodsReceiptForm.tsx`, `app/(staff)/staff/inventory/receipts/new/page.tsx` | **wire** · S3 |
| **BG-19** Customer list, name search, profile summary, notes, tags, staff password reset | `GET /api/staff/customers/browse?search=&tag=&sort=recent\|name&pageNumber=&pageSize=` → paged `{ id, fullName, mobileNumber, emailAddress, recordStatus, status, customerSince, area, tags[] }` (`Api/Controllers/StaffCustomersController.cs:52-74`). Detail adds `customerSince`, `area`, `orderCount`, `lifetimeSpend` (Money), `tags`, `noteCount` (`Read/ViewModels/StaffCustomerViewModel.cs:3-13`). Notes `GET`/`POST …/{id}/notes { text }` → 201 `{ noteId }` (`:115-141`); tags `PUT …/{id}/tags { tags[] }` → `{ tags }` as stored (`:143-155`); `POST …/{id}/password-reset` → `{ channel, maskedDestination, expiresOn }` (`:157-170`). Limits: 200 notes, note ≤ 1000, 10 tags, tag ≤ 30 (`Shared/Constants/CustomerStaffRecordRules.cs:6-9`) | `findCustomers` and `StaffCustomer` (`lib/api/staff-customers.ts:54, 62-73`) only | Customers list, profile KPIs, Notes tab, tags, "Send password reset" (`Customers.dc.html:76-138`; HO-P4 §11.2.8-9) → `components/customer/**`, `components/back-office-overview/CustomerProfileView.tsx`, `app/(staff)/staff/customers/**` | **wire** · S4 (Subscriptions tab and "Subscriber" filter = BG-15, deferred) |
| **BG-20** Counted amount per source | `CashUpViewModel.sources[{ key, label, expected, counted?, variance? }]` (`Read/ViewModels/BillingCashUpViewModels.cs:7-12, 20-23`); `PUT /api/staff/billing/cash-ups/{date}/count { counts[{ sourceKey, countedCash }], explanation? }` — the total is the server's sum; ≤ 50 entries, key ≤ 60 chars; `UnknownCashUpSource`, `DuplicateCashUpSource` (`Api/Contracts/Billing/BillingCashUpRequests.cs:3-17`; `Api/Controllers/StaffCashUpController.cs:33-52`; `App/CommandHandlers/Validators/BillingCashUpCommandValidators.cs:15-18`; `Shared/Constants/BusinessViolationCodes.Billing.cs:83-84`) | `CashUp` / `recordCashCount` (`lib/api/billing-cashup.ts:44-78`) total only | Cash-up table Source / Expected / Counted / Over-short (`Billing.dc.html:85-96`; HO-P4 §11.6.3) → `components/billing/CashUpScreen.tsx` | **wire** · S4 |
| **BG-21** Outlet card details | `GET /api/admin/branches` → `AdminBranchViewModel` adds `type` (Outlet \| Warehouse), `todayHours { date, isOpenToday, summary, intervals }`, `deliveryAreas[]`, `activeStaffCount`; address is `addressLine` (`Read/ViewModels/AdministrationBranchViewModels.cs:10-21`; `Api/Controllers/AdminBranchesController.cs:18-22`). Create/update accept `type` (`Api/Contracts/Administration/BranchRequests.cs:11-12, 22-23`) | `BranchSummary` (`lib/api/admin-branches.ts:38-44`) lacks them; `CreateBranchRequest` / `UpdateBranchDetailsRequest` (`:65, :78`) lack `type` | Outlet cards (`Administration.dc.html:62-80, 154-157`; HO-P4 §11.6.7) → `components/branches/BranchTable.tsx`, `BranchDetailsForm.tsx` | **wire** · S4 |
| **BG-22** Staff list: branch and status; design role set | `StaffAccountSummaryViewModel` adds `status` (Active \| NotSetUp \| Locked) and `branches[{ id, name, isPrimary }]` (`Read/ViewModels/StaffAccountSummaryViewModel.cs:3-9`; rule `Shared/Helpers/StaffAccountStatusRules.cs:5-16`). **Roles unchanged**: Reception, Inventory, ShopManager, Accountant, Administrator (`Shared/Constants/StaffRoleCatalogue.cs:38-40`) | `StaffAccountSummary` (`lib/api/staff-admin.ts:39-47`) lacks them | Staff & roles Outlet column, status (`Administration.dc.html:80-88`; HO-P4 §11.6.8) → `components/admin/StaffAccountTable.tsx` | **wire** (branch, status) · S4. The design's role set stays unbuilt |
| **BG-23** Click-to-cycle roster cells | `GET /api/admin/branches/{branchId}/roster-cells?from=&to=&staffAccountId=` → `[{ staffAccountId, branchId, date, shift: Morning \| Evening \| Off \| Custom, slots[{ starts, ends }] }]`; `PUT …/rosters/{staffAccountId}/shifts/{date} { shift: Morning \| Evening \| Off }` → 200 the cell; `ShiftDateInPast`, `StaffNotRosterable`, `BranchNotFound` (`Api/Controllers/AdminRostersController.cs:49-88`; `Api/Contracts/Administration/RosterRequests.cs:16-20`; `Read/ViewModels/RosterCellViewModels.cs:3-7`). Presets 08:00–14:00 and 14:00–20:00; only Reception is rosterable (`Shared/Constants/StaffRosterRules.cs:6-17`) | `lib/api/admin-rosters.ts:21` (patterns and exceptions only) | Roster grid (`Administration.dc.html:91-95, 147-150`; HO-P4 §11.6.9) → `components/roster/RosterWeekView.tsx`, `app/(staff)/staff/admin/branches/[branchId]/roster/page.tsx` | **wire** · S4 |

---

## 1. Identity

| Field | Value |
|---|---|
| Handover ID | HO-P5-WIRING |
| Title | Wiring pass: surface the new backend data in the restyled screens |
| Date | 2026-10-31 |
| Author | Tech lead (handover agent), for shahjahan |
| Backlog | [`docs/USER_STORIES.md`](../USER_STORIES.md). Store front: US-SHP-03, US-SHP-04, US-ORD-02 … 06, US-ORD-12. Back office: US-RPT-05; US-ORD-09, US-ORD-10, US-ORD-11, US-ORD-16; US-SHP-01, US-SHP-02, US-SHP-03; US-IMP-04, US-IMP-06, US-IMP-10, US-IMP-12; US-ACC-07, US-ACC-10, US-ACC-11; US-BIL-12; US-ADM-01, US-ADM-02, US-ADM-03. US-SUB-* are **deferred** |
| SRS | UI-1, UI-3, UI-4, UI-5, UI-6, NFR-USA-4, NFR-USA-5, NFR-USA-6, NFR-CMP-2, NFR-PRF-1, C-5, C-6 ([`docs/SRS.md`](../SRS.md) §3.1, §6) |
| Pairs with | [HO-P3-STORE-FRONT](HO-P3-STORE-FRONT.md) (§21 G1/G4/G5/G8) and [HO-P4-BACK-OFFICE](HO-P4-BACK-OFFICE.md) (Backend gaps BG-1 … BG-23). Their layouts, decisions, accessibility rules and money rules stay binding |
| Approved design | [`docs/design/store/`](../design/store/README.md) and [`docs/design/back-office/`](../design/back-office/README.md), as already interpreted by HO-P3 and HO-P4. No new design exists; this pass fills in the elements those handovers left out |
| Backend handovers it consumes | The G/BG backend changes listed in the Gap inventory. No `architect` design was produced for the wiring itself; the decisions it needs are ADR-FE-185 … 192 (§9) and the open questions |
| Baseline commit | `67691e9` (branch `feat/phase2-catalogue-theme`) |
| Known e2e baseline | The 12 failures accepted in HO-P4 §1 Amended (ix), carried over unchanged: `staff-shell-toggle` :29, `staff-shell-manual-expand-overflow` :37, `staff-shell-sheet-closes-on-back-navigation` :30, `procurement-flows` :95 E-A3, `billing-a11y-responsive` :86 (dialog contrast), `billing-functional` :18 E-A1 and :216 E-F1, `admin-functional` :56 E-B1 (mobile-360), `notifications-inbox` :16 and :28 (mobile-360), `ordering-a11y-responsive` :133, `xct-operations` :76. Any other failure, or any of these failing in a new way, blocks |
| Amended | **2026-10-31 (owner-ratified, before build).** OQ-1 … OQ-15 are resolved as their recommended defaults in the Open questions table; the slices build to those defaults. **2026-10-31 (owner-ratified, after the S0 build).** (a) S0 may also edit `components/orders/OrderStatusBadge.tsx`, `components/portal/AccountSidebar.tsx` and `components/portal/dashboard/LiveOrderCard.tsx`, only to add `Packed` (the badge spec, and the open/live status lists). §14's `components/orders/*` row is waived for that one entry. (b) S1 adds `Packed` to `MyOrderDetail.tsx` (its status set, the cancel/return hints and the Packing case) and bumps the shop mock's `PERSIST_KEY` in `mocks/handlers/shop/store.ts`. S2 adds `Packed` to `StaffOrderQueue.tsx` (`STATUSES`, `PILL_STATUSES`). (c) S0's new `DbOrderLine`, `DbFulfilment` and shipment fields are optional, not required as §8.2 words them, because `customer.ts` and `pos.ts` build those objects. (d) The U15 Reports cases live in `overview-signin.test.tsx`. **2026-10-31 (owner-ratified, after S0 ARCHITECTURE run 1).** (e) S0's scope gains `tests/components/portal/account-sidebar.test.tsx` and `tests/components/orders/order-status-badge-packed.test.tsx`, for the `Packed` cases covering (a). (f) S0 may also edit `components/portal/dashboard/labels.ts`, only to add `Packed` to the portal `ORDER` map; without it `OrdersTile.tsx` shows a customer "Status unavailable". (g) §8.2's "most food products" stands: S0 seeds districts on more than half of the food products in `mocks/handlers/shop/fixtures.ts`, and products from non-Bangladeshi producers have none. **2026-10-31 (owner-ratified, after S0 CODE_REVIEW).** (h) S0 may also add `Packed: 'is packed'` to `HEADLINES` in `components/portal/dashboard/LiveOrderCard.tsx`, extending (a), with one case in `tests/components/orders/order-status-badge-packed.test.tsx`; without it a Packed order reads "is open". The wording is neutral because a pickup order is also Packed. **2026-10-31 (owner-ratified, after S0 ACCEPTANCE run 1).** (i) During a slice's gates, only the e2e rows §16 assigns to that slice block. A failure in any other spec that passes when rerun alone is recorded in the slice's TEST record and rechecked at E18, where "any other failure blocks" applies in full. (j) S0 is exempt from §19's ACCEPTANCE screenshots, as contract and seed work with only small label changes; S1 … S4 still owe them for the screens they change. (k) The customer-side `Packed` headline from (h) stays proven by its component test only; no slice owes it on a real screen, because `mocks/handlers/portal/**` is in no §13 block. **2026-10-31 (owner-ratified, after S0 ACCEPTANCE run 2).** (l) §16 E17's "all" is checked at E18 and does not block a slice's own gates, for S0 … S4. No slice runs E17 as a gate row, so a break in those specs from a slice's change surfaces at integration. **2026-10-31 (integrator decisions, under the owner's 2026-10-31 delegation to finish HO-P5 without per-step approval; not individually seen by the owner).** (m) `tests/unit/orders/status-vocabulary.test.ts` finds its seeds by id and asserts the eleven original orders' totals, so a seed added through §20.1 does not break it. (n) In a parallel batch, each implementer runs typecheck, lint, the Vitest files it touches and its §16 "may change" specs at `--workers=1`. The full `npm test -- --maxWorkers=2` and all the slice's §16 rows run in that slice's TEST gate, one slice at a time, because two slices running §17.2 together exhaust this machine's commit memory. (o) S1 may also edit `app/(shop)/_components/ProductPurchase.tsx` and `components/product/BuyBox.tsx`, only to pass `leadTimeDays` down to `DeliveryPromiseCard`, and `tests/components/checkout/checkout.test.tsx`, only to replace the superseded "no rider note" assertion in U25. (p) The district facet is ordered by name, case-insensitively, as `GetCatalogueFiltersQueryHandler.cs:55-56` does; the Gap inventory's and that handler comment's "most products first" do not match the code. (q) S1's calls stand: a lead time of 0 days keeps today's text, the customer Packed wording is "Your order is packed", and the delivery-promise mock has no maintenance 503, because no shop mock has one. (r) §14's `docs/**` row does not cover a slice's `docs/gates/HO-P5-WIRING-<slice>-*.md` gate records and its §17.3 report at `docs/gates/HO-P5-WIRING-<slice>-SLICE-REPORT.md`, or its `docs/test-cases/TC-HO-P5-WIRING-<slice>.md` sheet. (s) `CatalogueFilters.districts` is required as §11.2.1 says, and S1 may edit `tests/components/catalogue/catalogue-fixtures.ts` to add `districts: []` and `tests/components/catalogue/catalogue-p3.test.tsx` to retitle its "no District filter" case. (t) E4's "banners still render below" is proven by `tests/components/shop/shell-p5.test.tsx`, not e2e: no `Shop` banner is seeded, and seeding one would change every shop page. (u) The customer rider note is a `dt`/`dd` pair in the "Delivering to" card in `MyOrderDetail.tsx`, matching that card, not the "Note for the rider: {riderNote}" text of OQ-7, §11.2.9 and U15. (v) The rider-note mock answers a NUL character with `PredicateValidator`, where the server's `NulByteRejectionFilter.cs:41-48` answers earlier; it is not typeable, so the difference stands. (w) A free-delivery threshold of 0 is allowed by the server (`OrderConfigurationCommandValidators.cs:16-17`) but "Free delivery over ৳0.00" is wrong, so `promiseTakesStrip` treats it as no promise and the strip falls back as ADR-FE-187 does for a missing threshold. Other wording, such as "Free delivery on all orders", would be the owner's to give. (x) S2's code-over-document points stand under §20.2: the pick list lists only Confirmed and Packing (`StaffOrderQueryHandlers.cs:215-216`), rider name uniqueness is case-sensitive, not as §11.3.14 says (`RiderCommandHandlers.cs:18,45`), and `CourierNotFound` is a 404 (`OrderingResults.cs:15-21`). Orders.View is held by all five staff roles, so the pipeline panel's absent state is reached only by a refused or failed read. (y) The riders page uses `ResponsiveTable`, because `DataTable` is URL-driven. (z) S2 may edit `components/back-office/tab-parts.tsx`, only to add an optional count label so a pill's accessible name reads "Packed, 1 order" (§7 UI-6), leaving every other tab's output unchanged. (aa) `useSalesSeries`'s key adds `branchId` to §11.3.2's, so a branch switch refetches. A pick tick shows at once in component state only while its write is in flight, and the server's `picked` then decides, which §8.4 allows for that moment. Writable ticks and "Packed {time}" stay in the side panel; below 1024 px staff cannot tick a line, as in HO-P4. (ab) The POS change preview shows only when no payment has been added yet, because the quote evaluates one `tenderedCash` alone, and the browser may not correct it (§20.4), so on a split payment it would mislead. |

## 2. Objective

HO-P3 and HO-P4 rebuilt every customer and staff screen to the approved design but deliberately left out the elements whose data did not exist: district of origin, the "Organic" card badge, the rider note, the public free-delivery promise, the sales chart, order counts, riders, the POS category grid and change preview, the richer product, stock, customer, cash-up, outlet, staff and roster data. The backend for all of them except subscriptions is now merged.

HO-P5 connects that data to the existing screens. Each slice adds the server's new fields and endpoints to the `lib/api` types and clients, adds hooks where the screen needs a new query or command, teaches the MSW mocks the same fields **and the same validation the server applies**, and then makes the smallest component and page change that shows the element the way HO-P3/HO-P4 and the design describe. No layout is redesigned, no figure is computed in the browser, and nothing is shown that the server does not send.

The work is five slices. **S0** is a small shared slice (status vocabulary, shared seed fields, ADRs, one test split) that lands first. **S1** (store front) and **S2** (sales) follow in parallel, then **S3** (catalogue and stock) and **S4** (customers, money and admin). No file is owned by two slices (§13).

## 3. In scope

### 3.1 The slices

| Slice | Name | Gaps | Starts |
|---|---|---|---|
| **S0** | Shared contract and seeds | Order status `Packed` + action `MarkPacked` vocabulary (customer and staff), tracker mapping, order channel `Subscription` display label (OQ-11), `riderNote` on the shared fulfilment type, new **seed fields** in the two shared mock stores (`ordering/store.ts`, `shop/fixtures.ts`), ADR-FE-185 … 192, the `overview.test.tsx` split | First, alone |
| **S1** | Store front | G1, G4 (customer), G5, G8 | After S0 merges (batch 1, with S2) |
| **S2** | Sales | BG-1, BG-2, BG-3, BG-4, BG-5, BG-6, BG-7, BG-8; G4 staff read-back | After S0 merges (batch 1, with S1) |
| **S3** | Catalogue and stock | BG-9, BG-10, BG-12, BG-13, BG-14, BG-16, BG-17, BG-18 | Batch 2, after batch 1 merges |
| **S4** | Customers, money and admin | BG-19, BG-20, BG-21, BG-22, BG-23 | Batch 2, with S3 |

### 3.2 Decisions already taken (carried over)

| Decision | Source |
|---|---|
| Money, prices, change due, thresholds, variances and totals are shown **as the server sends them**, through `formatMoney` / `AmountCell`. No `+ - * /` on a money-named value in ordering files; no `Number(` / `parseFloat(` in billing files; a request carries a typed amount through `wireMoney` | ADR-317, ADR-FE-080, ADR-FE-090, ADR-FE-092, HO-P4 §7 (U24 guards), HO-P3 §4.3 |
| Tokens only: no hex, `rgb(`, `hsl(` or arbitrary colour values | HO-P2 §2, HO-P3 U9, HO-P4 U41 |
| WCAG 2.1 AA, 360 px floor, 44 px targets, status never by colour alone, tabs vs link navs as HO-P4 §7 UI-6 | HO-P3 §7.1, HO-P4 §7 |
| Design content without data is omitted, never faked or stubbed | ADR-FE-177, ADR-FE-184 |
| A screen reads each context's own endpoint; it never joins N reads to compute a missing field | `.ai/read-side-pattern.md`, HO-P4 §6 |
| Only `lib/hooks/` calls `useQuery` / `useMutation`; `components/{account,admin,auth,customer}/**` import no hooks | `web/eslint.config.mjs` |
| **Mocks mirror the server's validation**, not just its happy-path shape. A mock that accepts what the server refuses hides a real defect | HO-P4 §1 Amended (i) (2026-10-29: the reject handler had to learn the server's pending and recorder checks) |
| Customer copy says "basket"; checkout is one page with choices in the URL and the quote as truth | ADR-FE-174, ADR-FE-175 |
| Back-office selection lives in the URL; list+detail falls back to the detail route below 1024 px | ADR-FE-183 |

## 4. Out of scope

### 4.1 Deferred elsewhere

| Item | Where it goes |
|---|---|
| **Subscriptions (G2 / BG-15)**: MySubscriptions screen, overview "Next staples box", Home staples band, product "Repeat monthly", product editor "Can be subscribed to" (`isSubscribable`), Customers Subscriptions tab and "Subscriber" filter, Dashboard "Subscription orders due tomorrow", the Orders "Subscription" channel tab | The later subscriptions frontend handover. HO-P5 does **not** read or send `isSubscribable` and does not call any `/subscriptions` endpoint |
| HO-P3 G3 (batch per order line), G6 (All/Active/Past), G7 (Buy again with prices), G9 (harvest month), G10 (invoice download) | Not built in `src/`; remain HO-P3 §21 gaps |
| Basket "Add ৳X more for free delivery" for guests / before an address (G5b) | Needs a server amount for the cart (OQ-4) |
| Rider note on the printed packing slip (G4b) | `PackingSlipViewModel` has no rider note (`Read/ViewModels/StaffOrderViewModels.cs:58-61`) — backend follow-up |
| "Village on every pack" (G1 residual) | No village field exists (OQ-6) |
| The design's staff role set Manager / Cashier / Packer / Stock keeper / Rider (BG-22 residual) | Roles are unchanged in `src/` |
| Store-side "Was" price (BG-13 public fields) | OQ-8 |
| HO-P4 OQ-1 (`--warm` staff token) and OQ-2 (sidebar count badges) | Still owner decisions; BG-2 makes OQ-2 feasible but it is **not** built here |

### 4.2 Excluded and not changing

Every route and component not named in §11/§12 keeps its HO-P3/HO-P4 layout and behaviour. In particular: reports, returns, refunds, notifications, procurement screens other than the list reads S3 parameterises, the packing slip page, the receipt page, portal billing, inbox, wishlist and reviews.

### 4.3 Forbidden shapes

- **Any money arithmetic in the browser**: no "freeOver − subtotal", no "tendered − total", no summing counted sources, no summing chart days for a total, no "max − min". Show `total`, `changeDue`, `cashShort`, `variance`, `priceRange.min` / `.max` as sent.
- A `lib/api` field, endpoint or enum value the server does not send or accept. Every new type field cites its view model in a comment (`// Read/ViewModels/X.cs:NN`).
- A mock field the real API does not send, a mock that accepts a request the server refuses, or a mock that refuses a request the server accepts.
- Colour literals of any kind; new tokens; `globals.css` edits.
- New npm dependencies (charts use the existing `recharts` or CSS bars).
- Storing the rider note, a receipt draft or a POS tender in `localStorage` / `sessionStorage` / the URL (rider note) — see ADR-FE-186, ADR-FE-190.
- Any subscription endpoint, field or screen (§4.1).
- Any change under `src/` or `tests/` (.NET).

## 5. Prerequisites

| Required | State |
|---|---|
| HO-P3 merged, five gates passed | ✅ `41711847` (ACCEPTANCE PASS run 3) |
| HO-P4 merged, five gates passed | ✅ `67691e9` (ACCEPTANCE PASS) |
| G1/G4/G5/G8 backend merged | ✅ `1aa6e76` — verified in the Gap inventory |
| BG-1 … BG-23 backend merged (except BG-11) | ✅ `c908c35`, `aeb6103`, `bcc56fc`, `ba10c2f` — verified in the Gap inventory |
| Owner answers to OQ-1 … OQ-14 | ❌ Open. Each slice builds to the recommended default and records it; a changed answer becomes a §1 Amended row |
| S0 merged before S1–S4 branch | ❌ (this phase's first step) |
| The `web/` baseline green apart from the 12 known e2e failures (§1) | ✅ per HO-P4 §1 Amended (ix) |

## 6. Governing architecture documents

HO-P5 changes no backend code. The backend documents still bind it: they define what the screens may read and send, and the ARCHITECTURE gate checks that no slice works around them in the browser.

| Document | What you need from it |
|---|---|
| [`.ai/architecture.md`](../../.ai/architecture.md) | The layering the API enforces. The UI sends commands and reads view models; it never stands in for a server rule (permissions, money, stock, the maker-checker and the draft-ownership rules) |
| [`.ai/cqrs.md`](../../.ai/cqrs.md) | Reads come from query endpoints (`status-counts`, `sales-series`, `browse`, `roster-cells`, `delivery-promise`); writes go through command endpoints (`picked`, `packed`, `bulk-status`, `shifts/{date}`, draft `PUT`). A command's response is not a read model unless the endpoint says so (the roster cell `PUT` and the cash-up count `PUT` do return the read) |
| [`.ai/read-side-pattern.md`](../../.ai/read-side-pattern.md) | View models are fixed shapes; a missing field is a backend gap, not a client join. The per-source cash-up variance, the price range and the customer's lifetime spend are server figures |
| [`.ai/bounded-contexts.md`](../../.ai/bounded-contexts.md) | Which context owns each new datum: districts and certifications (Shop), delivery promise and riders and order status (Orders), sales series (Reporting), reorder level, drafts and arrivals (Inventory), notes and tags (Accounts), cash sources (Billing), outlet type and roster cells (Administration). A screen showing several calls each owner |
| [`.ai/namespace-conventions.md`](../../.ai/namespace-conventions.md) | Not applicable to `web/` naming; cited because the ARCHITECTURE gate checks no backend file is touched |
| [`.ai/decisions/adr.md`](../../.ai/decisions/adr.md) | ADR-317 (money as server strings, no browser arithmetic), ADR-318/319 (files: the certificate upload goes through the one scanned upload path), ADR-341 (per-area partial registries: mocks, hooks and nav stay per area) |
| [`web/README.md`](../../web/README.md) | Folder layout, `fetch` only in `lib/api/client.ts`, hooks only in `lib/hooks`, design tokens, the parallel-worktree rule |
| [`web/docs/decisions.md`](../../web/docs/decisions.md) | ADR-FE-030/031 (server-component shop, URL catalogue state), FE-055 (`FileUploadField`), FE-089/090/093/097 (cart server state, quote truth, `allowedActions`, idempotency), FE-130/135/137 (dashboard), FE-173 … 184 (HO-P3/HO-P4) |
| [HO-P3](HO-P3-STORE-FRONT.md) §7, §8.3, §21 and [HO-P4](HO-P4-BACK-OFFICE.md) §7, §8, §11, Backend gaps | The screens, contracts and rules this pass extends |

## 7. SRS UI requirements as build rules

| Req | Rule | Where enforced |
|---|---|---|
| UI-1, NFR-CMP-2 | Every new element works at 360 px: the District filter lives in `FiltersSheet` on phones; the sales chart and pipeline stack; the POS category tabs scroll inside their own `tablist`; the per-source cash-up table, the Products table with its new columns and the roster grid sit in `TableFrame` (or become cards below 768 px where the screen already does) | `mobile-360` project, every slice |
| UI-3 | Destructive or wide actions confirm, naming what is affected: bulk publish/hide ("Hide 4 products from the shop?"), discarding a receipt draft, replacing a **Custom** roster day, sending a customer password reset, deactivating a rider | U30, U36, U46, U42, U24 |
| UI-4 | Filters stay in the URL: `district` (repeatable) on the catalogue; customer `search`, `tag`, `sort`, `page` on `/staff/customers`; POS `category` and page are in component state (the POS keeps no URL state today) | U8, U38 |
| UI-5 | The order list's 30 s refetch also refetches `status-counts`; pick-list ticks now come from the server (`picked`), so they survive refetch, reload and another device | U19, U21 |
| UI-6, NFR-USA-6 | Charts have a "Show as table" alternative and an `aria-live="polite"` readout; count pills carry the number in text ("Packing, 3 orders"); the Organic badge is text; the autosave status is `role="status"`; the roster cell is a button whose name says the person, the day and the current shift ("Nadia, Tuesday 4 Nov: Morning. Change shift"); every new field has a visible label | axe in every `*-a11y-responsive.spec.ts`, U-tests |
| NFR-USA-4 | Every new server code maps to plain language: `InvalidCatalogueFilter`, `RiderNote` length, `DispatchTargetInvalid`, `RiderNameAlreadyExists`, `CompareAtMustExceedPrice`, `OrganicCertificateExpired`, `InvalidCertificateFile`, `GoodsReceiptDraftLimitReached`, `InvalidGoodsReceiptDraft`, `BranchNotAssigned`, `UnknownCashUpSource`, `DuplicateCashUpSource`, `ShiftDateInPast`, `StaffNotRosterable`, `InvalidOrderTransition` (pick after dispatch) | Each slice's error mapper; U-tests |
| NFR-USA-5 | The receipt form keeps its `UnsavedChangesGuard` until the draft has saved the latest change; the product editor and cash-up forms keep theirs | U36 |
| NFR-PRF-1 | `/shop`, `/shop/products`, `/shop/products/[slug]` stay Server Components. The delivery promise is read on the server with `getPublic` (`revalidate: 60`, a fixed URL) and never blocks the page: a failed read renders as "no promise" | U11, E4 |
| C-5 | POS: the anonymous sale changes nothing about tenders; still no card number UI | `tests/guards/no-card-ui.test.ts` |
| C-6 / ADR-317 | §4.3 first bullet | `tests/guards/no-money-arithmetic.test.ts`, the billing ESLint block, CODE_REVIEW by hand for `lib/hooks/useSalesSeries.ts` and `components/dashboard/**` |

## 8. Frontend architecture

### 8.1 Layering (unchanged)

`lib/api/*.ts` adds types and functions mirroring the server. `lib/hooks/*.ts` adds queries and mutations (query keys namespaced by area as today). Pages call hooks and pass props; components never fetch. Server Components on the shop read through the `…Server` functions with `getPublic`.

### 8.2 Contracts S0 fixes for everyone (land first)

| File | Change | Consumers |
|---|---|---|
| `lib/api/my-orders.ts` | `OrderStatus` gains `'Packed'` (between `Packing` and `Dispatched`), and `ORDER_STATUSES` lists it in pipeline order. `OrderFulfilmentView` (`:70`) gains `riderNote?: string \| null` (`Read/ViewModels/OrderViewModels.cs:23`) | S1, S2, every status filter |
| `lib/format/orders.ts` | `orderStatusLabel('Packed')` = "Packed" (OQ-10); action label `MarkPacked` = "Mark packed"; channel label `Subscription` = "Subscription" (display only, OQ-11) | S1, S2 |
| `lib/orders/tracker.ts` | `STAGE_OF_STATUS.Packed = 'Packing'` (the Packing node stays current while the order waits for its rider). Nothing else changes | Customer tracker (S1 screens) |
| `lib/api/staff-orders.ts` | **Not S0.** S2 owns it, and S2 widens `StaffOrderRow.channel` to `'Online' \| 'Counter' \| 'Subscription'` | S2 |
| `mocks/handlers/ordering/store.ts` | `OrderStatusName` gains `Packed`; `DbFulfilment.riderNote: string \| null`; `DbOrderLine.picked / pickedOn / pickedBy`; `DbOrder.packedOn`; `DbShipment` (or the existing shipment shape) `riderId / riderName` with `courierId` nullable; `Db.riders: { id, branchId, name, mobileNumber, isActive }[]`. Seeds: two active riders and one inactive at the main branch; one order in `Packed` with every line picked; one `Dispatched` cash-on-delivery order out with a rider; one delivered order with a rider note. Existing seeds keep their ids, statuses and amounts, so no existing spec moves | S1, S2 |
| `mocks/handlers/shop/fixtures.ts` | `MockProduct.district?: string \| null`; `MockSku.compareAtCents?: number \| null` and `scheduledCompareAtCents?: number \| null`; `MockProduct.organicCertificateExpiresOn?: string \| null`, `organicCertificateFileId?: string \| null`. Seeds: districts on most food products (real Bangladesh district names: Dinajpur, Satkhira, Sirajganj, Bogura, Sylhet, …) with at least two products sharing one district and some products without one; a "Was" price on two SKUs; one certified product whose certificate has expired and one with a valid file. Existing ids, names, prices and certifications unchanged | S1, S3 |
| `web/docs/decisions.md` | Append ADR-FE-185 … 192 (§9) in S0's first commit | all |
| `tests/components/back-office-overview/overview.test.tsx` | **Mechanical split, no assertion changed**, test count unchanged: dashboard cases → `overview-dashboard.test.tsx` (S2), customer cases → `overview-customers.test.tsx` (S4), staff sign-in cases → `overview-signin.test.tsx` (run-only). The original file is deleted | S2, S4 |

### 8.3 Store-front data flow (S1)

- `app/(shop)/layout.tsx` reads banners (as today) **and** `getDeliveryPromiseServer()` in parallel. `ShopTopStrip` takes `{ promise, banner }`. Precedence per ADR-FE-187 / OQ-1: promise with non-null `freeOver` → the strip reads "Free delivery over {formatMoney(freeOver)} · Cash on delivery across Bangladesh" (no place name, OQ-2) and **every** `Shop` banner goes to `BannerStrip`; otherwise the HO-P3 behaviour (first banner, else no strip).
- The product page reads the same promise server-side and passes `leadTimeDays` to `DeliveryPromiseCard` (OQ-3).
- The catalogue reads `districts` from `getCatalogueFiltersServer` and the `district` URL params through `catalogueParams.ts`.
- Checkout keeps the rider note in `CheckoutScreen` component state (ADR-FE-186), passes it to `placeOrder`, and keeps it across a retry with the same `Idempotency-Key`.

### 8.4 Back-office state

- Order counts: `useStaffOrderStatusCounts(filters without status)` shares the queue's 30 s refetch.
- Pick-list ticks: server state (`picked`), optimistic toggle with rollback and an error message; HO-P4's component-state ticks are removed.
- POS: category and browse page in component state; tendered cash in component state, debounced 400 ms into the quote request.
- Receipt drafts: `?draft=<id>` in the URL so a reload resumes; the draft id is minted once per new form (`crypto.randomUUID()`); autosave per ADR-FE-190.
- Customers: `search`, `tag`, `sort`, `page`, `customer` in the URL; the profile tab (`Orders` / `Billing` / `Notes`) in component state as today.
- Roster: the week in the URL (`?week=yyyy-MM-dd`) if the page already keeps it there; otherwise component state as today.

## 9. ADRs to record during this build

S0 appends all eight to `web/docs/decisions.md` in its first commit. Range **ADR-FE-185 … ADR-FE-192** belongs to HO-P5 (the next free number per [`README.md`](README.md#adr-numbering)). The integrator adds the row to the README ADR table; this handover does not edit that file.

| ADR | Decision | Amends |
|---|---|---|
| ADR-FE-185 | **Wiring rule.** A `lib/api` type gains a field only as a server view model or request contract has it, cited by file:line in a comment. The matching MSW mock adds the same field **and** the server's validation for any new input (length, count, enumeration, ownership, state); its error body uses the same code and property name | ADR-FE-184 (gaps are now closed this way) |
| ADR-FE-186 | The checkout rider note is component state only: not in the URL (free text a customer may fill with personal details), not in storage. It is sent only for Delivery, trimmed, ≤ 300 characters with a visible counter, and kept across a retry | ADR-FE-090 (URL holds the *choices*; the note is not a choice) |
| ADR-FE-187 | The store top strip shows the public delivery promise when `freeOver` is set; all `Shop` banners then show in `BannerStrip`. A failed or empty promise read falls back to the HO-P3 banner behaviour | ADR-FE-176 |
| ADR-FE-188 | Chart geometry may convert a server amount string to a number for bar length only, through the reports chart's existing conversion. Every figure **shown** (labels, readout, table, total) is the server string; no total or average is computed | ADR-FE-092, ADR-317 (clarifies, does not relax) |
| ADR-FE-189 | `Packed` is shown to customers as the Packing tracker node (label "Packed" in lists and badges) and to staff as its own status pill and pipeline bar | HO-P3 tracker, HO-P4 §11.3.1 |
| ADR-FE-190 | Receipt drafts autosave: whole-form `PUT` 1.5 s after the last change and on field blur, never more than one request in flight (a newer change waits and supersedes), status "Draft saved at hh:mm" in a polite live region; posting sends `draftId`; "Discard draft" confirms and deletes. A 404 on save means the draft was closed elsewhere: stop autosaving and say so | HO-P4 §11.5.6 ("no autosave", BG-18) |
| ADR-FE-191 | The POS change preview is the quote's `changeDue` / `cashShort` for the typed tender, debounced; the completed sale's `changeDue` stays authoritative on the receipt | HO-P4 §11.3.6, U23 ("no change shown before completion") |
| ADR-FE-192 | Roster cells cycle Morning → Evening → Off → Morning with one `PUT` per click; a `Custom` cell asks before replacing its hours; past dates and non-rosterable staff are read-only; the cell text is the server's shift and slot times | HO-P4 §11.6.9 (BG-23) |

**Proposed backend follow-ups** (not decided here; recorded for the owner): `amountToFreeDelivery` for a cart (G5b), the rider note on the packing slip (G4b), a zone name on the delivery promise or a corrected controller doc (OQ-2), a village field (G1 residual).

## 10. Dependencies

| Dependency | Status |
|---|---|
| npm packages | **None added.** `recharts` (pinned) or CSS bars; `lucide-react` icons |
| APIs | Only those in the Gap inventory, plus the existing ones |
| Between slices | S1–S4 depend on S0 (§8.2) and on nothing from each other. S3 and S4 start after S1 and S2 merge only to respect the batch rule, not because of a code dependency |

## 11. Components and screens

"Keep" means existing behaviour and tests carry over. Every new string is plain language.

### 11.1 S0 — Shared contract and seeds

| # | Change | Gap |
|---|---|---|
| 11.1.1 | §8.2 rows for `lib/api/my-orders.ts`, `lib/format/orders.ts`, `lib/orders/tracker.ts` | BG-4, G4, OQ-10, OQ-11 |
| 11.1.2 | §8.2 seed rows for `mocks/handlers/ordering/store.ts` and `mocks/handlers/shop/fixtures.ts`. Bump each store's persisted-state key (or reset path) so a stale browser copy does not hide the new fields | all |
| 11.1.3 | ADR-FE-185 … 192 | — |
| 11.1.4 | The `overview.test.tsx` split (§8.2) | — |
| 11.1.5 | New `tests/unit/orders/tracker-packed.test.ts` and `tests/unit/orders/status-vocabulary.test.ts` (U1, U2, U4) | BG-4 |

### 11.2 S1 — Store front

| # | Screen | Change | Gap · story |
|---|---|---|---|
| 11.2.1 | lib | `lib/api/shop-catalogue.ts`: `CatalogueItem.districtOfOrigin?`, `.certifications?: string[]`; `CatalogueFilters.districts: { value; count }[]`; `ProductDetail.districtOfOrigin?`; `DeliveryPromise { currencyCode; freeOver: Money \| null; leadTimeDays: number \| null }` and `getDeliveryPromiseServer()` (`getPublic`, `revalidate: 60`). `compareAtPrice` is **not** added (OQ-8). `lib/shop/catalogueParams.ts`: `district` joins `MULTI_PARAMS`, parsed, counted in the active-filter count, serialised to the API and kept by "Clear filters" rules exactly as `origin` is | G1, G5, G8 |
| 11.2.2 | Shell | `ShopTopStrip` per §8.3 (strip text is plain; when a banner is shown, today's link behaviour). `app/(shop)/layout.tsx` passes the promise; `BannerStrip` receives all banners when the promise takes the strip | G5 · ADR-FE-187 |
| 11.2.3 | Card | `ProductCard`: eyebrow = `districtOfOrigin` (uppercase via CSS, text unchanged) when present, otherwise today's producer · country (OQ-5). An "Organic" pill (`bg-leaf text-leaf-soft`, text "Organic") over the image corner **only** when `certifications` includes `CertifiedOrganic`; the card's accessible content includes "Certified organic" (visually hidden after the name) so the badge is not image-only | G1, G8 · US-SHP-04 |
| 11.2.4 | Catalogue | `CatalogueFilters` adds a **District** `FilterGroup` (checkboxes with counts from `filters.districts`, sorted as sent) after Origin; hidden when the list is empty. `ActiveFilterChips` shows "Remove filter {district}". `FiltersSheet` includes it on phones | G1 · US-SHP-04 |
| 11.2.5 | Product | `ProductHeading`: when `districtOfOrigin` is present, a line "Grown in {district}" (`text-leaf`, uppercase eyebrow style) above the existing producer · country eyebrow (OQ-5). `ProductDetailsTabs` "Origin & producer" lists District when present | G1 · US-SHP-03 |
| 11.2.6 | Product | `DeliveryPromiseCard({ className, leadTimeDays? })`: when `leadTimeDays` is a number, the delivery fact's text becomes "Standard delivery usually takes {n} day(s). Pick a slot at checkout; the fee is shown before you order." (OQ-3); otherwise today's text. Export name and existing props unchanged | G5 · US-ORD-06 |
| 11.2.7 | Home | `PromiseStrip` unchanged (no "Village on every pack", OQ-6). The home page shows the strip via the layout (11.2.2) | G1, G5 |
| 11.2.8 | Checkout | `PaymentSection` (section 3) ends with a labelled text input "Note for the rider (optional)", placeholder "e.g. call before you come up", `maxLength={300}`, a live character count ("{n} of 300"), shown **only when fulfilment is Delivery**. State lives in `CheckoutScreen` (ADR-FE-186). `lib/api/checkout.ts`: `PlaceOrderRequest.riderNote?`; the body sends `riderNote: fulfilment === 'Delivery' ? trimmed \|\| undefined : undefined`. A 400 naming `RiderNote` shows inline under the field. Placement, idempotency and retry unchanged | G4 · US-ORD-03 |
| 11.2.9 | My orders | Customer order detail (`OrderPanels` delivery panel): "Note for the rider: {riderNote}" as plain text when present (OQ-7) | G4 · US-ORD-12 |
| 11.2.10 | Mocks | `mocks/handlers/shop/store.ts` `catalogueItem()` / `detailView()` add `districtOfOrigin` and `certifications` from the fixtures (`compareAtPrice` too, because the server sends it on both — OQ-8 only governs display). `mocks/handlers/shop/catalogue.ts`: `district` filter (case-insensitive), **400 `InvalidCatalogueFilter` with `propertyName: "district"`** for > 20 values or a value > 60 characters, matching the server body shape; `/api/shop/filters` returns `districts`; new `GET /api/shop/delivery-promise` computed from the ordering store's zones exactly as the server does (§Gap inventory G5), honouring maintenance mode as the other storefront mocks do. `mocks/handlers/ordering/customer.ts`: place-order accepts `riderNote`, **400** for > 300 characters or a control character (propertyName `RiderNote`), drops it for Pickup, and returns it in `fulfilment.riderNote` on the detail | G1, G4, G5, G8 · ADR-FE-185 |

### 11.3 S2 — Sales: Dashboard, Orders, Counter sale

New components go into folders the ordering guards scan (`components/orders/Staff*.tsx`, `components/pos/*`, `components/fulfilment/*`) or into `components/dashboard/**`. **No new component folder.**

| # | Screen | Change | Gap · story |
|---|---|---|---|
| 11.3.1 | lib | `lib/api/dashboard.ts`: `SalesSeries` types and `getSalesSeries(days = 14)`. `lib/api/staff-orders.ts`: `StaffOrderRow` + `deliveryZone`, `deliveryDistrict`, `slotDate`, `slotWindowLabel` (and `StaffCustomerOrderRow` **omits** them — the customer-orders panel's server row does not send them); `channel` widened (§8.2); `StaffOrderLine` + `picked`, `pickedOn`, `pickedBy`; `StaffOrderDetail.packedOn`; `StaffOrderAction` + `'MarkPacked'`; `StaffShipment.courierId: string \| null`, `riderId`, `riderName`; `getStaffOrderStatusCounts(filters)`, `markPacked(orderId)`, `setLinePicked(orderId, lineId, picked)`, `dispatchOrder(orderId, { courierId } \| { riderId }, trackingNumber?)` (exactly one target, typed as a union), `listRiders(activeOnly)`, `createRider`, `updateRider`. `lib/api/pos.ts`: `browsePosSkus({ category?, pageNumber, pageSize })`; `getCounterQuote({ …, tenderedCash? })` via `wireMoney`; `CounterQuote.changeDue?`, `.cashShort?`; `CounterSaleInput.customerName?` / `.customerMobile?` (both or neither) | BG-1 … BG-8 |
| 11.3.2 | lib | Hooks: `lib/hooks/useStaffOrders.ts` adds `useStaffOrderStatusCounts`, `useMarkPacked`, `useSetLinePicked` (optimistic, rollback), `useRiders`, `useCreateRider`, `useUpdateRider`, and the rider target in `useDispatchOrder`; `lib/hooks/usePos.ts` adds `usePosBrowse` and the tendered-cash quote input; new `lib/hooks/useSalesSeries.ts` (query key `['dashboard', 'sales-series', days]`, 403 → `null`) | — |
| 11.3.3 | Dashboard | "Sales, last 14 days" panel: bars from `days[].net` (geometry per ADR-FE-188), each bar focusable with an `aria-live` readout "{date}: {formatMoney(net)}, {orders} orders"; heading figure = server `total`; "Show as table" toggles a `TableFrame` table (Date, Net sales, Orders). Rendered only when the series query succeeds (403 or no branch → panel absent, no error banner) | BG-1 · US-RPT-05 |
| 11.3.4 | Dashboard | "Orders in progress" panel: one bar per pipeline status from `status-counts` (`Confirmed`, `Packing`, `Packed`, `Dispatched` — the statuses the design draws), each a link to `/staff/orders?status=X` with the server count as text; `total` as sent. No client sums | BG-2 · US-RPT-05 |
| 11.3.5 | Dashboard | `orders.cod-with-riders` renders through the existing tile renderer (no component change); the dashboard mock seeds it (11.3.11) | BG-5 |
| 11.3.6 | Orders | Status `PillTabs` gain `count` from `status-counts` ("All" uses `total`) and a **Packed** pill. Counts refetch with the queue | BG-2, BG-4 · US-ORD-09 |
| 11.3.7 | Orders | List Fulfilment cell: for delivery, "{deliveryDistrict ?? deliveryZone}" and, when `slotDate`, "{formatted slotDate} · {slotWindowLabel}"; nothing extra for pickup/counter | BG-3 · US-ORD-09 |
| 11.3.8 | Orders | `StaffOrderSidePanel` / `StaffOrderPanels`: pick-list checkboxes read and write `picked` (`useSetLinePicked`); "Start packing" gating from HO-P4 U21 stays but reads server ticks; a 400 `InvalidOrderTransition` reverts the tick with "This order has already left the shelf." `MarkPacked` → button "Mark packed" from `allowedActions` only. "Packed {time}" from `packedOn`. Delivery panel shows "Note for the rider: …" when present (OQ-7) | BG-4, G4 · US-ORD-10 |
| 11.3.9 | Orders | `DispatchDialog`: a radiogroup "Send with" — **Courier** (today's courier select + optional tracking) / **Rider** (select of `useRiders(activeOnly)`; no tracking field). Sends exactly one id. With no active riders the Rider option is disabled with "No riders set up" and, for a `Riders.Manage` holder (presentation only), a link "Manage riders" → `/staff/fulfilment/riders`. Shipment panel shows "Rider: {riderName}" or the courier as today. `DispatchTargetInvalid` / 404 map to plain text | BG-5 · US-ORD-11 |
| 11.3.10 | Riders | New `app/(staff)/staff/fulfilment/riders/page.tsx` (OQ-9): `PageHeader` "Riders", a `DataTable` (Name, Mobile, Status) and "+ Add rider" / "Edit" opening a dialog (Name, Mobile optional, Active). Deactivate asks first. `RiderNameAlreadyExists` inline on Name. A 403 renders `PermissionDeniedState`. No nav item; linked from 11.3.9 and the pick-list page header | BG-5 |
| 11.3.11 | Counter sale | Left column: `PillTabs mode="state"` "All" + one tab per `ProductCategory` (labels from `lib/shop/labels`), then a tap-tile grid from `usePosBrowse` (paged "Show more"); the scan/search field keeps priority — a typed query shows search results instead of the grid | BG-6 · US-ORD-16 |
| 11.3.12 | Counter sale | Tender: the cash amount (typed or via quick buttons) is sent as `tenderedCash` to the quote (debounced, ADR-FE-191). Under the amount: "Change due {formatMoney(changeDue)}" or "Still to pay {formatMoney(cashShort)}" in a polite live region, from the quote only. The completed sale's `changeDue` still drives `PosSaleComplete` | BG-7 · US-ORD-16 |
| 11.3.13 | Counter sale | Customer chip: "Walk-in (no customer)" is the default; "Add customer" opens the existing `PosCustomerPanel`, whose validation becomes **both or neither** (name and mobile together). Completion with neither sends neither | BG-8 · US-ORD-16 |
| 11.3.14 | Mocks | `ordering/staff.ts`: row fields (from the order's fulfilment), `status-counts` (same filters, every status, zeros, pipeline order, `total`), `packed` (only from `Packing`, else 400 `InvalidOrderTransition`), `picked` (404 unknown order/line; 400 `InvalidOrderTransition` once `Dispatched` or later; idempotent), dispatch target (400 `DispatchTargetInvalid` for both or neither; 404 unknown/inactive rider), riders list/create/update (`activeOnly`; 400 `RiderNameAlreadyExists` per branch, case-insensitive; 404 `RiderNotFound`; 403 for a role without `Riders.Manage` on writes, mirroring `ActionRoles`), shipment rider fields. `ordering/pos.ts`: `browse` (category name validated like the server's enumeration; paging), `tenderedCash` (400 when ≤ 0 or > 2 decimals; `changeDue` / `cashShort` exactly one when the sale can be made), anonymous sale (400 when only one of name/mobile). `reports/dashboard.ts`: `sales-series` (`days` 1–31 else 400; 403 for roles without `Reports.SalesView`) and the `orders.cod-with-riders` tile for the roles the server shows it to | ADR-FE-185 |

### 11.4 S3 — Catalogue and stock

| # | Screen | Change | Gap · story |
|---|---|---|---|
| 11.4.1 | lib | `lib/api/staff-shop.ts`: `StaffProductSummary` + BG-9 fields; `bulkProductStatus({ productIds, action })` and its result type; `StaffProductDetail.districtOfOrigin` and `UpdateProductDetailsRequest.districtOfOrigin` (the details `PUT` sends it; **never** `isSubscribable`); `StaffSku.compareAtPrice`, `.scheduledCompareAtPrice`; `scheduleSkuPrice` + `compareAtAmount?` (via `wireMoney`); `StaffFoodDetail` + certificate fields; `SetFoodDetailsRequest` + `organicCertificateExpiresOn?`, `organicCertificateFileId?`. `lib/api/files.ts`: `FilePurpose` + `'OrganicCertificate'`; `lib/files/fileRules.ts`: the rule mirroring `FileRules.cs:33-37`. `lib/api/inventory-stock.ts`: BG-16 fields. `lib/api/inventory-alerts.ts`: `AlertSummary.consignmentsArriving?`. `lib/api/inventory-receipts.ts`: drafts client (`listReceiptDrafts`, `getReceiptDraft`, `saveReceiptDraft`, `discardReceiptDraft`) and `PostGoodsReceiptRequest.branchId?`, `.draftId?`. `lib/api/inventory-lookup.ts` `getLocations(branchId?)`, `lib/api/procurement-orders.ts` `getPurchaseOrders({ …, branchId? })`, `lib/api/procurement-consignments.ts` `getConsignments({ …, branchId?, arrivingWithinDays? })` — additive optional parameters only | BG-9 … BG-18 |
| 11.4.2 | lib | Hooks in `lib/hooks/useStaffShop.ts` (`useBulkProductStatus`), `lib/hooks/useInventory.ts` (drafts queries/mutations, autosave helper hook `useReceiptDraftAutosave`), `lib/hooks/useProcurement.ts` / `useInventoryLookup.ts` (branch parameter) | — |
| 11.4.3 | Products | `StaffProductTable` columns (HO-P4 §11.4.3 "Not built" list): thumbnail (the signed `primaryImage.url`, `alt` = its `altText`; `ProductPackArt` placeholder when null), Origin (`countryOfOrigin.name`), Pack sizes (`packSizes` joined, else "{skuCount} pack sizes"), Price (`formatMoney(min)` or "{min} – {max}" when the two strings differ; "—" when null), Stock ("{availableStock} available", "—" when null), and an "Organic" `StatusPill` when `isOrganic`. CSV export unchanged (the server's export has no extras) | BG-9 · US-SHP-01 |
| 11.4.4 | Products | A select checkbox per row and "Select all on this page"; a bulk bar ("{n} selected", **Publish**, **Hide from shop**, Clear). Both confirm (UI-3) then call `bulk-status` once; the result shows "{succeededCount} updated, {failedCount} not updated" from the server and lists each failure's product name and the server message; the list refetches; selection clears on page change and after the action (OQ-12) | BG-10 · US-SHP-01 |
| 11.4.5 | Product editor | Details → Organise card: "District of origin" text input (≤ 60, optional) under Country of origin; same single `PUT`, version handling and `two-step-save.test.tsx` unchanged | BG-12 · US-SHP-03 |
| 11.4.6 | Product editor | Pack sizes & prices: a "Was" column (`compareAtPrice`, and "then {scheduledCompareAtPrice}" beside a scheduled price); the schedule-price dialog gains an optional "Was price" field. `CompareAtMustExceedPrice` shows inline. No reorder column (HO-P4 note stands) | BG-13 · US-SHP-02 |
| 11.4.7 | Product editor | Food & labelling "Certified organic" block: "Certificate valid until" date input; a `StatusPill tone="danger"` "Expired" when the **server's** `organicCertificateExpired` is true; "Certificate file" via the shared `FileUploadField` with `purpose="OrganicCertificate"`, and "View certificate" opening `organicCertificateUrl` in a new tab (`rel="noopener noreferrer"`) when present; "Remove file" sends `organicCertificateFileId: null`. `InvalidCertificateFile` inline; a publish refused with `OrganicCertificateExpired` shows "The organic certificate has expired. Update it on Food & labelling before publishing." | BG-14 · US-SHP-03 |
| 11.4.8 | Inventory | Stock by item adds "Reorder at" (`reorderLevel`, with "(branch default)" when `reorderLevelIsDefault`; "Off" when "0") and a "Below reorder level" `StatusPill tone="warning"` from `belowReorderLevel`. The expanded batch matrix adds "Received" (date from `receivedOn`) and "Supplier" (`supplierName`, "—" when null). `/staff/inventory/stock/[skuId]` matrix gets the same two columns | BG-16 · US-IMP-06 |
| 11.4.9 | Inventory | Overview: an `AttentionRow` "{count} consignments arriving in the next {withinDays} days" linking to `/staff/procurement/consignments?arrivingWithinDays={withinDays}` when `consignmentsArriving` is present (absent otherwise). If the consignments page does not yet read `arrivingWithinDays` from its URL, S3 adds that (it owns `procurement/**`) | BG-17 · US-IMP-10 |
| 11.4.10 | Receiving | `GoodsReceiptForm`: autosave per ADR-FE-190 with "Draft saved at hh:mm" under the `h1`; on `/staff/inventory/receipts/new` without `?draft=`, a "Your drafts" list (from `listReceiptDrafts`, newest first: supplier, lines, last saved, branch) with "Continue" and "Discard"; "Post to stock" sends `draftId`. "Receive into" select **only when the caller has 2+ branches** (`getMyBranches`), defaulting to the active branch (OQ-13); changing it reloads purchase orders, consignments and locations for that branch and clears line locations (with a confirm when lines exist). `BranchNotAssigned` and the draft codes map to plain text. `UnsavedChangesGuard` releases only once the latest change is saved | BG-18 · US-IMP-04 |
| 11.4.11 | Mocks | `shop/staff.ts`: list extras (computed from fixtures exactly as the server rules describe: active SKUs only, cheapest-first sizes, price range of current prices, stock from the inventory mock or null for bundles, `isOrganic`); `bulk-status` (≤ 100 ids else 400; unknown action 400 `InvalidBulkAction`; per-product outcomes using the same publish checklist the single publish uses, plus `OrganicCertificateExpired`); district on detail/`PUT` (≤ 60, no control characters → 400 `InvalidDistrictOfOrigin`); compare-at (≤ current amount → 400 `CompareAtMustExceedPrice`); food certificate fields (`organicCertificateExpired` derived from UTC today; unknown/non-certificate file → 400 `InvalidCertificateFile`). `files/**`: accept purpose `OrganicCertificate` with the same types and size limit as `FileRules.cs`. `inventory/**`: BG-16 fields, `consignmentsArriving` (window 1–90 else 400), drafts (owner-only → 404 for another staff member's draft; limit 20 → 400 `GoodsReceiptDraftLimitReached`; closed draft → 404; over-long/negative → 400 `InvalidGoodsReceiptDraft`), `branchId` on post and lists (403 `BranchNotAssigned` for an unassigned branch) | ADR-FE-185 |

### 11.5 S4 — Customers, money and admin

| # | Screen | Change | Gap · story |
|---|---|---|---|
| 11.5.1 | lib | `lib/api/staff-customers.ts`: `browseCustomers({ search?, tag?, sort?, pageNumber?, pageSize? })`, `StaffCustomerListItem`; `StaffCustomer` + `customerSince`, `area`, `orderCount`, `lifetimeSpend`, `tags`, `noteCount`; `getCustomerNotes`, `addCustomerNote`, `setCustomerTags`, `requestCustomerPasswordReset`. `lib/api/billing-cashup.ts`: `CashUpLine.sourceKey?`, `CashUp.sources`, `recordCashCount(date, { counts: { sourceKey, countedCash }[], explanation? })` (each `wireMoney`; the total-only form stays for a day with no sources). `lib/api/admin-branches.ts`: `BranchSummary` + `type`, `addressLine`, `phoneNumber`, `email`, `weeklyHours`, `todayHours`, `deliveryAreas`, `activeStaffCount` (the list now sends the full `AdminBranchViewModel`); `type?` on create/update. `lib/api/staff-admin.ts`: `StaffAccountSummary.status`, `.branches`. `lib/api/admin-rosters.ts`: `getRosterCells`, `setRosterShift` | BG-19 … BG-23 |
| 11.5.2 | lib | Hooks: `useStaffCustomers.ts` (`useBrowseCustomers`, `useCustomerNotes`), `useStaffCustomerMutations.ts` (`useAddCustomerNote`, `useSetCustomerTags`, `useRequestCustomerPasswordReset`), `hooks/billing/useBillingMutations.ts` (**the cash-up count mutation only**), `useAdminBranches.ts` (type in forms), `useAdminRosters.ts` (`useRosterCells`, `useSetRosterShift`) | — |
| 11.5.3 | Customers | `/staff/customers` left column becomes the **browse list** (OQ-14): `SearchField` "Name, mobile or email" → `search`; a tag filter select (tags seen on the current page plus the URL value) → `tag`; sort "Most recent" / "Name"; paged; each row: initials, name, mobile, area, tags, status pill. Selection in `?customer=` as today. The POS customer panel keeps the exact `findCustomers` lookup | BG-19 · US-ACC-10 |
| 11.5.4 | Customers | Profile (`CustomerProfileView`): KPI row "Customer since" (date), "Orders" (`orderCount`), "Lifetime spend" (`AmountCell` of `lifetimeSpend`), plus the existing balance; "Area" beside mobile · email; tag chips with "Edit tags" (dialog: chips with remove, an input that adds on Enter, ≤ 10 tags, ≤ 30 characters each, counter; save sends the whole set and shows the server's stored set). A third tab **Notes** ("Notes ({noteCount})"): newest first, each with author name and time; an "Add a note" textarea (≤ 1000, counter) for holders of `Customers.AddNote` (presentation; the server decides). "Send password reset" (header action): confirm dialog "Send a password reset link to {name}? It goes to their own mobile or email." → result "Reset link sent by {channel} to {maskedDestination}. It expires at {time}." The token is never shown. A 403 shows the permission message | BG-19 · US-ACC-10, US-ACC-11 |
| 11.5.5 | Billing | `CashUpScreen`: the table becomes Source / Expected / Counted / Over or short from `sources[]` — one labelled input per source ("Counted for {label}"), the server's `variance` per source as a `StatusPill` (Balanced / Over / Short by the sign the server's string carries, as HO-P4 U36), the server's total `counted` and `variance` below. Submit sends `counts[]`; the response (the full read) replaces the screen. `UnknownCashUpSource` / `DuplicateCashUpSource` map to "The sources changed while you were counting. Reload and count again." "Close the day" unchanged. With an empty `sources` the HO-P4 single input remains | BG-20 · US-BIL-12 |
| 11.5.6 | Outlets | Outlet cards add: type pill (Outlet / Warehouse), `addressLine`, "Today: {todayHours.summary}" (the server's text, "Closed" included), "Delivers to {deliveryAreas joined}" (absent when empty), "{activeStaffCount} staff". Create and edit forms (`BranchDetailsForm`) gain a "Type" select (Outlet, Warehouse) | BG-21 · US-ADM-01 |
| 11.5.7 | Staff & roles | `StaffAccountTable`: "Outlet" column (branch names, primary first with "(primary)"); "Status" from the server `status` (Active / Not set up / Locked) replacing the HO-P4 `hasPassword` derivation. The footer keeps listing the real role catalogue (BG-22 residual) | BG-22 · US-ACC-07, US-ADM-02 |
| 11.5.8 | Roster | `RosterWeekView` reads `roster-cells` for the shown week; each cell is a button showing the server shift ("Morning", "Evening", "Off", "Custom") and its slot times from `slots`; click cycles per ADR-FE-192 with one `PUT`, replacing the cell with the response; `aria-live` announces "{name}, {day}: {shift}". Past dates and non-rosterable rows are not buttons. The legend lists names only, no hours (OQ-15). The pattern editor and exception form stay reachable as today | BG-23 · US-ADM-03 |
| 11.5.9 | Mocks | `areas/accounts.ts`: `browse` (search by name, by email when it contains `@`, by mobile when it has 3+ digits; `tag`; `sort` `recent`/`name` else 400; page size ≤ the server cap; search/tag ≤ 100 else 400), detail summary fields, notes (≤ 1000, ≤ 200 per customer, empty → 400; author = the signed-in staff), tags (≤ 10, ≤ 30 each, trimmed and de-duplicated in the response), password reset (`{ channel, maskedDestination, expiresOn }`; 403 for roles without `Customers.RequestPasswordReset`), staff-account `status` and `branches`. **Keep HO-P4 Amended (ii)/(v) fixture contracts** (Nadia Reception, Rafiq Inventory). `billing/{ops,store}.ts`: `sources` on the cash-up read and per-source counts (unknown key → 400 `UnknownCashUpSource`, repeated key → 400 `DuplicateCashUpSource`, > 50 → 400; counted/variance per source; totals summed **in the mock**, which is the server's role there). `admin/branches.ts`: the BG-21 fields and `type` validation (Outlet/Warehouse). `admin/rosters.ts`: `roster-cells` (range ≤ the server cap, `to` ≥ `from`), `shifts/{date}` (Morning/Evening/Off else 400; past → 400 `ShiftDateInPast`; non-Reception → 400 `StaffNotRosterable`; presets 08:00–14:00 and 14:00–20:00) | ADR-FE-185 |

## 12. Scaffold, config and mocks

| Item | Change |
|---|---|
| `web/package.json`, lock file, `eslint.config.mjs`, `vitest.config.mts`, `playwright.config.ts`, `tsconfig.json`, `next.config.ts` | **None** |
| `web/app/globals.css`, `app/layout.tsx`, `app/providers.tsx` | **None** |
| `web/lib/**` | Only the files each slice owns in §13, additively. Removing or renaming an existing export is forbidden; a widened union is allowed |
| `web/mocks/**` | Only the files each slice owns in §13. Seeds are additive: existing ids, statuses, amounts and the HO-P4 staff fixtures stay. Each changed store bumps its persisted key or reset path. `mocks/handlers/areas/subscriptions.ts` is untouched |
| `web/nav/**` | **None.** The riders page has no nav item (OQ-9) |
| `web/docs/decisions.md` | S0 only, appending ADR-FE-185 … 192 |
| `web/tests/contract/mock-vs-real.contract.test.ts` | **Integration step only** (§17.1 step 5): add every new GET in the Gap inventory to its list, after S1–S4 merge. Run with `npm run test:contract` against a scratch API when one is available; record the result |

## 13. Allowed scope

Paths are under `web/`. A `**` glob owns everything under it, including new files. **A path appears in exactly one block.**

```text
# ---------- S0 — Shared contract and seeds ----------
lib/api/my-orders.ts
lib/format/orders.ts
lib/orders/tracker.ts
mocks/handlers/ordering/store.ts
mocks/handlers/shop/fixtures.ts
docs/decisions.md                                     # append ADR-FE-185..192 only
tests/components/back-office-overview/overview.test.tsx          # delete after the split
tests/components/back-office-overview/overview-signin.test.tsx   # created by the split; run-only afterwards
tests/unit/orders/**                                   # new

# ---------- S1 — Store front (G1, G4, G5, G8) ----------
lib/api/shop-catalogue.ts
lib/api/checkout.ts
lib/hooks/useCheckout.ts
lib/shop/catalogueParams.ts
app/(shop)/layout.tsx
app/(shop)/shop/products/page.tsx
app/(shop)/shop/products/[slug]/page.tsx
app/(shop)/_components/CatalogueControls.tsx
app/(shop)/_components/CatalogueView.tsx
app/(shop)/_components/ProductDetailsRow.tsx
app/(portal)/checkout/**
app/(portal)/portal/orders/[orderId]/page.tsx
components/shop/ShopTopStrip.tsx
components/shop/BannerStrip.tsx
components/catalogue/ProductCard.tsx
components/catalogue/CatalogueFilters.tsx
components/catalogue/FilterGroup.tsx
components/catalogue/ActiveFilterChips.tsx
components/catalogue/FiltersSheet.tsx
components/product/ProductHeading.tsx
components/product/ProductDetailsTabs.tsx
components/hearth/DeliveryPromise.tsx
components/checkout/**
components/orders/OrderPanels.tsx                     # keep the safeHttpUrl export unchanged
components/orders/MyOrderDetail.tsx
mocks/handlers/shop/store.ts
mocks/handlers/shop/catalogue.ts
mocks/handlers/ordering/customer.ts
tests/components/catalogue/catalogue-p5.test.tsx      # new
tests/components/product/product-p5.test.tsx          # new
tests/components/shop/shell-p5.test.tsx               # new
tests/components/checkout/rider-note.test.tsx         # new
tests/components/catalogue/catalogue-params.test.ts   # district cases appended
tests/components/catalogue/product-card.test.tsx      # badge/eyebrow cases appended
tests/e2e/shop-catalogue.spec.ts
tests/e2e/shop-product.spec.ts
tests/e2e/shop-shell.spec.ts
tests/e2e/shop-home.spec.ts
tests/e2e/ordering-customer.spec.ts

# ---------- S2 — Sales (BG-1..BG-8; G4 staff read-back) ----------
lib/api/dashboard.ts
lib/api/staff-orders.ts
lib/api/pos.ts
lib/hooks/useStaffOrders.ts
lib/hooks/usePos.ts
lib/hooks/useSalesSeries.ts                           # new
app/(staff)/staff/page.tsx
app/(staff)/staff/orders/page.tsx
app/(staff)/staff/orders/[orderId]/page.tsx
app/(staff)/staff/fulfilment/**                       # incl. new riders/page.tsx
app/(staff)/staff/pos/page.tsx
components/dashboard/**
components/back-office-overview/DashboardAttention.tsx
components/back-office-overview/DashboardLatestOrders.tsx
components/back-office-overview/DashboardPipeline.tsx # new
components/orders/Staff*.tsx
components/orders/DispatchDialog.tsx
components/pos/**
components/fulfilment/**
mocks/handlers/ordering/staff.ts
mocks/handlers/ordering/pos.ts
mocks/handlers/reports/dashboard.ts
tests/components/back-office-overview/overview-dashboard.test.tsx  # created by S0's split
tests/components/dashboard/**
tests/components/back-office-sales/**
tests/components/orders/staff-orders.test.tsx
tests/components/pos/**
tests/components/fulfilment/**
tests/e2e/dashboard-home.spec.ts
tests/e2e/ordering-staff.spec.ts
tests/e2e/ordering-pos.spec.ts

# ---------- S3 — Catalogue and stock (BG-9, 10, 12, 13, 14, 16, 17, 18) ----------
lib/api/staff-shop.ts
lib/api/files.ts                                      # FilePurpose union only
lib/files/fileRules.ts                                # the OrganicCertificate rule only
lib/api/inventory-stock.ts
lib/api/inventory-alerts.ts
lib/api/inventory-receipts.ts
lib/api/inventory-lookup.ts
lib/api/procurement-orders.ts
lib/api/procurement-consignments.ts
lib/hooks/useStaffShop.ts
lib/hooks/useInventory.ts
lib/hooks/useInventoryLookup.ts
lib/hooks/useProcurement.ts
app/(staff)/staff/shop/**
app/(staff)/staff/inventory/**
app/(staff)/staff/procurement/**
components/staff-shop/**
components/back-office-catalogue/**
components/inventory/**
components/stock/**
components/back-office-stock/**
components/procurement/**
mocks/handlers/shop/staff.ts
mocks/handlers/files/**                               # purpose addition only
mocks/handlers/inventory/**
tests/components/staff-shop/**
tests/components/back-office-catalogue/**
tests/components/inventory/**
tests/components/stock/**
tests/components/back-office-stock/**
tests/components/procurement/**
tests/e2e/shop-staff.spec.ts
tests/e2e/inventory-flows.spec.ts

# ---------- S4 — Customers, money and admin (BG-19..BG-23) ----------
lib/api/staff-customers.ts
lib/api/billing-cashup.ts
lib/api/admin-branches.ts
lib/api/staff-admin.ts
lib/api/admin-rosters.ts
lib/hooks/useStaffCustomers.ts
lib/hooks/useStaffCustomerMutations.ts
lib/hooks/billing/useBillingMutations.ts              # the cash-up count mutation only
lib/hooks/useAdminBranches.ts
lib/hooks/useStaffAdmin.ts
lib/hooks/useAdminRosters.ts
app/(staff)/staff/customers/**
app/(staff)/staff/billing/cash-up/**
app/(staff)/staff/admin/branches/**
app/(staff)/staff/admin/staff-accounts/page.tsx
components/customer/**
components/back-office-overview/CustomerProfileView.tsx
components/back-office-customers/**                  # new
components/billing/CashUpScreen.tsx
components/branches/BranchTable.tsx
components/branches/BranchDetailsForm.tsx
components/admin/StaffAccountTable.tsx
components/roster/**
components/back-office-admin/**
mocks/handlers/areas/accounts.ts
mocks/handlers/billing/ops.ts
mocks/handlers/billing/store.ts
mocks/handlers/admin/branches.ts
mocks/handlers/admin/rosters.ts
tests/components/back-office-overview/overview-customers.test.tsx  # created by S0's split
tests/components/customer/**
tests/components/back-office-customers/**
tests/components/back-office-admin/**
tests/components/roster/**
tests/components/billing/payment-flows.test.tsx       # cash-up cases only
tests/e2e/staff-customers.spec.ts
tests/e2e/billing-functional.spec.ts
tests/e2e/admin-functional.spec.ts
tests/e2e/staff-admin.spec.ts
```

**Ownership notes.**
- **Shared seed stores belong to S0**: `mocks/handlers/ordering/store.ts` (S1 customer handlers and S2 staff/POS handlers read it) and `mocks/handlers/shop/fixtures.ts` (S1 public and S3 staff handlers read it). A slice that needs another seed field raises §20.1; it does not edit the store.
- `components/orders/` is split by file: S1 owns `OrderPanels.tsx` and `MyOrderDetail.tsx`; S2 owns `Staff*.tsx` and `DispatchDialog.tsx`; every other file there is import-only.
- `components/back-office-overview/` is split by file: S2 the `Dashboard*.tsx` files, S4 `CustomerProfileView.tsx`; `StaffAuthFrame.tsx` is frozen.
- `lib/api/staff-orders.ts` (S2) is imported by S4's customer orders panel; S2 keeps `StaffCustomerOrderRow` free of the BG-3 fields.
- `lib/shop/labels.ts` is import-only (S2 uses it for POS category tab labels).
- Test files not listed are **run-only**. When ownership is unclear, the file is not yours (§20.1).

## 14. Forbidden scope

| Path | Why |
|---|---|
| `src/**`, `tests/**` (.NET), `deploy/**` | Frontend wiring only; the backend is the contract |
| `docs/**` except this handover (append-only §1 Amended rows), `.ai/**`, `.claude/**` | Inputs |
| Anything subscription-shaped: `mocks/handlers/areas/subscriptions.ts`, `nav/areas/subscriptions.ts`, any `/subscriptions` client, `isSubscribable` in a request or form, a Subscriptions tab, menu link or filter | Deferred (§4.1) |
| `app/globals.css`, `app/layout.tsx`, `app/providers.tsx`, `app/page.tsx`, `app/icon.svg` | Tokens and root shell |
| `components/ui/**`, `components/common/**`, `components/back-office/**` (S0 HO-P4 primitives), `components/hearth/*` except S1's `DeliveryPromise.tsx`, `components/files/**`, `components/auth/**`, `components/account/**` | Shared primitives; import only. `FileUploadField` already takes `purpose` |
| `components/orders/*` except the files §13 lists | Shared customer/staff order components (`OrderLines`, `OrderSummary`, `OrderStatusBadge`, …) |
| `components/billing/*` except `CashUpScreen.tsx` | Shared billing primitives render in customer screens |
| `components/branches/*` except `BranchTable.tsx`, `BranchDetailsForm.tsx`; `components/admin/*` except `StaffAccountTable.tsx` | Calendar, hours, closures, 403 states |
| `lib/**` and `mocks/**` not listed in a slice's block, including `lib/shop/labels.ts`, `lib/money/**`, `lib/format/money.ts`, `lib/api/client.ts`, `lib/api/errors.ts` | Shared contracts |
| `nav/**` | No nav change in this pass |
| `tests/guards/**`, `tests/a11y/**`, `tests/setup.ts`, `tests/e2e/{fixtures,global-setup,ordering-helpers,shop-helpers,portal-helpers,inventory-helpers,reports-helpers}.ts` | Shared test infrastructure |
| Run-only e2e specs: `shop-a11y-responsive`, `shop-portal`, `home`, `ordering-a11y-responsive`, `ordering-customer-orders`, `portal-*`, `account-area`, `accounts-*`, `staff-shell-*`, `staff-auth`, `reports-*`, `inventory-a11y-responsive`, `inventory-real-api`, `procurement-flows`, `billing-a11y-responsive`, `billing-real-api`, `admin-a11y-responsive`, `admin-filters`, `admin-branch-calendar`, `notifications-*`, `xct-*`, `journey-real-api`, `real-api-verification`, `portal-real-api` | They must pass (apart from the 12 baseline failures, §1). A slice keeps the accessible names and roles they rely on (§20.3) |
| `package.json`, lock file, every config file | No dependency or config change |

## 15. Component test cases (Vitest)

Existing tests stay green **without weakening an assertion**. Where a test asserted the absence of an element this pass now adds (HO-P3 U6 "No Organic badge", U13 "no free-delivery amount", HO-P4 U17 "no Notes", U18 "no counts", U21 local ticks, U23 "no change-due before completion", U32 "no Receive into", U38 "no address or staff-count"), the owning slice replaces it with the positive assertion below **of at least the same strength** and lists the old → new pair in its report.

| ID | Slice | Case | Expected |
|---|---|---|---|
| U1 | S0 | Tracker for an order in `Packed` (delivery and pickup) | Five nodes; Packing is `current`; Placed and Confirmed `done`; not `null`. `ORDER_STATUSES` contains `Packed` between `Packing` and `Dispatched` |
| U2 | S0 | Labels | `orderStatusLabel('Packed')` = "Packed"; the `MarkPacked` action label = "Mark packed"; channel `Subscription` = "Subscription"; every pre-existing label unchanged |
| U3 | S0 | Test split | The three `overview-*.test.tsx` files together hold exactly the cases of the old file; the Vitest total is unchanged |
| U4 | S0 | Seeds | The ordering store has one `Packed` order with all lines `picked`, two active riders and one inactive, one dispatched COD order with a rider, one order with a `riderNote`; shop fixtures have ≥ 2 products sharing a district, ≥ 1 without, 2 SKUs with a "Was" price, 1 expired and 1 valid certificate; pre-existing ids and amounts unchanged |
| U5 | S1 | `ProductCard` with / without `districtOfOrigin` | Eyebrow text is the district / producer · country |
| U6 | S1 | `ProductCard` with `certifications` incl. / excl. `CertifiedOrganic` | "Organic" pill present with the accessible text "Certified organic" / absent. Supersedes HO-P3 U6's "No Organic badge (G8)" |
| U7 | S1 | District filter with 3 districts; toggle one; chip; Clear filters | Group "District" lists 3 checkboxes with counts; URL gains `district=X` (repeatable); chip "Remove filter X" removes it; Clear filters removes it; no group when `districts` is empty |
| U8 | S1 | `catalogueParams` | `district` parsed as a list, serialised to the API, counted in the active-filter count, kept/cleared like `origin` |
| U9 | S1 | `ProductHeading` | "Grown in {district}" only when present; producer · country eyebrow unchanged |
| U10 | S1 | `ShopTopStrip` with promise `freeOver` + 2 banners; with `freeOver: null` + banner; neither | "Free delivery over ৳5,000.00 · Cash on delivery across Bangladesh" and both banners passed to `BannerStrip` / first banner as HO-P3 U1 / no strip. The amount is `formatMoney` of the server string; no arithmetic. Supersedes HO-P3 U13's "no free-delivery amount" for the strip only |
| U11 | S1 | Layout promise read fails (500) | The page renders; the strip falls back to the banner; no error banner |
| U12 | S1 | `DeliveryPromiseCard` with `leadTimeDays: 1` / `null` | "usually takes 1 day" text / today's text; export and existing props unchanged |
| U13 | S1 | Checkout rider note | Field labelled "Note for the rider (optional)" in section 3 for Delivery; absent for Pickup; `maxLength` 300 with a live counter; never written to the URL or storage; `placeOrder` body carries the trimmed note for Delivery and none for Pickup; a retry after a network failure reuses the same `Idempotency-Key` and the same note |
| U14 | S1 | Server 400 naming `RiderNote` | Error shown under the field; Place order stays available |
| U15 | S1 | Customer order detail with `fulfilment.riderNote` | "Note for the rider: …" rendered as text (markup in the note is shown literally) |
| U16 | S2 | Sales chart with 14 days; 403 | 14 focusable bars; readout "{date}: {money}, {n} orders"; heading total = server `total` string; "Show as table" table has 14 rows / panel absent, no error |
| U17 | S2 | Pipeline from `status-counts` | Confirmed, Packing, Packed, Dispatched bars with the server counts as text, each linking `/staff/orders?status=X`; no client-side sum (total shown = server `total`) |
| U18 | S2 | Orders status pills with counts | Each pill shows the server count; "All" shows `total`; a Packed pill exists; selecting writes `status=` as before. Supersedes HO-P4 U18's "no counts rendered" |
| U19 | S2 | List row BG-3 | Delivery row shows district (or zone) and "{date} · {window}"; pickup and counter rows show neither |
| U20 | S2 | Pick-list tick | Click sends `PUT …/picked { picked: true }`; the tick shows immediately; a 400 `InvalidOrderTransition` reverts it with the message; ticks come from `picked` and survive a refetch and a remount. Supersedes HO-P4 U19/U21's component-state ticks |
| U21 | S2 | `MarkPacked` in `allowedActions` | "Mark packed" button calls `POST …/packed`; absent when not allowed; "Packed {time}" from `packedOn` |
| U22 | S2 | Dispatch dialog | "Send with" radiogroup Courier/Rider; Rider lists active riders only; the request carries exactly one of `courierId`/`riderId`; no tracking field for Rider; with zero riders the Rider option is disabled with "No riders set up"; shipment shows "Rider: {name}" |
| U23 | S2 | Riders page | Lists riders; add/edit dialog; `RiderNameAlreadyExists` inline on Name; deactivate confirms; 403 → `PermissionDeniedState` |
| U24 | S2 | POS browse | Category `tablist` with "All" + categories (labels from `lib/shop/labels`); selecting calls `browse?category=X`; tiles add a basket line; a typed search replaces the grid with results |
| U25 | S2 | POS change preview | Typing 1000 sends `tenderedCash` to the quote; "Change due ৳{changeDue}" from the quote / "Still to pay ৳{cashShort}"; no text without a tender; the completed sale still shows its own `changeDue`. Supersedes HO-P4 U23's first clause |
| U26 | S2 | POS anonymous sale | Default chip "Walk-in (no customer)"; completing sends neither name nor mobile; entering only one of them blocks with "Enter both the name and the mobile number, or neither." |
| U27 | S2 | Guards | `no-money-arithmetic` and `no-card-ui` pass and still scan `components/pos/*`, `components/orders/Staff*`, `components/fulfilment/*`; staff side panel shows the rider note |
| U28 | S3 | Products table BG-9 | Thumbnail with the server alt text (placeholder when null); Origin; Pack sizes; Price "{min} – {max}" only when the two strings differ; Stock "{n} available" or "—"; "Organic" pill when `isOrganic`. Supersedes the BG-9 "Not built" assertions |
| U29 | S3 | Bulk publish/hide | Row and page checkboxes; bar with Publish / Hide from shop; confirm names the count; one `bulk-status` call with the ids; result line uses the server counts and lists failures with their messages; selection clears after and on page change |
| U30 | S3 | Details district | Field saved in the same `PUT` with `expectedVersion`; `isSubscribable` is never sent; `two-step-save.test.tsx` passes |
| U31 | S3 | "Was" price | Column renders `compareAtPrice` and the scheduled one; the schedule dialog sends `compareAtAmount`; `CompareAtMustExceedPrice` inline |
| U32 | S3 | Certificate | Expiry date field; "Expired" pill only when the server says `organicCertificateExpired`; upload uses `purpose="OrganicCertificate"`; "View certificate" opens the signed URL with `noopener`; "Remove file" sends `null`; `InvalidCertificateFile` inline |
| U33 | S3 | Stock BG-16 | "Reorder at" with "(branch default)"/"Off"; "Below reorder level" pill from the server boolean; batch matrix shows Received and Supplier |
| U34 | S3 | Overview arrivals | Row "{count} consignments arriving in the next {withinDays} days" linking with `arrivingWithinDays`; absent when the field is missing |
| U35 | S3 | Receipt draft autosave | A change triggers one `PUT` after 1.5 s; a second change during the request waits and supersedes; status "Draft saved at hh:mm" in `role="status"`; reload with `?draft=` restores the form; post sends `draftId`; Discard confirms then deletes; a 404 on save stops autosave with a message; `GoodsReceiptDraftLimitReached` shows plain text; `goods-receipt-form.test.tsx` passes |
| U36 | S3 | Receive into | No select with one branch; with two, a labelled "Receive into" select defaulting to the active branch; changing it refetches POs, consignments and locations with `branchId` and asks before clearing line locations; post carries `branchId`; `BranchNotAssigned` mapped. Supersedes HO-P4 U32's "No Receive into select" |
| U37 | S4 | Customer browse | Search "Rahman" calls `browse?search=Rahman`; tag and sort write the URL; paging; selecting sets `?customer=`. Supersedes HO-P4 U16's lookup assertions for this screen; the POS panel still uses `findCustomers` |
| U38 | S4 | Profile summary | Customer since, Orders, Lifetime spend (`AmountCell`, server string), Area, tag chips; Orders, Billing and **Notes** tabs; still no Subscriptions tab. Supersedes HO-P4 U17's "no Notes" |
| U39 | S4 | Notes | Newest first with author and time; add note ≤ 1000 with counter; text rendered literally; the list refetches after 201 |
| U40 | S4 | Tags | Max 10, ≤ 30 each, enforced in the dialog; save sends the whole set; the chips show the server's returned set |
| U41 | S4 | Password reset | Confirm dialog; result "Reset link sent by {channel} to {maskedDestination}…"; no token or link text anywhere; 403 → permission message |
| U42 | S4 | Cash-up per source | One labelled input per source; submit sends `counts[]` (each `wireMoney`); per-source variance pills and the total from the server response; Unknown/Duplicate source codes mapped; no `Number(`/`parseFloat(` (billing lint); with no sources the HO-P4 single input remains (HO-P4 U36 still passes) |
| U43 | S4 | Outlet cards | Type pill, address, "Today: {summary}", delivery areas, "{n} staff"; Type select in create/edit. Supersedes HO-P4 U38's "no address or staff-count text" |
| U44 | S4 | Staff table | Outlet column (primary first, "(primary)"); Status from the server (`Locked` shown) |
| U45 | S4 | Roster cycle | Morning → Evening → Off → Morning, one `PUT` each, cell replaced by the response; Custom asks first; past dates and non-rosterable rows are not buttons; legend has no hours; `ShiftDateInPast` / `StaffNotRosterable` mapped; cell names per §7 UI-6 |
| U46 | all | Colour literals | HO-P3 `tests/components/shop/no-hex-literals.test.ts` and HO-P4 `tests/components/back-office/no-colour-literals.test.ts` pass over every touched file |
| U47 | all | Mocks mirror validation | Each slice adds, in its own new test file, one case per new mocked refusal (§11.x Mocks rows): the mock returns the server's status, code and property name |

## 16. End-to-end test cases (Playwright, `chromium` + `mobile-360`)

**Machine limits (binding):** run at `--workers=1` or `--workers=2` only, with `--max-failures=20`, on a **fresh `next dev` per chunk** (MSW runs only under `next dev`; a production build cannot be used). After stopping a run, kill the Playwright process tree and any leftover `chrome-headless-shell`, and free the port before the next chunk. Four workers exhaust commit memory on the build machine.

**May change** = the owning slice may add cases and update selectors for structure this pass changes, keeping existing assertions. **Run-only** = must pass unchanged (§14), the 12 baseline failures (§1) excepted.

| ID | Slice | Spec / case | Kind | Expected |
|---|---|---|---|---|
| E1 | S0 | `ordering-customer-orders.spec.ts`, `portal-dashboard.spec.ts`, `ordering-staff.spec.ts` | run-only | Pass (the tracker and status vocabulary change breaks nothing) |
| E2 | S1 | `shop-catalogue.spec.ts` + new: filter by a district → every card's eyebrow is that district; a certified card shows "Organic" | may change | Pass |
| E3 | S1 | `shop-product.spec.ts` + new: a product with a district shows "Grown in …" and the delivery card states the lead time | may change | Pass |
| E4 | S1 | `shop-shell.spec.ts` / `shop-home.spec.ts`: the strip shows the free-delivery promise; banners still render below; axe clean | may change | Pass |
| E5 | S1 | `ordering-customer.spec.ts` + new: place a delivery COD order with a rider note → the order detail shows it; switching to Pickup hides the field | may change | Pass |
| E6 | S1 | `shop-a11y-responsive`, `shop-portal`, `home`, `ordering-a11y-responsive` (baseline :133 excepted), `portal-*`, `account-area`, `accounts-*` | run-only | Pass |
| E7 | S2 | `dashboard-home.spec.ts` + new: sales chart table alternative; pipeline link to `?status=Packing` | may change | Pass |
| E8 | S2 | `ordering-staff.spec.ts` + new: pill counts; tick a line, reload, tick persists; Mark packed; dispatch to a rider → shipment shows the rider | may change | Pass |
| E9 | S2 | `ordering-pos.spec.ts` + new: browse a category, add a tile; tender 1000 → change shown before completing; complete an anonymous sale → receipt | may change | Pass |
| E10 | S3 | `shop-staff.spec.ts` + new: select two products → Hide from shop → result line; set a district and a "Was" price; expired certificate blocks publish with the message | may change | Pass |
| E11 | S3 | `inventory-flows.spec.ts` + new: "Reorder at" column; arrivals row; type in a new receipt, reload with `?draft=`, the lines are back, post it | may change | Pass |
| E12 | S3 | `inventory-a11y-responsive`, `procurement-flows` (baseline :95 excepted), `inventory-real-api` (real-API run only) | run-only | Pass |
| E13 | S4 | `staff-customers.spec.ts` + new: search by name → profile shows lifetime spend; add a note; edit tags; send password reset → masked destination | may change | Pass |
| E14 | S4 | `billing-functional.spec.ts` + new: count two sources → per-source variance; baseline :18 E-A1 and :216 E-F1 excepted | may change | Pass |
| E15 | S4 | `admin-functional.spec.ts` (baseline :56 mobile-360 excepted), `staff-admin.spec.ts` + new: outlet card details; staff Outlet column; roster cell cycles | may change | Pass |
| E16 | S4 | `billing-a11y-responsive` (baseline :86 excepted), `admin-a11y-responsive`, `admin-filters`, `admin-branch-calendar` | run-only | Pass |
| E17 | all | Every other spec (`staff-shell-*` baseline excepted, `notifications-*` baseline excepted, `xct-*` baseline excepted, `reports-*`, `staff-auth`) | run-only | Pass |
| E18 | integration | `npm run test:e2e` in chunks (§17.2) | — | Only the 12 baseline failures, each failing as recorded |
| E19 | integration | `npm run sweep:a11y` | — | No new axe violation against baseline `67691e9` |

## 17. Implementation order and verification

### 17.1 Order (small batches)

1. **S0 alone** on `feat/p5-s0-contract` from `67691e9`. First commit: ADR-FE-185 … 192. Second commit: the `overview.test.tsx` split (counts unchanged). Then §11.1. Gates, merge.
2. **Batch 1: S1 and S2 in parallel**, each in its own worktree from the S0 merge, one `PORT` each. Gates, merge in either order.
3. **Batch 2: S3 and S4 in parallel**, from the batch-1 merge. Gates, merge.
4. Each slice, before its gates, runs §17.2 "per slice".
5. **Integration** on `feat/phase2-catalogue-theme` (or its successor) after all five merge: §17.2 "integration"; add the new GETs to `tests/contract/mock-vs-real.contract.test.ts` (§12) and run `npm run test:contract` if a scratch API is available, recording the result in the integration report either way.

### 17.2 Commands (from `web/`)

Per slice:

```bash
npm run typecheck
npm run lint
npm test
npx playwright test --project=chromium --project=mobile-360 --workers=2 --max-failures=20 <the slice's "may change" specs from §16>
npx playwright test --project=chromium --project=mobile-360 --workers=2 --max-failures=20 <the slice's run-only specs from §16>
```

Integration (each chunk on a fresh `next dev`; stop the server and kill leftovers between chunks):

```bash
npm run typecheck && npm run lint && npm test && npm run build
npx playwright test --project=chromium --project=mobile-360 --workers=2 --max-failures=30 tests/e2e/shop-*.spec.ts tests/e2e/home.spec.ts tests/e2e/ordering-customer*.spec.ts tests/e2e/portal-*.spec.ts tests/e2e/account*.spec.ts
npx playwright test --project=chromium --project=mobile-360 --workers=2 --max-failures=30 tests/e2e/ordering-staff.spec.ts tests/e2e/ordering-pos.spec.ts tests/e2e/ordering-a11y-responsive.spec.ts tests/e2e/dashboard-home.spec.ts tests/e2e/reports-*.spec.ts tests/e2e/staff-*.spec.ts
npx playwright test --project=chromium --project=mobile-360 --workers=2 --max-failures=30 tests/e2e/inventory-*.spec.ts tests/e2e/procurement-flows.spec.ts tests/e2e/billing-*.spec.ts tests/e2e/admin-*.spec.ts
npx playwright test --project=chromium --project=mobile-360 --workers=2 --max-failures=30 tests/e2e/notifications-*.spec.ts tests/e2e/xct-*.spec.ts
npm run sweep:a11y
# colour-literal back-up check (U46)
rg -n --glob "*.{ts,tsx}" "#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|-\[#" components app
```

The real-API specs (`*-real-api`, `journey-real-api`, `real-api-verification`) run only when their environment is configured; record "not run" otherwise.

### 17.3 Each slice's report lists

Files touched (all inside its §13 block); every superseded assertion (old → new, per §15); every OQ default it built to; every mock refusal it added and the server file:line it mirrors; e2e results per spec including which baseline failures appeared.

## 18. Acceptance criteria

| A# | Slice | Story | Criterion | Evidence |
|---|---|---|---|---|
| A1 | S0 | US-ORD-12, US-ORD-10 | `Packed` is understood everywhere: the customer tracker shows it on the Packing node, labels exist, the mock seeds it; HO-P5 ADRs recorded; test split with unchanged count | U1–U4, E1 |
| A2 | S1 | US-SHP-04, US-SHP-03 | District of origin shows on cards and the product page, and the catalogue filters by it with server counts and URL state | U5, U7–U9, E2, E3 |
| A3 | S1 | US-SHP-04 | Catalogue cards show a truthful "Organic" badge from the item's certifications | U6, E2 |
| A4 | S1 | US-ORD-06 | The store shows the server's free-delivery threshold in the top strip and the lead time on the product page, with no browser arithmetic and a safe fallback | U10–U12, E3, E4 |
| A5 | S1 | US-ORD-03, US-ORD-12 | A customer can leave a rider note for a delivery order; it is placed once, validated as the server does, and shown back on the order | U13–U15, E5 |
| A6 | S2 | US-RPT-05 | Dashboard shows the 14-day sales chart (accessible, server figures) and the orders pipeline; the COD-with-riders tile appears for the right roles | U16, U17, E7 |
| A7 | S2 | US-ORD-09, US-ORD-10 | Orders: status counts, delivery area and slot on rows, persisted pick-list ticks, Mark packed | U18–U21, E8 |
| A8 | S2 | US-ORD-11 | Orders can be dispatched to an in-house rider; riders can be managed | U22, U23, E8 |
| A9 | S2 | US-ORD-16 | Counter sale: category browse, server change preview before completion, anonymous walk-in sale; no card UI, no money arithmetic | U24–U27, E9 |
| A10 | S3 | US-SHP-01 | Products list shows origin, sizes, price range, stock, thumbnail and organic, and supports bulk publish/hide | U28, U29, E10 |
| A11 | S3 | US-SHP-02, US-SHP-03 | Product editor: district, "Was" price, organic certificate expiry and file | U30–U32, E10 |
| A12 | S3 | US-IMP-06, US-IMP-10 | Inventory: reorder level, batch received/supplier, arriving consignments | U33, U34, E11 |
| A13 | S3 | US-IMP-04 | Receiving autosaves to a server draft, resumes, and can receive into another assigned branch | U35, U36, E11 |
| A14 | S4 | US-ACC-10, US-ACC-11 | Customers: browsable list with name search and tags, profile summary, notes, tags, staff-started password reset | U37–U41, E13 |
| A15 | S4 | US-BIL-12 | Cash-up counts per source with the server's per-source variance | U42, E14 |
| A16 | S4 | US-ADM-01, US-ADM-02, US-ACC-07 | Outlet cards show type, address, today's hours, delivery areas, staff count; staff list shows outlets and status | U43, U44, E15 |
| A17 | S4 | US-ADM-03 | Roster grid cells cycle Morning/Evening/Off through the server | U45, E15 |
| A18 | all | UI-6, HO-P2 §2 | No colour literals; every a11y spec passes; no new axe violations | U46, E6, E12, E16, E19 |
| A19 | all | — | Every new mocked input is refused exactly as the server refuses it | U47, §17.3 reports |
| A20 | all | — | No file outside the slice's §13 block; nothing subscription-shaped; no backend, config or dependency change | ARCHITECTURE gate diff review against §13/§14 |
| A21 | all | — | typecheck, lint, Vitest and build pass; full e2e shows only the 12 baseline failures | §17.2, E18 |
| A22 | — | US-SUB-* | **Not met in this pass**: subscriptions (G2/BG-15) deferred to the subscriptions frontend handover | §4.1 |

## 19. Required gates

Per slice, in this order.

| Gate | Agent | Focus for this pass |
|---|---|---|
| ARCHITECTURE | `architecture-reviewer` | Diff inside §13, nothing in §14; every new type field cites a real view model; each screen calls its owning context's endpoint; Server Components on the shop; no subscription surface |
| SECURITY | `security-reviewer` | Rider note and customer notes rendered as text, not in URLs or storage; password reset shows only the masked destination; the certificate link uses the server's signed URL with `noopener`; draft ownership not assumed client-side; presentation-only permission hints, the server's 403 respected |
| CODE_REVIEW | `code-reviewer` | No money arithmetic (incl. `useSalesSeries.ts` and `components/dashboard/**` by hand); `wireMoney` for every amount sent; tokens only; mocks mirror validation; component size |
| TEST | `test-engineer` | §15/§16 cases exist and pass on both projects; superseded assertions are at least as strong; e2e run at ≤ 2 workers; baseline failures reported by name |
| ACCEPTANCE | `acceptance-reviewer` | Every §18 row evidenced; screenshots at 360 and 1280 against the matching `.dc.html`; omissions are exactly the residual gaps and OQ defaults, not silent drops |

## 20. BLOCKED conditions

### 20.1 **A file you need is not in your §13 block**
Stop and name the file and the change. If another slice owns it, the integrator routes the change to that slice; if it is S0's seed store, S0 (or the integrator) adds the seed. **Never** edit it "just a little", and never copy it under a new name.

### 20.2 **The server sends something different from the Gap inventory** (a field name, a nullability, a status code)
The code wins. Mirror what `src/` does, cite the file:line in your report, and the integrator records a §1 Amended row. **Never** shape the type or the mock to this document against the code.

### 20.3 **A run-only spec breaks because a name or role changed**
Restore the accessible name or role it relies on. If the new element genuinely requires a different name, raise BLOCKED with the spec and line. **Never** edit a run-only spec or weaken an assertion in one you own.

### 20.4 **A figure seems to need arithmetic** (amount to free delivery, change, a total of counted sources, a chart total, a price range)
Use the server's field. If the server has none, the element is a residual gap: leave it out and report it. **Never** compute it, and never relax a guard or add an ignore comment.

### 20.5 **A mock cannot mirror a server rule** (it needs state the mock does not have)
Model the minimum state that makes the rule true (for example, a per-branch rider name set). If that is not possible, report it and leave the handler **refusing** rather than accepting. **Never** ship a mock that accepts what the server refuses.

### 20.6 **An open question's default looks wrong once built** (for example, the strip precedence)
Build the default, note the concern in your report, and let the owner answer. **Never** pick a different answer silently.

### 20.7 **Something subscription-shaped appears** (an `isSubscribable` field in a form you touch, a `Subscription` channel filter)
Leave it out. Display the channel label only (OQ-11). **Never** call a subscription endpoint or send `isSubscribable`.

### 20.8 **The e2e run crashes for resources** (worker exit 0xC0000142, `next dev` heap errors at low memory, a stuck port)
Stop, kill the Playwright tree and leftover browsers, free the port, and rerun the chunk at `--workers=1`. **Never** record a resource crash as a test result.

---

## Backend gaps still open after HO-P5

| # | What | Why it stays open | Interim |
|---|---|---|---|
| BG-11 | Categories management screen | Categories are a fixed enumeration; dropped by HO-P4 as not a defect | No button |
| BG-15 / G2 | Subscriptions, everywhere | Deferred to the subscriptions frontend handover | Nothing shown |
| G1 residual | Village of origin; "Village on every pack" | Backend stores a district only | District shown; promise left out (OQ-6) |
| G4b | Rider note on the packing slip | `PackingSlipViewModel` (`Read/ViewModels/StaffOrderViewModels.cs:58-61`) has no rider note | Shown on the staff order panel (OQ-7) |
| G5b | Basket "Add ৳X more for free delivery" for a guest or before an address | No server amount for a cart; computing it is forbidden | Strip states the threshold; checkout keeps `CheckoutFreeDelivery` from the quote (OQ-4) |
| G5c | Place name in the strip ("in Dhaka") | `DeliveryPromiseViewModel` has no zone name; the controller's XML doc claims `zoneName` | Strip without a place name (OQ-2). The doc/view-model mismatch should be fixed in `src/` |
| BG-22 residual | Manager / Cashier / Packer / Stock keeper / Rider roles | Roles unchanged in `src/` | Footer lists the real roles |
| HO-P3 G3, G6, G7, G9, G10 | As HO-P3 §21 | Not built | As HO-P3 |

## Open questions (resolved 2026-10-31: owner accepted every default, see §1 Amended)

Each slice builds to the default and records it. An owner answer that differs becomes a §1 Amended row.

| OQ | Question | Recommended default |
|---|---|---|
| OQ-1 | Top strip: should the delivery promise replace the first `Shop` banner (as the design draws), or should an admin-edited banner keep the strip (HO-P3 OQ-5)? | The promise takes the strip when `freeOver` is set; all banners show in `BannerStrip` (ADR-FE-187) |
| OQ-2 | The design says "Free delivery over [AMOUNT] **in Dhaka**". The promise has no zone name (and its controller doc wrongly mentions `zoneName`). Hard-code "Dhaka"? | No. Omit the place: "Free delivery over ৳X · Cash on delivery across Bangladesh". Ask backend to add `zoneName` or fix the doc |
| OQ-3 | The owner rule of 2026-10-16 says the shop makes "no dates, fees or speed claims" (`components/hearth/DeliveryPromise.tsx:4-8`). Does commissioning G5 supersede it for the product page lead time and the strip threshold? | Yes, for exactly these two server figures, worded as "usually takes N day(s)" |
| OQ-4 | Basket "Add ৳X more for free delivery" needs a subtraction the browser may not do | Not built (G5b). Ask backend for an amount on the cart if wanted |
| OQ-5 | Card eyebrow: the design shows the district only; today's card shows producer · country. Product page: "Grown in {district}" replaces or joins the producer line? | Card: district when present, otherwise producer · country. Product: "Grown in {district}" added above the existing producer · country line |
| OQ-6 | "Village on every pack" — the backend has a district, not a village, and the district is optional | Leave the promise out |
| OQ-7 | The design never draws the rider note being read back. Show it to the customer on their order and to staff on the order panel? | Yes, both, as plain text "Note for the rider: …". Packing slip waits for G4b |
| OQ-8 | The server now sends a "Was" price on store cards and the product page; the store design never draws a struck price | Not shown in the store in this pass; staff editor only |
| OQ-9 | Riders need a management screen; the design has none | Minimal `/staff/fulfilment/riders` (list, add, edit, deactivate), linked from the dispatch dialog and pick list; no nav item |
| OQ-10 | Customer-facing label for `Packed` | "Packed" in lists and badges; the tracker stays on the Packing node |
| OQ-11 | Staff order rows can now carry channel `Subscription` | Show the label "Subscription" (display only); no filter or tab until the subscriptions handover |
| OQ-12 | Bulk publish/hide: selection across pages? | Current page only; cleared on page change and after the action |
| OQ-13 | Receiving "Receive into": HO-P4 removed the select; the backend now allows another assigned branch | Show the select only with 2+ assigned branches, defaulting to the active branch |
| OQ-14 | Customers screen: replace the exact mobile/email lookup with the browsable list (name search) | Yes on `/staff/customers`; the POS customer panel keeps the exact lookup (its primary-mobile match semantics matter for walk-in identity) |
| OQ-15 | Roster legend: the design says "Morning 8–4 / Evening 2–10"; the server presets are 08:00–14:00 and 14:00–20:00 (`Shared/Constants/StaffRosterRules.cs:14-17`) | Legend shows names only; each cell shows the server's slot times. Owner to confirm which hours are intended |

# HO-P6 — Subscriptions: customer, staff and back-office screens (frontend, 4 slices)

Owner brief (2026-11-07, as given to this handover):
- Subscriptions were deliberately left out of HO-P5 ([HO-P5-WIRING](HO-P5-WIRING.md): Gap inventory row BG-15, §4.1 "Deferred elsewhere", the §14 row "Anything subscription-shaped…", §18 A22 "Not met in this pass"). This handover delivers them.
- [HO-SUB-002](HO-SUB-002.md) (frontend, baseline `4007225`, never built) is **source material only**: its intent, its rules ADR-FE-110/111/112 and the stories US-SUB-01 … 06. It predates the clinic retirement (HO-P1), the catalogue and theme (HO-P2), the store front (HO-P3), the back office (HO-P4) and the wiring pass (HO-P5). Everything else here is re-grounded in today's code. Cat, vet, prescription-diet and clinic content is dropped.
- **The backend is the source of truth for the wire.** It is built and merged (`6c5c89c`). Every endpoint, field, status, action and limit below cites `src/` by file and line, as HO-P5 did.
- Process: HO-P5's. Slices with disjoint file scopes, S0 first, then small parallel batches, then five gates per slice and an integration pass. Nothing is committed by the handover author; the owner reviews and commits this file.

---

## Contract inventory (read first): verified against the code at `c176fd8`

Paths are abbreviated: `Api/…` = `src/Api/AmarGram.Api/…`, `Read/…` = `src/Read/AmarGram.Read/…`, `Shared/…` = `src/Shared/AmarGram.Shared/Common/…`, `App/…` = `src/Application/AmarGram.Application/…`, `Domain/…` = `src/Domain/AmarGram.Domain/…`, `Infra/…` = `src/Infrastructure/AmarGram.Infrastructure/…`. Web paths are under `web/`.

**Endpoint ids.** **C1 … C12** are customer endpoints, **T1 … T9** are staff endpoints and **P1 … P5** are other endpoints. None of them collides with the slice names **S0 … S3**.

**Wire conventions** (`Read/ViewModels/SubscriptionViewModels.cs:3-4`, `Api/Contracts/Subscription/SubscriptionRequests.cs:3-4`): JSON camelCase; local dates are `yyyy-MM-dd` strings; instants are ISO-8601 with offset; money is `{ amount: "1450.00", currencyCode }`; every view carries `commerceTimeZoneId`. Enumeration fields travel as their **display names** (`"Active"`, `"CashOnDelivery"`). No field is a token, card or gateway reference (ADR-238).

**Two 400 shapes.** A bad enumeration value in a request is refused by the controller **before** the command, with a plain object `{ "error": "…" }` (`CustomerSubscriptionsController.cs:56, 141-142, 180, 186`; `StaffSubscriptionsController.cs:143-145`). Everything else is the usual `ValidationResponse` (`errors[{ propertyName, errorMessage, errorCode }]`) from FluentValidation or a returned violation (`App/CommandHandlers/Subscription/SubscriptionHandlerSupport.cs:18-32`). `web/lib/api/client.ts:366-368` turns **both** into `ApiValidationError`, so for the `{ error }` shape `response.errors` is `undefined`. The subscription error mapper must handle that (§8.5).

**Status mapping** (`Api/Controllers/SubscriptionHttp.cs:17-40`): `SubscriptionNotFound` or `ProductNotFound` → **404** with no body (another customer's subscription is the same 404 as a missing one, ADR-248); `StaleVersion` → **409** with the `ValidationResponse`; every other refusal → **400**. Commands answer with the real result, never `202`.

### Customer endpoints: `Api/Controllers/CustomerSubscriptionsController.cs`, route `api/customers/me/subscriptions` (`:24`), `[RequireCustomerSession]` (`:25`), GETs `Cache-Control: no-store`

| # | Endpoint | Request | Response | Refusals |
|---|---|---|---|---|
| C1 | `GET options?skuId=` (`:28-35`) | `skuId` | `SubscriptionOptionsViewModel` (`SubscriptionViewModels.cs:47-60`): `sku { skuId, productName, variantLabel, imageUrl, isAvailable }`, `unitPrice: Money \| null`, `subscribable`, `notSubscribableReason` (server text, `Shared/Constants/SubscriptionMessages.cs:17-18`), `allowedIntervalWeeks` (`[2,4,6,8,12]`, `SubscriptionRules.cs:8`), `maxQuantity` (20, `:10`), `discountPercent` (string `"F2"`, e.g. `"10.00"`), `earliestFirstDeliveryOn`, `latestFirstDeliveryOn` (today + 90, `:14`), `changeCutoffDays`, `preChargeNoticeDays`, `existingSubscriptionId`, `commerceTimeZoneId`. Built at `Read/QueryHandlers/Subscription/SubscriptionCustomerQueryHandlers.cs:74-99`; `subscribable = isPurchasable && isSubscribable` (`:86`) | 404 unknown SKU (`:83`) |
| C2 | `GET payment-methods?skuId=&quantity=&deliveryAddressId=&pickupBranchId=` (`:37-48`) | `quantity` defaults to 1 and is clamped to 1…20 (`SubscriptionCustomerQueryHandlers.cs:126`) | `[{ method, isAvailable, unavailableReason }]` (`SubscriptionViewModels.cs:62`). **`[]` when neither id is given** (`:117`). Delivery offers `CashOnDelivery`, `BankTransfer`; pickup offers `BankTransfer`, `PayAtPickup` (`:119-121`). Availability and the reason text are Orders' own BR-15 decision (`:123-134`) | 404 unknown SKU (`:114`) |
| C3 | `GET ?status=live\|cancelled\|all&pageNumber=&pageSize=` (`:50-63`) | `live` = Active, Paused, Suspended; omitted or `all` = every status | `PagedResult<SubscriptionViewModel>`. Order: not cancelled first, then by `nextDeliveryOn` (nulls last), then newest start (`SubscriptionCustomerQueryHandlers.cs:30`). Page size 1…100, default 20 (`:15`) | 400 `{ error: "status must be live or cancelled." }` (`:56`); paging 400s from `Api/Controllers/PagingHelper.cs:31-47` |
| C4 | `GET {id}` (`:65-74`) | — | **One flat object**: `SubscriptionViewModel` plus `cycles[]` (the latest 12, newest first; `SubscriptionRules.CustomerCycleHistory`, `SubscriptionRules.cs:23`; flattening `SubscriptionHttp.cs:25-31`) | 404 (`:71`) |
| C5 | `GET {id}/cycles?pageNumber=&pageSize=` (`:76-86`) | — | `PagedResult<SubscriptionCycleViewModel>`, newest first (`SubscriptionCustomerQueryHandlers.cs:53-71`) | 404 |
| C6 | `POST` (`:88-107`) | `CreateSubscriptionRequest` (`SubscriptionRequests.cs:6-16`): `skuId`, `quantity`, `intervalWeeks`, `firstDeliveryOn?`, `fulfilment` (`Delivery`\|`Pickup`), `deliveryAddressId?`, `pickupBranchId?`, `paymentMethod` | **201** `SubscriptionViewModel` (no `cycles`), `Location: /api/customers/me/subscriptions/{id}` (`:106`) | 400 `{ error }` for a bad `fulfilment` / `paymentMethod` (`:180, :186`); validator (`App/CommandHandlers/Validators/SubscriptionCommandValidators.cs:17-28`: quantity 1…20, interval in the list, exactly one of address / branch matching the fulfilment, property `Fulfilment`); handler (`App/CommandHandlers/Subscription/SubscriptionCustomerCommandHandlers.cs:33-83`): `SkuNotSubscribable` (two texts, `:42-43`), `SubscriptionAlreadyExists` (`:45-46`), `SubscriptionLimitReached` (20 live, `:48-49`), Orders' servability codes (`SubscriptionHandlerSupport.cs:66-91`: `DeliveryAddressNotFound` → `DeliveryAddressId`, `AddressOutsideServedZones` → `DeliveryAddressId`, `PickupBranchUnavailable` → `PickupBranchId`, `PaymentMethodUnavailable` → `PaymentMethod` with Orders' text, `DeliveryTaxNotConfigured` / `ServiceLevelUnavailable` → `Fulfilment`), `InvalidFirstDeliveryDate` (`Domain/DomainServices/SubscriptionSchedule.cs:207-216`, property `FirstDeliveryOn`); **404** `ProductNotFound` for an unknown SKU (`:40`, `SubscriptionHttp.cs:17`) |
| C7 | `PUT {id}/terms` (`:109-120`) | `ChangeSubscriptionTermsRequest` (`SubscriptionRequests.cs:18-27`): `version`, `quantity`, `intervalWeeks`, `fulfilment`, `deliveryAddressId?`, `pickupBranchId?`, `paymentMethod` | **200 `SubscriptionChangeResult`** (`:156-168`): `{ subscription: SubscriptionViewModel, appliedImmediately, appliesFromCycleOn, message }` | as C6, plus **409** `StaleVersion` (`SubscriptionCustomerCommandHandlers.cs:104-105`); `NoChangeRequested` (`SubscriptionSchedule.cs:94`); `InvalidSubscriptionTransition` for Suspended, Cancelled or a pending cancel (`:92-93`). An interval-only change skips the servability re-check (`SubscriptionCustomerCommandHandlers.cs:121-123`) |
| C8 | `POST {id}/skip` (`:122-126`) | `{ cycleOn }` (`SubscriptionRequests.cs:29-32`) | 200 change result | `CycleNoLongerSkippable` naming the next skippable date (`SubscriptionSchedule.cs:125, 133, 253-254`; text `SubscriptionMessages.cs:41-44`); `SkipAlreadyScheduled` (`:131-132`); `InvalidSubscriptionTransition` (`:119-120`) |
| C9 | `POST {id}/pause` (`:128-130`) | no body | 200 change result | `InvalidSubscriptionTransition` (`SubscriptionSchedule.cs:140-141`) |
| C10 | `POST {id}/resume` (`:132-136`) | `{ firstDeliveryOn? }` (`SubscriptionRequests.cs:34-37`) | 200 change result | `SubscriptionSuspended` (customer cannot lift a suspension, `SubscriptionCustomerCommandHandlers.cs:175-177`); `SkuNotSubscribable` when the product can no longer be bought (`:180-185`); `InvalidFirstDeliveryDate`; `InvalidSubscriptionTransition` |
| C11 | `POST {id}/cancel` (`:138-146`) | `{ reason, note? }` (`SubscriptionRequests.cs:39-43`) | 200 change result | 400 `{ error }` when `reason` is missing or not a reason name (`:141-142`); validator: reason must be one of the six customer reasons (`IsCustomerChoice`, `Shared/Enums/SubscriptionCancellationReason.cs:20`), note ≤ 500 (`SubscriptionCommandValidators.cs:63-66`); `NoChangeRequested` when a cancel is already scheduled (`SubscriptionSchedule.cs:168-169`) |
| C12 | `DELETE {id}/pending-changes` (`:148-152`) | — | 200 change result | `NoPendingChange` (`SubscriptionSchedule.cs:179-180`) |

The change result's `message` is the server's sentence and names the affected date (`SubscriptionSchedule.cs:221-246`, dates as `ddd d MMM`, `SubscriptionMessages.cs:26`).

### `SubscriptionViewModel`: `Read/ViewModels/SubscriptionViewModels.cs:24-42`, built by `Read/QueryHandlers/Subscription/SubscriptionViews.cs:42-76`

`id`, `version`, `status` (`Active` \| `Paused` \| `Suspended` \| `Cancelled`), `suspensionReason` (`UnpaidCycles` \| `ProductUnavailable` \| null), `product { skuId, productName, variantLabel, imageUrl, isAvailable }` (current catalogue name, creation snapshot as fallback; **no slug**), `terms { quantity, intervalWeeks, fulfilment, deliveryAddress { id, label, line1, city } | null, deliveryAddressMissing, pickupBranch { id, name } | null, paymentMethod }` (`:12-14`), `nextDeliveryOn` (date, null unless Active), `changeCutoffOn` (instant, Active only, `SubscriptionViews.cs:73`), `isLocked`, `followingDeliveryOn` (Active only), `skippableCycleOn`, `pending { terms | null, skip, statusChange (Pause \| Cancel \| null), appliesFromCycleOn } | null` (`:16`; `appliesFromCycleOn` is `nextDeliveryOn` for a pending cancel, else the following cycle, `SubscriptionViews.cs:66`), `estimate { unitPrice, quantity, subtotal, discountPercent, discountAmount, estimatedTotal, note } | null` (`:18-19`; null when the SKU has no price), `allowedActions[]`, `lastCycle | null`, `startedOn`, `cancelledOn`, `commerceTimeZoneId`.

`allowedActions` values (`Domain/DomainServices/SubscriptionSchedule.cs:26-34`, rules `:62-86`): `ChangeTerms`, `Skip`, `Pause`, `Resume`, `Cancel`, `WithdrawPending`. Active without a pending cancel: ChangeTerms, Skip (only when `skippableCycleOn` is set), Pause (only without a pending status change), Cancel. Paused: ChangeTerms, Resume, Cancel. Suspended: Cancel. Any non-cancelled subscription with something pending: WithdrawPending. **The screens render from this list only.**

`SubscriptionCycleViewModel` (`:21-22`): `id`, `cycleOn`, `outcome` (`Generated` \| `Failed`), `failureReason` (`OutOfStock`, `ProductUnavailable`, `PaymentMethodUnavailable`, `DeliveryUnavailable`, `DeliveryAddressMissing`, `OrderRefused`; `Shared/Enums/SubscriptionCycleFailureReason.cs:6-11`), `orderId`, `orderNumber`, `orderState` (`AwaitingPayment`, `Confirmed`, `Expired`, `Cancelled`, `Delivered`, `Refused`; `Shared/Enums/SubscriptionCycleOrderState.cs:6-11`), `paymentExpiresOn` (instant), `discountPercent`.

### Staff endpoints: `Api/Controllers/StaffSubscriptionsController.cs`, route `api/staff/subscriptions` (`:22`). Not branch-scoped (`:17`)

| # | Endpoint | Action (`Shared/Constants/Actions.Subscriptions.cs:8-10`) | Response | Refusals |
|---|---|---|---|---|
| T1 | `GET ?status=&suspensionReason=&paymentMethod=&q=&sort=&pageNumber=&pageSize=` (`:25-38`) | `Subscriptions.View` | `PagedResult<StaffSubscriptionRowViewModel>` (`SubscriptionViewModels.cs:68-79`): `id`, `customer { id, name, mobile }`, `product`, `quantity`, `intervalWeeks`, `status`, `suspensionReason`, `nextDeliveryOn`, `paymentMethod`, `unpaidStreak`, `lastCycle`. `q` matches product name, customer name or mobile, case-insensitive (`Read/QueryHandlers/Subscription/SubscriptionStaffQueryHandlers.cs:26-32`). `sort`: `nextDeliveryOn` (default, nulls last), `-nextDeliveryOn`, `status`, `product`; anything else is the default, never a 400 (`:37-43`) | 400 `{ error }` for a bad status, reason or method (`:143-145`); 403 |
| T2 | `GET unpaid?pageNumber=&pageSize=` (`:40-49`) | View | `PagedResult<UnpaidSubscriptionViewModel>` (`:81-88`): `id`, `customer`, `product`, `status`, `group` (`"Suspended"` \| `"AtRisk"`), `unpaidStreak`, `unpaidCycles[]`. Suspended first, then by streak (`SubscriptionStaffQueryHandlers.cs:114-153`) | 403 |
| T3 | `GET due-tomorrow` (`:51-58`) | View | `{ dueOn, count, liveCount, suspendedCount, commerceTimeZoneId }` (`:106`; handler `SubscriptionStaffQueryHandlers.cs:204-218`: `count` = Active with `nextDeliveryOn` = tomorrow in the commerce zone) | 403 |
| T4 | `GET export.csv?` (T1's filters, no paging) (`:60-76`) | `Subscriptions.Export` | `text/csv`, file `subscriptions.csv`, 12 columns (`:72`) | **413** `{ error: "Too many rows to export. Narrow the filters." }` above 50,000 rows (`:69`, `SubscriptionRules.cs:26`); 400 `{ error }`; 403 |
| T5 | `GET {id}` (`:78-89`) | View | **One flat object**: `SubscriptionViewModel` + `customer`, `cycles[]` (latest 50), `cancellationReason`, `cancellationNote`, `suspendedOn`, `reinstatement { reinstatedOn, reinstatedBy (a Guid, no name), reason } \| null`, `allowedStaffActions[]` (`Reinstate` when Suspended, `Cancel` when not Cancelled; `SubscriptionStaffQueryHandlers.cs:168-170`) | 404; 403 |
| T6 | `GET {id}/cycles` (`:91-100`) | View | `PagedResult<SubscriptionCycleViewModel>` | 404; 403 |
| T7 | `POST {id}/reinstate` (`:102-114`) | `Subscriptions.Manage` | **200 `SubscriptionViewModel` only** (not the staff detail, `:130-134`) | `ReinstatementReasonRequired` (`SubscriptionCommandValidators.cs:104`; trimmed, ≤ 500, `Domain/Aggregates/Subscription/SubscriptionAggregate.cs:261-262`); `SubscriptionCannotBeReinstated` unless Suspended (`:258-259`); `SkuNotSubscribable` while the product cannot be bought (`App/CommandHandlers/Subscription/SubscriptionWorkerCommandHandlers.cs:160-165`); `InvalidFirstDeliveryDate`; 404; 403 |
| T8 | `POST {id}/cancel` (`:116-128`) | Manage | 200 `SubscriptionViewModel` only. Reason is always `StaffCancelled` (`:123`); after the cut-off the cancel is **scheduled** like a customer's | `CancellationReasonRequired` when the note is empty (`SubscriptionCommandValidators.cs:69-70`), note ≤ 500 (`:63`); `InvalidSubscriptionTransition` for a cancelled one; 404; 403 |
| T9 | `GET /api/staff/customers/{customerId}/subscriptions` (`:150-165`) | View | `{ live: SubscriptionViewModel[], cancelledCount, suspendedCount }` (`live` = every non-cancelled one, Suspended included; `SubscriptionStaffQueryHandlers.cs:186-200`). An unknown customer has none (200) | 403 |

Roles (`Shared/Constants/ActionRoles.Subscriptions.cs:12-14`, ADR-248): **View** = Reception, Inventory, ShopManager, Accountant, Administrator; **Manage** = ShopManager, Administrator; **Export** = ShopManager, Accountant, Administrator.

### Other endpoints this pass touches

| # | Endpoint | Fact |
|---|---|---|
| P1 | `GET /api/staff/shop/products/{id}` | `isSubscribable` is **always sent** (`Read/ViewModels/StaffProductDetailViewModel.cs:63`; `GetStaffProductDetailQueryHandler.cs:123`). The web type and the shop staff mock lack it today, which is a mock-vs-real drift S3 closes |
| P2 | `PUT /api/staff/shop/products/{id}` | `isSubscribable?: boolean`; **omitted leaves it unchanged** (`Api/Contracts/Product/StaffProductRequests.cs:32-33`; `StaffProductsController.cs:101`; `App/CommandHandlers/Product/UpdateProductDetailsCommandHandler.cs:62`). Clearing it never ends existing subscriptions; their next cycle fails `ProductUnavailable` and suspends (`Domain/Aggregates/Product/ProductAggregate.Subscription.cs:4-7`) |
| P3 | `GET /api/staff/orders?channel=Subscription`, `GET /api/staff/orders/status-counts?channel=Subscription` | Already accepted (`StaffOrdersController.cs:118, 126, 143, 149`; `Shared/Enums/OrderChannel.cs:8`). Web: `channel` is already in the filter type (`lib/api/staff-orders.ts:58`) and the row label exists (`components/orders/StaffOrderQueue.tsx:71`); only the select option is missing (`:284-288`) |
| P4 | `GET /api/branches` (public) | Active branches with `addressLine`, `phoneNumber` (`Api/Controllers/BranchesController.cs:14-25`; `Read/ViewModels/AdministrationBranchViewModels.cs:6-8`). **No type and no pickup flag** (BG-S3). Web client `getPublicBranches` (`lib/api/admin-branches.ts:81-82`) |
| P5 | Notification links | `/portal/subscriptions/{id}` and `/portal/subscriptions/{id}?skip=yyyy-MM-dd` and `/portal/subscriptions` (`Infra/Notifications/NotificationLinkBuilder.cs:23-28`). The customer routes in §8.1 **must** match these |

### Settings that shape the screens (`Shared/Constants/SettingDefinitions.Subscriptions.cs:11-29`)

Cut-off 2 days (0…7), notice 3 days (1…14), **discount 0.00 % by default** (0…50), payment reminder 24 h, unpaid orders before suspension 2 (1…6). The shop manager sets them on the existing registry-driven settings screen (`lib/api/admin-settings.ts:27-44`); no frontend change is needed for that (US-SUB-04).

### Web today

Nothing subscription-shaped exists: `mocks/handlers/areas/subscriptions.ts:10` and `nav/areas/subscriptions.ts:14` are empty, both already registered (`mocks/handlers/index.ts:27, 62`; `nav/index.ts:10, 30`). Negative assertions that this pass supersedes are listed in §15.

---

## 1. Identity

| Field | Value |
|---|---|
| Handover ID | HO-P6-SUBSCRIPTIONS |
| Title | Subscriptions: customer, staff and back-office screens |
| Date | 2026-11-07 |
| Author | Tech lead (handover agent), for shahjahan |
| Backlog | [`docs/USER_STORIES.md`](../USER_STORIES.md) §11: **US-SUB-01, US-SUB-02, US-SUB-03, US-SUB-04, US-SUB-06**; **US-SUB-05 adapted** (the prescription suspension is retired with the clinic, ADR-244; its surviving analogue is the `ProductUnavailable` suspension and the staff restart). The backlog's "cat owner" / "veterinarian" wording predates HO-P1 (OQ-20) |
| SRS | FR-SUB-1 … FR-SUB-5 ([`docs/SRS.md`](../SRS.md) §4.10); FR-SUB-6 retired with the clinic; UI-1, UI-3, UI-4, UI-5, UI-6, NFR-USA-4, NFR-USA-5, NFR-USA-6, NFR-CMP-2, NFR-PRF-1, C-5, C-6 |
| Pairs with | [HO-SUB-001](HO-SUB-001.md) (backend; §12.4 was its contract, **the code above wins** where they differ). **Supersedes [HO-SUB-002](HO-SUB-002.md)** (never built). Follows [HO-P5-WIRING](HO-P5-WIRING.md), whose rules, guards and gate process stay binding |
| Approved design | [`docs/design/subscriptions/`](../design/subscriptions/README.md) (21 artboards drawn against HO-SUB-002) for layout, wording and states, restyled to today's tokens: the customer layer of HO-P3 for customer screens, the HO-P4 back office for staff screens. [`docs/design/back-office/`](../design/back-office/README.md) for the touch points (`ProductEditor.dc.html:150` "Can be subscribed to", `Customers.dc.html:104, 137` Subscriptions tab, `Dashboard.dc.html:163` "Subscription orders due tomorrow"). The store's multi-item "Monthly staples box" (`docs/design/store/MySubscriptions.dc.html`, `Account.dc.html:66`, `Home.dc.html:142`) is **not buildable** (BG-S7, OQ-9) |
| Backend handover it consumes | HO-SUB-001 as built (`6c5c89c`), ADR-237 … 249 as recorded in [`.ai/decisions/adr.md`](../../.ai/decisions/adr.md) §"ADR-237 … ADR-249" (line 4701). No `architect` design was produced for this frontend; the decisions it needs are §9's ADRs and the open questions |
| Baseline commit | `c176fd8` (branch `feat/phase2-catalogue-theme`) |
| Known e2e baseline | HO-P5's list, **11 cases** since HO-P5 Amended (ak) ([integration record](../gates/HO-P5-WIRING-INTEGRATION.md)): `staff-shell-toggle` :29, `staff-shell-manual-expand-overflow` :37, `staff-shell-sheet-closes-on-back-navigation` :30, `billing-a11y-responsive` :86, `billing-functional` :18 E-A1 and :216 E-F1, `admin-functional` :56 E-B1 (mobile-360), `notifications-inbox` :16 and :28 (mobile-360), `ordering-a11y-responsive` :133, `xct-operations` :76. **Another track is fixing these now.** The list in force is the one at the slice's base commit; it may only shrink. No slice may depend on a baseline case failing or passing. A baseline case that now passes is not a finding; any other failure blocks |
| Amended | (a) 2026-11-07: OQ-1…OQ-19 take their recommended defaults as an integrator decision under the owner's 2026-10-31 delegation (the owner asked on 2026-11-07 for subscriptions to be completed). OQ-20 (USER_STORIES.md wording) goes to the owner and is not edited here. Append further rows; never edit in place |
| Amended | (b) 2026-11-07: integrator decision, under the owner's 2026-10-31 delegation, on the S0 ARCHITECTURE gate findings ([record](../gates/HO-P6-SUBSCRIPTIONS-S0-ARCHITECTURE.md)). (1) One address book: `mocks/handlers/areas/accounts.ts` (otherwise §14-forbidden) gains exactly one read-only export, `findCustomerAddress(customerId, addressId)`, and seeds "Home" (default) and "Office" into the signed-in customer's book; the subscriptions store reads it, its own address copy is deleted, and a missing address reports `deliveryAddressMissing: true` as the server does (SubscriptionViews.cs:93-102). The four other seeded subscribers have no account in the accounts mock, so their Home addresses sit in a private seed-only table in `accounts.ts`, read through the same export. S1's handlers register nothing. (2) The shop mock store key (`shop/store.ts`) is bumped to `__amargram_shop_mock_db__v3` (§11.1.5's "both store keys" is made true). (3) The ordering store key prefix is `__amargram_` (no PurrCare leftovers). (4) One subscribable list: `shop/fixtures.ts` owns `SUBSCRIBABLE_PRODUCT_NUMBERS`; `subscriptions/fixtures.ts` derives `SUBSCRIBABLE_SKU_IDS` from it (the reverse import would be circular). (5) `formatCommerceInstant` goes through `formatInZone`. (6) File:line added to the `SubscriptionPendingStatusChange` citation. (7) Clarifications to §13: its `docs/decisions.md` means `web/docs/decisions.md`, and the S0 branch is `feat/p6-s0-contract` (not `feat/p6-s0-subscriptions-contract`). Append further rows; never edit in place |

## 2. Objective

The subscription backend has been merged since `6c5c89c`. No customer can reach it yet, and staff have no screen for it. This pass builds the screens that use it.

**Customers** can start a repeat delivery from a product page. They see their subscriptions in the account area and keep control of each one: change quantity, interval, delivery and payment method, skip one delivery, pause, resume, cancel, or withdraw a scheduled change. Each action is confirmed and answered with the server's own sentence, which names the delivery it affects. A reminder's skip link opens a confirmation for exactly that delivery and never acts on its own.

**Staff** get a Subscriptions list with filters kept in the address, a CSV export, the unpaid worklist (US-SUB-06), and a detail page where a shop manager can restart a suspended subscription or cancel one with a reason. The back office shows subscriptions where staff already work: a product's "Can be subscribed to" switch, a Subscriptions tab on the customer profile, the dashboard's "Subscription orders due tomorrow", and a Subscription option in the orders channel filter.

Four rules govern everything here. They are HO-SUB-002's, recorded for the first time in §9.

1. **The server owns the schedule (ADR-FE-110).** No screen adds weeks to a date, compares a date with today, or predicts the following delivery. Actions come from `allowedActions` and `allowedStaffActions`. Lock wording comes from `isLocked`, and the effect of a change comes from `message`.
2. **A link never acts on load (ADR-FE-111).**
3. **Dates are dates (ADR-FE-112).** `yyyy-MM-dd` is never passed to `new Date()`.
4. **Money and the estimate are the server's (ADR-FE-113, ADR-317).** There is no payment capture, and the browser does no arithmetic. Before a subscription exists, no estimate total is shown (OQ-3).

The work is four slices. **S0**, the shared contract, labels, mock store and ADRs, lands first and alone. **S1** (customer) and **S2** (staff subscriptions) follow in parallel. **S3** (back-office touch points) comes last. No file is owned by two slices (§13).

## 3. In scope

### 3.1 The slices

| Slice | Name | Delivers | Stories | Starts |
|---|---|---|---|---|
| **S0** | Shared contract, labels and mock store | `lib/api/subscriptions.ts` and `lib/api/staff-subscriptions.ts` (types and clients for every C- and T- endpoint, role constants), `lib/subscriptions/**` (labels, copy, date helpers, error mapper, query keys), the subscriptions mock store with a faithful port of `SubscriptionSchedule.cs`, seeds (subscriptions, `isSubscribable` products, subscription-channel orders), the e2e mock controls, ADRs (§9), guard and parity tests | all (foundation) | First, alone |
| **S1** | Customer | Product page Subscribe offer (G2), `/portal/subscriptions` list, `/portal/subscriptions/new/[skuId]`, `/portal/subscriptions/[subscriptionId]` with change, skip, pause, resume, cancel, withdraw, history, suspension banner and the skip-link confirmation; account-menu entry; the overview "Next delivery" card (OQ-8); customer mock handlers | US-SUB-01, 02, 03, 04 (display), 06 (customer side) | Batch 1, after S0 merges |
| **S2** | Staff subscriptions | `/staff/subscriptions` (All), `/staff/subscriptions/unpaid`, `/staff/subscriptions/[subscriptionId]` with reinstate and cancel, CSV export, staff nav entry; staff mock handlers | US-SUB-05 (adapted), US-SUB-06 | Batch 1, with S1 |
| **S3** | Back-office touch points | Product editor "Can be subscribed to" (BG-15), Customers profile Subscriptions tab, Dashboard "Subscription orders due tomorrow" (and suspended count, OQ-12), Orders channel option "Subscription" (OQ-11); touch-point mock handlers; the shop staff mock's `isSubscribable` | US-SUB-01 (offer control), US-SUB-06 (staff awareness) | Batch 2, after batch 1 merges |

### 3.2 Decisions already taken (carried over)

| Decision | Source |
|---|---|
| Money is shown **as the server sends it**, through `formatMoney` / `Amount` / `AmountCell`. No `+ - * /`, `Number(`, `parseFloat(` on a money-named or percent-named value | ADR-317, ADR-FE-080, ADR-FE-092, HO-P5 §4.3 |
| Tokens only: no hex, `rgb(`, `hsl(` or arbitrary colour values; no new tokens; no `globals.css` edit | HO-P2 §2, HO-P3 U9, HO-P4 U41 |
| WCAG 2.1 AA; 360 px floor; **44 px** targets; status never by colour alone; tabs and link navs as HO-P4 §7 UI-6 | HO-P3 §7.1, HO-P4 §7 |
| Design content without data is omitted, never faked or stubbed | ADR-FE-177, ADR-FE-184 |
| A screen reads each context's own endpoint; it never joins N reads to compute a missing field | `.ai/read-side-pattern.md`, HO-P4 §6 |
| Only `lib/hooks/` calls `useQuery` / `useMutation`; `components/{account,admin,auth,customer}/**` import no hooks | `web/eslint.config.mjs` |
| **Mocks mirror the server's validation and its body shapes** (ADR-FE-185), including the `{ error }` 400s, the 404-for-someone-else's, and the role 403s | HO-P5 ADR-FE-185 |
| Presentation-only permission hints use role arrays that mirror `ActionRoles` (pattern: `RIDER_MANAGE_ROLES`, `lib/api/staff-orders.ts:417`, `useCanManageRiders`, `lib/hooks/useStaffOrders.ts:99-102`); the server's 403 has the last word | HO-P5 §11.3.9, HO-RPT-002 `NavItem.roles` (`nav/types.ts:43-49`) |
| Customer copy says "basket"; customer screens use the hearth customer layer (`components/hearth/**`, import-only) | ADR-FE-173, ADR-FE-174 |
| Back-office selection and filters live in the URL; list + detail falls back to the detail route below 1024 px | ADR-FE-183 |
| The customer guard returns to the full path **including the query string** after sign-in (`components/portal/CustomerSessionGuard.tsx:41-49`), checked by `sanitizeNextPath` (`lib/validation/nextPath.ts:21-40`) | HO-ACC-002, later hardening |
| Branch-scoped file downloads go through `downloadBillingFile` (`lib/api/billing-staff.ts:560-570`), the one XHR download path | HO-P5 S2 (`downloadOrderingFile`) |
| E2E: ≤ 2 workers, a fresh `next dev` per chunk, `E2E_KEEP_ROUTES=1` (set by `playwright.config.ts`'s `webServer`; set it yourself when you start your own server) | HO-P5 §16, Amended (au) |

## 4. Out of scope

### 4.1 Deferred elsewhere

| Item | Where it goes |
|---|---|
| Subscribe offer for **signed-out** visitors | Needs `isSubscribable` on the public product read (BG-S1). Until then the offer is signed-in only (OQ-1) |
| Customers list "Subscriber" filter | `GET /api/staff/customers/browse` takes `search`, `tag`, `sort` only (`StaffCustomersController.cs:54-57`). Backend gap BG-S2 (OQ-10) |
| A multi-item "staples box" (Home band, store `MySubscriptions` layout, overview "Next staples box" with several items) | One SKU per subscription in `src/`. BG-S7 (OQ-9). The overview card is built for a single subscription (OQ-8) |
| An estimate total on the Subscribe form before the subscription exists | No server figure; computing it is forbidden. BG-S4 (OQ-3) |
| The subscriber discount on the **invoice** (US-SUB-04 AC) | Orders and Billing render the labelled order discount (ADR-242). Evidenced on the real API only (A14) |
| Configuring the discount (US-SUB-04) | The existing settings screen renders the registry (`SettingDefinitions.Subscriptions.cs`). No change. Real API only (A14) |
| Generating orders, reserving stock, sending the pre-charge notice and the payment reminder (US-SUB-01 AC2, US-SUB-03, US-SUB-06 AC1) | Server worker (ADR-241, ADR-245, ADR-246). This pass shows their results (history, payment state, the skip link) |
| The reporting "Subscription health" figures (`docs/design/reporting/DashboardAdmin.dc.html:186-187`) | HO-RPT-* follow-up; no endpoint here |

### 4.2 Excluded and not changing

Every route and component not named in §11/§12 keeps its HO-P3/HO-P4/HO-P5 layout and behaviour. In particular: checkout, the basket, the customer order page (the history links to it unchanged), the inbox, the settings screen, reports, billing.

### 4.3 Forbidden shapes

- **Client-side schedule logic**: adding days or weeks to a date, comparing a date to "today" to decide lock, skip or wording, guessing the following delivery, filtering `allowedActions` by status. Use the server field (ADR-FE-110, §20.4).
- **`new Date('yyyy-MM-dd')`** or any local-time parse of a subscription date; `addDaysIso`, `date-fns` `add*` / `sub*` imported into subscription code (ADR-FE-112).
- **Any money or percent arithmetic** in the browser (subtotal, discount amount, total, "save ৳X"). A percent string may be trimmed for display (`"10.00"` → `10`), string-only, with no arithmetic.
- **Any payment capture**: card number, expiry, CVV, "save card", wallet, mandate, auto-charge wording (ADR-238, C-5, `tests/guards/no-card-ui.test.ts`).
- A mutation on page load, including from `?skip=` (ADR-FE-111).
- Subscription form values, notes or reasons in `localStorage`, `sessionStorage` or the URL. Choices on the staff list are filters, and they do belong in the URL.
- A `lib/api` field, endpoint or enum value the server does not send or accept. Every type field cites its view model or request contract by file:line in a comment (ADR-FE-185).
- A mock field the real API does not send, a mock that accepts a request the server refuses, or one that refuses what the server accepts.
- Colour literals of any kind; new tokens; `globals.css` edits; new npm dependencies (no date-picker, calendar or date library: native `<input type="date">`).
- Any change under `src/` or `tests/` (.NET).

## 5. Prerequisites

| Required | State |
|---|---|
| Subscriptions backend merged (HO-SUB-001 as built, BG-15) | ✅ `6c5c89c`, verified in the Contract inventory against `c176fd8` |
| HO-P5 merged, five gates per slice, integration E18/E19 | ✅ ([integration record](../gates/HO-P5-WIRING-INTEGRATION.md)) |
| HO-P5 follow-up layout merged | ✅ `0df78db` |
| `web/` green at `c176fd8` apart from the baseline in §1 | ✅ per the HO-P5 integration record and the follow-up commits since |
| Owner answers to OQ-1 … OQ-20 | ❌ Open. Each slice builds to the recommended default and records it; a changed answer becomes a §1 Amended row |
| S0 merged before S1–S3 branch | ❌ (this phase's first step) |
| The baseline-fix track | In progress elsewhere. **Not a prerequisite**; do not wait for it and do not depend on it (§1) |

## 6. Governing architecture documents

This pass changes no backend code. The backend documents still bind it: they define what the screens may read and send, and the ARCHITECTURE gate checks that no slice works around them in the browser.

| Document | What you need from it |
|---|---|
| [`.ai/architecture.md`](../../.ai/architecture.md) | The layering the API enforces. The UI sends commands and reads view models; it never stands in for a server rule (the schedule, the cut-off, permissions, money, servability) |
| [`.ai/cqrs.md`](../../.ai/cqrs.md) | Reads come from query endpoints (C1–C5, T1–T3, T5, T6, T9); writes go through command endpoints (C6–C12, T7, T8). A command's response is a read only where the endpoint says so: the customer change result carries `subscription`; the staff writes return the **plain** `SubscriptionViewModel`, not the staff detail, so the staff detail is re-read (ADR-FE-194) |
| [`.ai/read-side-pattern.md`](../../.ai/read-side-pattern.md) | View models are fixed shapes. `allowedActions`, `isLocked`, `skippableCycleOn`, `followingDeliveryOn` and `estimate` are computed by the same functions the aggregate uses (`SubscriptionViews.cs:16-21`), so a missing figure is a backend gap, never a client computation |
| [`.ai/bounded-contexts.md`](../../.ai/bounded-contexts.md) | Subscriptions live in the Order context (ADR-237). Payment availability is Orders' (C2). Addresses are Accounts'. Branches and phones are Administration's (P4). The product flag is Shop's (P1, P2). Each screen calls each owner |
| [`.ai/namespace-conventions.md`](../../.ai/namespace-conventions.md) | Not applicable to `web/` naming; cited because the ARCHITECTURE gate checks no backend file is touched |
| [`.ai/decisions/adr.md`](../../.ai/decisions/adr.md) | ADR-237 … 249 (line 4701: no auto-charge 238, schedule model 239, price at generation 242, mirrored order outcomes 243, notice 245, reminder 246, authorization 248); ADR-317 (money); ADR-341 (per-area partial registries: this area's mocks, hooks and nav stay in their own files) |
| [`.ai/enumeration-pattern.md`](../../.ai/enumeration-pattern.md) | Why enumerations travel as display names and why the web unions list exactly the server's values (`SubscriptionStatus` is the pattern's own four-state example) |
| [`web/README.md`](../../web/README.md) | Folder layout, `fetch` only in `lib/api/client.ts`, hooks only in `lib/hooks`, "Adding a functional area" (`nav/areas/subscriptions.ts`, `mocks/handlers/areas/subscriptions.ts`) |
| [`web/docs/decisions.md`](../../web/docs/decisions.md) | ADR-FE-080/090/092/093 (money, quote truth, `allowedActions`), FE-173 … 192 (HO-P3, HO-P4, HO-P5) |
| [HO-P5](HO-P5-WIRING.md) §3.2, §4.3, §14, §17, §19, §20 | The process, guards and BLOCKED rules this pass inherits |
| [HO-SUB-002](HO-SUB-002.md) §2, §7, §8.4–8.5, §11 | Intent and copy, adapted here |

## 7. SRS UI requirements as build rules

| Req | Rule | Where enforced |
|---|---|---|
| UI-1, NFR-CMP-2 | Every new screen and dialog works at **360 px** with no sideways scroll and 44 px targets. The Subscribe form is one column. The detail stacks its panels. History and staff tables become cards below 768 px (`ResponsiveTable` or `DataTable`'s card mode). Each slice ships a dedicated `*-360.spec.ts` covering **every** new screen and every dialog it adds | E5, E10, E14 |
| UI-3 | Every state change confirms and names what is affected: skip ("Skip the delivery on Tue 20 Oct?"), pause, cancel, withdraw, staff reinstate ("Restart {customer}'s subscription?"), staff cancel. The wording after the cut-off ("Your delivery on {nextDeliveryOn} is already being prepared and will still arrive…") is chosen **only** from `isLocked` | U17, U19–U21, U31, U32 |
| UI-4 | Staff list: `status`, `suspensionReason`, `paymentMethod`, `q`, `sort`, `page` in the URL; export through T4 with the same filters | U27, U28 |
| UI-5 | No polling on subscription screens. Every action re-evaluates the lock on the server and the answer states the real outcome, so a page left open across the cut-off cannot mislead | Code review |
| UI-6, NFR-USA-6 | Status, payment state and suspension reason are words (with an icon), never colour alone; every dialog is focus-trapped with its heading announced; the change `message` is read from a `role="status"` region; date fields are native `<input type="date">` with a visible label and the allowed range in words; tabs vs link navs as HO-P4 §7 UI-6 (customer Current/Cancelled = state tabs; staff All/Unpaid = link nav) | axe in each slice's a11y spec; U-tests |
| NFR-USA-4 | Every subscription code maps to plain language (§10.3); the server's `errorMessage` is preferred when present; `errorCode` never appears in the DOM | U7, each slice's error cases |
| NFR-USA-5 | The Subscribe form and the change dialog keep every value across a validation error, a 409, and the inline "Add a new address" (ADR-FE-196); an open dialog with edits uses `UnsavedChangesGuard` | U13, U14, U18 |
| NFR-PRF-1 | `/shop/products/[slug]` stays a Server Component; the Subscribe offer is part of the existing client island and reads C1 **after** render, only for a signed-in customer; it never blocks the page | U8, E2 |
| C-5 / ADR-238 | No card UI anywhere (§4.3) | `tests/guards/no-card-ui.test.ts` (whole UI), U6 |
| C-6 / ADR-317 | §4.3 money bullet | `tests/guards/no-money-arithmetic.test.ts` does **not** scan the new folders (`tests/guards/ordering-scope.ts:12-58`), so S0's U6 scans them |

## 8. Frontend architecture

### 8.1 Route map (additions)

```
web/app/
  (portal)/portal/subscriptions/page.tsx                    My subscriptions (Current | Cancelled)      S1
  (portal)/portal/subscriptions/new/[skuId]/page.tsx        Subscribe                                   S1
  (portal)/portal/subscriptions/[subscriptionId]/page.tsx   Detail; ?skip=yyyy-MM-dd opens a confirm    S1
  (staff)/staff/subscriptions/page.tsx                      All (filters in the URL, export)            S2
  (staff)/staff/subscriptions/unpaid/page.tsx               Unpaid worklist                             S2
  (staff)/staff/subscriptions/[subscriptionId]/page.tsx     Staff detail, reinstate, cancel             S2
```

The routes match the notification links (P5). `new` and `unpaid` are static segments, so they win over the dynamic `[subscriptionId]`; ids are GUIDs and can never be `new` or `unpaid`. The SKU is a path segment (ADR-FE-109). The query string now survives sign-in too, but a path segment has no parameter to lose.

### 8.2 Layering

`lib/api/subscriptions.ts` (customer) and `lib/api/staff-subscriptions.ts` (staff) mirror the server. Every field cites its view model line. `lib/subscriptions/**` holds pure helpers: labels, copy, date formatting, the error mapper and query keys. `lib/hooks/useSubscriptions.ts` (S1), `lib/hooks/useStaffSubscriptions.ts` (S2) and `lib/hooks/useSubscriptionSummaries.ts` (S3) own the queries and mutations. Pages call hooks and pass props; components never fetch. `components/customer/**` stays hook-free: S3 builds the tab's panel in `components/back-office-subscriptions/` and passes it into `CustomerProfile` through a new optional slot.

### 8.3 State and query keys (`lib/subscriptions/keys.ts`, S0)

| Data | Key | Notes |
|---|---|---|
| Options (C1) | `['me','subscriptions','options', skuId]` | `staleTime` 60 s |
| Payment methods (C2) | `['me','subscriptions','payment-methods', skuId, quantity, fulfilment, addressOrBranchId]` | Not requested until an address or branch is chosen (the server answers `[]` anyway); quantity changes debounced 300 ms |
| My list (C3) | `['me','subscriptions','list', status, page]` | `status` = `live` / `cancelled`; tab in component state, page in the URL (`?page=`) |
| My detail (C4) | `['me','subscriptions','detail', id]` | with `cycles` |
| My cycles (C5) | `['me','subscriptions','cycles', id, page]` | "Show more" pages after the 12 the detail carries |
| Staff list (T1) | `['staff','subscriptions','list', filters]` | filters from the URL |
| Unpaid (T2) | `['staff','subscriptions','unpaid', page]` | |
| Staff detail (T5) | `['staff','subscriptions','detail', id]` | |
| Staff cycles (T6) | `['staff','subscriptions','cycles', id, page]` | |
| Due tomorrow (T3) | `['staff','subscriptions','due-tomorrow']` | Used by slice S3. No polling of its own; refreshes on mount and window focus |
| Customer summary (T9) | `['staff','subscriptions','customer', customerId]` | Used by slice S3 |

**Cache rule (ADR-FE-194).** A customer change result's `subscription` replaces the `subscription` part of the detail cache (its `cycles` are kept). The hook then invalidates `['me','subscriptions','list']`, the cycles and the options. Create (201) seeds the detail key with `cycles: []` and invalidates the list. A staff reinstate or cancel invalidates the whole `['staff','subscriptions']` prefix, which includes due-tomorrow and the customer summary. The detail is re-read rather than patched, because T7 and T8 return the plain view without the staff fields.

The last change message lives in the detail page's component state and is shown in a `role="status"` region until the next action.

### 8.4 Dates, instants and money (`lib/subscriptions/dates.ts`, S0)

- `formatCycleDate('2026-10-20')` → `"Tue 20 Oct"` (the server's own `ddd d MMM`, `SubscriptionMessages.cs:26`); `formatCycleDateLong` → `"Tuesday 20 October 2026"`. Both split the string and format `Date.UTC(y, m-1, d)` with `timeZone: 'UTC'`, the same technique as `lib/format/time.ts:121-131` (`formatDateOnly`, import-only, which stays as it is).
- `formatCommerceInstant(instant, commerceTimeZoneId)` → `"Sun 18 Oct, 00:00 (Asia/Dhaka)"` via `formatInZone` (`lib/format/time.ts:52`), zone always named (ADR-FE-014). Used for `changeCutoffOn`, `paymentExpiresOn`, `cancelledOn`, `suspendedOn`, `reinstatedOn`.
- `formatPercentText("10.00")` → `"10"`, `isZeroPercent("0.00")` → `true`. These use string patterns only (`/^0+(\.0+)?$/`, trailing-zero trim) and no arithmetic.
- Money: `formatMoney` / `Amount` / `AmountCell` of the server's `Money`. `estimate.discountAmount` is shown with a leading "−" as text.

### 8.5 Errors (`lib/subscriptions/errors.ts`, S0)

`describeSubscriptionError(error)` and `subscriptionFieldErrors(error)`:
- `ApiValidationError` with `errors[]`: per-field messages by `propertyName` (case-insensitive: `Quantity`, `IntervalWeeks`, `Fulfilment`, `DeliveryAddressId`, `PickupBranchId`, `PaymentMethod`, `FirstDeliveryOn`, `CycleOn`, `Reason`, `Note`, `SkuId`), server text preferred, the §10.3 map as fallback.
- `ApiValidationError` whose `response.errors` is **not an array** (the controller's `{ error }`): "We couldn't save that. Please check your choices and try again." The UI never sends a bad enum, so seeing this means a client defect; it must not crash `describeApiError` (`lib/api/errors.ts:121-133` reads `errors.length`).
- `ApiNotFoundError`: "We couldn't find that subscription." (or "that product" on the Subscribe page).
- `ApiConflictError`: "This subscription changed in another window. We've loaded the latest."
- `ApiForbiddenError`: the existing `describeForbidden`.
- `lib/api/errors.ts` is **not** edited (§14). The map is passed to `describeApiError(error, SUBSCRIPTION_CODE_MESSAGES)` where a generic sentence is needed.

### 8.6 Copy (`lib/subscriptions/copy.ts`, S0)

One module so every screen says the same thing:
- **How paying works**: "No card needed. Each delivery creates an order that you pay for by {payment method text}." Method texts are the server's (`SubscriptionMessages.cs:54-57`): "Cash on delivery", "Bank transfer", "Pay at the shop on collection".
- **Cut-off**: "Changes made before {changeCutoffOn} apply to the delivery on {nextDeliveryOn}. After that, they start with the next one."
- **Locked**: "Your delivery on {nextDeliveryOn} is already being prepared. Changes now start with the delivery on {followingDeliveryOn}."
- **Reminder**: "We'll remind you {preChargeNoticeDays} days before each delivery."
- **Estimate note**: the server's `estimate.note` when present; on the Subscribe form the same sentence as the constant `SubscriptionMessages.EstimateNote` (`SubscriptionMessages.cs:23`) plus "Each order is priced on the day it is placed." (ADR-242).
- **"Next delivery on {date}"** labels `nextDeliveryOn` (OQ-4), with "The order is placed on this date." as its help text (ADR-239).

## 9. ADRs to record during this build

S0 appends these to `web/docs/decisions.md` in its first commit.

**ADR-FE-109 … 114** are HO-SUB-002's reserved numbers ([`README.md`](README.md#adr-numbering) row "ADR-FE-109 … ADR-FE-118, `HO-SUB-002` (109–114 used)"). They were written in that handover but **never recorded** in `decisions.md`, because HO-SUB-002 was never built. They are recorded here once, adapted. **ADR-FE-193 … 197** are new, starting at the next free number (README line 124). The integrator updates the README table ("109–114 recorded by HO-P6"; a new row "ADR-FE-193 … ADR-FE-202 | `HO-P6-SUBSCRIPTIONS` (193–197 used)"). This handover does not edit the README.

| ADR | Decision | Amends |
|---|---|---|
| ADR-FE-109 | Customer subscriptions are routes under `/portal/subscriptions` (list, `new/[skuId]`, `[subscriptionId]`), matching the server's notification links (`NotificationLinkBuilder.cs:23-28`). Subscribing is one page, not a stepper; the SKU is a path segment. The catalogue entry is the product page's Subscribe offer (ADR-FE-195) | HO-SUB-002 ADR-FE-109 (the HO-SHP-002 product-page assumption is replaced by today's `ProductPurchase`) |
| ADR-FE-110 | **The server owns the schedule.** Actions render only from `allowedActions` / `allowedStaffActions`; lock wording only from `isLocked` / `changeCutoffOn` / `followingDeliveryOn`; the effect of a change only from `message` and `appliesFromCycleOn`. The client never adds days, compares a date to today to decide anything, or predicts a delivery | unchanged from HO-SUB-002 |
| ADR-FE-111 | The reminder's **skip link** `?skip=yyyy-MM-dd` opens a confirmation for exactly that date when it equals `skippableCycleOn`; otherwise it explains "That delivery can no longer be skipped." and, when `skippableCycleOn` is set, offers "Skip the delivery on {date} instead". Nothing mutates on load; the parameter is removed with `router.replace` after it is read. The query string survives sign-in (`CustomerSessionGuard.tsx:41-49`), so a signed-out click still lands on the confirmation | HO-SUB-002 ADR-FE-111 (the "parameter lost at sign-in" caveat no longer applies) |
| ADR-FE-112 | Subscription dates are date-only strings, formatted by `lib/subscriptions/dates.ts` with UTC arithmetic for layout only; never `new Date('yyyy-MM-dd')`. Instants use `formatInZone` with `commerceTimeZoneId`, zone named | unchanged |
| ADR-FE-113 | **No payment capture anywhere.** The payment method is a stated intention with the §8.6 copy; unavailable methods stay in the list, disabled, with Orders' reason as text. **No estimate is computed in the browser**: before creation the form shows the unit price, the discount rate as text and the note; the server's `estimate` appears from the detail onwards (OQ-3) | HO-SUB-002 ADR-FE-113 and its §11.1 "calculated locally for display" (withdrawn: ADR-317, HO-P5 §4.3) |
| ADR-FE-114 | Staff subscription lists keep their filters in the URL, sort and page on the server, and export through `export.csv` with the same filters via `downloadBillingFile`. A 413 is shown as the server's sentence. The client never builds CSV | HO-SUB-002 ADR-FE-114 (download path named) |
| ADR-FE-193 | **The subscriptions mock is the server's rules, ported.** One store (`mocks/handlers/subscriptions/store.ts`) and one port of `SubscriptionSchedule.cs` (`schedule.ts`: `isLocked`, `followingCycleOn`, `skippableCycleOn`, `allowedActions`, every change function and `describe` with the server's exact sentences). The mock's clock is real time in `Asia/Dhaka` with the cut-off setting; seeds are relative to today. The mock keeps both 400 shapes. Its settings are fixed constants mirroring `SettingDefinitions.Subscriptions.cs`, except the discount, which is seeded at `"10.00"` (OQ-17). The mock may do date arithmetic: it is the server | ADR-FE-185 (applies it to a stateful rule set) |
| ADR-FE-194 | Cache rule of §8.3: the customer change result replaces the detail's `subscription`; staff writes re-read the staff detail and invalidate `['staff','subscriptions']` | ADR-FE-093 |
| ADR-FE-195 | **Product page Subscribe offer**: shown only to a signed-in customer, for the selected SKU, from C1, under the purchase row. "Subscribe & save {n}%" when the discount is not zero, else "Subscribe"; "You already subscribe to this" with a "Manage" link when `existingSubscriptionId` is set; nothing when not subscribable or while loading. Nothing for a signed-out visitor (BG-S1, OQ-1) | HO-SUB-002 OQ-1 |
| ADR-FE-196 | **Adding an address while subscribing is inline** with the shared `AddressForm` (`components/account/AddressForm.tsx`, import-only), as checkout does (`components/checkout/DeliverToSection.tsx:21`); the new address is selected. No detour, no `sessionStorage` | HO-SUB-002 §8.3 (the storage detour is withdrawn) |
| ADR-FE-197 | **Back-office touch points read their own subscription endpoint** (T3, T9) and degrade silently: a 403 or a failed read hides the tab or row, never shows an error banner on the host screen. The product flag is sent as the boolean the editor shows, in the same details `PUT` | HO-P5 ADR-FE-184/185 |

**Proposed backend follow-ups** (not decided here; recorded for the owner): BG-S1 … BG-S9 below.

## 10. Dependencies, enumerations and codes

### 10.1 Dependencies

| Dependency | Status |
|---|---|
| npm packages | **None added.** Native date inputs; `lucide-react` icons (`Repeat`, `PauseCircle`, `CalendarX`, …) |
| APIs | The Contract inventory only, plus the existing customer addresses (`lib/api/account.ts:64-80`) and public branches (`lib/api/admin-branches.ts:81-82`) |
| Between slices | S1, S2 and S3 depend on S0 and on nothing from each other at build time. Cross-slice **links** only: S3's customer tab and dashboard rows link to S2's routes; S1's history links to the existing customer order page. S3 runs after batch 1 so its e2e can follow those links |

### 10.2 Enumerations and plain-language labels (`lib/subscriptions/labels.ts`, S0)

| Enumeration (source) | Values → label |
|---|---|
| `SubscriptionStatus` (`Shared/Enums/SubscriptionStatus.cs:6-9`) | Active → "Active"; Paused → "Paused"; Suspended → "Suspended"; Cancelled → "Cancelled" |
| `SubscriptionSuspensionReason` (`SubscriptionSuspensionReason.cs:9-10`) | UnpaidCycles → staff "Unpaid orders", customer banner "This subscription was paused after unpaid orders. Please contact the shop to restart it." (the server's sentence without the count, `SubscriptionMessages.cs:36`; BG-S9); ProductUnavailable → staff "Product unavailable", customer "This subscription was paused because the product is no longer available. Please contact the shop." (`:37`) |
| `SubscriptionCancellationReason` (`SubscriptionCancellationReason.cs:9-17`) | Customer choices (OQ-5): NoLongerNeeded "I don't need it any more"; TooMuchStock "I have too much at home"; TastesDidNotSuit "It wasn't to our taste"; TooExpensive "It costs too much"; SwitchingProduct "I'm switching to another product"; Other "Something else". Shown to staff: StaffCancelled "Cancelled by the shop"; CustomerMerged "Customer records merged"; AccountDeleted "Account deleted" |
| `SubscriptionPaymentMethod` (`SubscriptionPaymentMethod.cs:9-11`) | `SubscriptionMessages.cs:54-57` texts |
| `SubscriptionFulfilment` (`SubscriptionFulfilment.cs:6-7`) | Delivery "Deliver to me"; Pickup "Collect from an outlet" |
| Interval | "Every {n} weeks" (`SubscriptionMessages.cs:59`, capitalised) |
| `SubscriptionCycleOutcome` / `FailureReason` | Generated → the order state; Failed → `SubscriptionMessages.FailureReasonText` sentences (`SubscriptionMessages.cs:46-52`), copied verbatim |
| `SubscriptionCycleOrderState` | AwaitingPayment "Awaiting your transfer: pay by {paymentExpiresOn}" (staff: "Awaiting payment"); Confirmed "Confirmed"; Expired "Expired unpaid"; Cancelled "Cancelled"; Delivered "Delivered"; Refused "Refused on delivery" |
| `SubscriptionPendingStatusChange` | Pause → "Pauses after the delivery on {nextDeliveryOn}"; Cancel → "Ends after the delivery on {appliesFromCycleOn}" |
| Allowed actions | ChangeTerms "Change"; Skip "Skip the delivery on {skippableCycleOn}"; Pause "Pause"; Resume "Resume"; Cancel "Cancel subscription"; WithdrawPending "Withdraw scheduled changes"; staff Reinstate "Restart"; staff Cancel "Cancel subscription" |
| Unpaid `group` | Suspended "Suspended"; AtRisk "At risk" |

An unknown value from the server renders "Unknown" (never the raw code) and is a §20.2 report.

### 10.3 Violation codes → fallback text (`SUBSCRIPTION_CODE_MESSAGES`, S0)

`SkuNotSubscribable`, `InvalidSubscriptionQuantity`, `InvalidSubscriptionInterval`, `FulfilmentDetailsInvalid`, `PaymentMethodNotAllowedForFulfilment`, `InvalidFirstDeliveryDate`, `SubscriptionAlreadyExists`, `SubscriptionLimitReached`, `InvalidSubscriptionTransition`, `SubscriptionSuspended`, `SubscriptionCannotBeReinstated`, `ReinstatementReasonRequired`, `NoChangeRequested`, `NoPendingChange`, `CycleNoLongerSkippable`, `SkipAlreadyScheduled`, `CycleNotDue` (`Shared/Constants/BusinessViolationCodes.Subscriptions.cs:11-28`); reused `DeliveryAddressNotFound`, `AddressOutsideServedZones`, `PickupBranchUnavailable`, `PaymentMethodUnavailable`, `DeliveryTaxNotConfigured`, `ServiceLevelUnavailable` (`SubscriptionHandlerSupport.cs:66-91`), `CancellationReasonRequired`, `StaleVersion`, `InvalidPageSize`, `InvalidPageNumber`. Texts are the server's sentences where `SubscriptionMessages.cs` has them; the others are short plain sentences written by S0 and listed in its report.

## 11. Components and screens

"Keep" means existing behaviour and tests carry over. Every new string is plain language. Components stay under ~150 lines each, with distinct loading, empty, error and permission-denied states.

### 11.1 S0 — Shared contract, labels and mock store

| # | Change | Serves |
|---|---|---|
| 11.1.1 | `lib/api/subscriptions.ts`: types for C1–C12 and the views (`SubscriptionView`, `SubscriptionCycle`, `SubscriptionOptions`, `SubscriptionPaymentMethodOption`, `SubscriptionChangeResult`, `CustomerSubscriptionDetail` = view + `cycles`), string-literal unions for every enumeration in §10.2, and `getSubscriptionOptions`, `getSubscriptionPaymentMethods`, `listMySubscriptions`, `getMySubscription`, `getMySubscriptionCycles`, `createSubscription`, `changeSubscriptionTerms`, `skipSubscriptionDelivery`, `pauseSubscription`, `resumeSubscription`, `cancelSubscription`, `withdrawPendingSubscriptionChanges`. Paths and bodies exactly as the Contract inventory | all customer stories |
| 11.1.2 | `lib/api/staff-subscriptions.ts`: T1–T9 types and `listStaffSubscriptions`, `listUnpaidSubscriptions`, `getSubscriptionsDueTomorrow`, `subscriptionsCsvPath(filters)` (no paging params), `getStaffSubscription`, `getStaffSubscriptionCycles`, `reinstateSubscription`, `staffCancelSubscription`, `getCustomerSubscriptionSummary`; `SUBSCRIPTION_VIEW_ROLES`, `SUBSCRIPTION_MANAGE_ROLES`, `SUBSCRIPTION_EXPORT_ROLES` mirroring `ActionRoles.Subscriptions.cs:12-14` | US-SUB-05/06 |
| 11.1.3 | `lib/subscriptions/{labels,copy,dates,errors,keys}.ts` per §8.3–§8.6, §10.2–§10.3 | all |
| 11.1.4 | Mock: `mocks/handlers/subscriptions/store.ts` (state, persisted under `__amargram_subscriptions_mock_db__v1`, `resetSubscriptionsMockData()`, view builders producing **exactly** the view-model shapes, including the flattened C4 and T5 objects), `schedule.ts` (ADR-FE-193 port), `fixtures.ts` (`subscriptionFixtureIds`, `seedDates()` returning the seeded dates so specs never compute them), `control.ts` (`window.__subscriptionsMock`: `reset`, `lock(id)` / `unlock(id)` by moving the seed's `nextDeliveryOn` across the cut-off, `suspend(id, reason)`, `setDiscount(text)`), `customer.ts`, `staff.ts`, `touchpoints.ts` as **one-line stubs** (`export const …Handlers: HttpHandler[] = []`), and `mocks/handlers/areas/subscriptions.ts` turned into the aggregator that spreads the three arrays and installs the controls (as `mocks/handlers/ordering/index.ts:24` does) | ADR-FE-193 |
| 11.1.5 | Seeds (additive): **signed-in customer** (`accountsFixtureIds.customerId`): Active unlocked with a priced SKU; Active **locked** with pending terms; Paused; Suspended `UnpaidCycles` (two Expired cycles); Suspended `ProductUnavailable`; Cancelled (reason TooMuchStock); one Active with `deliveryAddressMissing`; one Active whose `lastCycle` is `AwaitingPayment` with `paymentExpiresOn`; cycles covering every outcome, order state and failure reason. **Other customers** (existing accounts-mock ids): ≥ 3 Active, 1 AtRisk (one Expired cycle), 1 Suspended `UnpaidCycles`, 1 Paused, 1 Cancelled; ≥ 1 Active with `nextDeliveryOn` = tomorrow (due-tomorrow ≥ 1). `mocks/handlers/shop/fixtures.ts`: `MockProduct.isSubscribable` (default `false`); at least three food products `true` (one with two SKUs), the rest unchanged. `mocks/handlers/ordering/store.ts`: `DbOrder.channel` widened to `'Online' \| 'Counter' \| 'Subscription'`; one subscription-channel order per seeded `Generated` cycle (AwaitingPayment bank transfer, Delivered, Cancelled-after-expiry) with the cycle's `orderId` / `orderNumber`, for the signed-in customer and one other. Existing ids, statuses and amounts unchanged; both store keys bumped | US-SUB-01 AC2, 06 |
| 11.1.6 | `web/docs/decisions.md`: ADR-FE-109 … 114 and 193 … 197 (§9) | — |
| 11.1.7 | Tests U1–U7 in `tests/unit/subscriptions/**` | — |

### 11.2 S1 — Customer (store front and account)

| # | Screen | Change | Story · design |
|---|---|---|---|
| 11.2.1 | lib | `lib/hooks/useSubscriptions.ts`: `useSubscriptionOptions(skuId, enabled)`, `useSubscriptionPaymentMethods(…)` (debounced quantity), `useMySubscriptions(status, page)`, `useMySubscription(id)`, `useMySubscriptionCycles(id, page)`, `useCreateSubscription`, `useChangeSubscriptionTerms`, `useSkipSubscriptionDelivery`, `usePauseSubscription`, `useResumeSubscription`, `useCancelSubscription`, `useWithdrawPendingSubscriptionChanges`, each applying ADR-FE-194; `useOutletContacts()` reusing the `['public','branches']` key (`lib/hooks/usePortalDashboard.ts:27-34` pattern) | — |
| 11.2.2 | Product page | `components/product/BuyBox.tsx` gains an optional `subscribe?: ReactNode` slot rendered under the actions row (absent = today's output unchanged). `app/(shop)/_components/ProductPurchase.tsx` passes `<SubscribeOffer skuId={sku.skuId} />` only when `signedIn` and the SKU has a price. `components/subscriptions/SubscribeOffer.tsx` per ADR-FE-195; a variant change re-reads C1 for the new SKU; the link is a 44 px secondary button to `/portal/subscriptions/new/{skuId}` | US-SUB-01 · `SubscribeUnavailable.dc.html` (three button states) |
| 11.2.3 | Subscribe | `/portal/subscriptions/new/[skuId]` → `SubscribeForm`, one column, sections in order: **Product** (image, name, variant, unit price `formatMoney`; `subscribable: false` → the server's `notSubscribableReason` and a link back to the shop, no form; `existingSubscriptionId` → "You already subscribe to this." + link; C1 404 → "We couldn't find that product."). **Per delivery** (number input with − / + buttons, 1…`maxQuantity`, the range in words). **How often** (radio cards from `allowedIntervalWeeks`). **Delivery or pickup** (radio cards). Delivery: the address book from `getMyAddresses` (default preselected) plus "Add a new address" inline (ADR-FE-196). Pickup: outlets from P4 with address (OQ-7). **How you'll pay for each order**: radio cards from C2 for the chosen address or branch; unavailable ones stay, disabled, with `unavailableReason` under them (`aria-describedby`); the §8.6 "How paying works" note. **First delivery**: `<input type="date">` with `min`/`max` from C1, default `earliestFirstDeliveryOn`, helper "Choose a date from {formatCycleDate(earliest)} to {formatCycleDate(latest)}. We'll remind you {n} days before each delivery." **Price**: unit price, "Subscription discount: {n}% off every delivery" when not zero, and the estimate note; **no total** (OQ-3). Submit "Start subscription" → C6 with `firstDeliveryOn` only when changed from the default. 201 → seed the detail cache and navigate to the detail, where an announced alert reads "Subscribed. Your first delivery is on {formatCycleDate(nextDeliveryOn)}." 400 → an error summary plus field errors (§8.5), values kept; `PaymentMethodUnavailable` re-reads C2; `SubscriptionAlreadyExists` links to the existing one (re-read C1 for its id); `SubscriptionLimitReached` is the server sentence. The button is disabled only while in flight, with its busy state announced | US-SUB-01, 04 · `Subscribe.dc.html`, `SubscribePickup.dc.html`, `SubscribeMobile.dc.html` |
| 11.2.4 | My subscriptions | `/portal/subscriptions` → `MySubscriptionsList`: `PageHeader` "My subscriptions" + "Each delivery is a normal order: pay cash on delivery, by bank transfer or at the shop. No card is stored." State tabs **Current ({totalCount})** (`status=live`) and **Cancelled ({totalCount})** (`status=cancelled`), each count from its own query (OQ-19). `SubscriptionCard` (link to detail): image, product · variant, "{qty} × every {n} weeks", status word + icon, "Next delivery on {date}" or why there is none ("Paused: no deliveries until you resume", "Suspended: see why", "Ended on {cancelledOn}"), and **one** warning line where it applies, in this order: suspension; `deliveryAddressMissing` ("Your delivery address was removed. Choose another."); `lastCycle.orderState = AwaitingPayment` ("Waiting for your transfer: pay by {paymentExpiresOn}"); `pending` ("Changes scheduled from {appliesFromCycleOn}"); `product.isAvailable = false` ("This product can't be bought right now"). Empty: "No subscriptions yet. Look for Subscribe on a product page." with a link to `/shop` (`HearthEmpty`). Paged with `?page=` | US-SUB-01, 02, 06 · `MySubscriptions.dc.html`, `MySubscriptionsEmpty.dc.html` |
| 11.2.5 | Detail | `/portal/subscriptions/[subscriptionId]` → `SubscriptionDetail` composed of: `NextDeliveryPanel` (Active: "Next delivery on {date}" + cut-off sentence; `isLocked` → the §8.6 locked sentence with `followingDeliveryOn`; Paused: "Paused: no deliveries until you resume."; Cancelled: "Ended on {cancelledOn}."); `SuspensionBanner` (§10.2 text; UnpaidCycles adds every outlet's name and phone from P4, OQ-14); `PendingChangesPanel` (`pending.terms` as text, `pending.skip`, `pending.statusChange`, each with `appliesFromCycleOn`); `TermsPanel` (quantity, interval, address or branch, payment method; `deliveryAddressMissing` → warning with "Choose another address" opening the change dialog focused on the address field); `EstimatePanel` (server `estimate` as sent: "{quantity} × {unitPrice}", "Subtotal", "Subscription discount −{discountPercent}%", "−{discountAmount}", "Estimated per delivery {estimatedTotal}", `note`; absent when `null`); `SubscriptionActions` (buttons **only** from `allowedActions`, labels per §10.2); `LastChangeAlert` (`role="status"`); `CycleHistory` (date, outcome or order state as text, failure sentence, order number → `/portal/orders/{orderId}`, pay-by; table ≥ 768 px, cards below; "Show more" via C5). 404 → "We couldn't find that subscription." with a link to the list | US-SUB-01 AC1–2, 02, 06 · `SubscriptionDetail*.dc.html`, `SuspensionBanners.dc.html` |
| 11.2.6 | Dialogs | `ChangeTermsDialog` (11.2.3's controls; options and payment methods re-read for the new terms; `PUT` with `version`; 200 → close, show `message`; 409 → stale sentence, re-read, the dialog stays open with the customer's values; `NoChangeRequested` → its sentence); `SkipDialog` ("Skip the delivery on {skippableCycleOn}?" → C8 with that date; `CycleNoLongerSkippable` → the server sentence, re-read); `PauseDialog` (unlocked: "Pause this subscription? No orders are placed until you resume."; locked: "Your delivery on {nextDeliveryOn} is already being prepared and will still arrive. Your subscription pauses after it."); `ResumeDialog` (optional date with `min`/`max` from C1 for `product.skuId`; `SubscriptionSuspended` / `SkuNotSubscribable` → server sentence); `CancelDialog` (reason radios, **required** before sending, §10.2 customer reasons; optional note ≤ 500 with a counter, plain text; locked wording "Your delivery on {nextDeliveryOn} is already being prepared and will still arrive. Your subscription ends after it."); `WithdrawDialog` (lists what will not happen). All focus-trapped, heading announced, 44 px buttons | US-SUB-02 · `ChangeTermsDialog`, `SkipDialogs`, `PauseDialog`, `CancelDialog`, `ResumeAndWithdraw` `.dc.html` |
| 11.2.7 | Skip link | `SkipLinkHandler` on the detail page applies ADR-FE-111 once the detail has loaded, then `router.replace(pathname)`. A malformed `?skip=` is ignored and removed | US-SUB-03 · `SkipDialogs.dc.html` |
| 11.2.8 | Account menu | `components/portal/account-nav.ts`: `{ label: 'Subscriptions', href: '/portal/subscriptions', icon: 'repeat' }` after "My orders"; `PHONE_PILL_ORDER` gains it after `/portal/orders`; `AccountIcon` gains `'repeat'`; the doc comment (`:2-4`) drops "Subscriptions is not added until G2 closes". `components/portal/AccountSidebar.tsx`: map `'repeat'` to lucide `Repeat`, nothing else | ADR-FE-109 · `docs/design/store/Account.dc.html:39` |
| 11.2.9 | Overview | `components/subscriptions/NextDeliveryCard.tsx` mounted by `components/portal/dashboard/PortalDashboard.tsx` in the grid beside `DefaultAddressCard`: reads C3 `status=live&pageSize=1` (the server's order puts the soonest first) and shows the product, "Next delivery on {date}" (or the status sentence when it has none) and "Manage" → detail. Absent when there is none or the read fails (decoration, like `usePortalBranchContacts`). No Skip/Undo on the overview (OQ-8). Update the component's doc comment (`:20`) | G2 · `Account.dc.html:66-71` |
| 11.2.10 | Mocks | `mocks/handlers/subscriptions/customer.ts`: C1–C12 against the S0 store, by the signed-in customer only (another customer's id → 404, no body); both 400 shapes per the Contract inventory; validator then handler order as the server; servability: an address not in the mock address book → `DeliveryAddressNotFound`, a branch not in the public list → `PickupBranchUnavailable`, cash on delivery above the ordering mock's COD ceiling → `PaymentMethodUnavailable` with the same reason text C2 returns; live limit 20; one live subscription per SKU; 409 on a stale `version`; every change through `schedule.ts` with its `message` | ADR-FE-185, 193 |

### 11.3 S2 — Staff subscriptions

| # | Screen | Change | Story · design |
|---|---|---|---|
| 11.3.1 | lib | `lib/hooks/useStaffSubscriptions.ts`: `useStaffSubscriptions(filters)`, `useUnpaidSubscriptions(page)`, `useStaffSubscription(id)`, `useStaffSubscriptionCycles(id, page)`, `useReinstateSubscription`, `useStaffCancelSubscription` (ADR-FE-194), `useExportSubscriptions` (`downloadBillingFile(subscriptionsCsvPath(filters), 'subscriptions.csv')`), `useCanManageSubscriptions()`, `useCanExportSubscriptions()` (role arrays, presentation only; unknown roles = not allowed) | — |
| 11.3.2 | Nav | `nav/areas/subscriptions.ts`: one item `{ label: 'Subscriptions', href: '/staff/subscriptions', icon: 'repeat', audience: 'staff', roles: SUBSCRIPTION_VIEW_ROLES }`. `components/common/staff-nav-groups.ts`: one entry in the Sales group after Customers, `{ href: '/staff/subscriptions', label: 'Subscriptions', match: '/staff/subscriptions' }`. Nothing else in either file | ADR-FE-181 |
| 11.3.3 | List | `/staff/subscriptions`: `PageHeader` "Subscriptions" with **Export CSV** (shown to `SUBSCRIPTION_EXPORT_ROLES`); a link nav **All** / **Unpaid** (`aria-current`); `SearchField` "Customer, mobile or product" → `q`; selects Status, Suspension reason (enabled only when Status is Suspended or empty), Payment method; sort select "Next delivery (soonest)", "Next delivery (latest)", "Status", "Product"; "Clear filters". Table (`DataTable`, URL-driven): Customer (link `/staff/customers/{id}`), Mobile, Product · variant, "{qty} × every {n} weeks", Status pill (word + icon; reason as a second line), Next delivery (`formatCycleDate` or "—"), Payment method, Unpaid streak ("{n} unpaid" when > 0), Last order (number + state). Row → `/staff/subscriptions/{id}`. Export (T4): 413 → "Too many rows to export. Narrow the filters."; 403 → the permission sentence | US-SUB-06 · `StaffSubscriptions.dc.html` |
| 11.3.4 | Unpaid | `/staff/subscriptions/unpaid` (T2): two headed groups from `group` ("Suspended" first, then "At risk"; a group with no rows on the page is omitted). Each row: customer (link), product, "{unpaidStreak} unpaid in a row", and a list of `unpaidCycles` (date, order number → `/staff/orders/{orderId}`, "Pay by {paymentExpiresOn}" when set, state as text), "Open" → detail. Paged | US-SUB-06 AC2 · `StaffUnpaid.dc.html` |
| 11.3.5 | Detail | `/staff/subscriptions/[subscriptionId]` (T5): header (product · variant, status pill); panels read-only: Customer (name, mobile, link), Schedule (next delivery, cut-off, `isLocked` sentence for staff, pending changes as text), Terms, Estimate (as 11.2.5), Records ("Suspended on {suspendedOn}" or "Never: none recorded"; "Restarted on {reinstatedOn}: {reason}" or "Never: none recorded" (the id is not shown, BG-S5); "Cancelled on {cancelledOn}: {reason label}{, note}" or "Not cancelled"), History (all 50 cycles plus "Show more" via T6; order number → `/staff/orders/{orderId}`). Actions **only** from `allowedStaffActions` **and** only for `SUBSCRIPTION_MANAGE_ROLES`; other roles see "Only a shop manager or an administrator can restart or cancel a subscription." A 403 on an action replaces that action with `PermissionDeniedState` (not a toast) | US-SUB-05 (adapted), 06 · `StaffSubscriptionDetail.dc.html`, `StaffDetailReadOnly.dc.html` |
| 11.3.6 | Dialogs | `ReinstateDialog`: "Restart {customer.name}'s subscription to {productName}?"; reason textarea, required (client) and ≤ 500 with a counter; optional first-delivery date with **no** client min/max and the helper "Leave empty to restart from the earliest possible date." (OQ-16); POST T7 → re-read; errors mapped (`ReinstatementReasonRequired` on Reason, `InvalidFirstDeliveryDate` on the date with the server sentence that names the range, `SubscriptionCannotBeReinstated`, `SkuNotSubscribable`). `StaffCancelDialog`: "Cancel {customer.name}'s subscription to {productName}?"; when `isLocked`: "The delivery on {nextDeliveryOn} is already being prepared and will still be placed; the subscription ends after it."; note required, ≤ 500; POST T8 → re-read; `CancellationReasonRequired` on Note | US-SUB-06 · `StaffDialogs.dc.html` |
| 11.3.7 | Mocks | `mocks/handlers/subscriptions/staff.ts`: T1, T2, T4–T8 (T3 and T9 belong to slice S3). Role checks by `getStaffRoleIdsForRequest` (`mocks/handlers/areas/accounts.ts:781`) against the three role arrays → 403; `{ error }` 400s for bad enums; `sort` never 400; `q` over product, customer name and mobile, case-insensitive; export as `text/csv` with the 12 columns and 413 above the cap (`store.ts` exports `MAX_EXPORT_ROWS` = 50 000 and a test-only override, so the mock need not hold 50,001 rows to prove it); unpaid grouping and ordering as the server; reinstate and cancel through `schedule.ts` and the aggregate rules quoted above | ADR-FE-185, 193 |

### 11.4 S3 — Back-office touch points

| # | Screen | Change | Story · design |
|---|---|---|---|
| 11.4.1 | lib | `lib/api/staff-shop.ts`: `StaffProductDetail.isSubscribable: boolean` (`StaffProductDetailViewModel.cs:63`), `UpdateProductDetailsRequest.isSubscribable?: boolean` (`StaffProductRequests.cs:32-33`); replace the "deliberately NOT here" comment (`:261-263`). `lib/hooks/useSubscriptionSummaries.ts`: `useSubscriptionsDueTomorrow()` (T3) and `useCustomerSubscriptionSummary(customerId)` (T9) (403 → `null`, no retry on refusal) | — |
| 11.4.2 | Product editor | `components/staff-shop/ProductDetailsForm.tsx`: in the Organise card after "Listed in shop", a 44 px checkbox **"Can be subscribed to"** with the help text "Customers can start a repeat delivery of any pack size. Turning it off does not cancel existing subscriptions: their next order is not placed and they are suspended." (`ProductAggregate.Subscription.cs:4-7`; OQ-18). Default from `product.isSubscribable`. `app/(staff)/staff/shop/products/[productId]/page.tsx` sends `isSubscribable: values.isSubscribable` in the same `PUT` with `expectedVersion` (next to `:55`). `two-step-save.test.tsx` stays green | BG-15 · `ProductEditor.dc.html:150` |
| 11.4.3 | Customers | `components/customer/CustomerProfile.tsx`: optional `subscriptionsPanel?: ReactNode` prop and a tab **"Subscriptions"** after Orders, offered only when the prop is passed (as `notesPanel`, `:46-55`); the doc comment's "Not built: the Subscriptions tab" (`:21`) is removed. `components/back-office-overview/CustomerProfileView.tsx` passes `<CustomerSubscriptionsPanel … />` only when `useCustomerSubscriptionSummary` succeeded (403 or failure → no tab, ADR-FE-197). `components/back-office-subscriptions/CustomerSubscriptionsPanel.tsx`: each live subscription (product · variant, status pill, "{qty} × every {n} weeks", next delivery or status sentence, payment method) linking `/staff/subscriptions/{id}`; then "{suspendedCount} suspended · {cancelledCount} cancelled" as text; empty: "No current subscriptions." The tab label is "Subscriptions ({live.length})". The "Subscriber" filter is **not** built (BG-S2) | US-SUB-06 · `Customers.dc.html:104, 137`, `CustomerSubscriptionsPanel.dc.html` |
| 11.4.4 | Dashboard | `components/back-office-overview/DashboardAttention.tsx` adds two rows from T3: "Subscription orders due tomorrow" (`tone="neutral"`, `Repeat` icon, `count`, href `/staff/subscriptions?status=Active`) when `count > 0`; "Subscriptions suspended" (`tone="warning"`, `suspendedCount`, href `/staff/subscriptions?status=Suspended`) when `suspendedCount > 0` (OQ-12). The panel is absent only when **all three** sources are refused; the "Checking…" and failure lines account for the third query. The order of the existing rows is unchanged; the subscription rows come last. `app/(staff)/staff/page.tsx`'s comment "Not built: subscriptions due" stays as is (that file is not in scope; the integrator may update it) | BG-15 · `Dashboard.dc.html:163` |
| 11.4.5 | Orders | `components/orders/StaffOrderQueue.tsx`: the Channel select's blank option becomes "Any channel" and gains `<option value="Subscription">Subscription</option>` (`:284-288`). Nothing else changes; the row label stays (`:71`); the doc comment (`:62`) drops "display only, OQ-11" | BG-15 (Subscription channel), OQ-11 |
| 11.4.6 | Mocks | `mocks/handlers/subscriptions/touchpoints.ts`: T3 (count of Active with `nextDeliveryOn` = tomorrow in `Asia/Dhaka`, live and suspended counts) and T9 (`live` sorted as the server, the two counts; unknown customer → empty, 200), both 403 for roles outside `SUBSCRIPTION_VIEW_ROLES`. `mocks/handlers/shop/staff.ts`: detail sends `isSubscribable` from the fixture; `PUT` sets it when the body has a boolean, leaves it when omitted, 400 when it is present and not a boolean (model binding); the change is visible to C1 at once because both read the same product object | ADR-FE-185 |

## 12. Scaffold, config and mocks

| Item | Change |
|---|---|
| `web/package.json`, lock file, `eslint.config.mjs`, `vitest.config.mts`, `playwright.config.ts`, `tsconfig.json`, `next.config.ts` | **None** |
| `web/app/globals.css`, `app/layout.tsx`, `app/providers.tsx`, `app/(portal)/layout.tsx`, `app/(staff)/layout.tsx` | **None** (navigation goes through `account-nav.ts` and the nav registry) |
| `web/lib/**` | Only the files each slice owns in §13. Removing or renaming an existing export is forbidden; widening a type is allowed |
| `web/mocks/**` | Only the files each slice owns. Seeds are additive; existing ids, statuses and amounts stay; each changed store bumps its persisted key |
| `web/nav/**` | `nav/areas/subscriptions.ts` only (S2) |
| `web/docs/decisions.md` | S0 only (§9) |
| `web/tests/contract/mock-vs-real.contract.test.ts` | **Integration step only** (§17.1 step 4). Add the GETs: C1 (`?skuId=` of a subscribable SKU), C2 (with `deliveryAddressId`), C3 (`?status=live`, `?status=cancelled`), C4, C5, T1, T2, T3, T5, T6, T9 (the seeded customer's id). On the real side, `collect()` makes the first product subscribable when none is (staff `GET` the detail, `PUT` it back with `isSubscribable: true`) and starts one subscription for the seeded customer when she has none (C6, Delivery, her address, the first available method from C2), on the scratch database the test already insists on (`:562-575`). The new customer and staff subscription reads join the `LATE` phase. Nothing goes into `KNOWN_DRIFT` to hide a difference. `GET /api/staff/shop/products/{id}` is already listed; its `isSubscribable` drift closes with S3. Run `npm run test:contract` when a scratch API is available; record "not run" otherwise |

## 13. Allowed scope

Paths are under `web/` unless they start with `docs/`. A `**` glob owns everything under it, including new files. **A path appears in exactly one block.** Each slice also owns its own `docs/test-cases/TC-HO-P6-SUBSCRIPTIONS-<slice>.md`, its gate records `docs/gates/HO-P6-SUBSCRIPTIONS-<slice>-<GATE>.md`, and its report `docs/gates/HO-P6-SUBSCRIPTIONS-<slice>-SLICE-REPORT.md`.

```text
# ---------- S0 — Shared contract, labels and mock store (first, alone) ----------
lib/api/subscriptions.ts                                   # new
lib/api/staff-subscriptions.ts                             # new
lib/subscriptions/**                                       # new: labels, copy, dates, errors, keys
mocks/handlers/areas/subscriptions.ts                      # aggregator + controls install
mocks/handlers/subscriptions/store.ts                      # new
mocks/handlers/subscriptions/schedule.ts                   # new
mocks/handlers/subscriptions/fixtures.ts                   # new
mocks/handlers/subscriptions/control.ts                    # new
mocks/handlers/shop/fixtures.ts                            # isSubscribable seeds only
mocks/handlers/ordering/store.ts                           # channel widened + subscription-channel order seeds only
docs/decisions.md                                          # append ADR-FE-109..114, 193..197 only
tests/unit/subscriptions/**                                # new
docs/test-cases/TC-HO-P6-SUBSCRIPTIONS-S0.md
docs/gates/HO-P6-SUBSCRIPTIONS-S0-*.md

# ---------- S1 — Customer ----------
lib/hooks/useSubscriptions.ts                              # new
app/(portal)/portal/subscriptions/**                       # new routes
app/(shop)/_components/ProductPurchase.tsx                 # pass <SubscribeOffer> only
components/product/BuyBox.tsx                              # optional `subscribe` slot only
components/subscriptions/**                                # new
components/portal/account-nav.ts                           # Subscriptions link, pill order, 'repeat' icon type, doc comment
components/portal/AccountSidebar.tsx                       # 'repeat' icon mapping only
components/portal/dashboard/PortalDashboard.tsx            # mount NextDeliveryCard + doc comment only
mocks/handlers/subscriptions/customer.ts                   # S0 creates the empty stub; S1 owns it after
tests/components/subscriptions/**                          # new
tests/components/portal/account-sidebar.test.tsx           # supersede :106 only
tests/components/portal/account-p3.test.tsx                # supersede :170 only
tests/components/portal/dashboard.test.tsx                 # supersede U-A11b :162-167 only
tests/e2e/subscriptions-customer.spec.ts                   # new
tests/e2e/subscriptions-customer-360.spec.ts               # new
tests/e2e/subscriptions-customer-a11y.spec.ts              # new
tests/e2e/subscriptions-customer-real-api.spec.ts          # new; skips without E2E_REAL_API=1
tests/e2e/portal-dashboard.spec.ts                         # supersede E-A2 :29-36 only
docs/test-cases/TC-HO-P6-SUBSCRIPTIONS-S1.md
docs/gates/HO-P6-SUBSCRIPTIONS-S1-*.md

# ---------- S2 — Staff subscriptions ----------
lib/hooks/useStaffSubscriptions.ts                         # new
app/(staff)/staff/subscriptions/**                         # new routes
components/staff-subscriptions/**                          # new
nav/areas/subscriptions.ts                                 # one staff item
components/common/staff-nav-groups.ts                      # one Sales entry only
mocks/handlers/subscriptions/staff.ts                      # S0 creates the empty stub; S2 owns it after
tests/components/staff-subscriptions/**                    # new
tests/unit/staff-nav-groups.test.ts                        # append one case only
tests/e2e/subscriptions-staff.spec.ts                      # new
tests/e2e/subscriptions-staff-360.spec.ts                  # new
tests/e2e/subscriptions-staff-a11y.spec.ts                 # new
tests/e2e/subscriptions-staff-real-api.spec.ts             # new; skips without E2E_REAL_API=1
docs/test-cases/TC-HO-P6-SUBSCRIPTIONS-S2.md
docs/gates/HO-P6-SUBSCRIPTIONS-S2-*.md

# ---------- S3 — Back-office touch points ----------
lib/hooks/useSubscriptionSummaries.ts                      # new
lib/api/staff-shop.ts                                      # isSubscribable fields + comment only
app/(staff)/staff/shop/products/[productId]/page.tsx       # send isSubscribable only
components/staff-shop/ProductDetailsForm.tsx               # the checkbox only
components/customer/CustomerProfile.tsx                    # subscriptionsPanel slot + tab + doc comment only
components/back-office-overview/CustomerProfileView.tsx    # mount the panel only
components/back-office-overview/DashboardAttention.tsx     # two rows + panel-absence rule only
components/orders/StaffOrderQueue.tsx                      # channel select option + doc comment only
components/back-office-subscriptions/**                    # new
mocks/handlers/subscriptions/touchpoints.ts                # S0 creates the empty stub; S3 owns it after
mocks/handlers/shop/staff.ts                               # isSubscribable on detail and PUT only
tests/components/back-office-subscriptions/**              # new
tests/components/staff-shop/products-p5.test.tsx           # supersede :243-262 only
tests/components/back-office-overview/overview-customers.test.tsx   # supersede :148-170 (Subscriptions part) only
tests/e2e/subscriptions-backoffice.spec.ts                 # new
tests/e2e/subscriptions-backoffice-360.spec.ts             # new (axe included)
docs/test-cases/TC-HO-P6-SUBSCRIPTIONS-S3.md
docs/gates/HO-P6-SUBSCRIPTIONS-S3-*.md

# ---------- Integration (after S0..S3 merge; the integrator only) ----------
tests/contract/mock-vs-real.contract.test.ts               # §12 row
docs/gates/HO-P6-SUBSCRIPTIONS-INTEGRATION.md
docs/handover/HO-P6-SUBSCRIPTIONS.md                       # §1 Amended rows only, append-only
```

Notes:
- **S0's three stubs.** S0 creates `customer.ts`, `staff.ts` and `touchpoints.ts` each as a one-line empty export, so the aggregator compiles. After S0 merges, each file belongs only to the slice named in its block.
- `components/orders/` is split by file: S3 owns `StaffOrderQueue.tsx` and no other file there.
- `components/back-office-overview/` is split by file: S3 owns `CustomerProfileView.tsx` and `DashboardAttention.tsx`; every other file there is import-only.
- `components/portal/` is split by file: S1 owns `account-nav.ts`, `AccountSidebar.tsx` and `dashboard/PortalDashboard.tsx` only.
- `lib/subscriptions/**`, `lib/api/subscriptions.ts` and `lib/api/staff-subscriptions.ts` are import-only for S1–S3. A slice that needs a new label, key or client function raises §20.1 so S0 (or the integrator) can add it. **Never** copy the file.
- Test files not listed are **run-only**. When ownership is unclear, the file is not yours (§20.1).

## 14. Forbidden scope

| Path | Why |
|---|---|
| `src/**`, `tests/**` (.NET), `deploy/**` | Frontend only; the backend is the contract |
| `docs/**` except each slice's test-case sheet, gate records and slice report, and this handover's §1 Amended rows (integrator), `.ai/**`, `.claude/**` | Inputs |
| `docs/handover/README.md` | The integrator updates the ADR table after the merge (§9); no slice edits it |
| `app/globals.css`, `app/layout.tsx`, `app/providers.tsx`, `app/page.tsx`, `app/(portal)/layout.tsx`, `app/(staff)/layout.tsx`, `app/(shop)/layout.tsx`, `app/(staff)/staff/page.tsx` | Tokens, shells and the dashboard page (S3 changes the panel, not the page) |
| `components/ui/**`, `components/back-office/**`, `components/hearth/**`, `components/account/**` (`AddressForm` is import-only), `components/auth/**`, `components/files/**`, `components/common/**` except S2's `staff-nav-groups.ts`, `components/portal/**` except S1's three files, `components/product/**` except S1's `BuyBox.tsx`, `components/orders/**` except S3's `StaffOrderQueue.tsx`, `components/billing/**`, `components/checkout/**` | Shared primitives and other areas' screens |
| `components/portal/CustomerSessionGuard.tsx`, `lib/validation/nextPath.ts`, `app/(auth)/**` | The sign-in round trip works as it is (§20.7) |
| `lib/api/client.ts`, `lib/api/errors.ts`, `lib/api/types.ts`, `lib/format/**`, `lib/money/**`, `lib/api/account.ts`, `lib/api/admin-branches.ts`, `lib/api/billing-staff.ts`, `lib/api/staff-orders.ts`, `lib/api/shop-catalogue.ts`, every `lib/hooks/*` not created by this pass | Shared contracts (import-only) |
| `mocks/**` not listed in a slice's block, including `mocks/handlers/index.ts`, `mocks/handlers/areas/accounts.ts`, `mocks/handlers/admin/**`, `mocks/handlers/ordering/{customer,staff,quote,control,index}.ts` | Shared stores and other areas' handlers |
| `nav/index.ts`, `nav/types.ts`, every `nav/areas/*` except `subscriptions.ts` | ADR-341 |
| `tests/guards/**`, `tests/a11y/**`, `tests/setup.ts`, `tests/perf/**`, `scripts/**`, `tests/e2e/{fixtures,global-setup,ordering-helpers,shop-helpers,portal-helpers,inventory-helpers,reports-helpers}.ts` | Shared test infrastructure. New routes join the a11y sweep automatically (`tests/perf/inventory.ts:14-15`) |
| Run-only e2e specs (all not listed in §13), in particular `shop-*`, `home`, `portal-*` except `portal-dashboard` E-A2, `account-area`, `accounts-*`, `ordering-*`, `staff-shell-*`, `staff-auth`, `staff-customers`, `dashboard-home`, `sales-gate-s2`, `customers-admin-*`, `catalogue-stock-*`, `shop-staff`, `notifications-*`, `xct-*`, `*-real-api` not created here | They must pass (the baseline in §1 excepted). A slice keeps the accessible names and roles they rely on (§20.3) |
| `package.json`, lock file, every config file | No dependency or config change |

## 15. Component test cases (Vitest)

Existing tests stay green **without weakening an assertion**. Where a test asserted that an element this pass now adds is absent, the owning slice replaces it with a positive assertion of **at least the same strength** and lists the old → new pair in its report. The supersessions are named in the rows below and in §13.

Evidence runs at `npm test -- --maxWorkers=2` (HO-P5 Amended (n)). Inside a parallel batch, each implementer runs only the Vitest files it touches. The slice's TEST gate runs the full suite, one slice at a time.

| ID | Slice | Case | Expected |
|---|---|---|---|
| U1 | S0 | API clients (customer and staff), with `fetch` mocked | Each function calls exactly the method, path, query and body of its Contract-inventory row; enum fields are sent as display names; dates as `yyyy-MM-dd`; `subscriptionsCsvPath` carries the filters and **no** `pageNumber`/`pageSize`; `firstDeliveryOn` omitted when not given; the cancel body always has `reason` |
| U2 | S0 | Labels | Every value of every §10.2 enumeration has a non-empty label; the customer reasons are exactly the six `IsCustomerChoice` ones; failure and payment texts equal `SubscriptionMessages.cs` strings; an unknown value renders "Unknown" |
| U3 | S0 | Dates | `formatCycleDate('2026-10-20')` = "Tue 20 Oct" with `TZ=America/New_York` and with `TZ=Asia/Dhaka` (both runs recorded); `formatCommerceInstant` names the zone; `formatPercentText('10.00')` = "10", `('12.50')` = "12.5", `isZeroPercent('0.00')` true |
| U4 | S0 | Mock schedule parity | A table of states mirroring `SubscriptionSchedule.cs`: `allowedActions` for Active unlocked, Active locked, Active locked with pending skip, Active with pending pause, Active with pending cancel, Paused, Suspended, Cancelled; `skippableCycleOn` and `followingCycleOn`; each change function's resulting state, `appliedImmediately`, `appliesFromCycleOn`; `describe` returns the server's exact sentences (`:229-245`) with `ddd d MMM` dates |
| U5 | S0 | Seeds | The §11.1.5 inventory is present (by id); the T3 count is ≥ 1; ≥ 3 subscribable products and ≥ 1 not; each `Generated` cycle's order exists in the ordering store with channel `Subscription` and the same number; the ordering store's eleven original orders keep their ids and totals (`tests/unit/orders/status-vocabulary.test.ts` still passes) |
| U6 | S0 | Source guard over `components/subscriptions/**`, `components/staff-subscriptions/**`, `components/back-office-subscriptions/**`, `app/**/subscriptions/**`, `lib/subscriptions/**`, `lib/api/*subscriptions.ts`, `lib/hooks/use*Subscription*.ts` | No `new Date(` whose argument is a string literal matching `\d{4}-\d{2}-\d{2}` or an identifier ending `On`; no import of `addDaysIso` or `date-fns`; no `Number(`, `parseFloat(`, `parseInt(` or `+ - * /` on an identifier matching `amount\|price\|total\|subtotal\|discount\|percent`; no `card`, `cvv`, `expiry date` input names. The guard fails on a planted violation (proved in the test) |
| U7 | S0 | Error mapper | A `ValidationResponse` maps per field by `propertyName` (case-insensitive) with the server text; `{ error }` 400 (no `errors` array) → the generic sentence, no throw; 404, 409, 403 → §8.5 sentences; no `errorCode` in any output |
| U8 | S1 | Subscribe offer | Signed in + subscribable + discount "10.00" → a link "Subscribe & save 10%" to `/portal/subscriptions/new/{skuId}`; discount "0.00" → "Subscribe"; not subscribable → nothing; `existingSubscriptionId` → "You already subscribe to this" + "Manage" → detail; signed out → nothing and **no C1 request**; variant change → C1 for the new SKU; `BuyBox` without the slot renders exactly as before |
| U9 | S1 | Subscribe form from options | Quantity limited 1…`maxQuantity` with the range in words; intervals from the payload; date `min`/`max` set, default the earliest, the range and the reminder lead stated in words |
| U10 | S1 | Not offered | `subscribable: false` → the server's reason and a link back, no form; `existingSubscriptionId` → link; C1 404 → "We couldn't find that product." |
| U11 | S1 | Payment methods | No C2 request until an address or branch is chosen; delivery requests `deliveryAddressId`; an unavailable method is a disabled radio with `unavailableReason` as text tied by `aria-describedby`; switching to pickup lists P4 outlets and re-requests with `pickupBranchId`; a quantity change re-requests (debounced) |
| U12 | S1 | No browser estimate | The form shows the unit price, "Subscription discount: 10% off every delivery" and the note, and **no** subtotal or total; after 201 the detail's `EstimatePanel` shows the server's six strings as sent (supersedes HO-SUB-002 U-A6) |
| U13 | S1 | Inline address | "Add a new address" opens `AddressForm`; saving selects the new address; every other choice is kept; nothing is written to `localStorage`/`sessionStorage` |
| U14 | S1 | Submit | 201 → navigates to the detail with "Subscribed. Your first delivery is on {date}" announced; a 400 maps to fields with a summary and keeps values; `SubscriptionAlreadyExists` links to the existing one; `PaymentMethodUnavailable` re-reads C2; the `{ error }` 400 shows the generic sentence |
| U15 | S1 | My subscriptions | Tabs Current / Cancelled with counts from each query's `totalCount`; card content and the single warning line per case (each of the five cases); empty state; `?page=` paging |
| U16 | S1 | Detail, unlocked | "Next delivery on …" and the cut-off sentence with the instant in the commerce zone; buttons exactly equal to `allowedActions` (a fixture whose list omits `Pause` shows no Pause) |
| U17 | S1 | Detail, locked | The locked sentence with `followingDeliveryOn`; the Skip button names `skippableCycleOn`; pause and cancel confirms use the locked wording **because** `isLocked` is true (same dates with `isLocked: false` → unlocked wording) |
| U18 | S1 | Change terms | `PUT` with `version`; 200 → the dialog closes and `message` appears in `role="status"`; a scheduled result shows the pending panel; 409 → the stale sentence, a re-read, the dialog open with the customer's values; `NoChangeRequested` sentence |
| U19 | S1 | Skip | Confirm names the date; `POST {cycleOn}` only after confirming; `CycleNoLongerSkippable` → server sentence and a re-read |
| U20 | S1 | Skip link | `?skip=` equal to `skippableCycleOn` → the confirm opens, **no request** before confirming, `router.replace` drops the parameter; another date → "That delivery can no longer be skipped." + "Skip the delivery on {skippableCycleOn} instead"; `skippableCycleOn: null` → the explanation without an offer; malformed → ignored and removed |
| U21 | S1 | Pause, resume, cancel, withdraw | Each confirm's text; resume date `min`/`max` from C1; `SubscriptionSuspended` sentence; cancel cannot be sent without a reason; note ≤ 500 with counter, rendered literally; withdraw sends `DELETE` |
| U22 | S1 | Suspension | UnpaidCycles banner with each outlet's name and phone from P4 (no contacts shown when P4 fails); ProductUnavailable banner; actions only Cancel (from the fixture's list) |
| U23 | S1 | History | Every outcome, order state and failure reason as text; order number links `/portal/orders/{orderId}`; pay-by in zone; "Show more" requests page 2 of C5; table ≥ 768 px, cards below |
| U24 | S1 | Account menu | "Subscriptions" after "My orders", current on `/portal/subscriptions/**`, present in the phone pills. Supersedes `account-sidebar.test.tsx:106` and `account-p3.test.tsx:170` (now asserting the link exists, with its href and position) |
| U25 | S1 | Overview card | With live subscriptions: product, "Next delivery on {date}", "Manage" → detail; with none or a failed read: absent, nothing else on the dashboard changes. Supersedes `dashboard.test.tsx` U-A11b (`:162-167`): the dashboard payload still has no `subscriptions` key, and the card comes only from C3 |
| U26 | S1 | Customer mock refusals (new file) | One case per §11.2.10 refusal: status, code, `propertyName` and body shape equal the server's (both 400 shapes, 404 without body, 409) |
| U27 | S2 | Staff list | Filters, sort and page write the URL; a reload issues the same request; columns as §11.3.3; the reason select is enabled only for Suspended or no status |
| U28 | S2 | Export | Shown only to export roles; calls `downloadBillingFile` with `export.csv` and the current filters, no paging; 413 → "Too many rows to export. Narrow the filters."; 403 → the permission sentence |
| U29 | S2 | Unpaid | "Suspended" then "At risk" headings from `group`; each row's unpaid cycles with date, order link, pay-by and state as text |
| U30 | S2 | Staff detail | Read-only panels; the records written out ("Never: none recorded"); no reinstater id in the DOM; actions only from `allowedStaffActions` and only for manage roles; Reception sees the "Only a shop manager or an administrator…" sentence |
| U31 | S2 | Reinstate | Reason required (client) and ≤ 500; the confirm names the customer and product; POST with `reason` and optional `firstDeliveryOn`; the staff detail is re-read; each error code maps to its field; a 403 replaces the action with `PermissionDeniedState` |
| U32 | S2 | Staff cancel | Note required, ≤ 500; locked wording from `isLocked`; POST; re-read shows the pending cancel; `CancellationReasonRequired` on Note |
| U33 | S2 | Nav | The Sales group lists "Subscriptions" after "Customers"; the item is active on `/staff/subscriptions/unpaid` and `/staff/subscriptions/{id}`; no other group changes |
| U34 | S2 | Staff mock refusals (new file) | 400 `{ error }` per bad filter; 403 per role for View, Manage, Export (mirroring `ActionRoles.Subscriptions.cs:12-14`); 413 above the cap; 404 unknown; reinstate/cancel rule codes |
| U35 | S3 | Product editor | The checkbox reflects `isSubscribable`; saving sends `isSubscribable` as that boolean in the same `PUT` with `expectedVersion`. Supersedes `products-p5.test.tsx:243-262` ("never sends isSubscribable" → "sends exactly the shown value, and the district as before") |
| U36 | S3 | Customer tab | "Subscriptions ({n})" with the live rows linking `/staff/subscriptions/{id}`, the counts line; a 403 or failed read → no tab. Supersedes `overview-customers.test.tsx:148-170` for the Subscriptions tab (now present); its "no Subscriber" assertion stays |
| U37 | S3 | Dashboard rows | "Subscription orders due tomorrow" with the server `count` (absent at 0), "Subscriptions suspended" (absent at 0), hrefs as §11.4.4; a 403 on T3 drops both rows without a banner; the panel is absent only when all three sources are refused |
| U38 | S3 | Orders channel | The select offers "Any channel", "Online", "Counter", "Subscription"; choosing Subscription writes `channel=Subscription`, and both the list and `status-counts` are requested with it; the existing row label case still passes |
| U39 | S3 | Touch-point mock refusals (new file) | T3 and T9 answer 403 for roles outside View; `PUT` `isSubscribable` omitted → unchanged, non-boolean → 400; C1's `subscribable` follows the flag immediately |
| U40 | all | Colour literals, targets | `tests/components/shop/no-hex-literals.test.ts` and `tests/components/back-office/no-colour-literals.test.ts` pass over every touched file; every new interactive control has `min-h-11` (44 px) or larger |

## 16. End-to-end test cases (Playwright, `chromium` + `mobile-360`)

**Machine limits (binding).** Run at `--workers=1` or `--workers=2` only, with `--max-failures=20`, on a **fresh `next dev` per chunk**. MSW runs only under `next dev`, so a production build cannot be used. `E2E_KEEP_ROUTES=1` must be set (the `webServer` sets it; set it yourself for your own server). After a run, kill the Playwright process tree and any leftover `chrome-headless-shell`, and free the port. Four workers exhaust commit memory on this machine.

**360 px rule.** Every new screen and every new dialog has a case in its slice's `*-360.spec.ts`. Each case checks for no horizontal scroll (`document.documentElement.scrollWidth <= 360`) and that the screen's interactive controls are at least 44 px high. Specs read seeded dates from `mocks/handlers/subscriptions/fixtures.ts` (`seedDates()`) and never compute them.

**May change** means the owning slice may add cases and update selectors for structure this pass changes, keeping existing assertions. **Run-only** means the spec must pass unchanged (§14), the §1 baseline excepted.

| ID | Slice | Spec / case | Kind | Expected |
|---|---|---|---|---|
| E1 | S0 | `ordering-customer-orders`, `ordering-staff`, `staff-customers`, `portal-dashboard`, `shop-product` | run-only | Pass. The seeds change nothing visible until S1–S3 build the screens |
| E2 | S1 | `subscriptions-customer.spec.ts` — signed in, a subscribable product page → "Subscribe & save 10%" → form (Delivery, every 4 weeks, bank transfer) → start → detail shows "Next delivery on …", the terms and the server estimate; a non-subscribable product shows no offer; signed out, the product page shows no offer; signed out, `/portal/subscriptions/new/{skuId}` → sign in → back on the form for that SKU | new | Pass — US-SUB-01 AC1 |
| E3 | S1 | same spec — unlocked: change quantity → message names the next delivery; locked (`__subscriptionsMock.lock`): change, skip, cancel → each message names the following delivery, the pending panel lists them, withdraw clears them; pause → resume with a chosen date → "Next delivery on {that date}"; suspended: banner with outlet phone, only Cancel offered; history shows "Awaiting your transfer: pay by …" and links to the order page | new | Pass — US-SUB-02 AC1–2, US-SUB-06 |
| E4 | S1 | same spec — `?skip=` matching → confirm, nothing changed before confirming, the parameter gone, then skipped; stale `?skip=` → explanation + "Skip the delivery on … instead"; signed out with `?skip=` → sign in → lands on the confirmation (no automatic skip) | new | Pass — US-SUB-03, ADR-FE-111 |
| E5 | S1 | `subscriptions-customer-360.spec.ts` — product page with the offer; Subscribe form (delivery and pickup, with the inline address form open); My subscriptions (both tabs, empty state via a reset customer); detail unlocked, locked, paused, suspended, cancelled; each of the six dialogs open; the overview card | new | No sideways scroll; 44 px controls |
| E6 | S1 | `subscriptions-customer-a11y.spec.ts` — axe on every screen and dialog in E5 at 1280 and 360, including the error summary on the form | new | Zero serious/critical |
| E7 | S1 | `portal-dashboard.spec.ts` E-A2 (`:29-36`) superseded: orders and balances still on one screen, **and** the "Next delivery" card present with its Manage link; every other case unchanged | may change (E-A2 only) | Pass. Runs in its own chunk (HO-P5 Amended (ae)) |
| E8 | S1 | run-only: `shop-*`, `home`, `portal-*` (except E7), `account-area`, `accounts-*`, `ordering-customer*`, `ordering-a11y-responsive` | run-only | Pass (baseline excepted) |
| E9 | S2 | `subscriptions-staff.spec.ts` — ShopManager: filter Suspended + Unpaid orders → URL carries both → reload keeps them; Export CSV → the download request carries the filters (route-intercepted, file name `subscriptions.csv`); Unpaid → Suspended and At risk groups with unpaid orders listed; open a suspended one → Restart with a reason → Active, it leaves the Suspended group; cancel another with a note → shows the scheduled or immediate result; Reception → detail visible, no Restart/Cancel, the who-can-act sentence; Accountant → Export visible, no actions | new | Pass — US-SUB-06 AC2, US-SUB-05 (adapted) |
| E10 | S2 | `subscriptions-staff-360.spec.ts` — list (cards), Unpaid, detail, both dialogs, the sidebar sheet showing the entry | new | No sideways scroll; 44 px |
| E11 | S2 | `subscriptions-staff-a11y.spec.ts` — axe on list, Unpaid, detail, both dialogs, the 413 message | new | Zero serious/critical |
| E12 | S2 | run-only: `staff-shell-*` (baseline excepted), `staff-auth`, `staff-customers`, `admin-a11y-responsive` | run-only | Pass. A Tab-count change from the new sidebar link is §20.3 |
| E13 | S3 | `subscriptions-backoffice.spec.ts` — product editor: tick "Can be subscribed to" on a non-subscribable product, save, then the signed-in customer sees the offer on that product; untick, save, the offer is gone; customer profile → Subscriptions tab lists the seeded live ones and links to the staff detail; dashboard → "Subscription orders due tomorrow" row with the count → `/staff/subscriptions?status=Active`; orders → Channel "Subscription" → only subscription orders listed, pills counted with the filter | new | Pass |
| E14 | S3 | `subscriptions-backoffice-360.spec.ts` — the product editor Organise card, the customer Subscriptions tab, the dashboard attention panel, the orders "More filters" with the channel select; axe on each at 1280 and 360 | new | No sideways scroll; 44 px; zero serious/critical |
| E15 | S3 | run-only: `shop-staff`, `catalogue-stock-*`, `staff-customers`, `customers-admin-*`, `dashboard-home`, `ordering-staff`, `sales-gate-s2`, `packed-customer-after-staff` | run-only | Pass |
| E16 | integration | `npm run test:e2e` in chunks (§17.2), each on a fresh `next dev` | — | Only the §1 baseline cases, each failing as recorded; a baseline case that passes is noted, not a finding |
| E17 | integration | `npm run sweep:a11y` | — | The six new routes are in the inventory and clean; no new violation |
| E18 | integration | `*-real-api` specs from S1/S2 and `npm run test:contract` | — | Run when `E2E_REAL_API=1` / `CONTRACT_API_BASE_URL` are configured; otherwise recorded "not run" |

## 17. Implementation order and verification

### 17.1 Order (small batches)

1. **S0 alone** on `feat/p6-s0-subscriptions-contract` from `c176fd8`. First commit: ADR-FE-109 … 114 and 193 … 197. Then §11.1. Gates, merge.
2. **Batch 1: S1 and S2 in parallel**, each in its own worktree from the S0 merge, one `PORT` each. Inside the batch each implementer runs typecheck, lint, the Vitest files it touches, and its new specs at `--workers=1`. The full `npm test -- --maxWorkers=2` and the slice's §16 rows run in that slice's TEST gate, **one slice at a time**, because two slices running §17.2 together exhaust this machine's commit memory. Gates, then merge in either order.
3. **Batch 2: S3** from the batch-1 merge. Gates, merge.
4. **Integration** on `feat/phase2-catalogue-theme` (or its successor): §17.2 "integration"; the contract-test additions (§12); `docs/gates/HO-P6-SUBSCRIPTIONS-INTEGRATION.md`; §1 Amended rows for every integrator decision.

### 17.2 Commands (from `web/`)

Per slice:

```bash
npm run typecheck
npm run lint
npm test -- --maxWorkers=2
# S0 only, once more under another zone (U3):
TZ=America/New_York npx vitest run tests/unit/subscriptions --maxWorkers=2
npx playwright test --project=chromium --project=mobile-360 --workers=2 --max-failures=20 <the slice's new specs from §16>
npx playwright test --project=chromium --project=mobile-360 --workers=2 --max-failures=20 <the slice's run-only specs from §16>
```

On Windows PowerShell, set the zone with `$env:TZ='America/New_York'; npx vitest run …`, then remove it.

Integration (each line is one chunk on a fresh `next dev` with `E2E_KEEP_ROUTES=1`; stop the server and kill leftovers between chunks):

```bash
npm run typecheck && npm run lint && npm test -- --maxWorkers=2 && npm run build
npx playwright test --project=chromium --project=mobile-360 --workers=2 --max-failures=30 tests/e2e/subscriptions-customer*.spec.ts tests/e2e/shop-*.spec.ts tests/e2e/home.spec.ts tests/e2e/account*.spec.ts tests/e2e/ordering-customer*.spec.ts
npx playwright test --project=chromium --project=mobile-360 --workers=2 --max-failures=30 tests/e2e/portal-dashboard.spec.ts
npx playwright test --project=chromium --project=mobile-360 --workers=2 --max-failures=30 <every other tests/e2e/portal-*.spec.ts, listed by name; portal-dashboard.spec.ts is not in this chunk>
npx playwright test --project=chromium --project=mobile-360 --workers=2 --max-failures=30 tests/e2e/subscriptions-staff*.spec.ts tests/e2e/subscriptions-backoffice*.spec.ts tests/e2e/staff-*.spec.ts
npx playwright test --project=chromium --project=mobile-360 --workers=2 --max-failures=30 tests/e2e/ordering-staff.spec.ts tests/e2e/ordering-pos.spec.ts tests/e2e/ordering-a11y-responsive.spec.ts tests/e2e/dashboard-*.spec.ts tests/e2e/sales-gate-s2.spec.ts tests/e2e/packed-customer-after-staff.spec.ts tests/e2e/reports-*.spec.ts
npx playwright test --project=chromium --project=mobile-360 --workers=2 --max-failures=30 tests/e2e/inventory-*.spec.ts tests/e2e/procurement-flows.spec.ts tests/e2e/catalogue-stock-*.spec.ts tests/e2e/shop-staff.spec.ts
npx playwright test --project=chromium --project=mobile-360 --workers=2 --max-failures=30 tests/e2e/billing-*.spec.ts tests/e2e/admin-*.spec.ts tests/e2e/customers-admin-*.spec.ts
npx playwright test --project=chromium --project=mobile-360 --workers=2 --max-failures=30 tests/e2e/notifications-*.spec.ts tests/e2e/xct-*.spec.ts
npm run sweep:a11y
# colour-literal back-up check (U40)
rg -n --glob "*.{ts,tsx}" "#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|-\[#" components app
```

The real-API specs and `npm run test:contract` run only when their environment is configured; record "not run" otherwise.

### 17.3 Each slice's report lists

The slice report goes in `docs/gates/HO-P6-SUBSCRIPTIONS-<slice>-SLICE-REPORT.md` and the test-case sheet in `docs/test-cases/TC-HO-P6-SUBSCRIPTIONS-<slice>.md`, written **before** the TEST gate. Each report lists:
- files touched (all inside its §13 block);
- every superseded assertion, old → new;
- every OQ default it built to;
- every mock refusal it added, with the server file:line it mirrors;
- e2e results per spec, including which baseline cases appeared and which passed;
- the Vitest totals at `--maxWorkers=2`.

## 18. Acceptance criteria

| A# | Slice | Story | Criterion | Evidence |
|---|---|---|---|---|
| A1 | S0 | — | The shared contract mirrors the server exactly (paths, bodies, both 400 shapes, labels, dates), and the mock applies the server's schedule rules with the server's sentences | U1–U5, U7 |
| A2 | S0 | ADR-FE-110/112/113 | Subscription code has no date arithmetic, no date-only `new Date`, no money or percent arithmetic and no card UI, and the guard proves it can fail | U3, U6, `no-card-ui` |
| A3 | S1 | US-SUB-01 AC1 | A signed-in customer subscribes to a SKU from its product page with a quantity, an interval, delivery or pickup and a payment method, and sees the next delivery date, including after signing in mid-flow | U8, U9, U11, U13, U14, E2 |
| A4 | S1 | US-SUB-01 | Products that cannot be subscribed to are explained, not offered; an existing subscription is linked; signed-out visitors are not misled (BG-S1) | U8, U10, E2 |
| A5 | S1 | US-SUB-01 AC2, US-SUB-06 | Generated orders appear in the history with their payment state, including "Awaiting your transfer: pay by …", and link to the order page | U23, E3 |
| A6 | S1 | ADR-238 | No card, token or payment capture; unavailable methods carry Orders' reason as text; no browser estimate | U11, U12, U6, `no-card-ui` |
| A7 | S1 | US-SUB-02 AC1 | Before the cut-off a customer can change quantity, interval, delivery and payment, skip one delivery, pause, resume and cancel; actions follow `allowedActions` exactly | U16, U18, U19, U21, E3 |
| A8 | S1 | US-SUB-02 AC2 | After the cut-off the customer is told which delivery a change affects, sees it scheduled, and can withdraw it | U17, U18, U21, E3 |
| A9 | S1 | US-SUB-03 | The reminder's skip link leads to a confirmation for that delivery, never acts on its own, survives sign-in, and explains a stale date | U20, E4 |
| A10 | S1 | US-SUB-06, US-SUB-05 (adapted) | A suspended subscription explains why and what to do (outlet phones for unpaid orders; product withdrawn), and offers only what the server allows | U22, E3 |
| A11 | S1 | G2 | The account menu has Subscriptions; the overview shows the next delivery for a customer who has one | U24, U25, E7 |
| A12 | S2 | US-SUB-06 AC2 | Staff see every subscription with URL filters and sort, export it as CSV (413 explained), and see the unpaid worklist grouped Suspended / At risk with each unpaid order | U27–U29, E9 |
| A13 | S2 | US-SUB-06, US-SUB-05 (adapted) | A shop manager or administrator restarts a suspended subscription with a reason, or cancels one with a note; other roles see the record without actions; a 403 is shown in place | U30–U32, E9 |
| A14 | S1/S3 | US-SUB-04 | The discount shows on the offer, the form (as a rate) and the server estimate. Its configuration (settings screen) and its line on the invoice are server-rendered and **evidenced on the real API only**; in a mock-only run this row is recorded "real-API pending" with E18 | U8, U12, E2, E18 |
| A15 | S3 | BG-15 | Staff can switch "Can be subscribed to" on a product, and the store front follows it | U35, U39, E13 |
| A16 | S3 | BG-15, US-SUB-06 | The customer profile has a Subscriptions tab with live subscriptions and counts; the dashboard shows subscription orders due tomorrow and suspended subscriptions; orders filter by the Subscription channel | U36–U38, E13 |
| A17 | all | UI-1, UI-6, HO-P2 §2 | Every new screen and dialog has a 360 px case and an axe case; no colour literals; 44 px targets; no new violations | U40, E5, E6, E10, E11, E14, E17 |
| A18 | all | ADR-FE-185/193 | Every mocked input is refused exactly as the server refuses it | U26, U34, U39, §17.3 reports |
| A19 | all | — | No file outside the slice's §13 block; no backend, config or dependency change | ARCHITECTURE gate diff review against §13/§14 |
| A20 | all | — | typecheck, lint, Vitest (`--maxWorkers=2`) and build pass; full e2e shows only the §1 baseline; the contract test covers the new GETs | §17.2, E16, E18 |
| A21 | — | — | **Not met in this pass, by design**: signed-out offer (BG-S1), "Subscriber" filter (BG-S2), the multi-item staples box (BG-S7), a pre-subscription estimate total (BG-S4) | §4.1, Backend gaps |

## 19. Required gates

Per slice, in this order. Records go in `docs/gates/HO-P6-SUBSCRIPTIONS-<slice>-<GATE>.md`.

| Gate | Agent | Focus for this pass |
|---|---|---|
| ARCHITECTURE | `architecture-reviewer` | Diff inside §13, nothing in §14; every type field cites a real view model or request line; each screen calls its owning context's endpoint (C-, T-, P-rows); **no client-side schedule logic** (ADR-FE-110, U6); hooks only in `lib/hooks`; `components/customer/**` still hook-free; the product page still a Server Component; the guard and `?next=` files untouched |
| SECURITY | `security-reviewer` | No payment capture; the skip link never mutates on load; nothing from a form in storage or the URL; notes and reasons rendered as text; presentation-only role hints with the server's 403 respected and shown in place; another customer's id is the same 404 as a missing one in the mock; CSV is downloaded, never built or previewed in the DOM |
| CODE_REVIEW | `code-reviewer` | Dates only through `lib/subscriptions/dates.ts`; no money or percent arithmetic (hand-check `EstimatePanel`, `SubscribeOffer`, the form's price section); ADR-FE-194 cache rules; copy from `lib/subscriptions/copy.ts`; mocks mirror validation and both 400 shapes; component size; tokens only |
| TEST | `test-engineer` | `TC-HO-P6-SUBSCRIPTIONS-<slice>.md` first; §15/§16 cases exist and pass on both projects; superseded assertions at least as strong; Vitest at `--maxWorkers=2`; U3 under two `TZ` values; e2e at ≤ 2 workers on a fresh `next dev` with `E2E_KEEP_ROUTES=1`; a 360 spec for every new screen; baseline cases reported by name |
| ACCEPTANCE | `acceptance-reviewer` | Every §18 row evidenced; screenshots at 360 and 1280 against the matching `docs/design/subscriptions/*.dc.html` (and `back-office/*.dc.html` for S3), in today's tokens; omissions are exactly the BG-S rows and OQ defaults, not silent drops. S0 is exempt from screenshots (contract and seeds, as HO-P5 Amended (j)) |

## 20. BLOCKED conditions

### 20.1 **A file you need is not in your §13 block**
Stop. Name the file and the change you need. If another slice owns it, the integrator routes the change there. If it is S0's shared file (`lib/subscriptions/**`, the two `lib/api` modules, the mock store or schedule), S0 or the integrator adds what you need. **Never** edit it "just a little", and never copy it under a new name.

### 20.2 **The server sends something different from the Contract inventory** (a field name, a nullability, a status code, a sentence)
The code wins. Mirror what `src/` does, cite its file:line in your report, and the integrator records a §1 Amended row. **Never** shape a type or a mock to this document against the code.

### 20.3 **A run-only spec breaks because a name, role or Tab order changed** (for example, a staff-shell spec counting Tab presses past the new "Subscriptions" link, or an account spec counting menu links)
Restore the accessible name or role it relies on. If the new link itself changes a count, raise BLOCKED with the spec and line; the integrator decides, and records it as an Amended row. **Never** edit a run-only spec or weaken an assertion in one you own.

### 20.4 **A screen seems to need schedule or money arithmetic** (the following delivery, "is it past the cut-off", the next skippable date, an estimate total, "you save ৳X")
Use the server's field (`followingDeliveryOn`, `isLocked`, `skippableCycleOn`, `estimate`). If the server has none, the element is a gap: leave it out and report it. **Never** compute it, and never relax a guard or add an ignore comment.

### 20.5 **A mock cannot mirror a server rule** (it needs state the mock does not have, such as Orders' COD ceiling for a zone)
Model the minimum state that makes the rule true, for example a single ceiling read from the ordering mock. If that is impossible, report it and leave the handler **refusing** rather than accepting. **Never** ship a mock that accepts what the server refuses.

### 20.6 **An open question's default looks wrong once built** (for example, the dashboard's second row or the overview card)
Build the default, note the concern in your report, and let the owner answer. **Never** pick a different answer silently.

### 20.7 **The sign-in round trip loses the SKU or the `?skip=` parameter**
Report it with the URL before and after sign-in. **Never** change `CustomerSessionGuard.tsx`, `nextPath.ts` or the sign-in page, and never move the SKU into a query parameter.

### 20.8 **A payment, card, wallet, "save for next time" or auto-charge control is asked for**
It contradicts ADR-238 and C-5. Report it; **never** build it.

### 20.9 **A staff order link from a subscription refuses** (the order was raised at a branch other than the staff member's active branch, so `/staff/orders/{id}` answers 404 or 403)
Keep the link and let the order page show its own refusal. Report the case, because it is a cross-branch question for the owner. **Never** switch the active branch for the user, and never hide the link based on a guess.

### 20.10 **The e2e run crashes for resources** (worker exit 0xC0000142, `next dev` heap errors, a stuck port) **or shows unrelated failures with "Compiled in 0ms" rebuilds in the dev log**
Stop. Kill the Playwright tree and leftover browsers, free the port, check that `E2E_KEEP_ROUTES=1` was set, and rerun the chunk at `--workers=1` on a fresh server. **Never** record a resource crash or a route-disposal failure as a test result.

---

## Backend gaps (not built here; for a backend follow-up)

| # | What | Why it stays open | Interim |
|---|---|---|---|
| BG-S1 | `isSubscribable` on the public product read (`ProductDetailViewModel`, per SKU or per product) | Without it a signed-out visitor cannot be told a product can be subscribed to; C1 needs a customer session | Offer signed-in only (OQ-1, ADR-FE-195) |
| BG-S2 | A "Subscriber" filter on `GET /api/staff/customers/browse` (`StaffCustomersController.cs:54-57`) | No parameter exists; joining reads in the browser is forbidden | Not built (OQ-10) |
| BG-S3 | A pickup-branch list for subscriptions (or `type` / pickup flag on `GET /api/branches`) | The public list has neither (`AdministrationBranchViewModels.cs:6-8`); a warehouse could be offered and then refused `PickupBranchUnavailable` | Public branches, server refusal shown inline (OQ-7) |
| BG-S4 | An estimate before creation (for example on C1 or C2 for a quantity) | The browser may not multiply or apply the discount | Unit price and rate as text; the server estimate after creation (OQ-3) |
| BG-S5 | The reinstater's name on the staff detail | `StaffReinstatementViewModel.ReinstatedBy` is a Guid (`SubscriptionViewModels.cs:100`) | Date and reason only (OQ-15) |
| BG-S6 | The allowed restart-date range for staff | C1 is customer-only; staff have no options read | Optional date with no client bounds; the server sentence names the range (OQ-16) |
| BG-S7 | A multi-item subscription ("staples box") | One SKU per subscription in the aggregate | Not built (OQ-9) |
| BG-S8 | A product slug on `SubscriptionProductViewModel` | No link from a subscription back to its product page | Product name as text |
| BG-S9 | The unpaid-orders threshold on the customer view | `SubscriptionMessages.SubscriptionSuspendedMessage` uses it (`:34-37`) but the view does not carry it | The sentence without the count |

## Open questions

Each slice builds to the default and records it. If the owner gives a different answer, it becomes a §1 Amended row.

| OQ | Question | Recommended default |
|---|---|---|
| OQ-1 | The public product read has no `isSubscribable`. Show a "Subscribe" link to signed-out visitors on every product, or nothing? | **Nothing for signed-out visitors**; signed-in customers get the offer per SKU from C1 (ADR-FE-195). Ask backend for BG-S1 |
| OQ-2 | Offer label and placement | Under the purchase row in the buy box: "Subscribe & save {n}%" when the discount is not zero, else "Subscribe"; "You already subscribe to this · Manage" when one exists |
| OQ-3 | HO-SUB-002 computed the estimate in the browser; that is now forbidden. What does the Subscribe form show? | Unit price, "Subscription discount: {n}% off every delivery" and the note; **no total**. The server's estimate shows on the detail from creation on. Ask backend for BG-S4 if a total is wanted before subscribing |
| OQ-4 | Label for `nextDeliveryOn`: "Next order" (HO-SUB-002) or "Next delivery" (store design, server messages)? | **"Next delivery on {date}"**, with the help text "The order is placed on this date." |
| OQ-5 | Wording of the six customer cancellation reasons | §10.2's texts; the reason is **required** (the server refuses a cancel without one, `CustomerSubscriptionsController.cs:141-142`), the note optional |
| OQ-6 | Adding an address while subscribing: HO-SUB-002's `sessionStorage` detour, or inline? | **Inline `AddressForm`**, as checkout does (ADR-FE-196); nothing stored |
| OQ-7 | Where do pickup outlets come from? | `GET /api/branches` (all active branches with address); a refused branch shows the server sentence on the field. Ask backend for BG-S3 |
| OQ-8 | Overview "Next staples box" (design: several items, Skip / Undo) | A **single "Next delivery" card** for the soonest live subscription, with "Manage" only; absent when there is none. No Skip/Undo on the overview (the detail page has Skip; "Undo" is not a server concept, withdraw is) |
| OQ-9 | Store design `MySubscriptions.dc.html` (multi-item box with per-item quantities) and the Home "staples box" band | **Not built** (BG-S7). The customer screens follow `docs/design/subscriptions/` in the customer layer tokens; the Home band is left out (no content without data) |
| OQ-10 | Customers "Subscriber" filter | **Not built** (BG-S2) |
| OQ-11 | Orders "Subscription" channel: a new pill tab, or a filter option? | A **Channel select option** "Subscription" in More filters; the blank option becomes "Any channel" (the old "Online and counter" was wrong once subscription orders exist). No extra pill: the pills are statuses |
| OQ-12 | Dashboard: only "Subscription orders due tomorrow" (design), or also suspended subscriptions (the server sends `suspendedCount`)? | **Both** rows in "Needs attention", each only when its count is above zero; due-tomorrow links `/staff/subscriptions?status=Active`, suspended links `?status=Suspended` |
| OQ-13 | Staff tabs: HO-SUB-002 had All / Unpaid / Prescription suspended | **All** and **Unpaid** only (prescription retired); a link nav between `/staff/subscriptions` and `/staff/subscriptions/unpaid`; sidebar entry in Sales after Customers |
| OQ-14 | Which phone does an `UnpaidCycles` banner give? | Every active outlet's name and phone from `GET /api/branches`, as the portal's "how to pay" box does |
| OQ-15 | Reinstatement record: the server gives a staff id, not a name | Show "Restarted on {date}: {reason}" without who (BG-S5) |
| OQ-16 | Staff restart date bounds | Optional date, no client min/max, helper "Leave empty to restart from the earliest possible date."; the server's sentence names the range on a refusal (BG-S6) |
| OQ-17 | Mock settings: read the admin settings mock, or fixed values? | **Fixed constants** in the subscriptions mock (cut-off 2, notice 3, unpaid 2) with the discount seeded at `"10.00"` so the discount UI is exercised; the admin settings mock is not changed. The real-API run proves the settings screen (A14) |
| OQ-18 | Product editor checkbox wording and help text | "Can be subscribed to"; help "Customers can start a repeat delivery of any pack size. Turning it off does not cancel existing subscriptions: their next order is not placed and they are suspended." |
| OQ-19 | My subscriptions tab counts | Each tab shows its own query's `totalCount` (two reads; no client arithmetic) |
| OQ-20 | `docs/USER_STORIES.md` §11 still says "cat owner", "food or litter", "veterinarian" (US-SUB-05, FR-SUB-6) | This pass uses the stories as adapted by HO-SUB-001 as built (ADR-244 retired; `ProductUnavailable` is the surviving suspension). Propose to the owner a backlog and SRS wording update; not edited here |

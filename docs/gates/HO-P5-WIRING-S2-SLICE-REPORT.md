# HO-P5 S2 (Sales: Dashboard, Orders, Counter sale) — slice report (§17.3)

Written by the S2 implementer. Everything below that says "passed" was seen to pass in this worktree; what was not run is said so.

## Branch and HEAD

| Field | Value |
|---|---|
| Branch | `feat/p5-s2-sales`, created from `b4f7783` (the worktree's branch `worktree-agent-a974eb1973a852f4a` sat at `b4f7783`, so `git checkout -b feat/p5-s2-sales b4f7783`) |
| HEAD | the last commit of the branch; see "Gate fix round" at the end |
| Worktree | `D:\my-repo\amar-gram\.claude\worktrees\agent-a974eb1973a852f4a` |
| Pushed | No |

Commits (oldest first): `625a0da` clients, hooks, mocks, dispatch dialog; `adec50e` workbench, riders page; `9eec889` dashboard panels, POS; `d26e5d7` superseded assertions; `230ea43` new tests; `971c8bd` tick fix and e2e. Run `git log b4f7783..HEAD --oneline` for the exact list.

## Files touched (inside S2's §13 block; `components/back-office/tab-parts.tsx` is in scope by §1 Amended (z))

New: `app/(staff)/staff/fulfilment/riders/page.tsx`, `components/back-office-overview/DashboardPipeline.tsx`, `components/dashboard/DashboardSalesChart.tsx`, `components/fulfilment/RiderDialog.tsx`, `components/fulfilment/RidersPage.tsx`, `components/pos/PosBrowseGrid.tsx`, `components/pos/PosSkuTile.tsx`, `lib/hooks/useSalesSeries.ts`; tests `tests/components/back-office-sales/{mock-refusals.test.ts,orders-p5.test.tsx,pos-p5.test.tsx,riders-dispatch.test.tsx}`, `tests/components/dashboard/sales-chart.test.tsx`.

Changed: `app/(staff)/staff/page.tsx`; `components/fulfilment/PickListPage.tsx`; `components/orders/{DispatchDialog,StaffOrderDetail,StaffOrderPanels,StaffOrderQueue,StaffOrderSidePanel}.tsx`; `components/pos/{PosCustomerPanel,PosScanField,PosScreen,PosTenderPanel}.tsx`; `lib/api/{dashboard,pos,staff-orders}.ts`; `lib/hooks/{usePos,useStaffOrders}.ts`; `mocks/handlers/ordering/{pos,staff}.ts`; `mocks/handlers/reports/dashboard.ts`; tests `back-office-overview/overview-dashboard.test.tsx`, `back-office-sales/{orders-workbench,pos-ticket}.test.tsx`, `orders/staff-orders.test.tsx`, `pos/pos.test.tsx`, e2e `dashboard-home`, `ordering-pos`, `ordering-staff`.

Nothing outside the block was edited. `mocks/handlers/ordering/store.ts`, `customer.ts` and `shop/fixtures.ts` are untouched (the seeds S0 added were enough).

## Superseded assertions (old → new)

| Where | Old | New (at least as strong) |
|---|---|---|
| `orders-workbench.test.tsx` U18 | five pills, `tabs.textContent` has no digit | six pills including **Packed**, each text = label + the server's count for that status (computed from the mock store), **All** = total; the counts follow the other filters but not `status`; Packed writes `status=Packed` |
| `orders-workbench.test.tsx` U19 | the pick tick survives a refetch (component state) | the tick is on the server (`lines[0].picked`), survives a refetch **and a remount** |
| `orders-workbench.test.tsx` U21 | ticking all enables Start packing | same, plus the server holds every `picked` (awaited) |
| `pos-ticket.test.tsx` U22 | `queryByRole('tab')` absent ("no category tabs, BG-6") | tablist "Item categories" with `All` first and 12 tabs |
| `pos-ticket.test.tsx` U23 first clause | no text `change due / change to give` before completion | "Change due ৳220.00" for 1000 against 780.00, "Still to pay ৳280.00" for 500, and **nothing** until cash is typed |
| `pos.test.tsx` gate fix | Enter without a customer does not open the review and says "Enter the customer's name and mobile" | Enter with only a name does not open the review and says "Enter both the name and the mobile number, or neither."; the fields are put in front of the cashier |
| `pos.test.tsx`, `pos-ticket.test.tsx`, e2e `ordering-pos` | chip "Walk-in · add customer" | chip "Walk-in (no customer)" |
| `staff-orders.test.tsx` U-D3 (3 cases), e2e `ordering-staff` E-B1 | `getByLabelText(/Courier/)` / `getByLabel('Courier')` | `/Which courier/` / `'Which courier'`. The dialog now also has a "Courier" radio, so the select's label changed; every assertion is unchanged |

## OQ defaults built to

OQ-7 (rider note read-back to staff, plain text, side panel and order page; not on the packing slip), OQ-9 (minimal `/staff/fulfilment/riders`, linked from the dispatch dialog and the pick list, no nav item), OQ-10 ("Packed" label, via S0's `orderStatusLabel`), OQ-11 (channel `Subscription` is a display label only through `orderChannelLabel`; no filter or tab). Concerns about a default: none.

## Mock refusals added (server file:line mirrored). One case each in `mock-refusals.test.ts` (U47)

| Mock | Refusal | Server |
|---|---|---|
| `POST …/packed` | not `Packing` → 400 `InvalidOrderTransition` "A confirmed order cannot be marked as packed."; unallocated line → 400 `OrderNotFullyAllocated`; unknown order 404; needs Orders.Fulfil (403) | `StaffOrdersController.cs:194-205`, `OrderAggregate.cs:406-414`, `OrderTransitionRules.cs:56,93-95`, `OrderMessages.cs:10-11`, `ActionRoles.Orders.cs:14` |
| `PUT …/lines/{id}/picked` | status not Confirmed/Packing/Packed → 400 `InvalidOrderTransition` (checked before the line); unknown line 404 `OrderLineNotFound`; repeat is a no-op (no version bump); untick clears who and when | `StaffOrdersController.cs:207-221`, `OrderAggregate.cs:421-433`, `OrderLine.cs:87-95`, `OrderingResults.cs:15-21` |
| `POST …/dispatch` | both or neither of `courierId`/`riderId` → 400 `DispatchTargetInvalid` on `CourierId`; tracking with a rider → 400 `DispatchTargetInvalid`; tracking > 100 chars; unknown/inactive/other-branch rider → 404 `RiderNotFound`; unknown/inactive courier → **404** `CourierNotFound`; pickup order → 400 "A pickup order is marked ready for collection, not dispatched."; unallocated → 400; only from Packing or **Packed**; rider shipment = `courierId` null, `courierName` "Our delivery rider", `riderId`, `riderName` | `OrderFulfilmentCommandValidators.cs:42-50`, `OrderFulfilmentCommandHandlers.cs:105-145`, `OrderAggregate.cs:436-447`, `Shipment.cs:43-44`, `OrderRules.cs:25` |
| `POST …/ready-for-collection` | from Packing or Packed; delivery order → 400 "Only a pickup order is marked ready for collection."; unallocated → 400 | `OrderAggregate.cs:450-458`, `OrderTransitionRules.cs:58,63` |
| `POST …/cancel` | allowed from Packed | `OrderTransitionRules.cs:64` |
| `PUT …/tracking` | a rider shipment → 400 `InvalidOrderTransition` | `OrderAggregate.cs:465-471` |
| `allowedActions` | Packing: `MarkPacked`, `Dispatch` (delivery) or `MarkReadyForCollection` (pickup), `Cancel`; Packed: the same without `MarkPacked` | `OrderTransitionRules.cs:46-66,99-113` |
| `GET …/orders/status-counts` | every status in pipeline order, zeros included, `total`; same filters as the list bar `status`; bad fulfilment / paymentMethod / channel (case-insensitive names, `Subscription` accepted) or search > 100 → 400 `{ error }` | `StaffOrdersController.cs:139-158`, `StaffOrderQueryHandlers.cs:87-105`, `EnumerationParsing.cs:20-30` |
| `GET …/orders` | the same four 400s (it had none) | `StaffOrdersController.cs:123-127` |
| `GET/POST/PUT …/riders` | list `{ id, name, mobileNumber, isActive }` only, never `branchId`, name order, `activeOnly`; mobile normalised to `+8801XXXXXXXXX`; name required / ≤ 100 / no control characters; mobile ≤ 30 / a real Bangladesh number else 400 `InvalidMobileNumber` on `MobileNumber`; duplicate trimmed name at the branch → 400 `RiderNameAlreadyExists` on `Name` (update excludes itself); unknown on update 404 `RiderNotFound`; list needs Orders.Fulfil, writes need Riders.Manage (403) | `StaffRidersController.cs:24-48`, `RiderCommandHandlers.cs:15-60`, `RiderCommandValidators.cs:12-26`, `RiderAggregate.cs:48-56`, `MobileNumber.cs:21-55`, `RiderViewModels.cs:4`, `ActionRoles.Orders.cs:14,26` |
| `GET …/pos/browse` | unknown category → 400 `{ error }` (case-insensitive name); `pageSize <= 0` → 400 `InvalidPageSize`; page number cap; size capped at 100, 20 by default; name order; `fefoBatches` empty; `totalCount` | `StaffPosController.cs:50-63`, `PagingHelper.cs:31-70`, `PosQueryHandlers.cs:76-99`, `ProductCategory.cs:21-31` |
| `POST …/pos/quote` | `tenderedCash` ≤ 0, > 9,999,999,999.99 or > 2 decimals → 400 `{ error }`; `changeDue` (zero when exact) **or** `cashShort`, only when the sale can be made and no quantity was cut; neither without a tender | `StaffPosController.cs:75-76`, `PosQueryHandlers.cs:113-123`, `TenderCalculator.cs:49-52` |
| `POST …/pos/sales` | name without mobile → 400 on `CustomerMobile`, mobile without name → 400 on `CustomerName`; neither = anonymous sale (no customer on the order, recipient "Walk-in customer", receipt `customerName` null); the reserved walk-in number typed as a customer → 400 `InvalidMobileNumber`; a per-customer or first-order code on an anonymous sale → 400 `DiscountCustomerLimitReached` on `DiscountCode` | `PosRequests.cs:31-33`, `ReturnAndRefundCommandValidators.cs:93-97`, `CompleteCounterSaleCommandHandler.cs:50-84`, `AnonymousCounterCustomer.cs:11-23` |
| `GET …/dashboard/sales-series` | Reports.SalesView only (403), `days` 1-31 (400 `{ error }`), `NoBranch` → 403 `BranchNotAssigned`; 14 days default, oldest first, every day present, `total` = the mock's sum | `StaffDashboardController.cs:38-61`, `SalesSeriesQueries.cs:13-14`, `ActionRoles.Reports.cs:12` |
| dashboard tile `orders.cod-with-riders` | ShopManager, Accountant, Administrator; `riders`, `orders`, `amount` computed live from the ordering store (a dispatch to a rider moves it) | `DashboardTileSources.cs:217-246`, `DashboardTiles.cs:20` |

Test seam added: `setMockOrderingRoles` in `mocks/handlers/ordering/staff.ts`, the same shape as the existing `setMockReportRoles`.

## Where the code differs from the handover or the S0 carry-forwards (§20.2: the code won)

1. **Pick list does not take `Packed`.** The carry-forward said the mock's pick list (`staff.ts` :726, :751) should accept Packed. The server's `GetPickListQuery` handler lists only `Confirmed` and `Packing` orders (`StaffOrderQueryHandlers.cs:215-216`, and its doc comment), so the mock is unchanged and still matches. Nothing to route.
2. **Rider name uniqueness is case-sensitive.** §11.3.14 says case-insensitive. The handler compares the trimmed name with `==` (`RiderCommandHandlers.cs:18,45`) and the unique index is a plain `(BranchId, Name)` index (`OrderingConfigurationConfigurations.cs:88`), so "rafiq hasan" is a different rider from "Rafiq Hasan". The mock follows the code. If case-insensitivity is wanted it is a backend change.
3. **`CourierNotFound` is a 404**, not the 400 the old dispatch mock sent (`OrderingResults.cs:15-21`). The dialog maps both to plain text under the field.
4. **Orders.View is held by all five staff roles** (`ActionRoles.Orders.cs:13`), so `status-counts` never 403s for a signed-in staff member; the dashboard pipeline's "absent on 403" is built and tested but only happens for a refused or failed read.
5. **The dashboard tile order** in the mock puts the rider-cash tile after `orders.today`; the server's catalogue puts the stock tiles first. Display order of the existing mock tiles was already not the server's, so it was left.

## Decisions to double-check (visual or UX; nothing here could be seen rendered)

* Pill count accessible name: done under Amended (z) (see Follow-ups); a pill now reads "Packed, 1 order".
* The Subscription channel appears only as a second line in the Fulfilment cell ("Subscription") for such a row; there is no seed order with that channel (`DbOrder.channel` in S0's store is `'Online' | 'Counter'`), so it is unit-tested through the type only.
* Dashboard layout: the sales chart (2/3) and "Orders in progress" (1/3) sit above "Needs attention / Latest orders" from 1280 px, stacked below. At 360 px the 14 bars are about 18 px wide each with a first and last date under them (not 14 day numbers); each bar is a button with a 44 px tall column but is narrower than 44 px, a deliberate trade-off for a chart of 14 days (the same days are in the table alternative). Please look at it.
* Riders page uses `ResponsiveTable` (table from 768 px, cards below), not `DataTable`, because the latter is URL-driven (search/sort/pager) and the registry is a short list. The Orders tabs show above it for orientation.
* The Rider option in the dispatch dialog stays disabled if the riders read fails ("Riders couldn't be loaded."), not only when there are none.
* The pick-list checkbox is controlled; a tick shows in the same event and the server's `picked` takes over when the write settles (found by the existing E7 spec: Playwright's `check()` saw no change while the cache update waited for the next tick). The hook still does the optimistic cache update and rollback.
* `useSalesSeries` is keyed `['dashboard', 'sales-series', branchId, days]` (the branch added so a switch refetches; §11.3.2 gives `['dashboard', 'sales-series', days]`).
* Mocks have one branch: riders created through the mock belong to the main branch and `X-Branch-Id` does not change the list. The "rider of another branch is 404" refusal is modelled by `DbRider.branchId` but there is no second-branch seed to exercise it in a screen.

## Verification

Commands from `web/`. Memory note: S1 was running, so Vitest ran at `--maxWorkers=1` and the full suite was **not** run (the TEST gate does that, per Amended (n)).

| Check | Result |
|---|---|
| `npm run typecheck` | exit 0, no output |
| `npm run lint` (`--max-warnings 0`) | exit 0 |
| Vitest, files this slice adds or changes plus the related folders (`tests/components/{back-office-sales,orders,pos,fulfilment,dashboard,back-office-overview}`, `tests/unit/orders`) | 20 files, 232 tests passed (before the last tick fix); after it `back-office-sales` + `orders/staff-orders` re-run: 123 passed |
| Vitest, guards and neighbours: `tests/guards` (`no-money-arithmetic`, `no-card-ui`, ordering scope), `shop/no-hex-literals`, `back-office/no-colour-literals`; `overview-customers`, `cart`, `checkout`, `offline`, `ordering-admin`, `refunds`, `returns`, `staff`, `unit/data-table`, `unit/staff-shell`, `back-office/primitives` | 4 + 28 files passed (220 + 288 tests) |
| e2e `dashboard-home.spec.ts` (E7), both projects, `--workers=1` | 8 passed |
| e2e `ordering-staff.spec.ts` (E8), both projects, `--workers=1` | first run 33 passed, 7 failed; fixed (below); rerun on a fresh `next dev`: **40 passed** |
| e2e `ordering-pos.spec.ts` (E9), both projects, `--workers=1` | **12 passed** |
| e2e `ordering-a11y-responsive.spec.ts` (run-only, not a S2 gate row; spot check of the screens this slice changed) | `chromium`: the first 33 of 34 cases passed in one run (including the `/staff/orders`, order detail, pick list, `/staff/pos`, receipt routes and the `:133` checkout case). Case 34 (`/staff/pos after a scan`) **timed out at 3.0 m** while S1's e2e was starting on the same machine; I stopped that run (its process tree only), then reran the case alone on the warm server: **passed** on `chromium` (24 s) and on `mobile-360` (25 s). `mobile-360` `staff routes` (24 cases, includes orders, order details, pick list, POS, receipt): **24 passed** (`--workers=1`). Not run: the `mobile-360` customer routes and set-up flows, and the chromium cases after 34 in that file (none is a screen this slice changed) |

First-run failures, all mine, none a baseline failure: the existing **E7** (`box.check()` "did not change its state": the controlled tick waited for the cache; fixed in `StaffOrderSidePanel`), my new pills test (the pill's accessible name has a space: "All 13"), and my new riders test on `mobile-360` (cards below 768 px, no `table` role). No resource crash (no 0xC0000142), no load timeout counted either way. None of the 12 §1 baseline failures is in a spec this slice ran.

Not run: the full Vitest suite; E17 specs other than `ordering-a11y-responsive`; `sweep:a11y`; `npm run build`; contract tests.

## Anything left undone

* Nothing outstanding in the slice. The riders page uses `ResponsiveTable` rather than `DataTable`; Amended (y) records that.
* No e2e case for the Subscription channel label (no seed; see above).
* `tests/contract/mock-vs-real.contract.test.ts` is the integration step's.

## Follow-ups after the report (Amended (z) and S1 SECURITY)

* `tab-parts.tsx`: optional `countLabel` (type `CountedTabItem`), visible count unchanged, sr-only ", 1 order"; no other tab changes. Test: `tab-count-label.test.tsx`. Verified: typecheck and lint clean; Vitest 91 files / 740 tests passed at `--maxWorkers=1` (slice folders, `back-office` incl. `primitives`, and every folder importing the tabs); e2e `ordering-staff` + `dashboard-home` on a fresh `next dev` (3122), both projects, `--workers=1`: 48 passed (a first run had my E8 pills assertion fail on the name format; fixed to `/^Packeds*,s*1 order$/`).
* Staff read-back of the rider note is wrapped in `<bdi>` on the side panel and the order page (U+202E and other format characters pass the server's C0-only rule); test in `orders-p5.test.tsx`.

## §20 requests

1. ~~§20.1 pill count name~~ closed by Amended (z): `tab-parts.tsx` now takes an optional `countLabel`; the queue pills read "Packed, 1 order".
2. §20.2: the code-versus-document differences are recorded by Amended (x) and (y); nothing further to route.

Nothing else blocked the slice.

## Gate fix round (S2 gates, merged with Amended (aa)-(ab))

Commits since the first report: `625a0da`, `adec50e`, `9eec889`, `d26e5d7`, `230ea43`, `971c8bd`, `f8ffb4d`, `db084bb` (Amended (z): tab count label, `<bdi>` rider note, with `tab-count-label.test.tsx`), then this round's commit(s); the exact list and HEAD are `git log b4f7783..HEAD --oneline`.

**SECURITY MEDIUM.** `PosScreen` applies the `?customerId=` preset once per id (a ref), New sale calls `router.replace('/staff/pos')` and clears the typed cash, and the review summary names the buyer ("Buyer: name (mobile)." or "No customer (walk-in sale)."). Tests: preset then clear both fields, and preset then complete then New sale, each ending with a sale that carries neither name nor mobile (the second sale scans oats, because the seed has one jasmine rice).

**ARCHITECTURE.** The chip reads "Walk-in (no customer) · Add customer" (§11.3.13); Vitest and e2e assertions updated. `ordering-staff.spec.ts` runs axe on `/staff/fulfilment/riders` (list and open dialog). Amended (ab): the change preview is hidden once a payment has been added; stale-quote tests cover a basket change after cash was typed, adding the payment, and out-of-order answers.

**CODE_REVIEW.** `pos-p5.test.tsx` paging (an override of 25 items, two requests), empty category (override, exact text) and category membership (every tile is a catalogue product of that category, counts match) can now fail. A line's pick checkbox is `aria-disabled` while its write is in flight (kept focusable rather than `disabled`, so a keyboard user does not lose focus; clicks are ignored); tests cover a generic failure, a 404, tick then untick, a concurrent refetch and switching orders mid-write.

**LOWs.**
- `!= null` for the rider shipment.
- One `useCanManageRiders()` (unknown roles are NOT allowed) for the riders page, the dispatch dialog and the pick list.
- The dispatch dialog's 404 re-reads the rider or courier list and blames the order if the one chosen is still on it. The client's `ApiNotFoundError` carries no body, so it cannot map by code.
- Tests for a failed riders read and for tracking-then-switch.
- The chart clamps a negative net to a zero bar, and a keyboard-focused bar keeps its readout when the pointer leaves. UI-6 needs no arrow-key model; the 14 bars stay 14 tab stops.
- Mock rider writes check shape, 404, duplicate name, then mobile; a whitespace-only name is `NotEmptyValidator`.
- An empty-Guid courier beside a real rider is refused by the handler.
- The quote always sends `changeDue` and `cashShort` (null when absent; the view model has no ignore-null setting).
- `lacksRole` on start-packing, tracking and cancel.
- The reserved walk-in number is refused in every typed form.
- E9 reads the POST body to tell an anonymous sale from a named one.
- A test renders the Subscription label.
- `removeAllListeners` moved to `beforeEach`.
- `tenderedCash` cites `PosRequests.cs:24`.

Verification: typecheck and lint clean; Vitest 56 files / 512 tests (slice folders, back-office, guards and tab consumers) at --maxWorkers=1; e2e ordering-staff + ordering-pos (axe on the riders page included), both projects, --workers=1, fresh next dev on 3122: 52 passed.

Left undone: nothing from the list. The mock receipt still hides the name of a named buyer who is not the seeded customer (`known` in `pos.ts`, pre-existing); E9 no longer depends on it.

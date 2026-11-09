# HO-P6-SUBSCRIPTIONS — integration record (part 1: E16, E17; part 2: E18 on the real API)

Branch `chore/p6-integration`, from `feat/phase2-catalogue-theme` at `4c1aab9` (S0, S1, S2 and S3 merged, each after five gates PASS). Integrator: Claude (Opus 5.5), under the owner's 2026-10-31 delegation. Run 2026-11-09 on this machine. Nothing pushed or merged.

Part 1 is everything except the real-API run. Part 2 (E18: the `*-real-api` specs, `npm run test:contract`, A14, §20.9 and the open real-API checks) ran later the same day against a scratch API; see "Part 2: E18 on the real API". The overall verdict is at the end.

## What ran

| Step | Result |
|------|--------|
| §12 contract-test GETs | Added (`7d9254f`). Skips cleanly without `CONTRACT_API_BASE_URL` (1 file, 72 tests skipped). Mock side checked with a throwaway run (below) |
| §11.4.4 stale comment | Fixed, Amended (n) (`880a01f`) |
| `npm run typecheck` | Clean |
| `npm run lint` | Clean (`--max-warnings 0`) |
| `npm test -- --maxWorkers=2` | 270 files passed, 1 skipped (the contract test); 2710 tests passed, 72 skipped, 0 failed (437.7 s) |
| `npm run build` | Compiled; 126 static pages generated |
| E16 e2e, chunks c1 … c8 (§17.2) plus c9 | Only load flakes outside the baseline, each passing alone (below). No §1 baseline case failed |
| E17 `npm run sweep:a11y` | 185 routes: 184 clean on the first pass, and the 185th clean when re-run alone (below). The six new routes are in the inventory and clean |
| Colour-literal check (U40) | `rg -n --glob "*.{ts,tsx}" "#[0-9a-fA-F]{3,8}\b\|rgba?\(\|hsla?\(\|-\[#" components app`: no match (exit 1) |
| E18 real-API specs and `npm run test:contract` | Part 2. Subscription real-API specs 7 of 7 cases on both projects; every other `*-real-api` spec and the journey green (billing after Amended (r)); contract check 71 of 72, the one red row a storefront drift from before HO-P6 (owner item 13) |

Every chunk ran on a fresh `next dev` (`.next` removed first; port 3131, `NEXT_PUBLIC_USE_MOCKS=true`, `NEXT_PUBLIC_API_BASE_URL=http://localhost:5005`, `E2E_KEEP_ROUTES=1`, 8 GB heap) with `--project=chromium --project=mobile-360 --workers=2 --max-failures=30 --retries=0`. Between chunks the server, its process tree and any Playwright or orphaned `chrome-headless-shell` processes were stopped and port 3131 checked free. No dev log showed a `Compiled in 0ms` rebuild, there was no 0xC0000142 or heap error, and free commit memory stayed at about 22 GB, so no chunk needed 1 worker. Logs are in the integrator's scratchpad (`e2e/<chunk>/list.txt`, `dev.out.txt`, `meta.txt`).

## Pass/fail per chunk

| Chunk | Specs | Passed | Failed | Flaky | Skipped | Time |
|-------|-------|--------|--------|-------|---------|------|
| c1 customer/store | subscriptions-customer*, shop-*, home, account*, ordering-customer* | 476 | 1 | 1 | 8 | 15.9 min |
| c2 portal-dashboard | portal-dashboard | 24 | 0 | 0 | 0 | 0.4 min |
| c3 other portal | portal-a11y-responsive, portal-real-api | 34 | 0 | 0 | 4 | 0.6 min |
| c4 staff | subscriptions-staff*, subscriptions-backoffice*, staff-* | 158 | 0 | 0 | 10 | 4.2 min |
| c5 sales | ordering-staff, ordering-pos, ordering-a11y-responsive, dashboard-*, sales-gate-s2, packed-customer-after-staff, reports-* | 166 | 0 | 0 | 14 | 10.8 min |
| c6 inventory | inventory-*, procurement-flows, catalogue-stock-*, shop-staff | 539 | 1 | 0 | 24 | 16.7 min |
| c7 billing/admin | billing-*, admin-*, customers-admin-* | 388 | 0 | 0 | 30 | 15.4 min |
| c8 notifications/xct | notifications-*, xct-* | 188 | 0 | 0 | 22 | 6.9 min |
| c9 (not in §17.2) | msw-start-race, order-tracker-360, p5-followup-layout-360, journey-real-api | 46 | 0 | 0 | 24 | 1.1 min |

c9 holds the specs that no §17.2 chunk names, so the whole suite ran. Skipped tests are the real-API specs (`subscriptions-customer-real-api`, `subscriptions-staff-real-api`, `portal-real-api`, `reports-real-api`, `billing-real-api`, `inventory-real-api`, `xct-real-api`, `journey-real-api`), which skip themselves without `E2E_REAL_API=1`.

## Baseline (§1, 11 cases)

None failed. All 11 passed on every project they run on, which matches the merge of `fix/baseline-and-lows`:

- c4: `staff-shell-toggle` :29, `staff-shell-manual-expand-overflow` :37, `staff-shell-sheet-closes-on-back-navigation` :30.
- c5: `ordering-a11y-responsive` :133.
- c7: `billing-a11y-responsive` :86, `billing-functional` E-A1 (:18) and E-F1 (now :222), `admin-functional` E-B1 :56 (both projects).
- c8: every `notifications-inbox` case on mobile-360 (the file's line numbers have moved since the list was written), `xct-operations` E-D1 (now :84, both projects).

A baseline case that passes is not a finding. The list stays as it is until the owner shortens it (For the owner, item 1).

## Every other failure, and how it was settled

Each was re-run alone at `--workers=1`, both projects, `--repeat-each=3`, `--retries=0`.

- **c1 `home.spec.ts` :26 "signed out lands on the public shop" (chromium), load flake.** It timed out at 5 s waiting for `/` to redirect to `/shop`. That is the first hit on a cold route, the same pattern HO-P5 recorded for `home.spec.ts` :33. Re-run on the warm c1 server: 6 of 6 passed. Subscription code is not involved.
- **c1 `subscriptions-customer-a11y.spec.ts` :60, "axe at 1280 › the Subscribe form, with the error summary, in pickup, and when it is not offered" (chromium), flaky.** The spec sets `retries: 1` itself (`test.describe.configure`), so this is counted as flaky, not failed. On the first attempt, axe read the submit button as `#e5e1dd` on `#be6d3c` (2.96:1). Neither value is a theme colour (`--accent` is `#b4531a`), so axe most likely sampled the button mid-way through a colour or opacity transition. The retry passed. Re-run alone: 6 of 6 passed. This is subscription code, but the product colours are not at fault, so no product change was made (For the owner, item 9).
- **c6 `procurement-flows.spec.ts` :95 E-A3 (chromium), load flake.** It hit the 30 s test timeout on its last step, the receipts list (`/staff/inventory/receipts`), deep into a 16.7 min chunk. Re-run alone on a fresh server: 6 of 6 passed (2.6 min). Subscription code is not involved.

No failure needed a fix, so nothing outside the §13 integration block was changed for e2e.

## Contract test (§12)

`web/tests/contract/mock-vs-real.contract.test.ts` (`7d9254f`):

- **New GETs, all in the LATE phase:**
  - C1 `options?skuId=` for a subscribable SKU.
  - C2 `payment-methods?skuId=&quantity=1&deliveryAddressId=`.
  - C3 `?status=live` and `?status=cancelled`.
  - C4 `{id}` and C5 `{id}/cycles`.
  - T1 (unfiltered, and `status=Active&sort=-nextDeliveryOn`), T2 `unpaid`, T3 `due-tomorrow`.
  - T5 `{id}` and T6 `{id}/cycles`.
  - T9 `/api/staff/customers/{id}/subscriptions`, for the signed-in customer's id as T5 reports it.
- **Real side, set-up in `collect()`:** when the customer has no live subscription, it first looks for a product among the first five whose SKU C1 calls `subscribable`. If there is none, it `PUT`s each of those products back from its staff detail with `isSubscribable: true` until one is. It then starts one subscription: Delivery, her first address, the first available method from C2, every 4 weeks, quantity 1. All of this runs on the scratch database that the test already insists on.
- **Mock side:** Sam's seeded subscriptions are used. The mock's ids are `b0000000-…-0201` (SKU), `5a000000-…-0001` (Home address), `5b000000-…-0002` (subscription) and `c0000000-…-0001` (customer). These ids are not hard-coded; each side finds its own.
- **`KNOWN_DRIFT` is unchanged and empty.** The `isSubscribable` drift on `GET /api/staff/shop/products/{id}` closed with S3; part 2 confirmed it (that row matches on the real API).
- **Retired GET dropped.** `GET /api/customers/me/shop/products/{slug}/purchasability` went with CustomerShopController in HO-P1 (`380e387`). Neither the API nor the mocks serve it. Its unhandled request (MSW `onUnhandledRequest: "error"`) stopped the mock side before any comparison could run, so `npm run test:contract` could not have passed since HO-P1. It is in the integration-owned file, so it was removed with a comment.
- **Mock-side check.** A throwaway run with `CONTRACT_API_BASE_URL` pointing at a closed port, and a temporary log line that was removed before the commit, showed every endpoint answering 200 on the mock. The run then stopped, as designed, at the scratch-database guard. Every new subscription read had data on the mock: 1 or 2 paths each, all 200.

## E17 sweep

185 routes in the generated inventory (public 18, customer 22, staff 143, none 2), run on a fresh `next dev` with the mocks and `E2E_KEEP_ROUTES=1` (16.4 min). HO-P5 swept 179; the six new ones are HO-P6's:

| Route | Audience | Result |
|-------|----------|--------|
| `/portal/subscriptions` | customer | clean |
| `/portal/subscriptions/[subscriptionId]` | customer | clean |
| `/portal/subscriptions/new/[skuId]` | customer | clean |
| `/staff/subscriptions` | staff | clean |
| `/staff/subscriptions/[subscriptionId]` | staff | clean |
| `/staff/subscriptions/unpaid` | staff | clean |

"Clean" means no serious or critical axe finding and no technical text in an alert.

- **The two detail routes are swept at the inventory's placeholder id** (`00000000-…-0001`), which the mocks do not know. The sweep therefore sees their not-found state. The full screens, at 1280 and 360, are covered by the slices' axe specs (E6 `subscriptions-customer-a11y`, E11 `subscriptions-staff-a11y`, E14 `subscriptions-backoffice-360`), which all passed in c1 and c4.
- **One route failed, for resources, not for axe.** `/staff/billing/reconciliation/cod` got `net::ERR_CONNECTION_REFUSED`. The dev log shows Next's own "Server is approaching the used memory threshold, restarting..." just after that route compiled, and the server was ready again 2.6 s later. Per §20.10 this is not a test result. Re-run alone on a fresh server (`SWEEP_ONLY=billing/reconciliation/cod`), it passed.

There is no serious or critical finding in the inventory, so there is no new violation, and the baseline sweep was not rerun.

## Amended letters used at integration

| Letter | What | Commit |
|--------|------|--------|
| (n) | `app/(staff)/staff/page.tsx` doc comment: "Not built: subscriptions due" replaced by a pointer to `DashboardAttention`'s rows (§11.4.4). Comment only | `880a01f` |
| (o) | Shop mock (S3's `isSubscribable` part): the real 400 body for a non-boolean flag (T12), and a flip moves the version by 2. Two new cases in S3's `mock-refusals.test.ts` | part 2, see Commits |
| (p) | Subscriptions mocks (S1's and S2's `notFound()`): ProblemDetails 404 as the server sends. S1's real-API spec pins that body and accepts pending policies after registering | part 2 |
| (q) | S2's staff real-API spec: at 360 the list is a card list, so the detail case takes the first card's link there | part 2 |
| (r) | `billing-real-api.spec.ts` E-F1 (HO-BIL-002's): accepts pending policies after registering | part 2 |
| (s) | Contract drift in two mocks outside every block: customer order detail `imagePath` and `riderNote`; catalogue list `totalItemCount`. The per-size card drift is left to the owner | part 2 |

Each is recorded in `docs/handover/HO-P6-SUBSCRIPTIONS.md` §1 as an integrator decision, under the owner's 2026-10-31 delegation, appended after (n). The purchasability removal (part 1) and the contract test's dictionary rule (part 2) are inside the integration block, so they need no row.

## Part 2: E18 on the real API

Run 2026-11-09, worktree `.claude/worktrees/p6-int`, branch `chore/p6-integration` from `3d2b436`.

### Environment

- **Database.** A new scratch database, `amargram_p6int`, built by the recipe: `seed-dev-db.mjs --db amargram_p6int --port 5099`, which created and migrated it, seeded it, and passed 16 of 16 checks. Then `seed-e2e-real-api.mjs`. No other database was read or written. `amargram_petclean`, `amargram_staffevent`, `amargram_realapi`, `amargram_realapi2` and `amargram_realapi_it` were not touched.
- **API.** `start-seeded-api.mjs --db amargram_p6int --port 5127 --web-port 3132`, built from this worktree's `src/`, with one extra environment variable, `Subscriptions__Worker__IntervalSeconds=20` (configuration only; the default is 900). `GET /api/dev/database` answered `amargram_p6int`. Ports 5099, 5127 and 3132 were checked free first.
- **Web.** `next dev -p 3132` from this worktree, with `.next` removed first, `NEXT_PUBLIC_USE_MOCKS=false`, `NEXT_PUBLIC_API_BASE_URL=http://localhost:5127` and `E2E_KEEP_ROUTES=1`. Playwright ran at `--workers=1 --retries=0`.
- **QuestPDF.** The Community licence fix from `fix/real-api-e2e` (`QuestPdfFonts.EnsureRegistered`) is in this branch. The invoice PDF downloads in billing E-F1 and E-DL returned 200 `application/pdf`.
- **Fixtures beyond the seeders.** The scratch database has no clock to move, so a subscription order can only be raised by bringing a delivery date forward. For the fixtures below, the integrator set `subscription.subscription.next_delivery_on` to today for single named subscriptions, in `amargram_p6int` only, and let the worker take the cycle as it would on the day. Every other change went through the API: product flags and listing, settings, a second outlet, and one staff account.

### 1. `npm run test:contract`

- **First run: 3 failed, 69 passed (72).** All three were in areas outside HO-P6. The check could not have run since HO-P1 (part 1, owner item 12), so these had built up unseen.
  - **`GET /api/customers/me/orders/{orderId}`.** `lines[].imagePath` and `fulfilment.riderNote` were missing in the mock. Both are always present on the server's view, null when there is none (`OrderViewModels.cs:15`, `:23`), and the web type already has both as optional. **Fixed in the mock**, Amended (s).
  - **`GET /api/staff/inventory/alerts/summary`.** The four `open.byKind` keys were "missing in real". `ByKind` is an `IReadOnlyDictionary<string,int>` that lists only kinds with an open alert (`AlertsAndReportsViewModels.cs:17`), the mock builds it the same way (`inventory/alerts.ts:91-92`), and the scratch database has none open. This was not drift; the comparator treated a dictionary's data keys as fields. **Fixed in the check**: a `DICTIONARY_PATHS` rule compares the values' shape, and an empty side is "unverified", as an empty array already was. Only `$.open.byKind` is listed.
  - **`GET /api/shop/products`.** `items[].skuId`, `items[].sizeLabel` and `totalItemCount` were missing in the mock. `totalItemCount` was **fixed in the mock**, Amended (s). `skuId` and `sizeLabel` are the server's one card per size (owner, 2026-10-18; `CatalogueSizeExpansion.cs`, 84 cards for 44 products here). The mock still lists one card per product. The web type and `ProductCard` already handle both shapes. Rewriting the storefront mock to one card per size changes what every shop spec and test sees, which is not a cheap change at integration. **Left red** and not put in `KNOWN_DRIFT` (owner item 13).
- **Second run, after the fixes: 1 failed, 71 passed (72).** The one failure is the shop list's `skuId` and `sizeLabel`.
- **Every HO-P6 GET matches** the real API: C1 to C5, T1, T2, T3, T5, T6 and T9. The staff product detail row also matches, so the `isSubscribable` drift is closed. What the scratch data could not show is listed as "unverified" (for example `pending`, `lastCycle` and `suspensionReason` null on one side, empty unpaid list).
- **What the collector changed on the real side.** No product was subscribable before the run (0 of 48). It flipped **Ajwa Dates** (`1c90cc4f-42e9-4396-ab39-88d917d0c5e9`, the first of the five it looks at) and started subscription `4982a279-39f7-4a93-a659-03ca741ad596` for `customer@amargram.test`: Delivery, cash on delivery, every 4 weeks, quantity 1.

### 2. Real-API specs (`E2E_REAL_API=1`)

| Spec | chromium | mobile-360 |
|------|----------|------------|
| `subscriptions-customer-real-api` (S1 T11 / E18): the empty list, menu entry and wire; subscribe by pickup, skip, cancel | 2 of 2 | 2 of 2 |
| `subscriptions-staff-real-api` (S2): list, filters and CSV; unpaid worklist; detail and roles; restart a suspended subscription; cancel a live one | 5 of 5 | 5 of 5 |

- **Runs that failed first.**
  - Customer spec, both cases, both projects. A newly registered customer has Privacy pending on the seeded database, and the portal's modal "Updated policies" prompt hid the page. The spec never accepted it. Fixed under Amended (p).
  - Customer spec, the wire case. The real 404 is ASP.NET's ProblemDetails, not an empty body. Spec and mocks were aligned under Amended (p).
  - Staff spec, "a detail opens from the list" on mobile-360. At 360 the list is a card list, not a table. Fixed under Amended (q).
- **Staff fixtures** (`SUBS_SEED`): `e2e.shopmanager`, `e2e.reception` and `e2e.accountant`. The restart and cancel cases change the database, so each project had its own pair:
  - chromium: suspended `0a805218-…` (Chola) and active `e8725fd2-…` (Black Seed Oil).
  - mobile-360: suspended `7a417d33-…` (Desi Cow Ghee) and active `f629d5e7-…` (Coconut Oil).
  - Each suspension is a real `ProductUnavailable` one: the product was unlisted, the cycle was brought forward, the worker recorded `SkuNotPurchasable` and suspended the subscription, and the product was then relisted.
  - No unpaid-orders suspension could be made: it needs two expired or refused orders in a row.
- **S2's blank-reason text, confirmed.** `POST /api/staff/subscriptions/{id}/reinstate` with `reason: ""`, `"   "` or no reason answers 400 `{ errors: [{ errorCode: "ReinstatementReasonRequired", errorMessage: "'Reason' must not be empty.", propertyName: "Reason" }] }`. That is exactly what the mock sends.
- **The other real-API specs and the journey** (`real-api-verification`, `portal`, `xct`, `journey`, `reports`, `billing`, `inventory`, with `--project=chromium --project=real-api`, as in the recipe):
  - First run: 57 passed, 1 failed (billing E-F1), 2 skipped, 1 did not run (billing E-DL, serial after E-F1). The 2 skipped are the `xct` offline cases, which need a production build, as the README says.
  - E-F1 failed the same way twice, alone as well, for the same reason as the customer spec. Its new customer's Privacy prompt hid `/portal/billing`'s invoice link. In the error snapshot only the `aria-live` regions are left outside the dialog. Its files have not changed since the precedent's green run (`e62d66b`); why that run escaped the prompt is not known.
  - After Amended (r), `billing-real-api` is 14 of 14, E-DL included. **Nothing has regressed.**

### 3. S3 T12: a non-boolean `isSubscribable`

`PUT /api/staff/shop/products/{id}` with `isSubscribable` set to `"yes"`, `1`, `{}`, `[]` or `"true"`, and once with a stale `expectedVersion` as well, gave 400 `application/problem+json` every time:

```json
{ "type": "https://tools.ietf.org/html/rfc9110#section-15.5.1", "title": "One or more validation errors occurred.", "status": 400,
  "errors": { "request": ["The request field is required."],
              "$.isSubscribable": ["The JSON value could not be converted to System.Nullable`1[System.Boolean]. Path: $.isSubscribable | LineNumber: 0 | BytePositionInLine: 443."] },
  "traceId": "00-…" }
```

- The byte position is where the reader stopped: the end of a string or number token, or one byte past `{` or `[`.
- The version did not move (8 → 8). Binding fails before the version check, so a stale version gives the same 400, never `ProductVersionConflict`. That is what the mock already did.
- The mock's text and keys were invented (`isSubscribable: ["The value provided for isSubscribable is not valid."]`). They now copy the server's, under Amended (o).
- The web client turns any 400 into an `ApiValidationError` holding the body (`lib/api/client.ts:366-368`), so the real and mock answers reach a caller the same way. The UI never sends a non-boolean.

### 4. The version moves by 2 on a flip

Confirmed. `UpdateDetails` bumps the version once, and `SetSubscribable` bumps it again only when the value changes (`ProductAggregate.Subscription.cs:14-20`).

- **Real API, flips:** 5→7, 6→8, 6→8 and 10→12.
- **Real API, no flip:** a save that changed only `listedOnStorefront` went 8→9 and 9→10.
- **The mock now does the same**, under Amended (o). It is a three-line change, and a new Vitest case checks +2, +1, +1 and +2.

### 5. A14 (US-SUB-04)

Screenshots are in `docs/gates/screenshots/HO-P6-INTEGRATION/`.

| Step | What the real API and screens showed | Screenshot |
|------|--------------------------------------|------------|
| Settings screen | `/staff/admin/settings`, group "Subscriptions", "Subscriber discount (percent)": 0.00 → 10.00. The confirm dialog read "Subscriber discount: 0.00 → 10.00"; the reload showed 10.00 | `a14-1-settings-1280.png` |
| Offer | Hand-pounded Red Rice: "Subscribe & save 10%", signed in, at 1280 and 360 | `a14-2-offer-1280.png`, `a14-2-offer-360.png` |
| Subscribe form (rate) | "Subscription discount: 10% off every delivery" | `a14-3-subscribe-form-1280.png`, `a14-3-subscribe-form-360.png` |
| Server estimate | After creating (Delivery, cash on delivery): Items 1 × ৳180.00, Subtotal ৳180.00, "Subscription discount −10%" −৳18.00, Estimated per delivery ৳162.00 | `a14-4-estimate-1280.png`, `a14-4-estimate-360.png` |
| Generated order | Cycle 2026-11-09 brought forward; the worker raised ORD-2026-000004 (cycle `discount_percent` 10.00). Line: unit ৳180.00, discount ৳18.00, line total ৳162.00; delivery ৳60.00; total ৳222.00 | `a14-5-order-1280.png` |
| Invoice line | INV-MAIN-2627-000022: "Hand-pounded Red Rice - 1 kg … UNIT PRICE ৳180.00, DISCOUNT ৳18.00 … NET ৳162.00"; Discounts ৳18.00; Total ৳222.00 | `a14-6-invoice-staff-1280.png` |

- **A14 is evidenced on the real API.** The discount is configured on the existing settings screen, then shown on the offer, the form (as a rate), the server estimate and the invoice line.
- **Two findings.**
  - Only an **administrator** can open the settings screen. The shop manager gets "You don't have permission to do this.", and the API agrees: `GET` and `PUT /api/admin/settings` answer 403 `ActionNotPermitted`. But US-SUB-04 ("As a shop manager…") and the comment on `SettingDefinitions.Subscriptions.cs:3-4` say the shop manager sets it. The web follows the server. Owner item 15.
  - Neither the invoice nor the order page names the discount: it is a bare `DISCOUNT ৳18.00`, or "Item discounts" on the order. ADR-242 calls it a "labelled line discount". The US-SUB-04 AC ("shown on the invoice") is met. Owner item 16 (LOW).

### 6. §20.9: an order link from a subscription, for an order at another branch

- **Set-up.**
  - A second outlet, "Uttara outlet (P6 check)" (`fab4ce45-…`), created through `POST /api/admin/branches`.
  - A shop manager whose only branch is Uttara (`p6.uttara.manager@amargram.test`).
  - The Main-outlet subscription order ORD-2026-000004 from A14.
- **What the server does.**
  - Subscriptions are not branch-scoped. Under the Uttara branch, `GET /api/staff/subscriptions/{id}` is 200 and lists the cycle with `orderId` and `orderNumber`.
  - `GET /api/staff/orders/{id}` with `X-Branch-Id` Uttara is **404**, with the plain ProblemDetails body. The order "does not exist" for another branch (`StaffOrdersController.cs:19`, `:160-167`).
  - The same request with `X-Branch-Id` Main is **403** `{"error":"BranchNotAssigned"}`.
  - The Main-branch administrator gets 200 (channel `Subscription`).
- **What the screens do.** The subscription detail keeps the link (`/staff/orders/37f592be-…`). Following it, the order page shows its own refusal: "Order not found. This order may belong to another branch." No error banner, and the active branch is not switched. Screenshots `s20-9-1-subscription-detail-uttara-1280.png` and `s20-9-2-order-page-uttara-1280.png`.
- **The other direction could not be made.** A pickup subscription at Uttara has no order, because Uttara holds no stock. The cycle was recorded as **failed, `SkuUnavailable`**, with no order. This shows BG-S3's concern on the real API: any active outlet is offered for collection (`CheckoutInputsLoader.cs:65-67`), even one that can never fill the order. Owner item 6 is updated.

### 7. Ownership

A second customer, registered through the API, asked for another customer's subscription `e8725fd2-…` and for a missing id (`5b000000-…-dead`). Each pair answered the same:

| Request | Another customer's | Missing |
|---------|--------------------|---------|
| `GET /api/customers/me/subscriptions/{id}` | 404 ProblemDetails | 404 ProblemDetails |
| `GET …/{id}/cycles` | 404 ProblemDetails | 404 ProblemDetails |
| `POST …/{id}/skip` | 404 ProblemDetails | 404 ProblemDetails |

Each body is `{ type: "…section-15.5.5", title: "Not Found", status: 404, traceId }`, so nothing in it tells the two apart. ADR-248 holds on the real API.

### 8. A finding that is not about the screens: a cleared flag does not stop the next order

- **What happened.** For the first suspension attempt, Chira's "Can be subscribed to" flag was cleared and its subscription's cycle brought forward. The worker **placed the order** (ORD-2026-000002) and the subscription went on to its next date.
- **Why.** Generation fails `ProductUnavailable` only on `SkuNotPurchasable`: an unlisted or inactive product or SKU (`SubscriptionFailureClassifier.cs:14`, `CheckoutPricing.cs:128`). It never reads `IsSubscribable`.
- **What says otherwise.**
  - The domain comment says "clearing it never touches existing subscriptions -- their next cycle simply fails `ProductUnavailable` and suspends" (`ProductAggregate.Subscription.cs:4-7`).
  - So does the staff editor's help text under OQ-18: "Turning it off does not cancel existing subscriptions: their next order is not placed and they are suspended."
- **Status.** This is a product question: either the server should honour the flag at generation, or the help text should change. It is not decided here. Owner item 14, with a proposed BG-S11.

### Changes, verification and process

- **Changes.** Amended (o) to (s), plus the comparator's dictionary rule: `f0ae577`, `5d38de8`, `504f3f4` and `b7cecc3` (see Commits).
- **Checks after the changes.**
  - `npm run typecheck` and `npm run lint`: clean.
  - `npm test -- --maxWorkers=2`: 270 files passed and 1 skipped (the contract test); 2712 tests passed (part 1 had 2710, plus the 2 new (o) cases), 72 skipped, 0 failed (435.2 s).
  - The real-API specs above were re-run after their changes.
- **Not run again.** The E16 mock chunks were not re-run. The mock changes only add fields, copy two error bodies and add one version step, and the full Vitest run covers them.
- **Processes.** At the end the API, `next dev` and every node, dotnet, Playwright and `chrome-headless-shell` process the integrator started were stopped. Ports 5099, 5127 and 3132 were free. The node process that was already running before part 2 (pid 19840) was left alone. `amargram_p6int` is kept for the owner; it is a scratch database and may be dropped.

## For the owner

Collected from the S0-S3 ACCEPTANCE records, plus what this integration found. None of these blocks the run.

1. **Baseline list.** All 11 §1 baseline cases passed in this run (after `fix/baseline-and-lows`). The §1 rule says the list may only shrink, so it is the owner's to clear.
2. **Real-API proof (E18, A14, S1 T11, S2's blank-reason text, S3 T12, the version bump): done in part 2.** See "Part 2: E18 on the real API".
3. **OQ-20 (S0).** The backlog and SRS wording. The 2026-11-07 cleanup (Amended (g)) covered `docs/USER_STORIES.md` and `docs/SRS.md`. Confirm that it settles the question.
4. **ADR table in `docs/handover/README.md` (S0), not done here.** The file is outside the integration block. The change is:
   - Row `ADR-FE-109 … ADR-FE-118 | HO-SUB-002 (109–114 used)` becomes "109–114 recorded by HO-P6".
   - Add a row `ADR-FE-193 … ADR-FE-202 | HO-P6-SUBSCRIPTIONS (193–197 used)`.
   - Move the next-free note past ADR-FE-197.
5. **Backend follow-ups (proposed, not decided):**
   - BG-S1: `isSubscribable` on the public product read (signed-out offer).
   - BG-S2: a Subscriber filter on staff customers browse.
   - BG-S3: a pickup-branch list or flag on `/api/branches`.
   - BG-S4: an estimate before creation.
   - BG-S5: the reinstater's name.
   - BG-S6: the staff restart-date range.
   - BG-S7: multi-item subscriptions.
   - BG-S8: a product slug on the subscription product view.
   - BG-S9: the unpaid threshold on the customer view.
   - BG-S10 (S2): `commerceTimeZoneId` on `UnpaidSubscriptionViewModel`. Until then, Unpaid pay-by times are shown in Asia/Dhaka with the zone named.
   - From S3: a `dueOn` filter on the staff list. The "Subscription orders due tomorrow" row opens every Active subscription, not only those due tomorrow.
6. **§20.9 cross-branch order links (S2): proven in part 2.**
   - Subscriptions are not branch-scoped. A staff member at another branch sees the link, and the order page says "Order not found. This order may belong to another branch." The API answers 404, or 403 `BranchNotAssigned` if the header names a branch the user lacks.
   - Owner question: should a subscription's order be reachable from any branch the subscription is visible from?
   - Related: an outlet with no stock is still offered for collection, and its cycles fail `SkuUnavailable` (BG-S3, now seen on the real API).
7. **44 px follow-ups:**
   - The dialog close X stays at 24 px (Amended (j)(2)). A global 44 px pass is a follow-up.
   - The orders "More filters" controls other than Channel are also left for that pass (Amended (l)(3)).
8. **Visual LOWs (no criterion attached):**
   - S1: in the history table at 1280, the order-number cell sits about one line lower than its row.
   - S1: the terms panel reads "Deliver to me … Deliver to Home: …", which says it twice.
   - S2: at 1280 with the sidebar expanded, the nine-column staff list scrolls inside its container. "Unpaid in a row" and "Last order" are off-screen.
   - S3: at 360, the customer profile tab bar hides Billing and Notes behind an inner scroll. Wrap the tabs, or shorten the labels.
   - S3: at 360, the pre-existing erase-personal-data panel's selects overflow their card.
9. **Test hygiene (LOW, found here).** The flaky axe case above. `subscriptions-customer-a11y` scans the Subscribe form while the submit button is still in its colour transition. The spec's own `retries: 1` absorbs this. A wait for the transition to end, or `prefers-reduced-motion` in that spec, would make it deterministic.
10. **S1 guard nit (ARCH LOW).** MySubscriptionsList aliases `totalCount` to `rows` to satisfy S0's guard. The guard should learn that `*Count` names are counts.
11. **The dev server restarts itself on long runs.** With `E2E_KEEP_ROUTES=1` (HO-P5 Amended (au)), `next dev` keeps every compiled route. On the 185-route sweep it reached Next's memory threshold and restarted once, and the one route in flight was refused. No e2e chunk hit this. If it recurs, a sweep split by `SWEEP_AUDIENCE` avoids it.
12. **`npm run test:contract` could not have passed since HO-P1.** The retired purchasability GET stopped it on the mock side. It is fixed here (Contract test, above). Its first real run (part 2) found three drifts in other areas: two were fixed and one is item 13.
13. **The storefront mock lists one card per product; the server lists one per size** (owner, 2026-10-18; `CatalogueSizeExpansion.cs`).
    - `GET /api/shop/products` is the one red contract row: `items[].skuId` and `items[].sizeLabel` are missing in the mock.
    - The web already handles both shapes (`ProductCard.tsx`).
    - Making the mock expand by size changes what every shop spec and test sees. It needs its own pass, not an integration patch.
    - It is not in `KNOWN_DRIFT`.
14. **A cleared "Can be subscribed to" flag does not stop the next order (product decision).** On the real API the worker placed the order for a product whose flag had been cleared. Generation checks only purchasability (`SubscriptionFailureClassifier.cs:14`). Both of these say the subscription is suspended instead:
    - the editor's help text (OQ-18: "their next order is not placed and they are suspended");
    - the domain comment (`ProductAggregate.Subscription.cs:4-7`).
    Choose one:
    - (a) a backend follow-up, **BG-S11**: the worker refuses a cycle for a non-subscribable product with `ProductUnavailable`, which is what the comment and HO-SUB-001 §8.6 imply;
    - (b) new help text, for example "Turning it off stops new subscriptions; existing ones carry on."
    Nothing was changed here.
15. **Who sets the subscriber discount.** US-SUB-04 says the shop manager, and so does `SettingDefinitions.Subscriptions.cs:3-4`. But the settings screen and `GET`/`PUT /api/admin/settings` are administrator-only (403 `ActionNotPermitted` for `e2e.shopmanager`). Confirm the role, or ask for a backend change.
16. **The subscription discount is not labelled on the invoice or the order (LOW).**
    - The invoice line shows `DISCOUNT ৳18.00`, and the order shows "Item discounts ৳18.00".
    - ADR-242 says "labelled line discount". The US-SUB-04 AC is met.
    - A label ("Subscription discount 10%") would need Orders and Billing to carry it.
17. **New accounts on a seeded database meet a modal policy prompt.** Two real-API specs registered customers without accepting it and failed: S1's spec and billing E-F1, fixed under Amended (p) and (r). The journey spec already accepts it. Any future real-API spec that registers a customer needs the same step.
18. **Mocks across the app send a bodiless 404; the server sends ProblemDetails.** Only the subscriptions mocks were aligned (Amended (p)). The client ignores 404 bodies, so nothing visible differs. The contract check compares GET 200s only, so it cannot see this. This is a note for whoever next extends the check.

## Commits

| Commit | What |
|--------|------|
| `7d9254f` | test(contract): the HO-P6 subscription GETs; the retired purchasability GET dropped |
| `880a01f` | docs(staff): stale staff-home comment; Amended (n) |
| `3d2b436` | docs(gates): HO-P6 integration record, part 1 |
| `f0ae577` | test(mocks): the real 400 for a non-boolean `isSubscribable`; a flip moves the version by 2; Amended (o) |
| `5d38de8` | test(subscriptions): the real-API specs accept pending policies, pin the ProblemDetails 404 and find the 360 card list; the mocks send the same 404; Amended (p), (q) |
| `504f3f4` | test(e2e): billing E-F1 accepts pending policies; Amended (r) |
| `b7cecc3` | test(contract): the first real run since HO-P1; order detail and catalogue fields; `byKind` compared as a dictionary; Amended (s) |
| (this record) | docs(gates): integration record part 2 (E18), verdict, Amended (o) to (s), screenshots |

## Still red

- **`npm run test:contract`: 1 of 72**, `GET /api/shop/products` (`items[].skuId`, `items[].sizeLabel`). This storefront mock drift is from before HO-P6 (owner item 13). Every HO-P6 row matches.
- Nothing else. No E16 non-baseline failure reproduces, no baseline case failed, and every real-API spec is green: the 2 `xct` offline cases are skipped by design without a production build.

## Verdict

**PASS, with owner items.**

- **Part 1.** E16 and E17 are clean apart from load flakes that pass alone.
- **Part 2, E18 on the real API.** Every subscription path is proven:
  - S1 T11 and the S2 staff cases, on both projects;
  - S2's blank-reason text;
  - S3 T12's body and the version step, with both copied into the mock;
  - A14 from the settings screen to the invoice line;
  - §20.9's refusal;
  - ownership 404s.
- **No regression.** The other real-API specs and the journey are green.
- **Open items, none of which is a defect in HO-P6's screens:**
  - one red contract row, from the storefront mock before HO-P6 (item 13);
  - two product questions, the cleared flag and who sets the discount (items 14 and 15).
- **Not done.** Nothing is pushed or merged.

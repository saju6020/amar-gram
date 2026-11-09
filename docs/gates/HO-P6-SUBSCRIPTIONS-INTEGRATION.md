# HO-P6-SUBSCRIPTIONS — integration record, part 1 (E16, E17; E18 pending)

Branch `chore/p6-integration`, from `feat/phase2-catalogue-theme` at `4c1aab9` (S0, S1, S2 and S3 merged, each after five gates PASS). Integrator: Claude (Opus 5.5), under the owner's 2026-10-31 delegation. Run 2026-11-09 on this machine. Nothing pushed or merged.

This is part 1: everything except the real-API run. E18 (the `*-real-api` specs and `npm run test:contract` against a scratch API) is **pending, part 2** (below).

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
| E18 real-API specs and `npm run test:contract` | **Pending, part 2** |

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
- **`KNOWN_DRIFT` is unchanged and empty.** The `isSubscribable` drift on `GET /api/staff/shop/products/{id}` closed with S3; part 2 confirms it.
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

It is recorded in `docs/handover/HO-P6-SUBSCRIPTIONS.md` §1 as an integrator decision, under the owner's 2026-10-31 delegation. The purchasability removal is inside the integration block, so it needs no row.

## Pending, part 2 (E18, A14, A20's contract part)

Part 2 needs a scratch API. Use the `web/README.md` "Real-API end-to-end runs" recipe: a scratch database such as `amargram_realapi`, `seed-dev-db.mjs`, `start-seeded-api.mjs`, `seed-e2e-real-api.mjs`, and the web app with `NEXT_PUBLIC_USE_MOCKS=false`. With that in place, part 2 must run:

1. **`npm run test:contract`** with `CONTRACT_API_BASE_URL`, `JOURNEY_CUSTOMER_EMAIL`/`PASSWORD` (`customer@amargram.test`), `E2E_STAFF_ADMIN`/`E2E_STAFF_PASSWORD` (`e2e.admin@amargram.test`).
   - The seeded customer needs an address in a served zone. The check already relies on that for the order quote.
   - On first run the check may make up to five products subscribable and start one subscription. Record which product it flipped.
   - Every difference is a finding. None goes into `KNOWN_DRIFT` to hide it.
2. **The S1 and S2 real-API specs:** `subscriptions-customer-real-api.spec.ts` (S1 T11) and `subscriptions-staff-real-api.spec.ts`, with `E2E_REAL_API=1`.
   - S2's item to confirm: the blank-reason text. The mock sends FluentValidation's default "'Reason' must not be empty.".
3. **S3 TEST T12:** the real API's 400 body for a non-boolean `isSubscribable` on `PUT /api/staff/shop/products/{id}`. Copy its text into the shop mock if it differs. The UI never sends one.
4. **The version bump on a flag flip.** A save that flips `isSubscribable` moves the server's version by 2. The mock moves it by 1 (S3 CODE_REVIEW run 1 LOW 2). Confirm, and decide whether the mock should follow.
5. **A14 (US-SUB-04):**
   - Set the discount on the settings screen (registry-driven, `lib/api/admin-settings.ts`). The default is 0.00 %.
   - Then show it on the offer, the form and the server estimate.
   - Then show its line on the invoice of a generated subscription order.
   - In this mock-only run, A14 is "real-API pending".
6. **§20.9:** an order link from a subscription whose order was raised at another branch. Record what the order page shows (404 or 403).
7. **Ownership:** another customer's subscription is the same 404 as a missing one. The mock always treats the customer as Sam, so only the real API proves this.

## For the owner

Collected from the S0-S3 ACCEPTANCE records, plus what this integration found. None of these blocks the run.

1. **Baseline list.** All 11 §1 baseline cases passed in this run (after `fix/baseline-and-lows`). The §1 rule says the list may only shrink, so it is the owner's to clear.
2. **Real-API proof is owed (E18, A14, S1 T11, S2's blank-reason text, S3 T12, the version bump):** see "Pending, part 2".
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
6. **§20.9 cross-branch order links (S2).** Kept, never hidden. Unproven on the real API (part 2, item 6).
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
12. **`npm run test:contract` could not have passed since HO-P1.** The retired purchasability GET stopped it on the mock side. It is fixed here (Contract test, above), but no real-API contract run since HO-P1 can have been green.

## Commits

| Commit | What |
|--------|------|
| `7d9254f` | test(contract): the HO-P6 subscription GETs; the retired purchasability GET dropped |
| `880a01f` | docs(staff): stale staff-home comment; Amended (n) |
| (this record) | docs(gates): HO-P6 integration record, part 1 |

## Still red

Nothing. There is no non-baseline failure that reproduces, and no baseline case failed. E18 is pending, part 2.

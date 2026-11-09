# P6 owner fixes (2026-11-09): final verification

Branch `fix/p6-owner-int`, head `94b30b2`. Sheet: `docs/test-cases/TC-P6-OWNER-FIXES.md` (every row observed; evidence there). Screenshots: `docs/gates/screenshots/P6-OWNER-FIXES-REAL-API/`. Nothing pushed or merged.

## Verdict

**Part A (mock): PASS.** **Part B (real API): FAIL on two rows, neither in changed code:** the contract test has two new red rows (B1) and part of the recipe's real-API specs could not run to the end in the polluted scratch database (B2c). Every owner-fix check on the real API passed (B3 to B11). **Overall: not green as asked, but no defect found in the owner fixes. The failures need an owner decision (clean database or accept).**

## Part A

| Step | Result |
|---|---|
| typecheck, lint | clean |
| Vitest `--maxWorkers=2` | 272 files passed, 1 skipped; 2730 tests passed, 72 skipped, 0 failed (438 s) |
| build | compiled, 126 pages |
| colour-literal rg | no match |

| Chunk | Passed | Failed | Flaky | Skipped | Note |
|---|---|---|---|---|---|
| c1 customer/store | 479 | 1 | 0 | 8 | `home.spec.ts:26` chromium (cold first hit, same as the previous record); re-run alone: failed once cold, then 3 passes |
| c2 portal-dashboard | 24 | 0 | 0 | 0 | |
| c3 other portal | 34 | 0 | 0 | 4 | |
| c4 staff | 168 | 0 | 0 | 10 | includes the new nextDeliveryOn, tabs, erase panel and order filter cases |
| c5 sales | 156 | 6 | 3 | 14 | machine saturated (51 min vs 10.8). Failures: `dashboard-home:43` E7, `ordering-a11y-responsive` `/cart`, `/portal/orders`, `.../return`, :133, :147 (timeouts). Re-run alone workers=1 both projects repeat 2: all passed (36 of 36 route cases, :133 and :147 4 of 4, E7 4 of 4) |
| c6 inventory | 539 | 1 | 0 | 24 | `procurement-flows:95` E-A3; alone 4 of 4 passed |
| c7 billing/admin | 388 | 0 | 0 | 30 | |
| c8 notifications/xct | 188 | 0 | 0 | 22 | |
| c9 | 44 | 0 | 2 | 24 | p5-followup-layout-360 :77, :98 flaked, passed on retry; alone 12 of 12 |
| sweep:a11y | 184 of 185 | 1 | | | `/staff/customers/duplicates` ERR_CONNECTION_REFUSED after next's memory restart; alone 2 of 2 clean |

c5's E7 is a dashboard case (changed area) but asserts the sales chart region, not the attention rows; it failed on a 5 s wait under load and passes alone. No baseline case failed. No failure touches a dialog, tab, orders filter, subscription, order or invoice screen.

## Part B

- **Set-up.** No migrations on this branch. `seed-dev-db.mjs` on `amargram_p6int` reset the admin password but stopped at "SKU already in use" (not idempotent on this DB); other passwords were reset through the reset flow; `seed-e2e-real-api.mjs` fails here (the staff list ignores `search`), so a scratch copy that pages the lists made the seed files. API on 5127, web on 3135.
- **The database is polluted** by integration-test data from earlier today (7248 products, hundreds of test branches, 34 policies, extra banners). This is the cause of the B1/B2c failures. Reversible edits made for the run were restored (list in the sheet's Environment).
- **B1 `test:contract`: 3 failed, 69 passed.** (1) shop products `skuId`/`sizeLabel`, the known owner item 13. (2) New: `GET /api/policies/{key}`, the real API 404s for 34 listed keys (test policies, not public). (3) New: `GET /api/staff/billing/cash-ups/{date}`, `lines[].sourceKey` missing in the mock. All HO-P6 rows match. Neither new row involves a file this branch changed. The contract test does not compare the new label fields (null in the sampled rows); they were checked directly.
- **B2 real-API specs.** Subscriptions customer 4 of 4 and staff 10 of 10 on chromium and mobile-360. Billing 14/14, portal 2/2, reports 8/8, xct 8 (+2 skipped by design), real-api-verification 3/3 (after setting 20 test policies to not require acceptance). Not passing: inventory R-A2 (Page crashed; 10 following serial cases did not run), journey 5e (first "Privacy Policy" link is a test policy; 5f and 2 console checks did not run). Steps 1 to 5d of the journey passed, including the delivery checkout and the staff order list.
- **Owner-fix items on the real API (all PASS, 1280 and 360):**
  - Cleared flag: order ORD-2026-000630 still raised (10% cycle), subscription Active, next date +28 days; a new subscription is refused 400 `SkuNotSubscribable`.
  - Due tomorrow: dashboard row 3, link `?status=Active&nextDeliveryOn=2026-11-10`, chip shown, list total 3, export.csv 3 rows (unfiltered 286).
  - "Subscription discount (10%)" on customer order, staff order, customer invoice, staff invoice, and in the downloaded PDF text.
  - Normal discounted order ORD-2026-000631: "Item discounts", "Order discount", invoice "Discounts"; no label.
- **Observation, outside the fixes:** a subscription order's staff page still shows "Order discount (Subscription discount) 0.00" and "Discount code: Subscription discount".

## Findings for the owner

1. Run the inventory, journey 5e and contract policy rows against a clean scratch database; this one cannot be made green without deleting integration data.
2. Contract rows (2) and (3) are drifts in mocks/test assumptions, not in this branch.

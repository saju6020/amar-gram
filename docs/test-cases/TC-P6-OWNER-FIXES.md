# TC-P6-OWNER-FIXES — Final verification of the owner's 2026-11-09 fixes (frontend and backend, integrated)

Handover: `docs/handover/HO-P6-SUBSCRIPTIONS.md`, Amended rows (t) to (ac). Gate records: `docs/gates/P6-OWNER-FIXES-BACKEND-*.md`. Previous run: `docs/gates/HO-P6-SUBSCRIPTIONS-INTEGRATION.md`.
Commit(s) under test: `94b30b2` on `fix/p6-owner-int` (= `feat/phase2-catalogue-theme` d83ef5f + backend fixes + frontend fixes)
Written: 2026-11-09  ·  Executed: 2026-11-09

> Statuses record what was **observed**, not inferred. The Evidence column names what was actually seen. `BLOCKED` marks a case that could not be executed or whose result was reasoned about rather than watched. The handover has no numbered integration rows for this work; IDs below were assigned by the tester from the task brief and the Amended rows.

## Summary

| | Count |
|---|---|
| Total (rows with an ID) | 41 |
| PASS | 33 |
| FAIL | 2 (B1, B2c) |
| BLOCKED | 1 (R2); coverage row (aa) |
| NOT RUN | 0 |

A5 to A13 carry load-flake notes with re-run evidence (A5a, A9a, A10a, A13a). Counts are of the rows above; (a few PASS rows contain failed first attempts explained in Evidence).

## Environment

Windows, 2 Playwright workers for Part A, 1 for Part B. Build, typecheck, lint, Vitest (272 files, 2730 tests), 8 mock chunks and the sweep ran on commit 94b30b2. Postgres 17 on localhost:5432; only amargram_p6int was written. API built from this worktree (Release), run on 5127; web next dev on 3135 with mocks off. The machine was heavily loaded during chunk c5 (51 min against 10.8 min before).

The scratch database amargram_p6int is not as the previous run left it: it holds data from backend integration runs earlier today (7248 products incl. 5000 from one actor, hundreds of Billing/Audit/Export test branches, 34 policies, extra banners, 5 suspended Royal Basmati subscriptions). For the run I changed and then restored: listed_on_storefront on 7196 non-seed products, 10 Marker banners (status), requires_acceptance on 20 policies, subscription.discountPercent (set to 10, back to 0), Ajwa Dates isSubscribable (cleared, back to true). Left behind on purpose: discount code OWNERFIX10, orders ORD-2026-000630/631, cycles and next_delivery_on dates changed for fixtures, 3 subscriptions dated 2026-11-10, 2 cancelled and 2 restarted subscriptions.

## Part A: mock

| ID | Case | Expected | Status | Evidence |
|---|---|---|---|---|
| A1 | `npm run typecheck` | clean | PASS | tsc --noEmit exit 0, no output |
| A2 | `npm run lint` (`--max-warnings 0`) | clean | PASS | eslint . --max-warnings 0 exit 0, no output |
| A3 | `npm test -- --maxWorkers=2` (full Vitest, includes `owner-fixes-p6`, `discount-label`, `staff-list` nextDeliveryOn, `mock-refusals`) | 0 failed | PASS | 272 files passed, 1 skipped (contract); 2730 tests passed, 72 skipped, 0 failed; 438.3 s (previous record 270/2712) |
| A4 | `npm run build` | compiles | PASS | Compiled successfully in 26.6s; 126/126 static pages; exit 0 |
| A5 | c1 customer/store: `subscriptions-customer*`, `shop-*`, `home`, `account*`, `ordering-customer*` (incl. new subscriptions-customer cases for the terms row and history cell, Amended (z)) | 0 real failures | PASS | 479 passed, 8 skipped, 1 failed: home.spec.ts:26 chromium (first cold hit to / timed out 5 s waiting for /shop). Re-run alone: see A5a |
| A5a | Re-run home.spec.ts:26 alone, workers=1, both projects, repeat-each=2 | passes on a warm server | PASS | Fresh server, first hit failed again (cold / to /shop, 5 s); the next three runs passed (chromium run 2, mobile-360 runs 1 and 2). Same signature as the previous record; no changed code involved (root redirect) |
| A6 | c2 `portal-dashboard` | 0 real failures | PASS | 24 passed, 0 failed (30 s) |
| A7 | c3 other portal (`portal-a11y-responsive`, `portal-real-api`) | 0 real failures | PASS | 34 passed, 4 skipped (real-API), 0 failed |
| A8 | c4 staff: `subscriptions-staff*` (new nextDeliveryOn chip case), `subscriptions-backoffice*` (profile tabs, erase panel, order filters 44 px), `staff-*` | 0 real failures | PASS | 168 passed, 10 skipped, 0 failed (4.5 min); includes subscriptions-staff nextDeliveryOn chip case and the 360 specs for tabs, erase panel, order filters |
| A9 | c5 sales: `ordering-staff`, `ordering-pos`, `ordering-a11y-responsive`, `dashboard-*`, `sales-gate-s2`, `packed-customer-after-staff`, `reports-*` | 0 real failures | PASS | 156 passed, 14 skipped, 3 flaky, 6 failed, 1 did not run, under heavy machine load (51 min against 10.8 min before). Failures: dashboard-home:43 E7, ordering-a11y-responsive :100 /cart, /portal/orders, /portal/orders/.../107/return, :133, :147 (all chromium; test timeouts of 3 min). Re-run alone at workers=1, both projects, repeat-each=2: all passed (A9a) |
| A9a | Re-run c5 failures alone: dashboard-home:43, ordering-a11y-responsive :133 :147 and all customer routes, procurement not in c5; workers=1, both projects, repeat-each=2 | all pass | PASS | dashboard-home:43 4 of 4, :133 4 of 4, :147 4 of 4; customer routes plus delivery-zones/new and discount-codes: 36 of 36 passed (11.2 min). E7 failed on a missing Sales chart region within 5 s while the machine was saturated; the dashboard attention rows are not what it asserts |
| A10 | c6 inventory: `inventory-*`, `procurement-flows`, `catalogue-stock-*`, `shop-staff` | 0 real failures | PASS | 539 passed, 24 skipped, 1 failed: procurement-flows:95 E-A3 chromium (fixtures.ts:150 goto/service-worker wait). Re-run alone: passed 4 of 4 (A10a) |
| A10a | Re-run procurement-flows:95 alone, workers=1, both projects, repeat-each=2 | passes | PASS | 4 of 4 passed (22 to 24 s each). Same case flaked in the previous record; inventory code, not changed code |
| A11 | c7 billing/admin: `billing-*`, `admin-*`, `customers-admin-*` | 0 real failures | PASS | 388 passed, 30 skipped, 0 failed (22.5 min) |
| A12 | c8 `notifications-*`, `xct-*` | 0 real failures | PASS | 188 passed, 22 skipped, 0 failed (8.5 min) |
| A13 | c9 (not in 17.2): `msw-start-race`, `order-tracker-360`, `p5-followup-layout-360`, `journey-real-api` | 0 real failures | PASS | 44 passed, 24 skipped, 2 flaky (p5-followup-layout-360 :77 and :98 chromium, passed on the spec's own retry); 0 failed. Re-run alone: 12 of 12 passed (A13a) |
| A13a | Re-run p5-followup-layout-360 :77 and :98 alone, workers=1, both projects, repeat-each=2 | pass | PASS | 12 of 12 passed |
| A14 | `npm run sweep:a11y` | no serious/critical axe finding | PASS | 185 routes: 184 passed; /staff/customers/duplicates got ERR_CONNECTION_REFUSED because next dev logged 'approaching the used memory threshold, restarting...' (known, owner item 11; not an axe result). Re-run alone on a fresh server with SWEEP_ONLY=customers/duplicates: 2 of 2 passed (duplicates, duplicates/review). 21.3 min |
| A15 | colour-literal `rg` check over `components app` | no match | PASS | rg -n --glob "*.{ts,tsx}" "#[0-9a-fA-F]{3,8}\b/rgba?\(/hsla?\(/-\[#" components app: no match, exit 1 |

## Part B: real API (`amargram_p6int`, API from this worktree, web on 3135, mocks off)

| ID | Case | Expected | Status | Evidence |
|---|---|---|---|---|
| B0 | Set-up: migrations applied/none pending, API starts on `amargram_p6int`, `/api/dev/database` names it | API healthy | PASS | No new migrations on this branch (__EFMigrationsHistory at 20261025000100_AddRiderRetentionGuard, 3 rows). seed-dev-db.mjs --db amargram_p6int --port 5099: run 1 timed out waiting for the admin reset mail (notification backlog); run 2 --skip-build set the admin password then stopped at SKU 'already in use' (seeder is not idempotent on this DB; account passwords for the others were already set by the first pass). Unknown passwords reset through the reset flow for accountant x2 and customer; API started with start-seeded-api.mjs --db amargram_p6int --port 5127 --web-port 3135 (Subscriptions__Worker__IntervalSeconds=20); GET /api/dev/database returned amargram_p6int; web next dev on 3135 mocks off. seed-e2e-real-api.mjs fails on this DB (search param ignored by staff product list; 7248 products), so a scratch copy that pages the lists produced bil-seed.json and rpt-seed.json |
| B1 | `npm run test:contract`, including the new label fields | only the storefront one-card-per-product row (owner item 13) red | FAIL | 3 failed, 69 passed (72). (1) GET /api/shop/products skuId and sizeLabel missing in mock: the known owner-item-13 row. (2) NEW: GET /api/policies/{key}: real API answers 404 for 34 listed keys (test policies in this DB, only some public). (3) NEW: GET /api/staff/billing/cash-ups/{date}: $.lines[].sourceKey missing in mock (real API sends it). All HO-P6 rows match (C1 to C5, T1 to T3, T5, T6, T9, staff product detail). Neither new row touches code changed on this branch (git diff of mocks and src lists no policy or cash-up file; (2) comes from test policies in the polluted scratch DB, (3) is a mock that omits a field that real lines carry once the DB has cash-up lines). The contract test has no assertion on the new discountLabel fields (they are null on both sides for the sampled order); checked directly in B7 to B11 |
| B2a | `subscriptions-customer-real-api`, chromium and mobile-360 | pass | PASS | chromium 2 of 2 and mobile-360 2 of 2 after the storefront list was made usable (see Environment): the first attempt self-skipped both cases because the first 24 shop cards had no skuId |
| B2b | `subscriptions-staff-real-api` both projects | pass | PASS | chromium 5 of 5 and mobile-360 5 of 5 (restart and cancel included) with fixtures: chromium suspended 0a805218 (Chola) active 7f7301f3 (Chira); mobile suspended 7a417d33 (Desi Cow Ghee) active 23ace462 (Jackfruit Chips). First attempt: restart failed because my unlisting of non-seed products had made the Royal Basmati fixtures unavailable (my set-up error, not a product defect) |
| B2c | `real-api-verification`, `portal-real-api`, `xct-real-api`, `reports-real-api`, `billing-real-api`, `inventory-real-api`, `journey-real-api` | pass (2 xct offline cases skip by design) | FAIL | Recipe run (chromium + real-api projects, workers=1): billing 14/14, portal 2/2, reports 8/8, xct 8 passed + 2 skipped by design, real-api-verification 3/3 (after 20 test policies were set not-requiring-acceptance; before that the register case hit strict-mode on 19 Accept buttons). FAILED in this polluted DB, none touching changed code: inventory R-A2 (Page crashed on /staff/inventory/receipts/new; 10 serial cases after it did not run); journey 5e (first 'Privacy Policy' link in /staff/admin/policies is a test policy whose text lacks 'respects your privacy': 5f and the 2 console-error cases did not run; steps 1 to 5d passed after 10 test banners were unpublished). The DB holds 7248 products, 300+ test branches, 34 policies and extra banners from backend integration runs. mobile-360 not run for these non-subscription specs |
| B3 | Clear "Can be subscribed to" on a product with a live subscription, force its cycle: order still raised, subscription stays Active (Amended (t), I_D8) | order raised, Active | PASS | Ajwa Dates (isSubscribable cleared via PUT). Subscription 4982a279 had next_delivery_on forced to 2026-11-07 in amargram_p6int; worker raised order ORD-2026-000630 (cycle outcome Generated, discount_percent 10.00), subscription still Active, next delivery 2026-12-05 (+28 days) |
| B4 | A new subscription on that product is refused | 400 `SkuNotSubscribable` | PASS | POST /api/customers/me/subscriptions for the cleared SKU: 400 SkuNotSubscribable 'This product is not offered as a subscription.'; options?skuId= says subscribable=false. The customer already held a live subscription on it, and the flag check still answered first |
| B5 | Dashboard "due tomorrow" link opens the list with `nextDeliveryOn`; count equals list total | counts equal | PASS | 3 subscriptions set to next_delivery_on 2026-11-10. API due-tomorrow count 3; dashboard row 'Subscription orders due tomorrow 3' href /staff/subscriptions?status=Active&nextDeliveryOn=2026-11-10; list opened with chip 'Next delivery: Tue 10 Nov' and 3 rows; API list totalCount 3 (unfiltered Active 221); bad date 400 'nextDeliveryOn must be yyyy-MM-dd.'. 1280 and 360, no sideways scroll |
| B6 | `export.csv?nextDeliveryOn=` honours the filter | only matching rows | PASS | export.csv?nextDeliveryOn=2026-11-10: 4 lines (header + 3 rows, all NextDeliveryOn 2026-11-10); unfiltered export 287 lines |
| B7 | Subscription order shows "Subscription discount (N%)" on the customer order page | label shown | PASS | Customer order page for ORD-2026-000630: 'Subscription discount (10%) ৳145.00' in the summary and under the line; no 'Item discounts'; 1280 and 360. API JSON lines[].discountLabel and totals.lineDiscountLabel = 'Subscription discount (10%)' |
| B8 | ...the staff order page | label shown | PASS | Staff order page: summary row 'Subscription discount (10%) ৳145.00', no 'Item discounts'; 1280 and 360. Side note (not part of the fix): the same page still lists 'Order discount (Subscription discount) ৳0.00' and 'Discount code: Subscription discount' |
| B9 | ...the invoice page | label shown | PASS | Customer invoice page and staff invoice page INV-MAIN-2627-000030 show 'Subscription discount (10%)' on the line and in totals at 1280 and 360; invoice JSON lines[0].discountLabel and totals.discountLabel set, the delivery line's null |
| B10 | ...the invoice PDF text (downloaded) | label in text | PASS | PDF downloaded both through the API (customer and staff endpoints, 200 application/pdf, 52920 bytes) and from the customer invoice page (INV-MAIN-2627-000030.pdf, kept in the screenshots folder). pdftotext: 'Product - Subscription discount (10%) BDT 145.00' under the Ajwa Dates line |
| B11 | A normal discounted order shows its old text ("Item discounts" / "Discounts", bare discount) | old text, no label | PASS | Created discount code OWNERFIX10 (10% on the order) and ORD-2026-000631 (INV-MAIN-2627-000031): customer and staff order pages show 'Item discounts' and 'Order discount' (staff: 'Order discount (OWNERFIX10)'), invoices show 'Discounts'; no 'Subscription discount' text; JSON lineDiscountLabel null. 1280 and 360. A line-level non-subscription discount cannot be produced on this server (only subscription orders carry line discounts) |
| B12 | Screenshots at 360 and 1280 in `docs/gates/screenshots/P6-OWNER-FIXES-REAL-API/` | files exist | PASS | 20 PNG files plus the invoice PDF in docs/gates/screenshots/P6-OWNER-FIXES-REAL-API/ (b5 dashboard and filtered list, b7 to b9 subscription order and invoice pages, b11 normal order and invoice, at 1280 and 360) |
| B13 | Cleanup: API and next dev stopped, ports free | done | PASS | API (pid 34344) and next dev 3135 stopped, their parent node stopped; ports 5099, 5127, 3134, 3135 free. Scratch-DB edits made for the run were reverted (see record) |

## Regression cases from earlier gates

| ID | Gate | Finding | Case | Status | Evidence |
|---|---|---|---|---|---|
| R1 | Backend CODE_REVIEW | LOW: PDF line label has no assertion | B10 downloads the PDF and reads its text | PASS | B10: PDF line label observed in extracted text |
| R2 | Backend CODE_REVIEW | LOW: mixed-label invoice gets null totals label | not testable on this data unless a mixed invoice exists; recorded in Gaps | BLOCKED | no mixed-label invoice exists on this data and none can be made without a second discount source |
| R3 | Integration record item 14 | cleared flag did not stop next order (now intended) | B3 | PASS | B3 and B4 |
| R4 | Integration record item 16 | discount not labelled on invoice/order | B7 to B10 | PASS | B7 to B10 |
| R5 | Integration record item 5 | due-tomorrow row opened every Active subscription | B5, B6 | PASS | B5 and B6 |
| R6 | Integration record 8 / baseline | 11 baseline cases | A8, A9, A11, A12 | PASS | No baseline case failed in c4, c5, c7, c8 (ordering-a11y :133 failed under load in c5 and passed 4 of 4 alone) |

## Acceptance-criteria coverage

| Criterion (Amended row) | Covered by | Status |
|---|---|---|
| (t)/(u) flag only stops new subscriptions; help text | A3 (`product-editor`), A8, B3, B4 | PASS |
| (v) nextDeliveryOn filter, chip, export | A3, A8, B5, B6 | PASS |
| (w) profile tabs wrap at 360 | A8 | PASS |
| (x) erase panel selects inside card | A8 | PASS |
| (y) 44 px dialog close and order filters | A5, A8, A3 | PASS |
| (z) history cell, terms row | A5, A3 | PASS |
| (aa) README ADR table | docs only, not executable; read in diff | BLOCKED (docs only, not executed or read by me) |
| (ab) discount labels | A3 (`discount-label`), B1, B7 to B11 | PASS |
| (ac) DialogHeader clears the close X | A3 (`owner-fixes-p6`) | PASS |

## Cases I could not run

| ID | Why | What would unblock it |
|---|---|---|
| R2 | No mixed-label invoice exists | A second line-discount source, or a backend integration test (the code reviewer already named it) |
| B2c remainder | inventory R-A2..R-X3 (10 cases), journey 5f and 2 console cases, mobile-360 for non-subscription specs | A clean scratch database (this one is polluted by integration-test data); then re-run |
| (aa) | README ADR table is documentation | Reading the diff |

## Gaps left deliberately

| Gap | Why not covered | Suggested owner |
|---|---|---|
| Contract test does not compare the new label fields | Null on both sides in the sampled rows; checked directly in B7 to B11 | Add a subscription order to the contract set |
| Customer-side page for a normal discounted order on a line discount | Server only produces line discounts for subscription orders | none |
| Staff order page shows Order discount (Subscription discount) 0.00 and Discount code: Subscription discount for subscription orders | Outside the owner fixes, observed only | Owner |

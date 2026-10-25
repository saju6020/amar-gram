# TC-HO-P3-STORE-FRONT — Store front screens rebuilt to the approved design (S0–S4)

Handover: `docs/handover/HO-P3-STORE-FRONT.md` (§15 U1–U38, §16 E1–E16, §17.1 splits, §18 A1–A18)
Commit(s) under test (run 2): HEAD `889d81f` (fixes `4713d6a`, `889d81f` on top of run 1's `5bd5508`) on `feat/phase2-catalogue-theme` (S0 `e29a0ae`, S1 `c38bb9d`, S4 `b1b237c`, S2 `5c5af0e`, S3 `24ad5f7`, `f7fe2af`, integration `3c98022`); baseline `46929be`
Written: 2026-10-25  ·  Executed: run 1 2026-10-25, run 2 2026-10-25 (this sheet is run 2; run 1 results are in git history of this file)

> Statuses record what was **observed**, not inferred. The Evidence column names what was actually
> seen. `BLOCKED` marks a case that could not be executed or whose result was reasoned about rather
> than watched.
>
> Process note (disclosed): typecheck, lint and the full Vitest run, plus a read of the test files,
> happened before this sheet was saved, and the Playwright run was already in flight when it was
> saved. The row list comes from handover §15/§16, not from results; no row was added, dropped or
> re-worded after seeing a result. Unit rows are one row per U-case; each e2e row is one row per
> E-case with a status per project.

## Summary (run 2)

| | Count (rows) |
|---|---|
| Total | 75 |
| PASS | 73 |
| FAIL | 0 |
| BLOCKED | 2 |
| NOT RUN | 0 |

BLOCKED: E-J (needs a live API) and E16 (the whole `npm run test:e2e` suite was not run; only the HO-P3 spec set). Row changes since run 1: E4, E9, E13, E14, R2 are now PASS. E12 is PASS for every account route; its one failing case (staff idle-lock axe) and shop-staff E-C1 are recorded as OUT OF HO-P3 SCOPE by owner decision (handed to HO-P4), not as HO-P3 failures. W2 is PASS with the three shop-product loosenings recorded as MEDIUM (owner: dev-server accommodations).

Raw run totals (run 2, HEAD 889d81f):

* typecheck: exit 0. lint (--max-warnings 0): exit 0.
* Vitest `npm test`: 200 files, 1850 tests: 1798 passed, 7 failed, 45 skipped. The 7 failures are 20 s timeouts in goods-receipt-form (4), shared-pieces (2) and reports/viewer (1), the known load-sensitive files; re-run alone those 3 files pass 43/43. 45 skipped = contract suite (real API only).
* Playwright, one worker, HO-P3 spec set, chromium + mobile-360, 530 runs: 501 passed, 4 flaky (failed first try, passed on retry), 17 failed, 8 skipped. The 17 failures re-run with --last-failed: 13 passed alone, 4 failed again. Final: 518 pass (501 + 4 + 13), 4 fail, 8 skipped (4 portal-real-api real-API gates, 4 phone-only / desktop-only halves of shop-home and shop-shell).
* The 4 final failures are staff-area tests: accounts-a11y-responsive "E-X1 (idle lock open)" (chromium + mobile-360) and shop-staff E-C1 (chromium + mobile-360). Handed to HO-P4 by the owner; out of HO-P3 scope.
* Flaky by name (failed first attempt, passed on retry): ordering-customer E-B1/E-B8 (chromium and mobile-360), ordering-a11y-responsive "/staff/orders" (mobile-360), ordering-customer-orders E-D1 (mobile-360).
* Failed in the full run, passed alone: ordering-a11y "?placed=1" (both projects), portal-dashboard E-A4 (both), shop-portal E-D1 (both), account-area E-E1 (mobile), accounts-auth E-B1 and E-C2 (mobile), home a11y and home staff redirect (mobile), shop-catalogue E-E1 maintenance (mobile), shop-shell phone case (mobile).

## Environment

* Windows 11, Node 24, `web/` suites. Branch feat/phase2-catalogue-theme, HEAD 889d81f.
* Playwright: PORT=3140 NEXT_PUBLIC_USE_MOCKS=true NEXT_PUBLIC_API_BASE_URL=http://localhost:5005, --project=chromium --project=mobile-360 --workers=1, next dev, MSW mocks. No backend, database or broker. Run took 1.5 h.
* Spec set: shop-*, home, ordering-customer*, ordering-a11y-responsive, account*, portal*.
* journey-real-api.spec.ts not run (needs JOURNEY_REAL_API=1 and a live API). No production build run.

## Unit cases (§15)

Each U row is mapped to the Vitest file(s) that assert it, found by reading the test source. The 415-test HO-P3-area run and the full run both showed these files green.

| ID | Slice | Case | Test location | Status | Evidence |
|---|---|---|---|---|---|
| U1 | S0 | ShopTopStrip banners | `shop/shell-p3.test.tsx` | PASS | 3 tests (title, safe link, none, BannerStrip rest) pass |
| U2 | S0 | ShopHeader | `shop/shell-p3.test.tsx`, `shop/shell.test.tsx` | PASS | logo, "Search the shop", Sign in, aria-current pill pass |
| U3 | S0 | MobileTabBar | `shop/shell-p3.test.tsx` (`MobileTabBar - U3`) | PASS | it.each x3 paths, not on /cart, Account to /sign-in or /portal pass |
| U4 | S0 | ProductCard Add | `catalogue/product-card.test.tsx` | PASS | one POST {skuId, quantity:1} asserted |
| U5 | S0 | ProductCard stepper | `catalogue/product-card.test.tsx` (`U5` x2) | PASS | + sends PUT, at 1 "−" removes, fromPrice kept |
| U6 | S0 | out of stock / multi-size | `catalogue/product-card.test.tsx` (`U6`) | PASS | Alert me, choose options, no Organic badge |
| U7 | S0 | PortalHeader | `portal/portal-header.test.tsx` (`U7` x2) | PASS | checkout variant and orders variant |
| U8 | S0 | ShopFooter | `shop/shell-p3.test.tsx` | PASS | four links, placeholders absent |
| U9 | S0 | no-hex scan | `shop/no-hex-literals.test.ts`, §17.2 `rg` | PASS | 31 file cases pass; manual `rg` over the §17.2 paths: 0 hits. Note the test scans S0's list only (gap G3) |
| U10 | S1 | ShopHero | `shop/home-hero.test.tsx` | PASS | with and without Home banner |
| U11 | S1 | CategoryTiles | `shop/home.test.tsx` | PASS | links, labels, counts, failed read |
| U12 | S1 | GrowersBand | `shop/home.test.tsx` | PASS | <= 2 tiles, text only without origins |
| U13 | S1 | PromiseStrip | `shop/home-hero.test.tsx` | PASS | facts present, "Village on every pack" absent |
| U14 | S1 | Home composition | `shop/home.test.tsx` | PASS | no staples box; categories nav |
| U15 | S2 | Heading band | `shop/catalogue-view-503.test.tsx` (node env), `catalogue/catalogue-p3.test.tsx` | PASS | band h1 and polite count asserted in the node-env file |
| U16 | S2 | Organic switch / chip / Clear filters | `catalogue/catalogue-p3.test.tsx` | PASS | URL gains/loses `certification=CertifiedOrganic`; fixed country kept |
| U17 | S2 | Sort radio group | `catalogue/catalogue-p3.test.tsx` | PASS | keeps filters and search |
| U18 | S2 | No results | `catalogue/catalogue-p3.test.tsx`, `catalogue/results-states.test.tsx` | PASS | Clear filters; suggestions for a search |
| U19 | S2 | Buy column 2 / qty 3 | `product/product-p3.test.tsx` | PASS | price is the SKU string, "3 ×", POST qty 3 |
| U20 | S2 | Gallery badge | `product/product-p3.test.tsx` | PASS | badge iff CertifiedOrganic; aria-pressed thumbnails |
| U21 | S2 | Details tabs | `product/product-p3.test.tsx`, `product/product-page.test.tsx` | PASS | arrows, empty tab absent |
| U22 | S2 | Goes well with | `product/product-p3.test.tsx` | PASS | nothing / 4 tiles |
| U23 | S3 | Basket states | `cart/cart.test.tsx` | PASS | changed, limited, unavailable, Undo |
| U24 | S3 | Basket summary | `cart/cart.test.tsx` | PASS | server subtotal only |
| U25 | S3 | Checkout renders | `checkout/checkout.test.tsx` (`U25`) | PASS | three numbered regions + aside |
| U26 | S3 | delivery.available=false | `checkout/checkout.test.tsx` (`U26`) | PASS | Pickup preselected with reason |
| U27 | S3 | Slots / levels / none | `checkout/checkout.test.tsx` | PASS | charges, lead times; "not needed" and Payment usable |
| U28 | S3 | Payment options | `checkout/checkout.test.tsx` (`U28`) | PASS | COD disabled with server reason; transfer message |
| U29 | S3 | Changes acknowledge | `checkout/checkout.test.tsx` (`U29`) | PASS | disabled until acknowledged |
| U30 | S3 | Double click, key reuse, success route | `checkout/checkout.test.tsx` (`U30`, RequestInProgress retry) | PASS | 1 POST; retry reuses key (via 409 RequestInProgress); route `/portal/orders/{id}?placed=1`. Network-error key reuse is observed at hook level (`unit/lib/idempotency-renewal`), not through `CheckoutScreen` (gap G4) |
| U31 | S3 | `?step=` ignored | `checkout/checkout.test.tsx` (`U31`) | PASS | all sections render |
| U32 | S4 | Sign-in page | `portal/account-p3.test.tsx` (`U32`) | PASS | leaf panel, staff link, `?next=` kept |
| U33 | S4 | Account sidebar | `portal/account-p3.test.tsx` (`U33`) | PASS | current item, labels, no Subscriptions, exports |
| U34 | S4 | Overview | `portal/account-p3.test.tsx` (`U34`) | PASS | tracker, default address, Buy again, tiles |
| U35 | S4 | My orders list | `portal/account-p3.test.tsx` (`U35`), `orders/my-orders.test.tsx` | PASS | cards, status pill, filter and paging |
| U36 | S4 | Order detail delivered | `portal/account-p3.test.tsx` (`U36`) | PASS | Order again, Return an item, invoice link |
| U37 | S4 | `?placed=1` bank transfer | `portal/account-p3.test.tsx` (`U37`), `orders/my-orders.test.tsx` | PASS | thank-you, instructions, `role=timer` |
| U38 | S4 | Profile pages | `portal/account-p3.test.tsx` (`U38`), `account/**` | PASS | pill tabs, deletion link, existing account cases green |
| U-S1 | all | Whole Vitest suite (A17) | `npm test` | PASS (after rerun) | 13 failures were 20 s timeouts in 5 known load-sensitive files; each re-run alone 73/73 pass |

## §17.1 split files (counted)

Counts are `it(` / `test(` declarations at `46929be` vs HEAD. The split commit is folded into `e29a0ae`, so the baseline file is the pre-split parent. "Rest + moved" equals the baseline wherever no case was added or rewritten.

| ID | Split | Baseline | Rest + moved now | Status | Evidence |
|---|---|---|---|---|---|
| SP1 | `product/hearth-shop` to `shop/home-hero` | 9 | 5 + 4 = 9 | PASS | counts equal; new files pass |
| SP2 | `catalogue/product-card` to `catalogue/results-states` | 16 | 14 + 4 = 18 | PASS | +2 are S0's U4-U6 additions; `NoResults`/`Pagination` blocks present in results-states |
| SP3 | `portal/account-sidebar` to `portal/portal-header` | 7 | 5 + 4 = 9 | PASS | +2 are S0/S4 additions |
| SP4 | `shop/shell` to `shop/origin-grid` | 11 | 10 + 1 = 11 | PASS | equal |
| SP5 | `shop/load-error` to `shop/countries-load-error` | 4 | 2 + 2 = 4 | PASS | equal |
| SP6 | `cart/cart` to `product/add-to-cart-button` | 9 | 9 + 2 = 11 | PASS | +2 are S3 basket additions |
| SP7 | `hearth/hearth` to `checkout/hearth-steps` | 11 | 4 + 7 = 11 | PASS | equal |
| SP8 | e2e `ordering-customer` to `ordering-customer-orders` | 9 | 7 + 2 = 9 | PASS | E-C2 and E-D1 moved; both run (E15) |

## End-to-end cases (§16), chromium and mobile-360

Phone / desktop halves in shop-home and shop-shell are viewport-gated by design, so each such test runs on one project only.

| ID | Slice | Spec | chromium | mobile-360 | Evidence (run 2) |
|---|---|---|---|---|---|
| E1 | S0 | shop-shell.spec.ts | PASS | PASS | phone case ran on mobile-360 (failed once under load, passed alone); desktop + add-item pass |
| E2 | S0 | home.spec.ts | PASS | PASS | mobile-360 a11y and staff redirect failed in the full run, passed alone |
| E3 | S1 | shop-home.spec.ts | PASS | PASS | |
| E4 | S2 | shop-catalogue.spec.ts | PASS | PASS | E-A4 now passes (searches "sap"); E-E1 maintenance failed once on mobile-360 under load, passed alone |
| E5 | S2 | shop-product.spec.ts | PASS | PASS | 7/7 each; see W2 for the recorded loosenings |
| E6 | S2 | shop-a11y-responsive.spec.ts | PASS | PASS | |
| E7 | S2 | shop-portal.spec.ts | PASS | PASS | E-D1 failed once in the full run (both), passed alone |
| E8 | S3 | ordering-customer.spec.ts | PASS | PASS | E-B1/E-B8 flaky on both (retry passed) |
| E9 | S3 | ordering-a11y-responsive.spec.ts | PASS | PASS | /portal/orders/{101,106,107} axe and 360 px overflow now pass; ?placed=1 passes (failed in the full run, passed alone on both); /checkout price change passes. mobile-360 /staff/orders flaky (retry passed) |
| E10 | S4 | accounts-auth.spec.ts | PASS | PASS | mobile-360 E-B1, E-C2 failed once in the full run, passed alone |
| E11 | S4 | account-area.spec.ts | PASS | PASS | mobile-360 E-E1 timed out once, passed alone (5.5 s) |
| E12 | S4 | accounts-a11y-responsive.spec.ts | PASS | PASS | all account routes pass. Only "E-X1 (idle lock open)" (staff idle-lock dialog) fails on both projects: OUT OF HO-P3 SCOPE, handed to HO-P4 |
| E13 | S4 | portal-dashboard.spec.ts | PASS | PASS | E-B1..B3 now pass (mock falls through); E-A4 tile links failed once in the full run (both), passed alone |
| E14 | S4 | portal-a11y-responsive.spec.ts | PASS | PASS | re-order dialog axe now passes |
| E15 | S4 | ordering-customer-orders.spec.ts | PASS | PASS | mobile-360 E-D1 flaky (retry passed) |
| E16 | all | npm run test:e2e (whole suite) | BLOCKED | BLOCKED | not run; only the HO-P3 spec set (530 runs: 518 pass, 4 fail, 8 skipped). The 4 failures are the staff-area tests above and shop-staff E-C1 |
| E-J | — | journey-real-api.spec.ts | BLOCKED | BLOCKED | needs JOURNEY_REAL_API=1 and a live API |

Outside §16: shop-staff.spec.ts E-C1 fails on both projects (staff catalogue editor): OUT OF HO-P3 SCOPE, handed to HO-P4. portal-real-api: 4 skipped by their real-API gate.

## Regression cases from earlier gates

Earlier HO-P3 gates (ARCHITECTURE, SECURITY, CODE_REVIEW) and TEST run 1 were all fixed in 4713d6a / 889d81f.

| ID | Gate | Finding | Case | Status | Evidence |
|---|---|---|---|---|---|
| R1 | ARCH (d) | portal header fits 360 px | no h-scroll on portal routes at 360 | PASS | portal and ordering a11y/responsive pass on both projects |
| R2 | ARCH (a)(b) / TEST run 1 | E9 spec asserted the pre-S4 banner | ordering-a11y ?placed=1 | PASS | passes on both projects (alone, after one load failure in the full run) |
| R3 | ARCH (c) | HearthLogo default unchanged | hearth and staff-shell units | PASS | green in the full Vitest run |
| R4 | TEST run 1 | dlitem / definition-list in BankTransferInstructions and OrderPanels | ordering-a11y /portal/orders/{101,107} and ?placed=1 axe | PASS | pass on both projects |
| R5 | TEST run 1 | 48 px overflow on /portal/orders/…0106 at 360 | ordering-a11y route 106 | PASS | passes on chromium |
| R6 | TEST run 1 | re-order mock (E-B1..B3, E14) and E-A4 search | portal-dashboard, portal-a11y, shop-catalogue | PASS | pass on both projects |
| R7 | CODE_REVIEW | "Remove from basket, {item}" accessible name | cart.test.tsx and ordering-customer remove/Undo | PASS | cart.test green; E8 remove/Undo passes |
| R8 | TEST run 1 | colour-literal guard covers every customer folder | no-hex-literals / §17.2 rg | PASS | Vitest guard green in the full run (see U9 row); not re-counted file by file in this run |

## Weakening audit (A17, §19 row 4)

| ID | Check | Status | Evidence |
|---|---|---|---|
| W1 | No skipped test added | PASS | `git diff 46929be HEAD` of `web/tests`: the only added `skip` lines are four viewport gates in `shop-home` and `shop-shell` (phone-only / desktop-only halves). No `.only`, `.fixme`, `.todo`, `xit`. Existing real-API skips unchanged |
| W2 | Removed assertions are copy / layout replacements | PASS (owner-accepted, MEDIUM recorded) | Unchanged from run 1: all removed assertions map to copy or layout, except three loosenings in shop-product.spec.ts (hero-image attributes only checked when a photo URL exists; draft slug accepts 200 + noindex; no-JS case asserts HTML text). Baseline fails the strict forms of the last two in next dev. Owner decision: dev-server accommodations, recorded as MEDIUM; the production-404 claim remains untested (no production build run) |
| W3 | Test count did not fall outside listed splits | PASS | per touched file: `checkout` 24 to 31, `my-orders` 22 to 22, `catalogue-controls` 9 to 9, `product-page` 16 to 16, `address-list` 4 to 4, `shop-catalogue` 7 to 9, `shop-product` 6 to 7, `accounts-auth` 8 to 9, others equal. `checkout.test` lost the `SlotStep`, `PaymentStep`, `ReviewStep`, stepper and greeting cases with the components; U25–U29 and the 7 added cases replace them. Vitest `it(` count: baseline checkout 24, now 31 |

## Acceptance-criteria coverage

| Criterion | Covered by | Status |
|---|---|---|
| A1 | U1–U3, U8, E1 | PASS |
| A2 | U4–U6, E1, E3 | PASS |
| A3 | U7, E9, E13 | PASS |
| A4 | SP1–SP8; ADR-FE-174..179 are not tested here | PASS for the splits; ADR text not checked by this gate |
| A5 | U10–U14, E3 | PASS |
| A6 | U12, countries-load-error, E6 | PASS |
| A7 | U15–U18, E4, E6 | PASS |
| A8 | U19–U22, E5, E7 | PASS (with W2 caveat) |
| A9 | U23, U24, E8 | PASS |
| A10 | U25–U31, E8, E9 | PASS |
| A11 | U32, E10, E12 | PASS |
| A12 | U33, U34, E13, E14 | PASS |
| A13 | U35–U37, E9, E15 | PASS |
| A14 | U38, E11, E12 | PASS |
| A15 | U9 + §17.2 `rg` | PASS (0 hits); automated scan covers S0 and S1 only |
| A16 | E1, E3, E6, E9, E12, E14 | PASS for all HO-P3 routes; the staff idle-lock axe case is out of scope (HO-P4) |
| A17 | typecheck, lint, Vitest, W1–W3 | PASS (W2 MEDIUM recorded); Vitest load-timeouts rerun alone |

## Cases I could not run

| ID | Why | What would unblock it |
|---|---|---|
| E-J `journey-real-api.spec.ts` | needs a live API and `JOURNEY_REAL_API=1` | run `npm run test:e2e:journey` against a real backend |
| contract suite (45 Vitest skips) | `describe.skipIf(!REAL)` | a real API |
| "production answers 404 for a draft slug" | needs `next build` + `next start` | run the draft-slug case against a production build |
| full `npm run test:e2e` (E16) | other areas' specs were out of the requested set and 1.9 h for this set alone | run it on the integration branch with a quiet machine |

## Gaps left deliberately

| Gap | Why not covered | Suggested owner |
|---|---|---|
| G1 shop-product loosenings (hero attributes, draft-slug status, no-JS h1) | dev-server / mock limits; owner accepted as MEDIUM | S2 owner: add a photo URL to the mock and a production-build 404 run |
| G3 automated colour-literal guard | now scans every customer folder (4713d6a); not re-verified file by file | slice owners |
| G4 U30 network-error retry through CheckoutScreen | covered at hook level and via 409 RequestInProgress | S3 owner |
| G6 staff idle-lock axe and shop-staff E-C1 | owner: handed to HO-P4 | HO-P4 |
| G7 E16 whole e2e suite | not run in this gate | integrator |

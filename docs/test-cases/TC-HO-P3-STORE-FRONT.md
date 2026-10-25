# TC-HO-P3-STORE-FRONT — Store front screens rebuilt to the approved design (S0–S4)

Handover: `docs/handover/HO-P3-STORE-FRONT.md` (§15 U1–U38, §16 E1–E16, §17.1 splits, §18 A1–A18)
Commit(s) under test: HEAD `5bd5508` on `feat/phase2-catalogue-theme` (S0 `e29a0ae`, S1 `c38bb9d`, S4 `b1b237c`, S2 `5c5af0e`, S3 `24ad5f7`, `f7fe2af`, integration `3c98022`); baseline `46929be`
Written: 2026-10-25  ·  Executed: 2026-10-25

> Statuses record what was **observed**, not inferred. The Evidence column names what was actually
> seen. `BLOCKED` marks a case that could not be executed or whose result was reasoned about rather
> than watched.
>
> Process note (disclosed): typecheck, lint and the full Vitest run, plus a read of the test files,
> happened before this sheet was saved, and the Playwright run was already in flight when it was
> saved. The row list comes from handover §15/§16, not from results; no row was added, dropped or
> re-worded after seeing a result. Unit rows are one row per U-case; each e2e row is one row per
> E-case with a status per project.

## Summary

| | Count (rows) |
|---|---|
| Total | 70 |
| PASS | 61 |
| FAIL | 8 |
| BLOCKED | 1 |
| NOT RUN | 0 |

Rows: U1–U38 and U-S1 (39, all PASS); SP1–SP8 (8, all PASS); E1–E16 and E-J (17: 10 PASS, 6 FAIL = E4, E9, E12, E13, E14, E16; 1 BLOCKED = E-J); R1–R3 (2 PASS, 1 FAIL = R2); W1–W3 (2 PASS, 1 FAIL = W2). An e2e row is FAIL if either project has a failing case in that spec; the Evidence column gives the exact tests.

Raw run totals:

* typecheck: exit 0. lint (`--max-warnings 0`): exit 0.
* Vitest `npm test`: 200 files, 1670 tests: 1612 passed, 13 failed, 45 skipped. The 13 failures are in 5 files (`inventory/control`, `inventory/goods-receipt-form`, `inventory/shared-pieces`, `pos/pos`, `reports/viewer`), all 20 s timeouts under load. Re-run alone: 5 files, 73/73 pass. 45 skipped = `tests/contract/mock-vs-real` (`describe.skipIf(!REAL)`).
* Vitest, HO-P3 areas alone (`shop catalogue product cart checkout hearth portal orders account`): 44 files, 415 tests, all pass.
* Playwright, one worker, 530 test runs (265 per project): 487 passed, 4 flaky (failed first try, passed on retry), 31 failed, 8 skipped. The 31 failures were re-run with `--last-failed`: 10 passed alone, 21 failed again. Final: 501 pass (487 + 4 + 10), 21 fail, 8 skipped (4 `portal-real-api` real-API gates, 4 viewport-gated halves of `shop-home` / `shop-shell`).
* All 21 final failures were also run against baseline `46929be` where listed as sampled below: they fail there too.

## Environment

* Windows 11, Node 24, `web/` suites. Branch `feat/phase2-catalogue-theme`, HEAD `5bd5508`.
* Playwright: `PORT=3140 NEXT_PUBLIC_USE_MOCKS=true NEXT_PUBLIC_API_BASE_URL=http://localhost:5005`, `--project=chromium --project=mobile-360 --workers=1`, dev server (`next dev`), MSW mocks. No backend, no database, no broker was reachable or started. The run took 1.9 h.
* Spec set: `shop-*`, `home`, `ordering-customer*`, `ordering-a11y-responsive`, `account*`, `portal*` (includes `shop-staff`, `portal-real-api`).
* Baseline comparison used the existing worktree `.claude/worktrees/baseline-46929be` on port 3150 (chromium only, retries 0 for the sample).
* `journey-real-api.spec.ts` needs `JOURNEY_REAL_API=1` and a live API: not run.
* Not run: production build (`next build` / `next start`).

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

"Phone half" / "desktop half" tests in `shop-home` and `shop-shell` are viewport-gated by design (`test.skip(widthOf(page) ...)`), so each such test runs on one project only.

| ID | Slice | Spec | chromium | mobile-360 | Evidence |
|---|---|---|---|---|---|
| E1 | S0 | `shop-shell.spec.ts` | PASS | PASS | chromium: desktop-no-tab-bar + add-item pass, phone test skipped by design; mobile-360: phone test (tab bar, /cart, footer not covered) + add-item pass, desktop test skipped by design |
| E2 | S0 | `home.spec.ts` | PASS | PASS | root redirects pass. First full run: staff-redirect failed on both projects and a11y failed on mobile-360; re-run alone: all pass (load flake, reported as flaky) |
| E3 | S1 | `shop-home.spec.ts` | PASS | PASS | axe, no h-scroll at 4 widths, Add -> stepper, See all pass on both; phone/desktop halves split by project |
| E4 | S2 | `shop-catalogue.spec.ts` | FAIL | FAIL | E-A4 "an ingredient and a tag find matching products" fails (30 s timeout, heading "Date Palm Gur" absent) on both. Fails identically at baseline (sampled): the mock has no ingredient/tag search. §16 E4 says "every existing case ... Pass"; HO-P3 did not close it. All other cases pass (E-E1 maintenance was a first-run flake, passes alone) |
| E5 | S2 | `shop-product.spec.ts` | PASS | PASS | 7/7 each (incl. the new S2 buy-box case). Note weakened assertions, W2 |
| E6 | S2 | `shop-a11y-responsive.spec.ts` | PASS | PASS | axe on every route, no h-scroll, grid. One chromium timeout (stock-alert confirmation, 1.5 m) passed alone |
| E7 | S2 | `shop-portal.spec.ts` | PASS | PASS | 3/3 each |
| E8 | S3 | `ordering-customer.spec.ts` | PASS | PASS | 7/7 each. mobile-360 E-B3, E-B4/E-C1, E-B5 failed their first attempt (30 s timeouts) and passed on retry: flaky under load |
| E9 | S3 | `ordering-a11y-responsive.spec.ts` | FAIL | FAIL | See findings 1-3. `/cart`, `/checkout` (price-change panel; mobile-360 passes alone at 28.8 s), staff routes pass. FAIL: `/portal/orders/{101,107}` (axe `definition-list`/`dlitem` in the bank-transfer `<dl>`; chromium also 106 overflow of 48 px @360 and 108 fine), and `/portal/orders/{id}?placed=1` (stale copy assertion at line 157; behind it the same axe violation, probed) |
| E10 | S4 | `accounts-auth.spec.ts` | PASS | PASS | 9/9 chromium; mobile-360 E-C2 reload failed first run, passed alone |
| E11 | S4 | `account-area.spec.ts` | PASS | PASS | 6/6 chromium; mobile-360 E-E1 timed out in the full run, passed alone (5.2 s). E-E2 and the unsaved-changes cases pass (known baseline E-E2 failure did not reproduce) |
| E12 | S4 | `accounts-a11y-responsive.spec.ts` | PASS (customer) / FAIL (staff idle lock) | PASS (customer) / FAIL (staff idle lock) | 72 of 73 per project pass; the one failure is `E-X1 (idle lock open)`, a staff-area test. Fails at baseline (sampled). §16 E12: "staff assertions untouched" |
| E13 | S4 | `portal-dashboard.spec.ts` | FAIL | FAIL | E-B1, E-B2, E-B3 (re-order) fail on both; E-A1..A5 and E-B4 pass (E-A4 on mobile-360 failed in the full run, passed alone). Fail at baseline (sampled): the ordering mock does not know the portal fixture order ids. §16 E13 lists E-B1..B4 as must-pass |
| E14 | S4 | `portal-a11y-responsive.spec.ts` | FAIL | FAIL | one case, `/portal with the re-order result dialog open` (same cause as E-B1; fails at baseline, sampled). The other 16 per project pass |
| E15 | S4 | `ordering-customer-orders.spec.ts` | PASS | PASS | E-C2 and E-D1 pass; mobile-360 E-C2 failed first try (30 s) and passed on retry (flaky) |
| E16 | all | whole suite | FAIL | FAIL | Not run as `npm run test:e2e` (the whole `tests/e2e` set). The HO-P3 spec set (530 runs) is red: 21 final failures, all listed under findings. Flaky by name: ordering-customer mobile-360 E-B3, E-B4/E-C1, E-B5; ordering-customer-orders mobile-360 E-C2 |
| E-J | — | `journey-real-api.spec.ts` | BLOCKED | BLOCKED | needs `JOURNEY_REAL_API=1` and a live API; not run |

Also in the Playwright set and not in §16: `shop-staff.spec.ts` E-C1 fails on both projects (also fails at baseline, sampled; staff catalogue editor, HO-P3 §16 does not list it), E-F1 flaked and passed alone. `portal-real-api.spec.ts`: 4 skipped by their real-API gate.

## Regression cases from earlier gates

Gate files present for HO-P3: ARCHITECTURE PASS, SECURITY PASS, CODE_REVIEW PASS. They record no fixed HIGH/BLOCKER finding, so there is no fixed finding that needs a regression row. Their open MEDIUM items (BuyBox price note wording, `CartLineRow` accessible name vs visible text, `ShopHeader` `text-warm` size, `HearthAuthShell` `text-warm`) are not fixed and have no test. Rows below come from the handover's own Amended list.

| ID | Gate | Finding | Case | Status | Evidence |
|---|---|---|---|---|---|
| R1 | ARCH run 1 (d) | portal header fits 360 px | no h-scroll on `/portal` family at 360 | PASS | `portal-a11y-responsive` and `accounts-a11y-responsive` no-overflow cases pass on both projects; `/portal/orders` and `/portal/orders/108` now pass where baseline overflowed |
| R2 | ARCH run 1 (a)(b) | e2e specs follow single-page checkout | E8, E15 | FAIL | E8 and E15 pass. The same edit pass left `ordering-a11y-responsive.spec.ts:157` asserting the pre-S4 copy "your order .* is placed", so E9's `?placed=1` case fails before reaching axe (finding 2) |
| R3 | ARCH run 1 (c) | `HearthLogo` `accentClassName` default unchanged | Vitest hearth and staff-shell units | PASS | `tests/components/hearth` and `tests/unit/staff-shell` green in the full run |

## Weakening audit (A17, §19 row 4)

| ID | Check | Status | Evidence |
|---|---|---|---|
| W1 | No skipped test added | PASS | `git diff 46929be HEAD` of `web/tests`: the only added `skip` lines are four viewport gates in `shop-home` and `shop-shell` (phone-only / desktop-only halves). No `.only`, `.fixme`, `.todo`, `xit`. Existing real-API skips unchanged |
| W2 | Removed assertions are copy / layout replacements | FAIL (LOW to MEDIUM) | Compared every removed `expect` line in the 17 touched pre-existing spec/test files. All map to replaced copy ("cart" to "basket", "Request a return" to "Return an item", "Country of origin" to "Origin", the stepper checkout to a single page, tabs 3 + 3 to Description / Origin / Details). Three e2e edits in `shop-product.spec.ts` are weaker than copy: (a) the hero-image `fetchpriority`/`loading`/`width`/`height`/`alt` assertions now run only if a photo URL exists (the mock sends none, so they never run in this suite); (b) the draft-slug case no longer requires HTTP 404 (accepts 200 plus `noindex`); (c) the no-JS case asserts the delivered HTML instead of a visible `h1`. The file's comments say `next dev` streams behind `loading.tsx` and that production answers 404. Baseline (sampled): the strict forms of (b) and (c) fail at `46929be` too, so these are dev-server accommodations, but the "production answers 404" claim has no test (gap G1) |
| W3 | Test count did not fall outside listed splits | PASS | per touched file: `checkout` 24 to 31, `my-orders` 22 to 22, `catalogue-controls` 9 to 9, `product-page` 16 to 16, `address-list` 4 to 4, `shop-catalogue` 7 to 9, `shop-product` 6 to 7, `accounts-auth` 8 to 9, others equal. `checkout.test` lost the `SlotStep`, `PaymentStep`, `ReviewStep`, stepper and greeting cases with the components; U25–U29 and the 7 added cases replace them. Vitest `it(` count: baseline checkout 24, now 31 |

## Acceptance-criteria coverage

| Criterion | Covered by | Status |
|---|---|---|
| A1 | U1–U3, U8, E1 | PASS |
| A2 | U4–U6, E1, E3 | PASS |
| A3 | U7, E9, E13 | FAIL (E9 and E13 red, see findings) |
| A4 | SP1–SP8; ADR-FE-174..179 are not tested here | PASS for the splits; ADR text not checked by this gate |
| A5 | U10–U14, E3 | PASS |
| A6 | U12, countries-load-error, E6 | PASS |
| A7 | U15–U18, E4, E6 | FAIL (E4 E-A4 red, pre-existing) |
| A8 | U19–U22, E5, E7 | PASS (with W2 caveat) |
| A9 | U23, U24, E8 | PASS |
| A10 | U25–U31, E8, E9 | FAIL (E9 red) |
| A11 | U32, E10, E12 | PASS (E12 staff idle-lock excluded, pre-existing) |
| A12 | U33, U34, E13, E14 | FAIL (E13 E-B1..B3, E14 re-order dialog red, pre-existing) |
| A13 | U35–U37, E9, E15 | FAIL (E9 `?placed=1` and order-detail axe) |
| A14 | U38, E11, E12 | PASS |
| A15 | U9 + §17.2 `rg` | PASS (0 hits); automated scan covers S0 and S1 only |
| A16 | E1, E3, E6, E9, E12, E14 | FAIL (E9, E12 staff, E14 dialog) |
| A17 | typecheck, lint, Vitest, W1–W3 | PASS for typecheck, lint, Vitest; W2 has LOW/MEDIUM weakenings; e2e not green |

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
| G1 draft-slug 404 / hero LCP attributes / no-JS `h1` weakened or conditional in `shop-product.spec.ts` | environment (dev streaming; mock sends no photo URL) | S2 owner: add a mock product with a photo URL and run the 404 case against a production build |
| G2 `ordering-a11y-responsive.spec.ts:157` stale copy | test defect, not product code | S3/S4 owner: assert the S4 confirmation ("Thank you! Your order is in.") |
| G3 automated U9 scan covers S0 (`shop/no-hex-literals.test.ts`) and S1 (`home.test.tsx`) only; S2, S3, S4 owned files have none | each later slice was to add its own list; S2–S4 did not | slice owners |
| G4 U30 network-error retry through `CheckoutScreen` | covered at hook level and via 409 in component | S3 owner |
| G5 `/portal/orders/106` @360 overflow (48 px) on chromium | pre-existing at baseline | S4 owner |

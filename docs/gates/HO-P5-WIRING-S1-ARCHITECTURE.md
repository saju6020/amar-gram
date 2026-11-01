GATE: ARCHITECTURE
HANDOVER: HO-P5-WIRING (slice S1, store front)
RUN: 2 (replaces run 1, FAIL at 1916533)
COMMITS: 44a53c7 2074711 b3ab577 4451483 303c01f (merge) 1916533 33b99fb 4d63c42 (merge) b49afaf b058708 (merge) (base da87b60, HEAD b058708, branch feat/p5-s1-store-front)
DATE: 2026-10-31
STATUS: PASS

No BLOCKER, HIGH or MEDIUM finding is open. Three LOW findings remain, all documentation. This verdict covers the code as written. No test was run here, so it says nothing about test results.

WHAT RUN 1 FOUND, AND WHAT CHANGED
- [BLOCKER, CLOSED] docs/gates/HO-P5-WIRING-S1-SLICE-REPORT.md was outside scope. Amended (r) now takes a slice's §17.3 report at this path, and its gate records, out of §14's `docs/**` row.
- [MEDIUM, CLOSED] web/lib/api/shop-catalogue.ts:90, `districts` optional against §11.2.1. Amended (s) ruled it required, and b49afaf made it so. It also added `districts: []` to the fixture and removed the `?? []` from CatalogueFilters.tsx. The server field is non-nullable (`GetCatalogueFiltersQuery.cs:18`). `tsc` is clean. No other code or test builds a partial filters response: the only `server.use` on `/api/shop/filters` (`load-error.test.tsx:31`) makes the read fail, which `settle` handles.
- [MEDIUM, CLOSED] web/app/(shop)/_components/CatalogueView.tsx:96, raw server message shown to a shopper. See the CatalogueView check below.
- [LOW, CLOSED] MyOrderDetail.tsx rider note as `dt`/`dd`: ruled by Amended (u).
- [LOW, CLOSED] mocks/handlers/ordering/customer.ts NUL response: ruled by Amended (v).
- [LOW, CLOSED] Slice report's "E5 asserts both": corrected in report line 43.
- [LOW, CLOSED] catalogue-p3.test.tsx stale title: retitled under Amended (s).
- [LOW, PARTLY CLOSED] Slice report's stale top: line 3 and the (o) file list are fixed; the rest is carried into the first finding below.
- [LOW, OPEN] Amended (p) on the Gap inventory: unchanged; see the second finding below.

FINDINGS
- [LOW] docs/gates/HO-P5-WIRING-S1-SLICE-REPORT.md:5,13,15,29,34,74 — The report's body still describes the slice before the fixes, though its §9 and line 11 state them correctly. Line 5 says "all inside S1's §13 block" and line 15 says "Nothing outside the block was edited", but five files are in scope by Amended (o) and (s) only. Line 13 lists `CatalogueView.tsx` as left unchanged. Line 29 says `catalogue-p3.test.tsx` was not edited and its fixture has no `districts`. Line 34 says the promise takes the strip whenever `freeOver` is non-null, which (w) narrows. Line 74 says `districts` is optional. The code is right in every case. A later gate reading only these lines would be misled.
- [LOW] docs/handover/HO-P5-WIRING.md:76 — Carried from run 1. Amended (p) and report line 72 say the Gap inventory reads "most products first", but the G1 row (line 31) does not; only the handler comment at `GetCatalogueFiltersQueryHandler.cs:49` does. Report line 73 likewise says the document types `currencyCode` as a string, while the inventory says "all null when no zone". The decision in (p) and the code are correct.
- [LOW] web/docs/decisions.md:2008 and web/components/shop/ShopTopStrip.tsx:7 — ADR-FE-187 still says the strip shows the promise "when `freeOver` is set", and the `promiseTakesStrip` doc comment says "it carries a free-delivery threshold". Amended (w) narrows both to a non-zero threshold. The inline comment at ShopTopStrip.tsx:13-15 explains the exception, and §12 lets only S0 edit decisions.md, so S1 did not cause the ADR text. The integrator may want a note against the ADR.

SCOPE CHECK
- files in allowed scope: 39/39
- files outside allowed scope: none
- §13 S1 block, 30 files: the 29 run 1 listed, plus app/(shop)/_components/CatalogueView.tsx.
- Amended (o), 3 files: app/(shop)/_components/ProductPurchase.tsx and components/product/BuyBox.tsx (the diff only passes `leadTimeDays` down); tests/components/checkout/checkout.test.tsx (only U25's assertion and comment).
- Amended (s), 2 files: tests/components/catalogue/catalogue-fixtures.ts (one line, `districts: []`); tests/components/catalogue/catalogue-p3.test.tsx (one line, the retitle).
- Amended (r), 4 files: docs/gates/HO-P5-WIRING-S1-{ARCHITECTURE,SECURITY,CODE_REVIEW,SLICE-REPORT}.md.
- Amended (b): `Packed` in MyOrderDetail.tsx and `PERSIST_KEY` in mocks/handlers/shop/store.ts, both done.
- §14: `git diff --stat da87b60...HEAD` is empty for src, tests (.NET), .ai, docs/handover, web/package.json, the lock file, globals.css, eslint config, tests/guards, tests/setup.ts and the S0 files (ordering/store.ts, shop/fixtures.ts, my-orders.ts). `lib/api/errors.ts` is imported, not edited. No new dependency.
- Not in the diff: an untracked docs/test-cases/TC-HO-P5-WIRING-S1.md sits in the worktree. Amended (r) allows it if committed. This gate did not read it.

VERIFIED
- `promiseTakesStrip` (ShopTopStrip.tsx:16-17, Amended (w)): `!!amount && !/^0*\.?0*$/.test(amount)` is a string test on the server's value, with no `Number(`, `parseFloat` or operator on the amount, so §4.3 and ADR-317 hold. I ran the expression over a truth table: "0.00", "0", "00.00", ".00", "0." and "" do not take the strip; "0.01", "0.10", "10.00", "100.00", "5000.00", "1000000.00" and "9999999999.99" do. A value with a non-zero digit cannot match, so no real threshold is lost. The wire format is `amount.ToString("F2", InvariantCulture)` (`OrderConfigurationViewModels.cs:8-9`), so zero always arrives as "0.00", and the server's lower bound is 0 (`OrderConfigurationCommandValidators.cs:16-17`). The server fact behind (w) holds too: `DeliveryChargeCalculator.cs:17` makes every order free at that threshold. The layout (`layout.tsx`) and the strip use the same predicate, so at zero the first banner takes the strip and the rest go below, with none shown twice or lost. The lead time on the product card is independent and still shows. The false branch of the type predicate no longer means `freeOver` is null, but no caller relies on that, and `tsc` is clean.
- `CatalogueView.tsx:97`: `SHOP_CODE_MESSAGES[errorCode] ?? 'Clear the filters and try again.'`. `InvalidCatalogueFilter` is the server's one code for this path (`ShopCatalogueController.cs:193-196`, all `InvalidFilter` branches), and the plain text is at `lib/api/errors.ts:279`, so NFR-USA-4 is met for every filter, not only district. An unmapped code gets the plain fallback. `errorMessage` no longer appears in `app/(shop)`, `components/catalogue` or `components/shop`. `lib/api/errors.ts` has no `use client` and takes only a type import from react-hook-form, so the view stays a Server Component (NFR-PRF-1). No test asserted the old raw text. `shell-p5.test.tsx` has a case for the new text; whether it passes is for TEST.
- Full source and mock diff reread at HEAD: layering holds. No component fetches or adds a hook, and §8.3's data flow, ADR-FE-186 (note in `CheckoutScreen` state only, Delivery only, trimmed) and ADR-FE-187 are as built. Sweep of added app, components, lib and mocks lines: no hex, rgb or hsl literal, and no `localStorage`, `sessionStorage`, `Number(`, `parseFloat`, `fetch(`, `useQuery`, `useMutation`, `use client` or subscription string. `compareAtPrice` is not in web/lib, components or app (OQ-8).
- Mock against server, at the citations corrected in b49afaf: the district trim is `ShopCatalogueController.cs:37`, and the count and length checks are at :38-39, in the same order as the mock. The promise mock passes a stored zero through as an amount, as the server does, so (w) can be exercised against it.
- b49afaf's other changes are test additions and citation or comment corrections, and all are in scope.
- `tsc --noEmit --incremental false` from web/ exited 0 and left no tracked change.
- Architecture docs: I read the openings of `.ai/architecture.md`, `.ai/cqrs.md`, `.ai/read-side-pattern.md`, `.ai/bounded-contexts.md`, `.ai/namespace-conventions.md` and `.ai/di-registration-guide.md`, the head of ADR-317, and ADR-FE-186 and -187. Run 1 read `.ai/read-side-pattern.md` and `.ai/bounded-contexts.md` in full. No `src/` file changed, so backend layering rules do not apply.

NOT CHECKED (for TEST and later gates)
- Not run, by instruction or by gate boundary: Vitest, ESLint, build, Playwright. No server was started. All test results in the slice report are its own claims.
- Runtime behaviour for TEST: the new `CatalogueView` and zero-threshold cases in `shell-p5.test.tsx`, the Packed and whitespace-note cases in `rider-note.test.tsx`, and MSW handler order for `/api/shop/delivery-promise`.
- The zero threshold has a component-level test only (`ShopTopStrip`, "0.00"). The layout's banner split at zero was checked by reading the code here and has no test. TEST should decide whether that is enough.
- Test files outside the b49afaf delta were not reread beyond run 1's review, and e2e specs were not reread at all.
- Screenshots and design match at 360 and 1280: ACCEPTANCE.
- Mock-versus-real contract run: assigned by §12 to the integration step.

GATE: TEST
HANDOVER: HO-P5-WIRING (slice S1, store front)
COMMITS: base da87b60, HEAD b058708 (branch feat/p5-s1-store-front)
DATE: 2026-10-31
STATUS: FAIL

The status is FAIL, not BLOCKED, because five rows that §16 assigns to S1 (E2, E6) failed once each in a 2-worker chunk. Every one of them passes when rerun alone at 1 worker, and none is a reproduced defect. §1 Amended (i) lets the integrator rule on a failure like this only for specs outside S1's rows, so I have not applied it to these. Nothing I ran points to a defect in S1's code.

SHEET: docs/test-cases/TC-HO-P5-WIRING-S1.md (99 rows: 89 PASS, 5 FAIL, 5 BLOCKED, 0 NOT RUN). Written before any command ran. E17 is noted in the sheet as not a slice row (Amended (l)) and is outside the counts. Row T3b was dropped because T3 was green.

RESULTS
- `npm run typecheck`: exit 0 (also `tsc --noEmit --incremental false -p .`, exit 0).
- `npm run lint`: exit 0, no output.
- `npm test -- --maxWorkers=2`: exit 0. 216 files passed, 1 skipped; 1927 tests passed, 45 skipped, 0 failed (333.76 s). Green, so no rerun at `--maxWorkers=1` and no flake comparison arose.
- Verbose run of the S1 files plus both colour guards at `--maxWorkers=1`: exit 0; every S1 case in the sheet passed.
- `next build` (after e2e, dev server stopped, `.next` deleted first): exit 0, 58 s.
- Served output: zero hits in `.next` (excluding `cache`) for the mock database keys, rider names, customer names, certificate numbers, `setupWorker`/`createWorker`, `msw/browser`, district names, "Stock take until", "Call before you come". `InvalidCatalogueFilter`, `districtOfOrigin` and `delivery-promise` appear as production code only.
- Playwright, `next dev` on :3121, mocks, chromium + mobile-360, `--workers=2 --max-failures=20`, fresh server per chunk, routes warmed:
  - Chunk 1, E2-E5 (shop-catalogue, shop-product, shop-shell, shop-home, ordering-customer): 78 passed, 4 skipped, 1 failed, 1 flaky.
  - Chunk 2a, E6 minus ordering-a11y-responsive: 370 passed, 4 failed.
  - Chunk 2b, ordering-a11y-responsive: 68 passed, 0 failed (baseline :133 passed on both projects).
  - Chunk 3, extra specs ordering-customer-orders and shop-staff: 15 passed, 1 flaky.
  - E6's first attempt (one run of all nine specs) stopped at 141 passes with exit 1, no failure listing and no summary. Recorded as a crashed run (§20.8), not a result; redone as 2a and 2b. Cause not established.
- The three customer results named by S0 ACCEPTANCE, which are S1's E5: the COD-ceiling test (was :166, now :200 because S1 added a test at :167) passed on both projects; :66 passed on both projects; :146 E-B3 flaked on chromium (see below) and passed on mobile-360.

FAILURES AND CLASSIFICATION
All five were rerun alone, 1 worker, `--retries=0`, warm server, on both projects, and passed every time.
- E2a: shop-catalogue.spec.ts:217 "E-E1: maintenance replaces the storefront" (mobile-360, chunk 1): `getByText("Stock take until 6pm.")` not found in 20 s. Alone: 2/2 pass. Also 6/6 at 2 workers with `--repeat-each=3 --retries=0`. UNEXPLAINED. Candidate cause: the test flips a server-global maintenance flag and its twin on the other project runs at the same time. Not proven.
- E6a: shop-a11y-responsive.spec.ts:118 "review form with validation errors" (mobile-360): 90 s timeout clicking `Send review`. Alone: pass. UNEXPLAINED, load pattern.
- E6b: shop-portal.spec.ts:11 "E-D1: save to the wishlist..." (chromium): 90 s timeout waiting for "Tell me when it's back". Alone: pass. UNEXPLAINED, load pattern. (The product page is an S1 file; the same page passes alone and elsewhere in the chunk.)
- E6c: home.spec.ts:41 "signed in as a customer lands on My orders" (mobile-360): expected /portal/orders, received /shop. Alone: pass. UNEXPLAINED, looks like session state under load.
- E6i: accounts-auth.spec.ts:102 "E-C2: reload the portal after sign-in" (mobile-360): `getByLabel("Full name")` not found in 5 s. Alone: pass. UNEXPLAINED, load pattern.
- Flaky, counted as PASS with a caveat: ordering-customer.spec.ts:146 E-B3 (chromium): first attempt failed at 24.8 s (the "Collect from a branch" radio was not found), passed on the spec's own `retries: 1`. Alone, `--retries=0`, `--repeat-each=4`: 8/8 pass. S0 recorded the same test flaking under load. Row E5d.
- Flaky outside E2-E6 (X1): ordering-customer-orders.spec.ts:69 E-D1 (chromium): the order link was not found on the first attempt; passed on retry. Alone, `--repeat-each=3`, `--retries=0`: 6/6 pass. Under (i) this is recorded and rechecked at E18.
- None of the 12 baseline failures failed. None of the five failures is on the baseline list.
- No 0xC0000142, no heap error, no resource crash apart from the unexplained stop of E6's first attempt.

MUTATION CHECKS (remove the code, watch a test fail, restore with `git checkout`, tree clean after each)
- Plain-text filter error (`CatalogueView.tsx` back to raw `errorMessage`): caught by shell-p5 "an over-limit district list reads the existing plain sentence".
- Delivery-only rider note: removing both guards (`CheckoutScreen.tsx:341` and `lib/api/checkout.ts:215`) is caught by rider-note "sends no note at all for Pickup...". Removing either one alone is NOT caught (47/47 pass both times). The two guards cover each other, so neither is proven by itself. Showing the field for Pickup (`PaymentSection` `showNote`) is caught by two tests.
- Zero-threshold strip fallback (`promiseTakesStrip` check removed): caught by shell-p5 "does not take the strip...". A temporary probe showed `0`, `0.0`, `0.00` fall back and `0.50`, `0.01`, `10.00` show the strip; the shipped test only uses `0.00`.
- Staff-only fields in the public builders: adding `organicCertificateExpiresOn` to `catalogueItem`, and `organicCertificateFileId` to `detailView`, is caught each time by catalogue-p5 "the public card and detail never carry the staff-only...".

U47 (one row per new mock refusal): district over 20 values, district over 60 characters, riderNote over 300, riderNote control character, both at once (two violations), and NUL as Amended (v) states. All have a passing case. 20 real values plus blanks and exactly 20 are accepted (negative cases).

BLOCKED
- E4c ("banners still render below" in a browser): unit-only under Amended (t); proven by shell-p5 U10d. Unblock: a seeded `Shop` banner (outside S1's block).
- E6h (`portal-real-api`) and every real-API spec: no backend on :5005.
- U12c (lead time 0 keeps today's text): no test passes 0; I read the code (`leadTimeDays > 0`) but did not watch it. Unblock: one case in product-p5.
- R9 (`centsText` edges, CODE_REVIEW LOW): the function is private and no fixture has an edge price.
- R11 (SECURITY: rider note in the audit table; shared catalogue rate-limit bucket): backend, pre-existing, no S1 change.
- E17: not a slice row (Amended (l)); left to E18. Not run.

NOT RUN
- E17 (above), E18 full e2e, E19 `sweep:a11y` (integration), ACCEPTANCE screenshots (acceptance gate).

WEAK TESTS (not changed; existing specs are not edited by this gate)
- The Delivery-only guards are redundant and individually unproven (M2).
- Zero-threshold test covers only "0.00".
- `PERSIST_KEY` v2 has no test (read, not tested).
- U47-5's "both rules" case is also the only NUL case.
- No test passes `leadTimeDays: 0`.
- Strong: the Packed case (now asserts the Packing node, done nodes, the disabled Return and its hint), the retry case (now asserts the field keeps its text), the staff-only fields case (fails for card and detail), the plain-text filter error.

PRODUCTION DEFECTS
- None found in S1's code. Carried and not S1's: `public/mockServiceWorker.js` is served (LOW, from S0); the SECURITY MEDIUMs (rider note reaches the audit table; shared catalogue rate-limit bucket) are backend.

SCOPE CHECK
- Written by this gate: docs/test-cases/TC-HO-P5-WIRING-S1.md and this file. Temporary edits for the mutation checks and one temporary probe test (`tests/components/shop/zz-probe.test.ts`) were reverted or deleted; `git status` shows only the sheet, this record and `.claude/worktrees/`.
- Not mine: `git status` showed `docs/gates/HO-P5-WIRING-S1-ARCHITECTURE.md` modified (76 lines) during the run. I did not touch it.
- Cleanup: the dev servers I started were killed (PIDs 37384, 23224, 15436, 14956, 32536); nothing listens on :3121; no Playwright process of mine remains. :3122 and the chrome-headless-shell processes of the other agent's run (worktree agent-a974eb1973a852f4a) were left alone. Nothing committed.

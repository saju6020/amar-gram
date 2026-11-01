GATE: TEST
HANDOVER: HO-P5-WIRING (slice S1, store front)
RUN: 4
COMMITS: base da87b60; run 1 b058708; run 2 e6956c0; run 3 9169e55; run 4 1cac603 (branch feat/p5-s1-store-front)
DATE: 2026-10-31 to 2026-11-01
STATUS: FAIL

Three S1 rows fail first time in run 4: E6c and E6e (cold-compile timeouts in the single-server chunk) and E6d (ordering-a11y-responsive: four tests fail on a horizontal overflow, a new and deterministic failure). None of the three is the sign-in bounce the race fix addresses. The bounce did not appear in run 4. I found no defect in S1's code; the E6d failure is not explained.

HISTORY
- Run 1 (b058708, 2 workers): 89 PASS, 5 FAIL, 5 BLOCKED. Five failures, all passing alone.
- Run 2 (e6956c0, 1 worker): 92 PASS, 4 FAIL, 3 BLOCKED. Vitest 216 files / 1941 passed, typecheck and lint exit 0, E2-E5 80 passed with no flake, each Delivery guard now fails a test alone. In the single-server E6 chunk, four tests failed: home:33 (both projects), portal-dashboard:66 (both), account-area:51 (mobile-360), accounts-auth:102 (mobile-360); each passed 8/8 alone; the same chunk on da87b60 gave 363 passed, 11 failed. ordering-a11y-responsive: 67 passed, 1 failed (:133 on mobile-360, baseline).
- Run 3 (9169e55, fresh server per file): 95 PASS, 1 FAIL, 3 BLOCKED. Seven of eight E6 files passed; accounts-a11y-responsive:161 (mobile-360) failed with a 30 s timeout on "Account menu for ..." after the page bounced to sign-in. Server memory grew 2.0-2.5 GB to 3.7-4.1 GB over the two ~11-minute files and stayed near 2 GB for short ones.
- Integration (697a636, merged as 1cac603, Amended (ac)): cause of the bounce reproduced by the integrator by delaying MSW registration (>= 1500 ms bounces every time, <= 300 ms never, because the session hook's two 300 ms retries end first). Fix: the shared `page` fixture holds every `/api/` fetch until `__mswReady`; new `msw-start-race.spec.ts`. No app code changed.

RUN 4 CHANGE CHECK: `git diff e6956c0 HEAD --stat` shows web/tests/e2e/fixtures.ts, portal-helpers.ts and msw-start-race.spec.ts plus docs only. No product file. `npm run typecheck`: exit 0. Vitest, E2-E5, mutations and `next build` were not repeated, as instructed.

RUN 4 METHOD (fixed in advance)
`--project=chromium --project=mobile-360 --workers=1 --retries=0`, mocks, :3121, routes warmed, a fresh `next dev` per chunk, a keep-awake process (PID 13732, stopped), first result counts, no reruns for the sheet. Note: `--retries=0` does not override a spec's own in-file `retries` (ordering-a11y-responsive and ordering-customer-orders retry once); for those the first attempt is what I counted.
- Chunk 2a (run 2's list on one server: shop-a11y-responsive, shop-portal, home, portal-a11y-responsive, portal-dashboard, account-area, accounts-a11y-responsive, accounts-auth): 371 passed, 3 failed (31.6 min).
- Chunk 2b (ordering-a11y-responsive, fresh server): 64 passed, 4 failed (20.9 min).
- Chunk 3 (ordering-customer-orders, shop-staff, msw-start-race, fresh server): 17 passed, 1 flaky.

RUN 4 FAILURES
1. portal-dashboard.spec.ts:66 "E-A4: tile links reach the owning areas", chromium and mobile-360. Clicking "All invoices" left the page on /portal; `toHaveURL(/portal/billing)` failed after 5 s. Dev log: `/portal/billing` was compiled on demand at that moment: 5.1 s (2,843 modules) for chromium, 8.4 s (1,587 modules) for mobile-360. On run 3's fresh per-file server the same route compiled in 2.4 s. Different cause from the bounce: a cold on-demand compile slower than the test's 5 s expect.
2. home.spec.ts:33 "signed in as staff lands on /staff", mobile-360 only (chromium passed). Stayed on "/" for 5 s. Dev log: `/staff` compiled in 7.7 s (1,818 modules) in this server; the chromium run of the same test saw 3.3 s (passed); run 3's fresh server 1.6 s. Same family as 1: cold-compile timeout, not the bounce (the page never went to /sign-in).
   Failures 1 and 2 are the same two tests that failed in run 2's single-server chunk. In run 2 I called them session failures; the run 4 dev log shows they are compile-time failures, so that earlier label was probably wrong for these two. account-area:51 and accounts-auth:102 (run 2) and accounts-a11y:161 (run 3) did not fail in run 4.
3. ordering-a11y-responsive.spec.ts:100, "/staff/orders" and "/staff/returns", on chromium and mobile-360 (4 tests; each failed its first attempt and the in-file retry): `/staff/orders @360 overflows horizontally`, expected <= 0, received 38 (likewise /staff/returns). Not the baseline :133 (it passed). New in run 4: these four passed in run 2 chunk 2b and run 1. Deterministic: the four tests alone on another fresh server at HEAD failed again; the same four tests alone on a fresh server with the e6956c0 versions of fixtures.ts and portal-helpers.ts swapped in (temporarily; restored with git checkout; tree clean) passed 4/4. So the new `/api` hold in `page` changes what these pages show when the 600 ms overflow check runs.
   Not established: whether this exposes a real 38 px overflow on staff orders and returns at 360 that the old race hid (for example pages sitting in an error or empty state before the fix), or a timing effect of the hold itself. I did not inspect the rendered page. Suspected only: the former. It is not caused by S1: S1 changes nothing in staff orders or returns, and the product code is identical to run 2's.
4. X1 ordering-customer-orders.spec.ts:35 E-C2 (chromium) failed its first attempt and passed on the in-file retry. Same test, same cause as before (it sets a 3 s transfer window and expects the "Pay by bank transfer" heading within 5 s). Reported separately; not the bounce.

WHAT PASSED
- accounts-a11y-responsive (including :161), accounts-auth (including :102), account-area (including :51), shop-a11y-responsive, shop-portal, portal-a11y-responsive: all passed first time in the single-server chunk where, in runs 2 and 3, some of them had failed. This is consistent with the race fix but does not prove it (those failures are intermittent), and msw-start-race.spec.ts passed on both projects.
- shop-staff passed. ordering-a11y-responsive :133 on mobile-360 passed this time.

ROWS (sheet: docs/test-cases/TC-HO-P5-WIRING-S1.md, 100 rows: 94 PASS, 3 FAIL, 3 BLOCKED, 0 NOT RUN)
- FAIL: E6c (home:33), E6e (portal-dashboard:66), E6d (ordering-a11y-responsive overflow).
- PASS now: E6g, E6i; E6a, E6b, E6f unchanged; new row X3 (msw-start-race) PASS.
- BLOCKED: E4c, E6h, R11 (as recorded). E17 outside the counts.
- Each changed row carries its earlier evidence after "PRIOR:".

NOT RUN
- Vitest, E2-E5, mutations, `next build` (not requested), E17, E18, E19 `sweep:a11y`, ACCEPTANCE screenshots, real-API specs.

WHAT WOULD CLEAR THE THREE FAILS
- E6c, E6e: either warm `/staff` and `/portal/billing` (and similar first-visit routes) before the chunk, or raise the 5 s expect timeout on those navigations; both are harness choices, not S1 changes.
- E6d: someone must look at /staff/orders and /staff/returns at 360 with data loaded. If the 38 px overflow is real it is a staff-side layout fault (S2's area), not S1's.

PRODUCTION DEFECTS
- None found in S1. Possible, unverified, outside S1: the /staff/orders and /staff/returns 360 px overflow above.

SCOPE AND CLEANUP
- Written by this gate: this record and the sheet. fixtures.ts and portal-helpers.ts were swapped and restored for one diagnostic; `git status` shows only these two docs. Nothing committed.
- Servers I started are stopped; nothing listens on :3121; keep-awake PID 13732 stopped; port 3122 untouched.

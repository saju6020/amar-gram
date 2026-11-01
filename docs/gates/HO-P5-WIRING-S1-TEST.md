GATE: TEST
HANDOVER: HO-P5-WIRING (slice S1, store front)
RUN: 3
COMMITS: base da87b60; run 1 at b058708; run 2 at e6956c0; run 3 at 9169e55 (branch feat/p5-s1-store-front; product code unchanged since e6956c0)
DATE: 2026-10-31 to 2026-11-01
STATUS: FAIL

One S1 row still fails: E6g (accounts-a11y-responsive:161, mobile-360), the first result on a fresh server for that file. The other seven E6 files passed first time. I found no defect in S1's code, but the one failure means the "degradation over a long chunk" explanation is not confirmed, and I cannot say it is wrong either.

HISTORY
- Run 1 (b058708, 2 workers): 89 PASS, 5 FAIL (E2a, E6a, E6b, E6c, E6i), 5 BLOCKED. All five passed alone. The Delivery-only guards were each unproven alone.
- Run 2 (e6956c0, 1 worker, tests-only change): 92 PASS, 4 FAIL, 3 BLOCKED. Vitest 216 files / 1941 passed; typecheck and lint exit 0; E2-E5 80 passed, 0 failed, 0 flaky; each Delivery guard now fails a test on its own. In the single-server E6 chunk 2a, four tests failed: home.spec:33 (both projects), portal-dashboard:66 (both), account-area:51 (mobile-360), accounts-auth:102 (mobile-360). Each passed 8/8 alone. Control: the same eight specs at 1 worker on da87b60 (no S1 code) gave 363 passed and 11 failed, including portal-dashboard:66 on both projects, account-area:51, accounts-auth:102/:18/:34, home:41. ordering-a11y-responsive: 67 passed, 1 failed (:133 mobile-360, the baseline exception). Those run 2 results stand; run 3 does not repeat Vitest, E2-E5, the mutations or ordering-a11y-responsive.

RUN 3 METHOD (fixed before running)
Every E6 spec file except ordering-a11y-responsive and the real-API specs: shop-a11y-responsive, shop-portal, home, portal-a11y-responsive, portal-dashboard, account-area, accounts-a11y-responsive, accounts-auth. For each file, a script checked :3121 was free, started a fresh `next dev` (PORT=3121, NEXT_PUBLIC_USE_MOCKS=true, NEXT_PUBLIC_API_BASE_URL=http://localhost:5005), warmed 15 routes, ran `--project=chromium --project=mobile-360 --workers=1 --retries=0`, then stopped only that server. First result counts; nothing was rerun. A keep-awake process (PID 39340) ran throughout and was stopped. Server memory is the working set of the process listening on :3121, at the start (after warming) and the end of each file.

RUN 3 RESULTS (first result per file)
| File | Result | Server memory start to end |
|---|---|---|
| shop-a11y-responsive | 76 passed | 2,487 to 4,107 MB (11.7 min) |
| shop-portal | 6 passed | 2,144 to 2,405 MB (47 s) |
| home | 8 passed | 2,283 to 2,179 MB (27 s) |
| portal-a11y-responsive | 34 passed | 2,217 to 1,935 MB (1.2 min) |
| portal-dashboard | 24 passed | 2,244 to 2,213 MB (52 s) |
| account-area | 12 passed | 2,142 to 2,257 MB (52 s) |
| accounts-a11y-responsive | 195 passed, 1 FAILED | 1,976 to 3,703 MB (11.1 min) |
| accounts-auth | 18 passed | 2,010 to 2,252 MB (1.0 min) |

FAILURE
- E6g: accounts-a11y-responsive.spec.ts:161 "E-X3: after signing out, no pc_session cookie is readable and web storage is empty", mobile-360, test number 196 of 196, near the end of the 11-minute file. A 30 s test timeout on `getByRole('button', { name: /^Account menu for / }).click()` after `signInAsCustomer` and `goto('/portal/account/profile')`. The dev log shows `/portal/account/profile` answered 200 and then `/sign-in?next=%2Fportal%2Faccount%2Fprofile`: the page did not see the signed-in session and went to sign-in.
- Same symptom as the earlier four? Yes in kind: a customer or staff session not recognised right after sign-in, on a freshly loaded page. Different in form: a 30 s test timeout instead of a 5 s expect. Not a new class of failure.
- Not rerun, as instructed. In run 2 this test passed in the single-server chunk, so it fails in some runs and not others.

WHAT THIS DOES AND DOES NOT SHOW ABOUT THE CAUSE
- The four run-2 failures (home:33, portal-dashboard:66, account-area:51, accounts-auth:102) all passed first time on a fresh server per file. That fits server age or chunk length being a factor. It is only support: the one failure that remains is in the fresh-server method, and it sits at the end of the longest files.
- Memory: the two longest files (shop-a11y-responsive and accounts-a11y-responsive, about 11 minutes each) grew the dev server from about 2.0-2.5 GB to 3.7-4.1 GB. The short files stayed near 2.0-2.4 GB or fell. shop-a11y-responsive grew most and passed; accounts-a11y-responsive grew less and had the failure. So growth alone does not predict the failure. I did not measure the same figures through the single-server run 2 chunk, so I have nothing to compare the 3.7-4.1 GB against.
- Control: da87b60 fails the same specs in a single-server chunk. That shows the instability is not caused by S1. It does not show what the cause is.

WHAT I READ IN THE MOCK AND SESSION CODE
Verified by reading (tests/e2e/fixtures.ts, portal-helpers.ts, mocks/handlers/areas/accounts.ts, instrumentation.ts, app/providers.tsx, lib/hooks/useSession.ts):
- `signInAsCustomer` and `signInAsStaff` do a page-level `fetch` to the sign-in endpoint. The handler runs in the browser (MSW service worker, state in the page), keeps its session Maps in the page and mirrors them to that tab's `sessionStorage`, and sets the cookie with `document.cookie`. Playwright gives each test a fresh browser context, so session state does not carry from one test to the next. Customer sessions last 168 hours, staff sessions use a 30-minute idle window plus an absolute expiry, both measured on the wall clock, not on server age.
- The dev server also runs a separate `msw/node` instance (instrumentation.ts) for server components. That instance has its own module-level copy of the mock stores (shop, ordering, accounts) which lives as long as the server and is shared by every test and both projects. The in-page store and the server store are different copies. State that accumulates over the server's life therefore exists (orders placed, reviews, a maintenance flag). I did not find any place where a sign-in test depends on that server-side copy.
- The fixtures file and `app/providers.tsx` both document a race: `worker.start()` is asynchronous, so a request in the same tick as hydration can reach the real network (nothing listens on :5005) before MSW is ready. `goto` is wrapped to wait for the service-worker controller (15 s) and `__mswReady` (10 s), both best-effort with errors swallowed. The session query retries only on a network error (`useSession.ts`: `retryOnlyNetworkError`, 300 ms delay, count not checked). A first session read that lost this race would fail, and the guard fails closed and redirects to sign-in, which is exactly what the run 3 log shows for E6g.
Only suspected, not verified: that the loss of that race is more likely when the dev server is slow or large, and that this is why failures appear in long runs. I did not instrument the race, did not read the guard's retry count against the failure, and have no direct measurement tying any failure to server memory or age. The "degradation" explanation is supported by 4 of 5 earlier failures disappearing on fresh servers, and weakened by the E6g failure and by da87b60's failures being the same kind of thing; it is not proven.

STATE OF THE ROWS (sheet: docs/test-cases/TC-HO-P5-WIRING-S1.md, 99 rows)
- 95 PASS, 1 FAIL (E6g), 3 BLOCKED (E4c, E6h, R11), 0 NOT RUN. E17 is not a slice row and is outside the counts.
- E6a, E6b, E6c, E6e, E6f, E6i changed from FAIL or from run 2 evidence to PASS on the run 3 first results; E6d stays PASS with the :133 baseline exception from run 2. E6g is FAIL. Run 2 evidence is kept in each cell.
- E2-E5, Vitest, the mutation checks and X1/X2 are as in run 2.

BLOCKED (unchanged)
- E4c (unit-only under Amended (t)), E6h and all real-API specs (no backend), R11 (backend SECURITY items).

NOT RUN
- E17, E18, E19 `sweep:a11y`, ACCEPTANCE screenshots; Vitest, E2-E5, mutations and ordering-a11y-responsive in run 3 (not asked).

PRODUCTION DEFECTS
- None found in S1. Carried, not S1: `public/mockServiceWorker.js` is served (LOW); the SECURITY MEDIUMs are backend.

SCOPE AND CLEANUP
- Written by this gate: this record and the sheet (overwritten/updated). No product or existing spec file changed; nothing committed. `git status` shows only these two docs.
- Servers I started were all stopped by the script; nothing listens on :3121; keep-awake PID 39340 stopped; port 3122 untouched. web/node_modules has 412 entries (restored earlier from the main checkout; no junction remains). No temporary worktree exists.

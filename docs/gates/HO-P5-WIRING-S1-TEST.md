GATE: TEST
HANDOVER: HO-P5-WIRING (slice S1, store front)
RUN: 2
COMMITS: base da87b60; run 1 at b058708; run 2 at e6956c0 (branch feat/p5-s1-store-front)
DATE: 2026-10-31 to 2026-11-01
STATUS: FAIL

Four S1 rows still fail at `--workers=1` (E6: home.spec, portal-dashboard, account-area, accounts-auth), so the status stays FAIL. I investigated: each of the four tests passes 8/8 alone (both projects, `--retries=0 --repeat-each=4`), and the same eight-spec chunk run on S1's diff base `da87b60`, which has none of S1's code, fails the same way (11 failures there). I found no defect in S1's code. The cause is instability in the long single-server E6 chunk, not in S1; I did not find the root cause beyond that. Whether to accept these four rows is the integrator's call (Amended (i) names only non-slice specs).

WHAT RUN 1 FOUND (HEAD b058708, 2 workers): 89 PASS, 5 FAIL, 5 BLOCKED. The five FAILs were E2a (shop-catalogue:217 maintenance), E6a (shop-a11y-responsive:118), E6b (shop-portal:11), E6c (home:41) and E6i (accounts-auth:102); each passed alone. The five BLOCKED rows were U12c, E4c, E6h, R9 and R11. The Delivery-only rider-note guards were each unproven alone (removing either one left 47/47 green).

SHEET: docs/test-cases/TC-HO-P5-WIRING-S1.md (99 rows: 92 PASS, 4 FAIL, 3 BLOCKED, 0 NOT RUN). Evidence cells carry "RUN 1" and "RUN 2" where both exist. E17 is noted as not a slice row (Amended (l)) and is outside the counts.

CHANGE SINCE RUN 1: `git diff b058708 HEAD --stat` shows four test files under web/tests (catalogue-p5, rider-note, product-p5, shell-p5) plus the slice report, the ARCHITECTURE record, the handover's Amended row and these docs. No product file changed. New cases: lead time 0 (U12c), zero threshold 0/0.0/0.00 and 0.01/0.50 plus a layout case, centsText table, store key v2, and a screen guard and a client guard for the Delivery-only note.

RESULTS (run 2)
- `npm run typecheck`: exit 0. `npm run lint`: exit 0.
- `npm test -- --maxWorkers=2`: exit 0. 216 files passed, 1 skipped; 1941 tests passed, 45 skipped, 0 failed (run 1: 1927).
- `next build` and the served-output check were not rerun: no product code changed since run 1 (exit 0, zero mock data in `.next`).
- Playwright, `next dev` :3121, mocks, `--project=chromium --project=mobile-360 --workers=1 --max-failures=20`, config retries unchanged, fresh server per chunk, routes warmed:
  - Chunk 1, E2-E5 (shop-catalogue, shop-product, shop-shell, shop-home, ordering-customer): 80 passed, 4 skipped, 0 failed, 0 flaky. The run-1 failure E2a (:217 maintenance) and the run-1 flake E5d (E-B3 :146) both passed first time, so they were 2-worker effects.
  - Chunk 2a, E6 without ordering-a11y-responsive: 368 passed, 6 failed (see below).
  - Chunk 2b, ordering-a11y-responsive: 67 passed, 1 failed: :133 on mobile-360, the baseline exception.
  - Chunk 3, X1/X2 (ordering-customer-orders, shop-staff): 14 passed, 2 flaky (see below).
- The three customer specs S0 flagged (E5): the COD-ceiling test (:200), :66 and :146 all passed first time on both projects.

FAILURES AND CLASSIFICATION
- E6c home.spec.ts:33 "signed in as staff lands on /staff" (chromium and mobile-360): stayed on "/" for 5 s.
- E6e portal-dashboard.spec.ts:66 "E-A4: tile links reach the owning areas" (chromium and mobile-360): stayed on /portal, expected /portal/billing.
- E6f account-area.spec.ts:51 "E-E2: opt into SMS marketing" (mobile-360): table not found within 5 s.
- E6i accounts-auth.spec.ts:102 "E-C2: reload the portal after sign-in" (mobile-360): "Full name" not found within 5 s.
  - All four: alone, fresh server, `--retries=0 --repeat-each=4`, both projects: 8/8 pass for each (plus accounts-auth:137, 8/8). A separate repeat-each=2 run of the four specs: 16/16.
  - Control on `da87b60` (no S1 code), same eight specs, 1 worker: 363 passed, 11 failed, among them portal-dashboard:66 on both projects, account-area:51 on mobile-360 (and three other account-area tests), accounts-auth:102 (chromium) with :18 and :34, home:41 on mobile-360, shop-a11y:118 and shop-portal:59/:81/:11. The failing set changes from run to run; the common factor is the long single-server chunk and sign-in/session pages. Root cause not established. Not a defect in S1.
- A discarded attempt: the first run of chunks 2a/2b at 1 worker was interrupted by the machine suspending (Playwright reported 10.4 h, `net::ERR_NETWORK_IO_SUSPENDED`). I reran both with a temporary keep-awake process (`SetThreadExecutionState`; no setting changed; killed afterwards). Only the rerun is counted.
- X1 ordering-customer-orders.spec.ts:35 "E-C2: an unconfirmed transfer expires" flaked on both projects in chunk 3 (passed on retry). Alone, `--retries=0 --repeat-each=4`: 7 of 8 pass; the one failure was the cold first chromium run. The test sets a 3 s transfer window and then expects the "Pay by bank transfer" heading, so a slow first render loses by design. Outside E2-E6; recorded under (i), recheck at E18.
- Baseline exception: ordering-a11y-responsive:133 on mobile-360 failed as the handover records. No other baseline item appeared (not in scope).
- No pass-on-retry in any E2-E5 row in run 2.

MUTATION CHECKS (run 2; each restored with `git checkout`, tree clean after)
- CheckoutScreen.tsx:341 guard removed alone: fails "screen guard: the request the screen builds for Pickup carries no riderNote" (1 failed, 48 passed).
- lib/api/checkout.ts:215 guard removed alone: fails "client guard: placeOrder drops a note given with Pickup, and trims one given with Delivery" (1 failed, 48 passed).
- Both removed: those two plus "sends no note at all for Pickup..." fail (3 failed). Each guard is now proven on its own.
- Run 1 results stand (no product change): plain-text filter error caught; PaymentSection Pickup field caught; zero-threshold check caught; staff-only fields in card and detail builders caught. The zero-threshold, store-key and centsText cases are new in run 2; I did not mutate them again.

CLOSED SINCE RUN 1
- U12c: now has a test (lead time 0 keeps today's text); PASS.
- R9: centsText table test (5, 99, 100, 101, 280000 minor units on detail and card); PASS.
- P3: store key v2 is pinned by a test; PASS.

BLOCKED (3)
- E4c ("banners render below" in a browser): unit-only under Amended (t); proven by shell-p5, now also by a layout case where the first banner is the strip and the rest are below, none lost or doubled.
- E6h and every `*-real-api` spec: no backend on :5005.
- R11 (SECURITY: rider note in the audit table; shared catalogue rate-limit bucket): backend, pre-existing.

NOT RUN
- E17 (Amended (l)), E18, E19 `sweep:a11y`, `next build` and served-output check in run 2 (no product change), ACCEPTANCE screenshots.

PRODUCTION DEFECTS
- None found in S1. Carried, not S1: `public/mockServiceWorker.js` is served (LOW); the SECURITY MEDIUMs are backend.

SCOPE AND CLEANUP
- Written by this gate: the sheet and this record (both overwritten from run 1). No product or existing spec file changed; temporary mutation edits were reverted. Nothing committed.
- An accident I caused and repaired: while removing a first temporary baseline worktree on the C: drive, `git worktree remove --force` followed a node_modules junction and emptied this worktree's `web/node_modules`. I restored it with robocopy from `D:\my-repo\amar-gram\web\node_modules` (identical package-lock hash, 412 entries); typecheck, the mutation runs and chunks that followed all worked. node_modules is untracked, so git is unaffected. The second baseline worktree (`.claude/worktrees/s1test-base`) was removed after dropping its junction first, and `git worktree prune` was run; the main repo's node_modules still has 412 entries.
- Dev servers I started are all stopped (nothing listens on :3121); the keep-awake process (PID 20700) is stopped. Port 3122 and its processes were not touched.

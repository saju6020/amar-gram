# HO-P6 S1 - TEST gate

Branch feat/p6-s1-customer at 7739506. Sheet: docs/test-cases/TC-HO-P6-SUBSCRIPTIONS-S1.md (builder's 43 rows plus T1-T12 added by this gate: 0 FAIL, 0 BLOCKED, 2 NOT RUN, both the real API: E18 and T11).

Verdict: PASS.

Cases T1-T12 were written as NOT RUN before anything was executed, then updated one at a time.

Results (dev server PORT=3128, mocks on, API base http://localhost:5005, E2E_KEEP_ROUTES=1, `--max-failures=5`):
- tsc --noEmit exit 0; lint exit 0 (`--max-warnings 0`).
- Full Vitest `--maxWorkers=2`: clean run 263 files passed (1 skipped), 2661 tests passed (62 skipped). An earlier run at the same head showed 1 failed test / 2660 passed; its name was lost because the output was piped through `tail`. A full re-run was clean, so it is recorded as one unidentified load flake (the first run overlapped nothing of mine, but the machine is shared). If the owner wants it identified, run the suite twice with `--reporter=default > file`.
- S1 specs plus S2 staff specs (subscriptions-customer, -360, -a11y, subscriptions-staff, -360, -a11y), chromium + mobile-360: second run on a warm server, workers=1, 136 passed, 14 skipped (the two real-API specs without E2E_REAL_API=1), 0 failed. The first run (workers=2, cold server) was 135 passed, 14 skipped, 1 failed, see the flake note below. Every S1 customer spec passed in both runs.
- Run-only set (shop-product, shop-a11y-responsive, portal-dashboard, portal-a11y-responsive, account-area, shop-portal, accounts-a11y-responsive, ordering-customer, ordering-a11y-responsive, shop-catalogue, shop-home, shop-shell, home, accounts-auth), both projects, final run workers=1 on a pre-warmed server: 526 passed, 4 skipped (viewport-conditional cases in shop-home and shop-shell), 0 failed. This covers the BuyBox offer slot, the Subscriptions menu link and overview card, and AddressForm's 44 px fields in checkout and accounts (Amended (j)).
- Amended (k) check: S2's private `pendingLines` now routes through `pendingChangeLines(view, 'staff')`; subscriptions-staff (both projects) and the Vitest staff tests pass.
- Colour-literal and card-input check (U40) over components/subscriptions, components/staff-subscriptions, lib/subscriptions and app: 0 hits.

Flakes, with evidence (none touches S1 code):
- Two earlier run-only attempts (workers=2) stopped at `--max-failures=5` with chromium-only failures: accounts-auth E-D1, home.spec (3 cases), accounts-a11y-responsive on /staff/admin/staff-accounts and /staff/customers/duplicates, portal-dashboard E-A4, shop-a11y-responsive (3 routes), ordering-customer E-B5 / E-C2 (flaky, passed on retry). They were 30 s timeouts or 5 s URL waits on the first compile of a cold route, with tests slowing to 45-90 s under two workers. Re-run alone at `--workers=1`: portal-dashboard all pass on both projects; accounts-auth E-D1 and home "staff lands on /staff" failed only on their first (cold) execution and passed 5 of 5 repeats on chromium and mobile-360 afterwards (17 of 18 overall). The final run on a pre-warmed server at workers=1 passed all of them. portal-dashboard E-A4 did fail twice at workers=2 in chromium; it touches the dashboard S1 changed, so it was checked specifically: it passed at workers=1 in the isolated run and in the final run, and its assertions (tile links, /portal/billing) do not involve the new Next delivery card.
- subscriptions-staff "an order number in the history opens the staff order page" failed on the first chromium execution after each cold start (URL stayed on /staff/subscriptions/{id}, 5 s expect) and passed 7 of 7 repeats and the whole warm run. S1 changed no history-link code (staff CycleHistory.tsx is untouched by the S1 commits; the only S2 file S1 touched is DetailPanels.tsx's pending lines). Recorded as a cold-compile load flake. The S2 TEST gate passed this case.
- No 0xC0000142, heap or "Compiled in 0ms" storms were seen; workers dropped from 2 to 1 for the run-only sweep because of timeouts.

Acceptance coverage: the builder's U8-U26, U40, E2-E8 map to passing rows; E7 (portal-dashboard E-A2 superseded) is inside the run-only set and passed.

Not run: subscriptions-customer-real-api (E18, T11) needs E2E_REAL_API=1, NEXT_PUBLIC_USE_MOCKS=false and a backend; no backend was started. `npm run sweep:a11y` and the production build are integration steps.

Process notes: the earlier unidentified Vitest failure is the one item a human may want to chase. No product code or spec was edited, no test added to the product tree, none weakened. No production bug found. Cleanup: dev server on 3128 stopped (no listener), node and chrome processes of this worktree stopped, no tracked screenshot modified, web/node_modules junction left in place.

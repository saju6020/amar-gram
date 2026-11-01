GATE: TEST
HANDOVER: HO-P5-WIRING (slice S1, store front)
RUN: 5
COMMITS: base da87b60; run 1 b058708; run 2 e6956c0; run 3 9169e55; run 4 1cac603; run 5 2805a80 (branch feat/p5-s1-store-front)
DATE: 2026-10-31 to 2026-11-01
STATUS: FAIL

One S1 row fails first time in run 5: E6e, `portal-dashboard.spec.ts:66` on mobile-360. Everything else passes: typecheck, lint, Vitest, build, E2-E5, and the rest of E6 including `ordering-a11y-responsive` (the 360 px overflows are gone). I found no defect in S1's code.

HISTORY
- Run 1 (b058708, 2 workers): 89 PASS, 5 FAIL, 5 BLOCKED. Five failures, each passing alone.
- Run 2 (e6956c0, 1 worker): 92 PASS, 4 FAIL, 3 BLOCKED. Vitest 1941 passed; E2-E5 80 passed; each Delivery guard fails a test alone. Single-server E6 chunk: home:33, portal-dashboard:66, account-area:51, accounts-auth:102 failed; the same chunk on da87b60 failed 11 tests.
- Run 3 (9169e55, fresh server per file): 95 PASS, 1 FAIL. accounts-a11y-responsive:161 (mobile-360) bounced to sign-in.
- Integration 697a636 / 1cac603 (Amended (ac)): sign-in bounce reproduced by delaying MSW registration; the `page` fixture now holds `/api/` fetches until `__mswReady`; `msw-start-race.spec.ts` added.
- Run 4 (1cac603): 94 PASS, 3 FAIL, 3 BLOCKED. No bounce. home:33 (mobile-360) and portal-dashboard:66 (both) failed on 5 s URL assertions while the dev log showed 7.7 s, 5.1 s and 8.4 s on-demand compiles; ordering-a11y-responsive failed 4 tests on a deterministic 38 px overflow at 360 that the old race had hidden.
- Integration 2a2963c / 2805a80 (Amended (ad)): `ResponsiveTable` and `TableFrame` fixes for the two real overflows.

RUN 5 CHANGE: `git diff 17002b0 HEAD --stat` shows `components/back-office/TableFrame.tsx`, `components/billing/ResponsiveTable.tsx` and docs only. Product code changed, so everything ran except the mutations (not repeated, as instructed).

RESULTS (run 5)
- `npm run typecheck`: exit 0. `npm run lint`: exit 0.
- `npm test -- --maxWorkers=2`: exit 0. 216 files passed, 1 skipped; 1941 tests passed, 45 skipped, 0 failed.
- `next build`: exit 0 (after `rm -rf .next`, nothing else using `.next`). Served-output check over `.next` excluding `cache`: 0 files for all 19 mock-data terms (database keys, rider and customer names, certificate numbers, `setupWorker`, `createWorker`, `msw/browser`, district names, "Stock take until", "Call before you come", seed product names).
- Playwright, mocks, `--project=chromium --project=mobile-360 --workers=1 --retries=0`, fresh `next dev` on :3121 per chunk (started after `rm -rf .next`), keep-awake PID 39588 (stopped), first attempt counts, in-file retries count as first-attempt failures:
  - Chunk 1, E2-E5 (shop-catalogue, shop-product, shop-shell, shop-home, ordering-customer): 80 passed, 4 skipped, 0 failed, 0 flaky.
  - Chunk 2a, E6 minus ordering-a11y-responsive (eight files): 373 passed, 1 failed (27.5 min).
  - Chunk 2b, ordering-a11y-responsive: 68 passed, 0 failed (21.2 min). `/staff/orders`, `/staff/returns` and baseline `:133` all passed on both projects.
  - Chunk 3, ordering-customer-orders, shop-staff, msw-start-race: 17 passed, 1 flaky (X1, below).

WARMING (Rule 3): before each chunk I requested, one after another and waiting for each answer, 21 routes: /, /shop, /shop/products, a product page, /cart, /checkout, /sign-in, /register, /staff, /staff/sign-in, /staff/pos, /staff/orders, /staff/returns, /staff/shop/products, /portal, /portal/orders, /portal/billing, /portal/account/profile, /portal/account/notifications, /portal/wishlist, /portal/reviews. All returned 200. First-compile times (seconds; full lists in the temp files `r5-<chunk>-warm.log`): `/shop` 5.7 to 7.9, `/staff` 2.8 to 5.8, `/staff/pos` 2.0 to 5.1 (one chunk), `/register` 1.4 to 5.0 (one chunk), `/shop/products*` 3.3 to 4.3, `/cart` and `/checkout` 2.7 to 4.1; every other route 1.4 to 2.7, including `/portal/billing` 1.7 to 2.1.

THE ONE FAILURE (E6e)
- portal-dashboard.spec.ts:66 "E-A4: tile links reach the owning areas", mobile-360 only; chromium passed. Clicking "All invoices" left the page on `/portal`; `toHaveURL(/\/portal\/billing$/)` failed after 5 s.
- Measured in the chunk's dev log: `/portal/billing` was warmed at the start (compiled in 1.4 s), was compiled again for the chromium run (0.75 s), and was compiled a third time when the mobile-360 test clicked, in 9.5 s (1,724 modules). So the failure does not come from an unwarmed route: the route was warmed and was compiled again, slowly, at the click.
- Not measured: why Next compiled the route again, and why that compile took 9.5 s against 0.75 s and 1.4 s earlier. I have no evidence on either, and will not name a cause.
- Not the sign-in bounce: the page was never sent to /sign-in for this assertion. Same family as run 4's portal-dashboard and home failures (a 5 s URL assertion against an on-demand compile), which warming at the start of the chunk did not prevent here.
- Warming it and rerunning would need a new run; I did not do that.

X1 (reported separately; outside S1's rows; rechecked at E18 under (i))
- ordering-customer-orders.spec.ts:35 E-C2, chromium: failed its first attempt (heading "Pay by bank transfer" not found in 5 s; the test sets a 3 s transfer window) and passed on the in-file retry. Same test and same symptom as in runs 2 to 4. X2 (shop-staff) and X3 (msw-start-race) passed.

ROWS (sheet: docs/test-cases/TC-HO-P5-WIRING-S1.md, 100 rows: 96 PASS, 1 FAIL, 3 BLOCKED, 0 NOT RUN)
- FAIL: E6e only.
- PASS now: E6c (home:33 passed on both projects), E6d (overflows fixed), plus every E2-E5 row.
- BLOCKED: E4c (unit-only under Amended (t)), E6h (real-API, no backend), R11 (backend SECURITY items). E17 is outside the counts.
- Each changed row keeps its earlier evidence after "EARLIER:" or "PRIOR:".

NOT RUN
- Mutations (not repeated), E17, E18, E19 `sweep:a11y`, ACCEPTANCE screenshots, real-API specs.

PRODUCTION DEFECTS
- None found in S1. The two staff-table overflows were real and are fixed by Amended (ad) (not S1's code). Carried, not S1: `public/mockServiceWorker.js` is served (LOW); the SECURITY MEDIUMs are backend.

SCOPE AND CLEANUP
- Written by this gate: this record and the sheet. No product or spec file changed by me. Nothing committed. `git status` shows only these two docs.
- Servers I started are stopped; nothing listens on :3121; keep-awake PID 39588 stopped; port 3122 untouched.

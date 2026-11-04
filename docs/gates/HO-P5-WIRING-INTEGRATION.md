# HO-P5-WIRING — integration record (E18, E19)

Branch `feat/phase2-catalogue-theme`. Integrator: Claude (Opus 5.5), under the owner's 2026-10-31 delegation to finish HO-P5 without per-step approval. Run 2026-11-04 to 2026-11-05 on this machine. Nothing pushed.

## What ran

| Step | Result |
|------|--------|
| Typecheck, lint, Vitest, build | Green (first integration attempt, 2026-11-04; not repeated). `tsc --noEmit` and ESLint rerun after each change below: clean |
| Contract GETs (`de92447`), README ADR rows (`a038495`) | Committed in the first attempt |
| E18 chunk 1 (store, portal, accounts) | Run in the first attempt. Its leftovers are settled below; chunk 1 was not run again as a whole |
| E18 chunks c2 … c8 | Run twice: pass A on the default `next dev`, then c3, c4, c6 and c7 again (pass B) after Amended (au) |
| E19 `sweep:a11y` | 179 routes: 178 clean, and the 179th clean when rerun alone (below) |

Every chunk ran on a fresh `next dev` (port 3120, `NEXT_PUBLIC_USE_MOCKS=true`, `NEXT_PUBLIC_API_BASE_URL=http://localhost:5005`, 8 GB heap) with `--project=chromium --project=mobile-360 --workers=2 --retries=0`. Free commit memory stayed between 12 and 20 GB, so no run needed 1 worker. Logs are in the integrator's scratchpad (`e2e/<chunk>/list.txt`, `dev.out.txt`, `meta.txt`); the first attempt's logs are in `D:/my-repo/amar-gram-backup/integration-2026-11-04/`.

## Pass/fail per chunk

| Chunk | Specs | Pass A (default dev server) | Pass B (Amended (au)) | Failures in the final pass |
|-------|-------|-----------------------------|-----------------------|----------------------------|
| c1 store/portal/accounts | shop-*, home, account-area, accounts-*, portal-* (not dashboard), ordering-customer-* | First attempt: 430 passed, 25 failed, 1 flaky (3 workers), then leftovers rerun | not rerun as a chunk | Leftovers settled below |
| c2 portal-dashboard | portal-dashboard | 24 passed, 0 failed | not needed | none (E-A4 :66 passed on both projects) |
| c3 sales | ordering-staff, ordering-pos, dashboard-*, sales-gate-s2, packed-customer-after-staff, reports-* | 90 passed, 2 failed, 14 skipped (10.5 min) | 98 passed, 0 failed, 14 skipped (4.2 min) | none |
| c4 staff | staff-admin, staff-auth, staff-customers, staff-shell-* | 49 passed, 9 failed | 52 passed, 6 failed (2.6 min) | 6, all baseline |
| c5 ordering-a11y | ordering-a11y-responsive | 68 passed, 0 failed | not needed | none (baseline :133 passed) |
| c6 inventory | inventory-*, procurement-flows, catalogue-stock-* | stopped at `--max-failures=30`: 238 passed, 30 failed (1.1 h) | 522 passed, 0 failed, 24 skipped (22.2 min) | none |
| c7 billing-admin | billing-*, admin-*, customers-admin-* | 377 passed, 11 failed, 30 skipped (41.4 min) | 383 passed, 5 failed, 30 skipped (24.9 min) | 3 baseline, 2 settled as flaky (below) |
| c8 notif-xct | notifications-*, xct-*, journey-real-api | 184 passed, 4 failed, 46 skipped | not needed (no rebuilds in its dev log) | 4, all baseline |

Skipped tests are the real-API specs, which skip themselves without `E2E_REAL_API=1`.

## Baseline failures (§1, 11 since Amended (ak))

Failing in the final pass, each in its recorded way:

- `staff-shell-toggle` :29, both widths, both projects: focus never reaches the toggle within 15 Tab presses (line 44), as HO-P4's TEST record says.
- `staff-shell-sheet-closes-on-back-navigation` :30, both projects: the click on the sheet's Inventory link times out.
- `billing-functional` :18 E-A1, both projects: "Issue invoice" stays disabled.
- `admin-functional` :56 E-B1, mobile-360: the Christmas Day grid cell is not found.
- `notifications-inbox` :16 and :28, mobile-360.
- `xct-operations` :76 E-D1, both projects.

Passing in this run (baseline, but not reproduced): `staff-shell-manual-expand-overflow` :37, `billing-a11y-responsive` :86, `billing-functional` :216 E-F1, `ordering-a11y-responsive` :133. They stay on the list until the owner removes them.

## Every other failure, and how it was settled

### Root cause for most of them: route disposal in `next dev` (Amended (au), fixed)

With Next's default on-demand entries (5 pages kept, 60 s idle), a long chunk keeps disposing compiled routes. Each disposal rebuilds the client bundle (`✓ Compiled in 0ms` in the dev log), and a page served across that rebuild can name a client chunk that then 404s. That page never hydrates: MSW never starts, buttons and selects do nothing, and router pushes never land. Reproduced directly: a dev server in that state returned 404 for `/_next/static/chunks/app/(auth)/staff/sign-in/page.js` on every load (`__mswReady` unset, no service worker). A fresh server served it. In pass A, every chunk whose dev log showed such rebuilds (c4: 2, c6: 6, c7: 5) had failures that pass alone. The chunks with none (c2, c3, c5, c8) had only baseline failures, apart from one c3 warm-up timeout.

The fix: `next.config.ts` sets `onDemandEntries` (6 h idle, 1000 pages) only when `E2E_KEEP_ROUTES=1`, and `playwright.config.ts`'s `webServer` sets that variable. `npm run dev` without it is unchanged, and production ignores the setting. Proof: the same 17 leftover tests at `--repeat-each=3` went from 22 failures in 14.4 min (r1, default) to 1 failure in 4.6 min (r2, with the flag), with no rebuilds in the dev log. In pass B no chunk logged a rebuild, c6 went from 30+ failures to 0, and the chunks ran 2 to 3 times faster.

Settled by (au) (fail in pass A, pass in pass B and in r2):

- c3: `reports-schedules` :21 E-D1, both projects. The `beforeAll` warm-up exceeded 30 s.
- c4: `staff-customers` :11 E-H1, :32 E-I1, :137 E13 (chromium). The form submit or select did nothing on a non-hydrated page. Reproduced 6/6 on r1's server; 6/6 pass in r2.
- c6: all 30. These were 30 s timeouts in `inventory-a11y-responsive` E-X1/E-X2, `inventory-flows` E-C1/E-C2/E-D1/E-F2/E-G1/E-X3, `procurement-flows` E-A1/E-B1, and `catalogue-stock-gate-s3` G3/G4. In pass A, cold route compiles took 10 to 18 s each, after each disposal.
- c7: `admin-a11y-responsive` :109 `/staff/admin/branches`, `admin-functional` :277 E-F1, :328 E-F2, :378 E-G1, :414 E-G3, `customers-admin-360` :16, `customers-admin-gate-s4` :50 G4/G5.

### Fixed by the first attempt's uncommitted work (reviewed and committed now)

- `staff-customers` :52 E5 (c4, first pass): Amended (ar), commit `bc1d088`. The test expected `?customerId=` to remain after `PosScreen` replaced it.
- `staff-shell-manual-expand-occludes-content` :72 (c4): Amended (at), commit `9bd7bc6`. The hit-test ran mid-way through the rail's 200 ms width transition.
- `xct-operations` :21 E-C1/E-C2 (c8): Amended (as), commit `00013b5`. The anonymised read-back lacked the BG-19 summary fields, so "Customer since" threw.
- `packed-customer-after-staff.spec.ts` (new, c3) committed as `8d2081d`. It passes on both projects.

### Settled as flaky, with evidence

- `home.spec.ts` :33 "signed in as staff lands on /staff" (chunk 1 leftover). 5 of 6 pass in r2 and 6 of 6 in r3 (`--repeat-each=3`, both projects). The one failure was the first run on a fresh server: `/` redirects client-side to `/staff`, whose first compile on a cold server exceeds the 5 s URL limit. The owner's 2026-10-29 choice of short chunks over longer timeouts stands, so no timeout was changed.
- `customers-admin-360` :23 "staff Outlet column" (c7 pass B, chromium). 6/6 pass in r1, 6/6 in r2 and 5/6 in r3. Both failures were 30 s timeouts on the first test against a cold server.
- `billing-a11y-responsive` :65 `/staff/billing/cash-up?date=…`, two separate causes, neither in the product:
  - c7 pass B, mobile-360: the run crossed midnight. The test title embeds today's date, so the worker reported "Test not found in the worker process".
  - r3, chromium, first test on a cold server: the 30 s MSW hold ran out, so sign-in fell through to port 5005 (404).
  - 5 of 6 pass in r3.

### Chunk 1 leftovers

- `shop-a11y-responsive` :86 `/staff/shop/products/{id}/food`: fixed by Amended (aq) (`7df064e`, certificate link contrast). 6/6 pass in r1 and r2.
- `accounts-auth` :137 E-D1 "follow a reset": 5 of 6 failed in r1 (sign-in after the reset stayed on `/sign-in`). In r2, with Amended (au), 6/6 pass. Settled by (au).
- `home.spec.ts` :33: flaky, above.

### E19 `sweep:a11y`

179 routes in the generated inventory (public 18, customer 19, staff 140, none 2), run on `next dev` with the mocks and `E2E_KEEP_ROUTES=1`. 178 passed with no serious or critical axe finding and no technical text in any alert. The 179th, `/staff/inventory/recalls`, timed out in `goto` at 120 s; rerun alone (`SWEEP_ONLY=/staff/inventory/recalls`), it and `/staff/inventory/recalls/[batchId]` both pass. There is no new violation against baseline `67691e9`, because there is none at all, so the baseline sweep was not rerun.

## Amended letters used at integration

| Letter | What | Commit |
|--------|------|--------|
| (aq) | Food & labelling "View certificate" link uses `text-accent-ink` (4.15:1 to about 6.3:1) | `7df064e` (recorded in the handover in `b917656`) |
| (ar) | `staff-customers` E5 follows the counter's one-time preset | `bc1d088` |
| (as) | Operations mock's anonymised customer carries the BG-19 summary fields | `00013b5` |
| (at) | `occludes-content` :72 waits for the rail's 200 ms width transition | `9bd7bc6` |
| (au) | `E2E_KEEP_ROUTES=1` keeps every compiled route in an e2e `next dev` | `4958e47` |

Each is recorded in `docs/handover/HO-P5-WIRING.md` §1 Amended as an integrator decision, under the owner's 2026-10-31 delegation.

## For the owner

1. **D2.** Backend wording of the `OrganicCertificateNotExpired` checklist item is the owner's to give.
2. **D3.** PO detail lacks `branchId` (backend): `GET purchase-orders/{id}` takes no branch, so receiving into another branch cannot pre-fill that branch's PO lines (Amended (ak)).
3. **F2 (LOW).** The products table's Status column scrolls at 1280 px, and the Product column is narrow at 360 px. Being fixed on `feat/p5-followup-layout`.
4. **F4.** The mock consignment seed is 14 days out, so the overview's consignment count shows 0.
5. **Baseline count.** The handover still says "12 baseline failures" in places (§1 row "Known e2e baseline", §16 E18, §18 A21); since Amended (ak) it is 11. Four of the 11 passed in this run (:37, billing-a11y :86, billing-functional :216, ordering-a11y :133); the owner may drop them.
6. **E12c real-API specs are unrun.** All real-API specs (`*-real-api`, `journey-real-api`, `real-api-verification`) skipped: no backend on this machine.
7. **G10.** "Receive into" shows raw branch ids if the admin branches read is refused (covered by the S3 gate test; wording or behaviour is the owner's call).
8. **Amended (au) changes how e2e should be run.** It supersedes the reasoning in (ae): with routes kept, `portal-dashboard` no longer needs its own chunk for E-A4 to pass. It is still run in its own chunk here, as (ae) says, until the owner relaxes that. Anyone starting their own e2e server must set `E2E_KEEP_ROUTES=1` as well.
9. **Test hygiene (LOW, not fixed).** These are pre-existing tests outside HO-P5's changes:
   - `staff-customers` E-H1's URL check `/\/staff\/customers\/[^/]+$/` also matches `/staff/customers/new`, so it proves nothing about the redirect; the next assertion does.
   - `admin-functional` E-F1 reads the slug without waiting for the publish response.
   - `billing-a11y-responsive` puts today's date in a test title, so a run across midnight reports "Test not found".
10. **Mock gap (LOW).** The accounts mock answers `GET /api/staff/customers/{id}/orders` with 404 for a just-registered walk-in. The profile still renders, but the browser logs a console error.
11. **Chunk 1 was not rerun as a whole** after Amended (au). Its leftovers were each settled alone, as listed above.

## Still red

Only the 7 baseline cases listed above (13 test instances across the two projects and widths), each failing in its recorded way. After (au), no non-baseline failure reproduces when rerun. Three tests failed once each, only as the first test on a cold server or across midnight (above).

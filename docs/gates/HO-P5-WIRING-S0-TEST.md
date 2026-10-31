GATE: TEST
HANDOVER: HO-P5-WIRING (slice S0)
COMMITS: base cda20c4, HEAD 0ae5cc9 (branch feat/p5-s0-contract)
DATE: 2026-10-31
STATUS: PASS for S0-introduced defects, with one caveat (Vitest never green in a single full pass here; load timeouts only, see below)

SHEET: docs/test-cases/TC-HO-P5-WIRING-S0.md (44 rows: 39 PASS, 1 FAIL, 4 BLOCKED, 0 NOT RUN). Written before any command ran.

RESULTS
- `tsc --noEmit`: exit 0 (also `--incremental false -p .`). ESLint `--max-warnings 0`: exit 0.
- Vitest, full suite, two runs: run 1: 3 failed, 1878 passed, 45 skipped (213 files, 1926 tests); run 2: 5 failed, 1876 passed, 45 skipped. The failures differ between runs (idle-lock, inventory/shared-pieces, back-office-stock/receiving-layout, then inventory/goods-receipt-form x4 and shared-pieces). Every failing file passes alone (33/33, 24/24). None is touched by the S0 diff. Classified environmental (load timeouts, a pointer-events race); same pattern HO-P4 recorded. Never green in one pass, so T3 is a FAIL on the sheet.
- S0's own tests: tracker-packed 4, status-vocabulary 8, order-status-badge-packed 3, account-sidebar 6, overview-dashboard/customers/signin 6+5+5, no-colour-literals and no-hex-literals: all pass. Old `overview.test.tsx` had 16 `it`; the three new files hold 16 (U3).
- `next build`: exit 0 (1m15s).
- Production bundle inspection (`.next`, all js/json/html/rsc/map): zero hits for `__purrcare_ordering_mock_db__`, the rider names (Rafiq Hasan, Jahid Alam, Kamal Mia), Mizanur Rahman, Shirin Akter, order id `...112`, the rider-note text, BOC-2026-0142, Bangladesh Organic Council, Sam Rahman, setupWorker, createWorker, the rider mobile. "Kalijira Rice" and "msw/browser" appear only in `.next/cache/webpack/*-production/0.pack` (build cache, not served). The two layout chunks that mention `NEXT_PUBLIC_USE_MOCKS` contain the guard call with `nodeEnv:"production"` inlined, not handlers. `public/mockServiceWorker.js` is tracked, present, holds no seeds: the known LOW stands.
- Playwright (mocks, `next dev` :3120, chromium + mobile-360, 2 workers, warm routes, dev server restarted once):
  - Chunk 1, E1 (ordering-customer-orders, portal-dashboard, ordering-staff): 60 passed, 0 failed.
  - Chunk 2 (shop-catalogue, shop-product, shop-home, shop-shell, ordering-customer): 61 passed, 4 skipped, 2 failed, 1 flaky.
  - Chunk 3 (ordering-pos, dashboard-home, account-area, portal-a11y-responsive, shop-staff): 71 passed, 1 failed.
  - Total 192 passed, 3 failed + 1 flaky (below), 4 skipped.

FAILURES AND CLASSIFICATION
- ordering-customer.spec.ts:166 "E-B4/E-C1 COD disabled above the ceiling" (chromium): 20 s element-not-found under 2-worker load. Reran alone, 1 worker, 0 retries, warm: passes on both projects. Environmental. Not on the baseline list.
- ordering-customer.spec.ts:66 "basket: remove offers an Undo ..." (mobile-360): 120 s test timeout on a click. Reran alone: passes (6.7 s). Environmental.
- ordering-customer.spec.ts:146 E-B3 (mobile-360): flaky (passed on the spec's own in-file retry). Passes alone. Environmental.
- shop-staff.spec.ts:137 E-C3 (mobile-360): element not found at 29.7 s under load. Reran alone on both projects: 2/2 pass. Environmental.
- No failure from the 12-item baseline list appeared (none of those specs were in scope). No unexplained failure, no real S0 defect.
- Vitest failures: see RESULTS; environmental.

SPECIFIC CHECKS
- U4 amounts: the existing test in `web/tests/unit/orders/status-vocabulary.test.ts` asserts no amounts (status of 6 of 11 old orders plus `toHaveLength(13)`), as CODE_REVIEW said. I compared the real seeds against cda20c4 at runtime with a temporary test (deleted, tree clean): all 11 pre-existing orders are equal as full objects (timestamps normalised, new rider fields dropped); status, subtotal, grand total, amount paid and each line's quantity, unit price and line total identical; order count 11 to 13. The 51 pre-existing products equal after dropping the five new fields. So the seeds did keep amounts; the test just does not prove it. I did not edit the test (not assigned to this gate).
- Packed headline on LiveOrderCard: unit test passes ("Order ORD-1 is packed"). Mutation check: deleting `HEADLINES.Packed` makes it fail; file restored.
- Seeded Packed order on a real screen: yes for staff. `/staff/orders` shows `ORD-2026-000112` with a "Packed" badge, and its panel reads "Order ORD-2026-000112 Packed" with the history ending "Packed". The panel offers no action buttons (the staff mock returns none for Packed: the S2 hand-off CODE_REVIEW named). No for the customer headline: the Packed order belongs to a customer who cannot sign in under mocks (`/portal/orders/<...112>` for Sam says "We can't find that order"), and the portal overview uses separate fixtures with no Packed order. So the LiveOrderCard Packed headline is only exercised by the unit render. Row X3 is BLOCKED.
- Do the added seeds move any existing spec: no. Every spec run (E1 plus 10 more files) passes or passed on isolated rerun.

BLOCKED
- X3 (customer-side Packed headline on a screen): needs a Packed order for Sam in the portal and ordering fixtures (S1's seeds).
- E18 full e2e and E19 `sweep:a11y`: the handover assigns both to the integration step (§16, §17.2), not S0; S0's per-slice e2e is E1. I did not start the full run (over 3 hours). **A full e2e is not required for S0.**
- Real-API specs (`*-real-api`, `journey-real-api`, `real-api-verification`): no backend.

WEAK TESTS
- `status-vocabulary.test.ts` U4 case "existing ids, statuses and amounts kept": title overstates it (no amounts; 6 of 11 ids). Also `toHaveLength(13)`, `riderNote ... toHaveLength(1)` and `compareAtCents ... toHaveLength(2)` will break when S1/S2 append seeds. Not changed by me; suggest snapshotting `grandTotalCents` and status for all 11 old ids and looking up by id.
- The badge, sidebar and headline tests are strong (icon comparison against unknown and Packing; headline fails when the entry is removed).

PRODUCTION DEFECTS
- None found in S0. Carried, not S0: staff mock gives a Packed order no actions (S2); `public/mockServiceWorker.js` served (LOW).

SCOPE CHECK
- Written by this gate: docs/test-cases/TC-HO-P5-WIRING-S0.md and this file. Temporary files (a seed-comparison test, two `*.oldtmp.ts` copies, a Playwright probe spec) were created and deleted; one temporary edit to `components/portal/dashboard/LiveOrderCard.tsx` was reverted with `git checkout`. `git status` shows only the sheet, this record and `.claude/worktrees/`. Nothing committed.
- Cleanup: the dev servers I started (PIDs 28660, 27448) were killed; no process listens on :3120; no Playwright or chrome-headless-shell processes remain.

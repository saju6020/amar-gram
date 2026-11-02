GATE: TEST
HANDOVER: HO-P5-WIRING (slice S2, sales: dashboard, orders workbench, riders, counter sale)
RUN: 1 (finished on 2026-11-02 after an interrupted session; rows already observed were kept, not rerun)
COMMITS: feat/p5-s2-sales at afff3ca (S2 commits 625a0da ... 962eaa0, merged with integration 697a636 / 2a2963c / b05175d)
DATE: 2026-11-01 to 2026-11-02
STATUS: FAIL

The slice's code passes every row it owns: typecheck, lint, Vitest, build, the served-output check, every U-row, E7, E8 and E9 on both projects first time, and X1 (`ordering-a11y-responsive`, 68 of 68 first time). The gate fails on two mutation rows, M1c and M8. Each one is a gap in the slice's own tests, not a product defect: a logic line can be removed and every one of the slice's tests still passes. The gate's own tests close both gaps (G2 and R3 in `web/tests/components/back-office-sales/test-gate-s2.test.tsx`). Each of those tests passes on clean code and fails when the line is removed. If the integrator adopts that file, and `web/tests/e2e/sales-gate-s2.spec.ts` with it, into the slice, M1c and M8 are covered and the sheet would read 136 PASS, 0 FAIL, 1 BLOCKED. That decision belongs to the integrator, not to this gate.

SHEET: docs/test-cases/TC-HO-P5-WIRING-S2.md. 137 rows: 134 PASS, 2 FAIL, 1 BLOCKED, 0 NOT RUN. E17 is outside the counts under Amended (l).

FAILS
- M1c: in `PosScreen.tsx`, I removed the preset's empty-ticket guard in the functional `setCustomer` (made it always true). With the guard gone, the lookup's answer overwrites a buyer the cashier typed before the lookup answered. All 49 tests in the slice's three POS files still passed, so no slice test protects that case. SECURITY probed it only in a scratch file. Gate test G2 ('keeps what the cashier typed when the held lookup then answers') fails with the guard removed and passes on clean code.
- M8: I dropped `branchId` from the `useSalesSeries` query key (Amended (aa)). The slice's `sales-chart` and `overview-dashboard` tests (25) still passed, because none of them switches the branch. Gate test R3 ('switching the active branch asks for the series again') fails with the mutation and passes on clean code.

BLOCKED
- R15: SECURITY run 4 LOW 3 is an accepted edge. A surviving `?customerId=X` history entry, reached by a remount, can still preset X. No test can tell that case from a genuine link. To unblock it, either the owner decides to close it (for example with a one-time token) or someone writes a real-router e2e that forces the race.
- A20 in the acceptance table (diff inside §13): this is the ARCHITECTURE gate's check and I did not rerun it.

RESULTS
- T1 `npm run typecheck` exit 0. T2 `npm run lint` exit 0.
- T3 `npm test -- --maxWorkers=2` exit 0: 218 files passed, 1 skipped; 2004 tests passed, 45 skipped, 0 failed (379 s). The gate file was run separately: 7 passed.
- T4 `next build` exit 0 after `rm -rf .next`.
- T5 served-output check over `.next` excluding `cache`: 0 files for all 26 mock-data terms. 'Our delivery rider' is a UI fallback string, not mock data.
- Playwright setup for every chunk: MSW, a fresh `next dev` on :3122, routes warmed, `--workers=1 --retries=0`, chromium and mobile-360. Only the first attempt counts, so a pass on an in-file retry would have been recorded as FAIL.
  - Chunk A, `dashboard-home` (E7a-d): all passed first time on both projects.
  - Chunks B1 and B2, `ordering-staff` (E8a-t): 22 + 18 = 40 passed. That is the whole file.
  - Chunk C, `ordering-pos` (E9a-i): 18 passed.
  - Chunk G, gate spec `sales-gate-s2` (G3-G5): 6 passed.
  - Chunk X1, `ordering-a11y-responsive` (2026-11-02): 68 passed, 0 failed, 0 flaky, in 24.7 min (chromium 12.0 min, mobile-360 12.5 min). Every test passed on its first attempt; the list output has no retry line.
    - Staff routes took 16.8-25.9 s each: /staff/orders 25.9 s (chromium) and 22.8 s (mobile-360); /staff/pos 22.6 / 25.0 s; POS receipt 20.1 / 22.6 s; pick list 20.0 / 21.8 s; /staff/returns 18.6 / 19.7 s.
    - Customer routes took 18.3-27.6 s.
    - Flows: baseline `:133` (checkout price change) passed in 29.2 / 30.6 s; `:147` in 29.1 / 30.4 s; `:168` (POS after a scan) in 31.3 / 32.2 s.
    - Dev log: 0 error or warn lines. Routes were recompiled during the chunk (Next drops a route after 60 s idle); the slowest recompile was /staff/sign-in at 4.8 s.
- R22 (Amended (ad), 360 px pill overflow): PASS. X1's /staff/orders and /staff/returns passed at mobile-360, and E8 passed at mobile-360.
- Mutations: 19 rows. 17 PASS. Two of those 17, M1a and M1e, are equivalent mutants, so no test could fail on them; M1a was redone as M1a2, which did fail tests. 2 FAIL (M1c, M8, above). M9 showed that the `GET …/orders` 400s are covered only by gate test G1 (U47i).

ACCEPTANCE COVERAGE (S2 part)
- A6, A7, A8, A9, A18, A19, A21: PASS on the listed rows.
  - A6 relies on gate test R3 for the branch switch.
  - A9 relies on gate test G2 for a buyer typed before the preset lookup answers.
  - A19 relies on gate test G1 for the list's 400s.
- A20: BLOCKED (ARCHITECTURE's check).

PRODUCTION DEFECTS
- None found in S2's code.
- One observation (G6): in `PosScreen.tsx`, `presetTaken` is redundant (M1e is an equivalent mutant), and the comment about a 'per-link counter' does not match the code, because `setPresetLink(1)` never counts up. Harmless.

WEAK TESTS NOTED
- M4: in Vitest, the tick's 'shows at once' overlay is protected only by the mid-write refetch case.
- R21: no test asserts that the 'Saving…' region has `role="status"`.
- Not mutation-run: R14, R19, the POS paging case and G3-G5.

NOT RUN
- E17 and E18 (integration), E19 `sweep:a11y`, the §19 ACCEPTANCE screenshots, and the real-API specs (no backend).

SCOPE AND CLEANUP
- Files written by this gate, all untracked and none committed:
  - docs/test-cases/TC-HO-P5-WIRING-S2.md
  - docs/gates/HO-P5-WIRING-S2-TEST.md
  - web/tests/components/back-office-sales/test-gate-s2.test.tsx
  - web/tests/e2e/sales-gate-s2.spec.ts
- I edited no product code and no existing spec.
- The dev server I started on :3122 and the keep-awake are stopped. Nothing listens on :3122, and no chrome-headless-shell process is left.

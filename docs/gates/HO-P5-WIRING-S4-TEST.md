GATE: TEST
HANDOVER: HO-P5-WIRING (slice S4, customers, money and admin; BG-19..BG-23)
RUN: 1
COMMITS: feat/p5-s4-customers-admin at 794188b (base 0a14dbc; S4 commits 3d6f14b ... 794188b)
DATE: 2026-11-02 to 2026-11-03
STATUS: PASS (integrator update, 2026-11-03, under Amended (al)). Run 1's verdict was FAIL; that record is commit 2976c4d.

INTEGRATOR UPDATE (2026-11-03, under the owner's 2026-10-31 delegation; not the gate's own words)
- Amended (al) adopts the gate's three files into S4 unchanged, so the slice's suite now holds G1, G2, G3, G8 and G9. M1b, M1c, M1d, M2b, M5b, M5c, M6b and R1, R2, R17 are covered, which by the gate's own reading makes the sheet 141 PASS, 0 FAIL, 1 BLOCKED (U47j, unreachable in the mock as seeded).
- Rechecked at the same product commit (794188b): tsc exit 0; ESLint on the three files exit 0; `vitest run` of the two gate Vitest files: 10 passed. The gate e2e spec passed in the run-1 E13 chunk on this commit and was not rerun.

The slice's code passes every row it owns:
- typecheck, lint, the full Vitest suite, the build and the served-output check;
- every U-row (U37-U46, U47a-i);
- E13, E14, E15 and E16 on both projects, first attempt, with only the named baseline exceptions;
- both X rows.

No product defect was found. The gate fails on seven mutation rows, and on the three regression rows that rest on them. Each is a gap in the slice's own tests: a logic line can be changed and every one of the slice's tests still passes.
- Two of the gaps were already known LOWs: CODE_REVIEW run 2 said only exception cancel was shown to refetch the roster cells, and run 3 said no test pins the per-source date-before-cap order.
- The gate's own tests close all seven gaps. Each passes on clean code and fails under its mutation.

This is the same shape as S2's run 1, which Amended (ag) resolved by adopting the gate files.

SHEET: docs/test-cases/TC-HO-P5-WIRING-S4.md. 142 rows: 131 PASS, 10 FAIL, 1 BLOCKED, 0 NOT RUN. E17 is outside the counts under Amended (l).

FAILS (all test gaps, none a product defect)
- M1b, M1c, M1d, and R1 (CODE_REVIEW run 1 HIGH). I removed `invalidateCells` from `useSetRosterPattern`, `useCancelScheduledRosterPattern` or `useCreateRosterException`, one at a time. Each time `roster-cells.test.tsx` still passed 15/15. Only exception cancel (M1e) and the whole helper (M1a) are caught by the slice. Gate test G1 marks a cached `roster-cells` week stale for each of the four hooks, and it fails under each mutation.
- M2b, and R2 (CODE_REVIEW run 1 MEDIUM, SECURITY LOW 1). I wrote the count reply under `['billing','cash-up',date]`, without `branchId`. The slice's 34 cash-up tests still passed, because the refetch that follows puts the same figures on screen. M2a (back to the all-branches predicate) is caught. Gate test G9 holds every read after the save, so only the reply itself can show ৳1,201.00. It fails under M2b.
- M5b, and R17 (CODE_REVIEW run 2 LOW). I moved the per-source sum cap before the date check. `back-office-admin/mock-refusals.test.ts` still passed 19/19. Gate test G2 adds a future day with two sources whose sum is over the cap, and expects `CashUpDateInFuture`. It fails under M5b.
- M5c. I swapped the browse mock's pageSize and sort 400s. `back-office-customers/mock-refusals.test.ts` :57 still passed: its title says "in the controller's order", but each request has only one bad input. Gate test G8 sends two bad inputs at once and reads the `{ error }` text. It fails under M5c.
- M6b. I made `active` always true, so a Merged customer gets Edit tags, Add a note and Send password reset. `overview-customers` and `staff-record` still passed. Gate test G3 (a Merged customer seen by an Administrator, with an Active control case) fails under M6b.

BLOCKED
- U47j: `NoResetChannel` has no case, and none can be written against the mock as seeded. The only customer with neither mobile nor email is Merged and is refused earlier with `AccountNotActive`, and the accounts mock has no seam for this. Unblock: add a seed or a seam, then one case.
- A20 in the acceptance table: this is the ARCHITECTURE gate's check, and I did not rerun it.

RESULTS
- T1 `npx tsc --noEmit -p .`: exit 0.
- T2 `npm run lint`: exit 0.
- T3 `npm test -- --maxWorkers=2`: exit 0.
  - 229 files passed, 1 skipped; 2150 tests passed, 45 skipped, 0 failed (514.8 s). No file failed, so no (i) rerun was needed.
  - S4's files: overview-customers 11/11, staff-record 8/8, customers mock-refusals 17/17, cash-up-sources 10/10, admin mock-refusals 19/19, money-and-admin 9/9, branch-form-type 3/3, roster-cells 15/15, documents-ops 15/15 (Amended (ai)), merge-review 6/6.
  - Guards: no-hex-literals 213/213, no-colour-literals 2/2, no-money-arithmetic 2/2.
- T4 `rm -rf .next && npx next build`: exit 0.
- T5 served-output check: 0 files in `.next` (excluding `cache`) for each of 21 S4 mock terms (seed names, the note text, staff-cash ids, mock seams, persist keys, MSW strings). Positive controls found S4's UI strings.
- U46 back-up `rg` for colour literals over `components app`: 0 matches.
- Mutations: 25 rows (M1a-f, M2a-b, M3, M4a-b, M5a-c, M6a-d, M7a-b, M8-M11).
  - 18 PASS and 7 FAIL (above).
  - M6d's first form was an equivalent mutant: in the mock, `Customers.View` and `Customers.AddNote` have the same roles. It was redone as M6d2 (AddNote roles gain Inventory), which the slice catches.
  - M8 shows the ADR-FE-080 money lint fires on `CashUpSources.tsx` (Amended (aj)).
  - Every mutation was restored with `git checkout -- <file>`, and the tree was checked after each.

E2E (MSW; fresh `next dev` on :3124 per chunk; routes warmed, every one 200; `--workers=1 --retries=0`; chromium and mobile-360; first attempt counts)
- E13, `staff-customers` plus gate spec G4/G5: 18 passed, 0 failed (1.1 min). All 10 S4 cases passed first time.
- E14, `billing-functional`: 30 passed, 2 failed (2.1 min).
  - The 2 failures are E-A1 :18 on both projects, a BASELINE exception. `Issue invoice` stayed disabled (spec :23). The recorded baseline says "fails on both projects", without the assertion. S4's diff touches only cash-up code in billing, nothing the invoice composer reads.
  - E-F1 :216 (baseline) passed on both projects.
  - E14 :231 and E-D1 passed.
- E15, `admin-functional` and `staff-admin`: 27 passed, 1 failed (3.1 min).
  - The failure is E-B1 :56 on mobile-360, a BASELINE exception as recorded. The 25 December 2028 gridcell is not found, which is consistent with the calendar being a list below 768 px; I did not measure it further. Chromium passed.
  - Both E15 cases and the staff Outlet/Status case passed on both projects.
- E16a, `billing-a11y-responsive`: 62 passed, 0 failed (15.7 min). The :86 BASELINE passed this time.
- E16b, `admin-a11y-responsive`: 234 passed, 0 failed (13.4 min). This includes the outlet cards, the new-branch Type select and the roster cells at 360-1440.
- E16c, `admin-filters` and `admin-branch-calendar`: 24 passed, 2 skipped (E-CAL8, real-API only), 0 failed (2.3 min).
- X1, `accounts-a11y-responsive`: 196 passed, 0 failed (11.5 min). It covers the S4 staff list and the customer profile.
- X2, `ordering-staff` :333 (customer page Orders panel): 2 passed, with no in-file retry used.
- Every chunk's dev log had 0 error or warn lines. There was no resource crash and no flaky or retried test. No failure needed an (i) rerun.

REGRESSION ROWS
- 19 rows, one for each finding fixed in CODE_REVIEW runs 1-3 and SECURITY LOW 1: 16 PASS and 3 FAIL (R1, R2, R17, above).
- R19 (run 3 LOW, fixed in 794188b with no test): measured in the browser by G4. Every control was at least 44 px on both projects. With the fix undone on Save tags, G4 failed with "Save tags is 40px tall, below 44px".
- R16 (pager 44 px): proved by the class assertion and M10. Its rendered size was not measured, because the mock list fits on one page.

ACCEPTANCE COVERAGE (S4 part)
- A14-A17: every U and E row PASS. The gaps above are closed only by gate tests G1, G2, G3, G8 and G9, and U37g (POS still uses `findCustomers`) is proved only by gate test G7.
- A18: PASS.
- A19: PASS, with U47j BLOCKED.
- A21: PASS.
- A20: BLOCKED (ARCHITECTURE's check).

PRODUCTION DEFECTS
- None found in S4's code.

WEAK TESTS NOTED
- The seven slice-suite gaps above.
- `back-office-customers/mock-refusals.test.ts:57`'s title claims an order that its assertions cannot see.
- No test asserts the "Updating the list…" status.

NOT RUN
- E17, E18 (integration), E19 `sweep:a11y`, the §19 ACCEPTANCE screenshots, the real-API specs (including `billing-real-api:260`, Amended (ai)) and the contract test. There is no backend.

GATE FILES (untracked, not committed; suggested for adoption as Amended (ag) did for S2)
- web/tests/components/back-office-admin/test-gate-s4.test.tsx: G1, G2, G3, G7, G8; 9 tests.
- web/tests/components/back-office-admin/test-gate-s4-cashup.test.tsx: G9; 1 test.
- web/tests/e2e/customers-admin-gate-s4.spec.ts: G4, G5; 4 tests per project.
- docs/test-cases/TC-HO-P5-WIRING-S4.md and this record.

SCOPE AND CLEANUP
- I edited no product code and no existing spec. All mutations were reverted; `git status` shows only the five gate files above.
- The :3124 dev server for each chunk was killed after that chunk. Nothing listens on :3124, no chrome-headless-shell is running, no node process from this worktree remains, and the keep-awake is stopped.
- `web/.next` holds the last dev build (gitignored). `web/test-results` was removed.

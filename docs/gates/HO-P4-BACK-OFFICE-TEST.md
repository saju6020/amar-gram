GATE: TEST
HANDOVER: HO-P4-BACK-OFFICE
COMMITS: 2f9006a (S0), c32a506 / 7cc5af5 (S2), de2a0de / 899ddad (S3), eaa9e52 / 9cc9f33 (S1), ed3028a / e65c852 (S4), bdcebe4 / 8baea3b (S5), 7cdfd78, a8bf606, 5d9ffbc, 4680214 (HEAD 68297a7); baseline 46929be
DATE: 2026-10-30
STATUS: FAIL

SHEET: docs/test-cases/TC-HO-P4-BACK-OFFICE.md (74 rows: 64 PASS, 8 FAIL, 2 BLOCKED, 0 NOT RUN). The sheet was written before any command ran.

RESULTS (HEAD 68297a7)
- typecheck (`tsc --noEmit -p .`): pass. lint (--max-warnings 0): pass. `npm run build`: pass. Colour-literal rg check: no hits.
- Vitest: 208 files, 1852 pass, 13 fail, 45 skip (contract). The 13 are load timeouts in 7 files; re-run alone those 7 files pass 92/92. U1 to U41 all have passing tests.
- U24: guards pass, and the new files are scanned. Planted a money multiplication and a "cvv" string in components/orders/StaffOrderDialogs.tsx and StaffOrderSidePanel.tsx in turn; both guards failed naming that file and line; both files restored (git status clean).
- E15: `sweep:a11y` staff audience: HEAD 139 passed, 0 serious/critical; baseline 46929be 138 passed, 0. No new violation.
- Playwright, whole suite except the real-API specs, run in 8 area chunks (fresh `next dev` each, 2 workers, failures re-run at 1 worker, and the non-obvious ones re-run on baseline). Approx 2,300 test executions.
- Passing on a fresh server: shop-staff (incl. E-C1, both projects), admin-a11y-responsive 234/234, inventory-a11y-responsive 460/460, inventory-flows 22/22 (E-X3 ok), billing-functional E-B2/E-D1, ordering-staff, ordering-pos, staff-auth, staff-customers (E-H1 too), dashboard-home, reports-viewer, reports-schedules, notifications-*, xct-offline*, and the HO-P3 set (194 tests, 189 pass, 4 skip, shop-portal E-D1 failed loaded and passed alone).

FINDINGS
- [HIGH] web/tests/e2e/accounts-a11y-responsive.spec.ts:122 "E-X1 (idle lock open)", both projects: the §1 Amended row (HO-P3 D-B) makes this HO-P4's to fix; it still fails. It failed in every run, including 1-worker runs on a fresh server. `getByRole('dialog').waitFor()` (line 150) times out at 45 s and the failure snapshot shows the staff sign-in form, not the idle-lock dialog. It fails identically at baseline 46929be. staff-auth.spec.ts's idle-lock cases (same `__forceStaffIdleExpired` and `__invalidateQueries` hooks) pass; they fill a field before forcing the idle state, this spec does not. Cause not isolated here (gate does not fix product code). Rows D1, D2.
- [MEDIUM] web/tests/e2e/staff-shell-toggle.spec.ts:29 (both widths, both projects): focus never reaches the "Expand menu"/"Collapse menu" button within 15 Tab presses (line 44). Same failure at baseline (line 28 there), so pre-existing, but E1 asks for the staff-shell specs to pass and the redesigned sidebar did not change it. Also pre-existing: staff-shell-manual-expand-overflow:37 and staff-shell-sheet-closes-on-back-navigation:30.
- [MEDIUM] Pre-existing failures that E10/E12/E13/E14/A18 expect to pass; each also fails on baseline (checked by me) or is on the brief's baseline list: procurement-flows:95 E-A3 (both projects, baseline fails), billing-a11y-responsive:86 dialog contrast (both, baseline fails), billing-functional:18 E-A1 (both, baseline fails) and :216 E-F1 (chromium, flaky), admin-functional:56 E-B1 (mobile-360, baseline fails), notifications-inbox:16/28 (mobile-360, baseline fails), ordering-a11y-responsive:133 (baseline fails), xct-operations:76 (both projects here; baseline failed the mobile one). Not HO-P4 regressions.
- [LOW] Load/timing: the dev server reaches 8-9 GB inside a chunk and tests then time out. Failing in a loaded pass but passing on a fresh server: shop-staff E-C1/E-C2/E-F1, account-area E-E2 and Back cases, accounts-auth E-B3/E-C2/E-C3, reports-schedules E-D1, notifications-log:66, notifications-unsubscribe E-D1, ordering-customer E-B1/E-B5, home:33, staff-shell-manual-expand-occludes-content:72, shop-portal E-D1, admin-a11y-responsive:145. One chunk was also hit by a host suspend (ERR_NETWORK_IO_SUSPENDED); re-run.
- [LOW] home.spec.ts:33 passed on a fresh server although the brief lists it as a baseline failure; listed as flaky, not re-baselined.
- [LOW] Vitest first pass is not green (13 load timeouts, pass alone), as in HO-P3.

D-B CARRY-OVERS
- shop-staff E-C1 (chromium and mobile-360): PASS. Baseline fails it, so HO-P4 delivered this one.
- accounts-a11y-responsive E-X1 idle lock: FAIL, not delivered (HIGH above).

BLOCKED
- Real-API specs (inventory-real-api E11, billing-real-api, reports-real-api, portal-real-api, xct-real-api, real-api-verification, journey-real-api): need a backend. Unblock: start the API, run `npm run test:e2e:real-api` and `test:e2e:journey`.
- R8: the ~18 rewritten test files were not re-audited by me beyond U35 (strong; asserts both buttons absent and a forged approve/reject returns 400 ApproverMustDiffer). Relied on CODE_REVIEW's comparison.

WEAK TESTS
- None found weak in the ones I read. No test was weakened or deleted by this gate.

PRODUCTION DEFECTS
- None new found. Not fixed by this gate: the idle-lock E-X1 case above (owed by HO-P4).

SCOPE CHECK
- files in allowed scope: n/a for this gate (read-only; no product or test file left changed). The U24 mutation edited components/orders/StaffOrderDialogs.tsx and StaffOrderSidePanel.tsx temporarily and restored them with `git checkout`; `git status` showed only the two gate files and .claude/worktrees/.
- files outside allowed scope: none. Written by this gate: docs/test-cases/TC-HO-P4-BACK-OFFICE.md, docs/gates/HO-P4-BACK-OFFICE-TEST.md.

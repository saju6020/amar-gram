# HO-P6 S2 — TEST gate

Branch feat/p6-s2-staff at 678a404. Sheet: docs/test-cases/TC-HO-P6-SUBSCRIPTIONS-S2.md (builder's 37 rows plus T1-T12 added by this gate: 0 FAIL, 0 BLOCKED, 0 NOT RUN except T7 "NOT RUN (real API)").

Verdict: PASS.

Cases were written as NOT RUN (T1-T12) before anything was executed, then updated one at a time.

Results (dev server PORT=3129, mocks on, API base http://localhost:5005, E2E_KEEP_ROUTES=1, `--workers=2 --max-failures=5`; no resource-crash symptoms: no 0xC0000142, no heap errors, no "Compiled in 0ms" storms, so no drop to 1 worker was needed for the main runs):
- tsc --noEmit exit 0; lint exit 0.
- Full Vitest `--maxWorkers=2`: 255 files passed (1 skipped), 2493 tests passed (62 skipped). No flaky file.
- S2 specs, chromium + mobile-360: subscriptions-staff, -360, -a11y: 76 passed; subscriptions-staff-real-api: 10 skipped (no E2E_REAL_API=1; recorded NOT RUN (real API), no backend started).
- Run-only set (staff-shell-* x6, staff-auth, staff-customers, admin-a11y-responsive), both projects: 284 passed, 2 failed.
  - The 2 failures were staff-customers.spec.ts:20 (`getByText('Incomplete')` not found) and :37 (URL stayed /staff/customers/duplicates), chromium only, while the run was loaded with a cold compile. Re-run alone, `--workers=1`, both projects: 10 passed. Recorded as a load flake; neither spec touches subscription routes or the Sales nav entry.
  - ARCHITECTURE's check: the new Sales "Subscriptions" link (with Amended (h)'s Repeat icon) moved no Tab or link count in staff-shell-*, staff-auth, staff-customers or admin-a11y-responsive. staff-shell-toggle :29 and staff-shell-sheet-closes-on-back-navigation :30, baseline failures in S2's own build, now pass.
- Colour-literal check (U40): 0 hits over components and app.

Acceptance coverage: A12 (U27-U29, E9), A13 (U30-U32, E9), A17/A18 (E10, E11, U40) each have passing cases.

Not run: the real-API spec (needs E2E_REAL_API=1 and a backend); the ARCHITECTURE note to confirm the server's blank-reason text on the real API stays open for the integrator's real-API run (E18). `npm run sweep:a11y` and the build are integration steps.

No product code or spec edited, no test added or weakened. No production bug found. Cleanup: dev server on 3129 stopped by Playwright (no listener left); `git status` shows only the sheet and this record; no tracked screenshots modified.

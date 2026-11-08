# HO-P6 S3 - TEST gate

Branch feat/p6-s3-backoffice at 5cfdaf4. Sheet: docs/test-cases/TC-HO-P6-SUBSCRIPTIONS-S3.md (builder's 41 rows plus T1-T12 added by this gate: 0 FAIL; T9 "NOT RUN (real API)"; T12 BLOCKED).

Verdict: PASS.

T1-T12 were written as NOT RUN before anything was executed, then updated one at a time.

Results (dev server PORT=3130, mocks on, API base http://localhost:5005, E2E_KEEP_ROUTES=1, `--workers=2 --max-failures=5`; no 0xC0000142, heap error or "Compiled in 0ms" storm, so no drop to 1 worker was needed):
- tsc --noEmit exit 0 (staff-shop.test.tsx:47 compiles with the optional `isSubscribable`); lint exit 0.
- Full Vitest `--maxWorkers=2`: 271 files (270 passed, 1 skipped), 2710 tests passed, 62 skipped, 0 failed. two-step-save (5), staff-shop (26) green.
- S3 specs subscriptions-backoffice and -360, chromium + mobile-360: 24 passed.
- E15 run-only set (shop-staff, catalogue-stock-*, staff-customers, customers-admin-*, dashboard-home, ordering-staff, sales-gate-s2, packed-customer-after-staff), both projects: 118 passed, 0 failed. Section 20.3: the new Subscriptions (n) tab moved no Tab count.
- S1/S2 regression (subscriptions-customer*, subscriptions-staff*): 136 passed, 14 skipped (real-API specs, no E2E_REAL_API).
- Source guards: 0 colour literals and 0 date/money arithmetic in S3 files (independent grep; U6 and no-literals green).

Not run: real-API specs (NOT RUN (real API), no backend started). T12, the real server's text for a non-boolean `isSubscribable` 400 (ARCHITECTURE LOW 2), stays BLOCKED for the integrator's real-API run.

No flakes, no product code or spec edited, no test added to the repo's suites or weakened. No production bug found. Cleanup: no listener on 3130 (only TIME_WAIT sockets), no Playwright or chrome-headless-shell process left; no tracked screenshots modified.

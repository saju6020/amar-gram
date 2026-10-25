GATE: TEST
HANDOVER: HO-P3-STORE-FRONT
COMMITS: e29a0ae (S0), c38bb9d / 860cd03 (S1), 5c5af0e / 2d0d351 (S2), 24ad5f7 / c7c660f (S3), b1b237c / bfb3c28 (S4), f7fe2af, 3c98022, 7cdfd78, 5bd5508, 4713d6a, 889d81f (HEAD); baseline 46929be
DATE: 2026-10-25
STATUS: PASS

RUN: 2 (run 1 was FAIL on 5bd5508; its findings were fixed in 4713d6a and 889d81f)

SHEET: docs/test-cases/TC-HO-P3-STORE-FRONT.md (75 rows: 73 PASS, 0 FAIL, 2 BLOCKED, 0 NOT RUN)

RESULTS (run 2, HEAD 889d81f)
- typecheck: pass. lint (--max-warnings 0): pass.
- Vitest (`npm test`): 200 files, 1850 tests: 1798 pass, 7 fail, 45 skipped. The 7 are 20 s timeouts in goods-receipt-form (4), shared-pieces (2) and reports/viewer (1), the known load-sensitive files; re-run alone those three files pass 43/43. The 45 skips are tests/contract (real API only). U1 to U38 all have passing tests.
- Section 17.1 splits: counted in run 1 (SP1 to SP8), unchanged.
- Playwright, HO-P3 spec set (shop-*, home, ordering-customer*, ordering-a11y-responsive, account*, portal*), chromium + mobile-360, one worker, 530 runs: 501 pass, 4 flaky (pass on retry), 17 fail, 8 skipped. The 17 re-run with --last-failed: 13 pass alone, 4 fail again. Final: 518 pass, 4 fail, 8 skipped (4 portal-real-api real-API gates; 4 phone-only / desktop-only halves in shop-home and shop-shell, by design).
- The 4 final failures are staff-area tests handed to HO-P4 by the owner and recorded as out of HO-P3 scope: accounts-a11y-responsive "E-X1 (idle lock open)" (both projects) and shop-staff E-C1 (both projects). Both also failed at baseline 46929be in run 1.
- Flaky by name (retry passed): ordering-customer E-B1/E-B8 (chromium, mobile-360); ordering-a11y-responsive /staff/orders (mobile-360); ordering-customer-orders E-D1 (mobile-360).
- Failed in the full run, passed alone (load): ordering-a11y ?placed=1 (both), portal-dashboard E-A4 (both), shop-portal E-D1 (both), account-area E-E1, accounts-auth E-B1 and E-C2, home a11y, home staff redirect, shop-catalogue E-E1 maintenance, shop-shell phone case (all mobile-360).
- Run 1 failures now green: E9 (stale banner assertion, BankTransferInstructions / OrderPanels dl structure, 106 overflow), E13 E-B1..B3, E14 re-order dialog axe, E4 E-A4.
- journey-real-api.spec.ts: not run (needs JOURNEY_REAL_API=1 and a live API). BLOCKED.
- The whole `npm run test:e2e` suite (E16) was not run; only the requested HO-P3 set. BLOCKED.

FINDINGS
- [MEDIUM] web/tests/e2e/shop-product.spec.ts:145-163,176-190,195-205 — three assertions are loosened beyond copy: the hero-image fetchpriority/loading/width/height/alt checks run only if a photo URL exists (the mock sends none, so they never run); the draft-slug case accepts HTTP 200 plus noindex instead of 404; the no-JS case asserts the HTML text instead of a visible h1. Baseline fails the strict forms of the last two in next dev. Owner decision: dev-server accommodations, kept as recorded MEDIUM. The claim that a production build answers 404 is untested (no production build run).
- [LOW] web/tests/components/checkout/checkout.test.tsx (U30) — the network-failure retry reusing the Idempotency-Key is proved at hook level (tests/unit/lib/idempotency-renewal.test.ts) and through a 409 RequestInProgress retry, not as a network error through CheckoutScreen.
- [LOW] web/tests/e2e — under one worker and a dev server, 13 tests fail the first attempt with 30 s timeouts and pass alone (list above). They are load flakes, not skips; E16 asks for them to be reported by name.
- [LOW] Out of HO-P3 scope, owner decision (HO-P4): web/tests/e2e/accounts-a11y-responsive.spec.ts:122 staff idle-lock dialog axe, and web/tests/e2e/shop-staff.spec.ts:15 E-C1. Not counted as HO-P3 failures.
- [LOW] Process — in run 1 typecheck, lint and Vitest ran before the sheet was saved (disclosed on the sheet). In run 2 the sheet existed first; its rows were updated after the runs.

SCOPE CHECK
- files in allowed scope: n/a for this gate (read-only; no product or test file changed in run 2).
- files outside allowed scope: none. Written by this gate: docs/test-cases/TC-HO-P3-STORE-FRONT.md, docs/gates/HO-P3-STORE-FRONT-TEST.md.

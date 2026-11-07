# HO-P6 S0 — TEST gate

Branch feat/p6-s0-contract at 46f9a58. Sheet: docs/test-cases/TC-HO-P6-SUBSCRIPTIONS-S0.md (29 rows: 26 PASS, 3 FAIL, 0 BLOCKED, 0 NOT RUN).

Verdict: FAIL (three run-only specs broken by S0's seed; everything S0 owns passes).

Green:
- tsc --noEmit exit 0; lint exit 0.
- Full Vitest `--maxWorkers=2`: 248 files passed (1 skipped), 2398 tests passed (62 skipped). No flaky file.
- U3 under TZ=America/New_York and TZ=Asia/Dhaka: subscriptions suite + status-vocabulary, 8 files / 127 tests each, passed. U4, U5 (11 original orders keep ids and totals), U6, U7, U1, U2 pass.
- E1 run-only specs (ordering-customer-orders, ordering-staff, staff-customers, portal-dashboard, shop-product), chromium + mobile-360: 98 passed. New Subscription-channel orders did not break the queue or status pills.
- accounts-a11y-responsive: 196 passed.

Failures (the Amended (b) seed of Sam's "Home" + "Office" addresses in mocks/handlers/areas/accounts.ts; baseline c176fd8 not re-run, attribution from the errors and the diff `addresses: []` -> seeded):
1. tests/e2e/account-area.spec.ts:47 `getByText('Home')` toHaveCount(0) received 1 (both projects).
2. tests/e2e/ordering-customer.spec.ts:96 `getByLabel('Home')` strict-mode violation, 2 radios (seeded "Home (default)" and the spec's own Home) (both projects).
3. tests/e2e/ordering-customer.spec.ts:156 "We don't deliver to Gazipur yet" not found; the seeded in-zone default is chosen instead of the added Gazipur address (both projects).
These specs are run-only (§14, §16 E8); not edited or weakened. Fix options for the integrator: do not seed addresses into the signed-in account (let the subscriptions seed live elsewhere), or amend the specs under a recorded decision.

Also noted: dates test relies on the runner's TZ env (not self-proving); store-key values and the mock `day()` reuse have no direct unit assertion. No tests were edited. No production bug beyond the above.

Cleanup: own next dev (port 3126) killed; no chrome-headless-shell left; no tracked screenshots modified.

# TC-HO-P6-SUBSCRIPTIONS-S0 — Subscriptions frontend: shared contract, mocks, seeds

Handover: docs/handover/HO-P6-SUBSCRIPTIONS.md (S0 rows U1–U7, §16 E1, §18 A1/A2, Amended (a)–(d))
Commit(s) under test: 46f9a58 (branch feat/p6-s0-contract)
Written: 2026-11-07 (sheet written, all rows NOT RUN, before any test was executed)  ·  Executed: 2026-11-07

> Statuses record what was observed. IDs U1–U7 are the handover's; X*, E1*, R* were assigned by the TEST gate
> (the handover's S0 rows are numbered, but E1 is one row for five specs, split here per spec).

## Summary

| | Count |
|---|---|
| Total | 29 |
| PASS | 26 |
| FAIL | 3 (X5a, X5b, X5c: run-only specs broken by S0's seeded addresses) |
| BLOCKED | 0 |
| NOT RUN | 0 |


## Environment

Worktree D:/my-repo/amar-gram/.claude/worktrees/p6-s0 at 46f9a58. `tsc --noEmit` exit 0; `npm run lint` exit 0 (max-warnings 0).
Vitest 5.0.1 at `--maxWorkers=2`. Playwright against `next dev -p 3126`, `NEXT_PUBLIC_USE_MOCKS=true`,
`NEXT_PUBLIC_API_BASE_URL=http://localhost:5005`, `E2E_KEEP_ROUTES=1`, `--workers=2`. Projects chromium and mobile-360.
No real API, database or broker was needed or used (mocks only). Playwright report and the dev server were killed afterwards.
No tracked screenshot was overwritten (`git status` clean apart from this sheet).

## Unit cases

| ID | Case | Expected | Status | Evidence |
|---|---|---|---|---|
| U1 | api-clients.test.ts: method/path/query/body per C1–C12, T1–T9, csv path with no paging, role constants | pass | PASS | Part of 8 files / 127 tests passing under each of two TZ runs and the full run |
| U2 | labels.test.ts: every enum labelled, six customer reasons, server texts, "Unknown" | pass | PASS | same |
| U3a | dates.test.ts under TZ=America/New_York | pass | PASS | `TZ=America/New_York npx vitest run tests/unit/subscriptions tests/unit/orders/status-vocabulary.test.ts --maxWorkers=2`: 8 files, 127 tests passed |
| U3b | dates.test.ts under TZ=Asia/Dhaka | pass | PASS | same command with Asia/Dhaka: 8 files, 127 passed |
| U3c | dates.test.ts under default TZ | pass | PASS | within full run, 119 subscription tests listed ✓ |
| U4 | schedule-parity.test.ts | pass | PASS | in the runs above |
| U5 | seeds.test.ts (inventory, T3 count, >=3 subscribable, Generated cycles have Subscription orders, 11 originals keep ids/totals) | pass | PASS | in the runs above |
| U5b | tests/unit/orders/status-vocabulary.test.ts | pass | PASS | included in the 8 files of the TZ runs and in the full run |
| U6 | source-guard.test.ts incl. planted violations | pass | PASS | in the runs above; tests/guards/no-card-ui.test.ts also in the full run |
| U7 | errors.test.ts | pass | PASS | in the runs above |
| X1 | Full Vitest `--maxWorkers=2` | green | PASS | 248 files passed, 1 skipped; 2398 tests passed, 62 skipped; 537 s. No flaky inventory file appeared |
| X2 | `npx tsc --noEmit` | clean | PASS | exit 0 |
| X3 | `npm run lint` | clean | PASS | exit 0 |
| X4 | Assertion-strength audit of dates, seeds, source-guard (read in full); others skimmed | no decoration | PASS | See gate record. No test edited; two limitations noted there, no weakness requiring change |

## Integration cases (Playwright, chromium + mobile-360)

| ID | Case | Expected | Status | Evidence |
|---|---|---|---|---|
| E1a | ordering-customer-orders | pass | PASS | one run of the five E1 specs on both projects: 98 passed, 0 failed |
| E1b | ordering-staff (queue, status pills, with new Subscription-channel orders) | pass | PASS | same run |
| E1c | staff-customers | pass | PASS | same run |
| E1d | portal-dashboard | pass | PASS | same run |
| E1e | shop-product | pass | PASS | same run |
| X5-ok | accounts-a11y-responsive (address book axe/responsive) | pass | PASS | 196 passed in the x5 run |
| X5a | account-area.spec.ts:9 "E-E1: add three addresses, change default, remove one" (both projects) | pass | FAIL | `account-area.spec.ts:47` `expect(page.getByText('Home')).toHaveCount(0)` Received 1 (earlier log: "locator resolved to 5 elements"). Sam now starts with a seeded Home; the spec's own Home is removed and the seeded one remains. Failed on both projects, in two runs, with retries |
| X5b | ordering-customer.spec.ts:89 "E-B1/E-B8: COD delivery order is placed once" (both projects) | pass | FAIL | `ordering-customer.spec.ts:96` `getByLabel('Home')` strict-mode violation: resolved to 2 radios, "Home (default) House 7, Road…" (seeded) and "Home House 7, Road 3,…" |
| X5c | ordering-customer.spec.ts:146 "E-B3: an address outside every zone offers collection" (both projects) | pass | FAIL | `ordering-customer.spec.ts:156` "We don't deliver to Gazipur yet…" not found: with a seeded in-zone default address, checkout selects that instead of the added Gazipur one |

Attribution of X5a-c to S0: observed errors point at the two seeded Sam addresses (`mocks/handlers/areas/accounts.ts`, `addresses: seedSamAddresses()` replacing `[]`, Amended (b)). The base commit c176fd8 was not re-run, so "passed before" is inferred from `addresses: []` in the diff, not watched.

## Regression cases from earlier gates

| ID | Gate | Finding | Case | Status | Evidence |
|---|---|---|---|---|---|
| R1 | ARCHITECTURE | Amended (b): one address book via findCustomerAddress | seeds.test.ts "addresses come from the accounts address book" | PASS | in runs above |
| R2 | CODE_REVIEW | Amended (d)(1): seeded ids are real GUIDs | seeds.test.ts "every id is a GUID" | PASS | in runs above |
| R3 | CODE_REVIEW | Amended (d)(2): branches from getBranchSnapshot | seeds.test.ts "pickup branches come from the administration mock" | PASS | in runs above |
| R4 | CODE_REVIEW | Amended (d)(4): a non-existent day is rejected | dates.test.ts ("2026-02-31", "2026-04-31" left as text; 2028-02-29 accepted) | PASS | covers `formatCycleDate`/`dateParts`. The mock store's `day()` reuse of `formatCycleDate` has no direct test (see gaps) |
| R5 | ARCHITECTURE | store-key bumps | grep: shop `…shop_mock_db__v3`, ordering `…ordering_mock_db__v4`, subscriptions `…subscriptions_mock_db__v2`, accounts `…accounts_mock_db_p7__` | PASS | grep output seen; no test asserts the keys (gap) |
| R6 | ARCHITECTURE | no PurrCare/cat/vet/clinic leftovers | grep -i over S0 subscription files | PASS | zero matches |

## Acceptance-criteria coverage

| Criterion | Covered by | Status |
|---|---|---|
| A1 contract mirrors server; mock applies schedule rules | U1–U5, U7 | PASS |
| A2 no date/money arithmetic, no card UI, guard can fail | U3, U6, no-card-ui | PASS |
| E1 "seeds change nothing visible" | E1a–E1e pass; but X5a–c show the address seed IS visible to run-only specs | PASS for the five named specs; FAIL for X5 |

## Cases I could not run

None.

## Gaps left deliberately

| Gap | Why not covered | Suggested owner |
|---|---|---|
| TZ independence of `formatCycleDate` is not proven by the test itself (it relies on the TZ env being applied by the runner) | TZ cannot be changed inside a test file reliably; the two env runs are the handover's method | S0 implementer |
| Mock store `day()` reuse and store-key values have no unit assertion | needs product-adjacent test additions beyond a gate | S0 implementer |
| X5a-c baseline not re-run at c176fd8 | machine budget | integrator if disputed |

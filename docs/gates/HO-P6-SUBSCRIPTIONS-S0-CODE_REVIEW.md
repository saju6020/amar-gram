GATE: CODE_REVIEW
HANDOVER: HO-P6-SUBSCRIPTIONS (slice S0, shared contract, labels and mock store)
COMMITS: 86db19d..bdb9759 (branch feat/p6-s0-contract; includes the ARCHITECTURE fixes 6864a40 b3e47fd 43ed835 bdb9759)
DATE: 2026-11-07
STATUS: FAIL

FINDINGS
- [HIGH] web/mocks/handlers/subscriptions/fixtures.ts:23 (`id` helper) — every id built with a two-character prefix is not a GUID: `id('5b', 1)` is `5b0000000-0000-0000-0000-000000000001` (first group 9 chars, not 8). Affects all subscription ids (`5b`), the seeded address ids (`5a`, also copied by hand into areas/accounts.ts:222,233 and the `seedOnlyAddressBooks` rows) and the subscription-channel order ids (`f5`, `orderId` at :326). `lib/validation/guid.ts` `isGuid` (used to 404 a non-GUID route id before any request) rejects all of them, so S1/S2 detail pages and order links for seeded rows would 404 under mocks, and the real server's `Guid` binding would refuse the same shapes. Verified with the regex in guid.ts. No test checks it. Fix: pad the prefix to 8 chars (`${prefix.padEnd(8, '0')}-0000-0000-0000-${...}`) and replace the literal ids in accounts.ts with the shared builder or correct literals; add a seeds test asserting `isGuid` for every subscription, cycle, address and order id.
- [MEDIUM] web/tests/components/catalogue/catalogue-p5.test.tsx:203-218 — "ignores a stale v2 copy" plants the stale copy under `__purrcare_shop_mock_db__v2`, a key the store (now `__amargram_shop_mock_db__v3`) never reads under any version, so the test passes whether or not the bump works; it can only fail on the final write assertion. It also adds a new `purrcare` literal (owner rule: no cat/PurrCare leftovers). Fix: plant the stale payload under a key the store actually reads in a prior version, or drop the "ignores stale" claim and keep only the v3-write pin; remove the purrcare string.
- [LOW] web/tests/components/back-office-sales/mock-refusals.test.ts:205 and test-gate-s2.test.tsx:44-46 — the two changed assertions went from `total: 0` to `> 0`. The change is justified (the seeds now add Subscription orders) but `> 0` no longer proves the filter is case-insensitive against a known set; a filter that returns every order would pass. test-gate-s2 partly recovers this with the `every(channel === 'Subscription')` check; mock-refusals does not. Fix: assert equality with the seeded count (`subscriptionOrderSeeds().length`) in both.
- [LOW] web/tests/unit/subscriptions/schedule-parity.test.ts:60-67 — the clock is only exercised at 11:00 Dhaka, where the UTC and Dhaka dates agree. The edge that the port exists for (UTC 18:00-23:59 is already tomorrow in Dhaka; the cut-off flips at local midnight) is untested, so a `today` taken from UTC would still pass. Fix: add `createClock(new Date('2026-10-16T19:00:00Z'))` expecting today `2026-10-17`, and a pair of instants either side of `2026-10-17T18:00:00Z` for `isLocked('2026-10-19')`.
- [LOW] web/mocks/handlers/subscriptions/store.ts:126 — `BRANCH_DIRECTORY` hardcodes the two branch names, so a branch renamed or deactivated in the Administration mock still shows the old name in `pickupBranch`; the server reads the Branches table (SubscriptionViews.cs:109-114). The address book was moved to a single source in Amended (b); branches have the same drift. Fix: read the branch from the administration branches store (as `findCustomerAddress` does for addresses) or record the deferral in the handover.
- [LOW] web/mocks/handlers/subscriptions/store.ts:215 vs ordering/store.ts:17 — subscriptions reseed daily (`seededOn`) but the ordering store does not, so after midnight a persisted tab has fresh cycle dates against orders placed relative to yesterday (`placedDaysAgo` off by one). Cosmetic in mocks only. Fix: stamp the ordering seed with the day too, or accept and note it.
- [LOW] web/lib/subscriptions/dates.ts:21 — `dateParts` accepts day 31 for any month; `2026-02-31` rolls over to 3 Mar through `Date.UTC` and displays a wrong date instead of falling back to the text. Fix: round-trip check (`getUTCDate() === day`) before returning parts.
- [LOW] web/mocks/handlers/subscriptions/schedule.ts:92-117 — `parts`/`day` duplicate `formatCycleDate` in lib/subscriptions/dates.ts (same `ddd d MMM` layout). Intentional separation (mock may do date arithmetic) but two copies of the server's date sentence can drift; consider having `day` call `formatCycleDate`.

NOTES (no action)
- Mock schedule port checked line by line against SubscriptionSchedule.cs, SubscriptionClock.cs and SubscriptionTerms.Create: IsLocked, FollowingCycleOn, SkippableCycleOn, NoticeDateFor, AllowedActions order, ChangeTerms (paused, unlocked interval recompute with last-cycle and earliest-date clamp, locked pending), Skip, Pause, Resume, Cancel, WithdrawPending, ProcessCycle, ValidFirstDate, Describe and every violation code, sentence and property name match. Cut-off instant (local midnight of cycleOn - cutoffDays via zonedTimeToUtcIso) is correct for Asia/Dhaka (no DST). SubscriptionRules constants match.
- Views match SubscriptionViews.ViewOf (pending.appliesFromCycleOn, changeCutoffOn only when Active, followingDeliveryOn only when Active, address missing/lookup keyed by customer+address), UnpaidCycleRule (window then reinstatement filter), the T2 worklist rule and ordering, and SubscriptionEstimate (integer minor units, half-up, strings on the wire; percent by string handling).
- Seeds: every Active seed's `nextDayOffset` is consistent with its last Generated cycle and interval; LOCKED_OFFSET=2 is locked and 3 is not; no order seq collision with 101-113.
- Accounts: Sam's two seeded addresses are read through `findCustomerAddress` (deleted address gives `deliveryAddressMissing`); adding them did not break any test that assumes an empty book (grep).
- ARCHITECTURE fixes verified present: single `SUBSCRIBABLE_PRODUCT_NUMBERS` list, subscriptions mock reads the accounts address book, `formatCommerceInstant` via `formatInZone`, `__amargram_` store keys bumped (accounts p6, ordering v3, shop v3).
- `isSubscribable` on the staff shop mock/type is deferred to S3 per handover P1/11.4.1; not a finding.
- Error mapper: handles the `{ error }` 400 (no `errors` array) without throwing; 409 always maps to the stale sentence.
- `npx vitest run tests/unit/subscriptions --maxWorkers=2`: 7 files, 116 tests pass. Full suite and Playwright not run (per instructions).
- Other mocks still carry `__purrcare_*` storage keys (admin, billing, inventory, notifications); outside this diff.

SCOPE CHECK
- files in allowed scope: 32/32 (web mocks, lib, tests, docs; no backend or src/ file touched)
- files outside allowed scope: none

---

## Run 2

GATE: CODE_REVIEW
HANDOVER: HO-P6-SUBSCRIPTIONS (slice S0)
COMMITS: 86db19d..ca1fb2c (fixes in ca1fb2c)
DATE: 2026-11-07
STATUS: PASS

RUN 1 FINDINGS, VERIFIED
- HIGH non-GUID ids: FIXED. `id()` pads the prefix to 8 chars; the `5a` literals in areas/accounts.ts (Sam's two plus four seed-only rows) are 8-char; no `5a0000000`/`5b0000000`/`f50000000` remains (grep). New seeds test runs `isGuid` over subscriptions, cycles, addresses, skus and subscription order ids (>40 values) and fails on the old shape. Store keys bumped (subscriptions v2, ordering v4, accounts p7); no stale key literal left.
- MEDIUM vacuous stale-key test: FIXED by dropping the stale claim; the test now pins the v3 write only and the purrcare literal is gone.
- LOW `> 0` assertions: FIXED, both now `toBe(subscriptionOrderSeeds().length)`.
- LOW clock edge: FIXED, tests at 19:00Z/17:59Z for today and 17:59:59Z/18:00:00Z for the cut-off; a UTC-based `today` would fail them.
- LOW branch directory: FIXED, `getBranchSnapshot` (exists, exported, returns a Branch with `name`) replaces `BRANCH_DIRECTORY`; no remaining references.
- LOW ordering reseed: accepted and recorded (Amended (d)(3) and a comment in ordering/store.ts).
- LOW dateParts: FIXED with a round-trip check; tests cover 02-31, 04-31 and leap day 2028-02-29 (a Tuesday).
- LOW duplicate date formatter: FIXED, `day()` delegates to `formatCycleDate`. Both produced `ddd d MMM`; the parity tests still pass.

NEW FINDINGS
- [LOW] web/tests/unit/subscriptions/seeds.test.ts:237-249 — the GUID test reads `ids.addresses` from subscriptions/fixtures.ts, not the literals typed by hand in areas/accounts.ts, so those could drift or turn non-GUID again unnoticed (the existing address-resolution test would still catch a mismatch with the subscriptions ids, but not a malformed pair). Fix: also assert `isGuid` on the addressId of the `findCustomerAddress` results already resolved in the next describe.
- [LOW] web/mocks/handlers/subscriptions/store.ts:320 — no test pins that a pickup subscription's `pickupBranch` name now comes from the Administration mock (and an unknown branch id gives undefined). Fix: one assertion on a seeded pickup subscription's view.

No new defect found in the id builder, key bumps, branch lookup, dateParts (year < 100 cannot reach it; the regex is 4-digit) or the formatCycleDate reuse. Second look at the full 86db19d..ca1fb2c diff found nothing run 1 missed.

CHECKS
- `npx vitest run tests/unit/subscriptions tests/components/back-office-sales/mock-refusals.test.ts tests/components/back-office-sales/test-gate-s2.test.tsx tests/components/catalogue/catalogue-p5.test.tsx --maxWorkers=2`: 10 files, 180 tests pass. No Playwright, no full suite.

SCOPE CHECK
- files in allowed scope: 13/13 changed in ca1fb2c (web mocks, lib, tests, handover Amended row; areas/accounts.ts ids and key only, authorised by Amended (b)/(c)/(d))
- files outside allowed scope: none

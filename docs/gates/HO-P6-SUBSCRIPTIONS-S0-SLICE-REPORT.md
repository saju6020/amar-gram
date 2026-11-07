# HO-P6 S0 (subscriptions: shared contract, labels and mock store) - slice report (§17.3)

Branch `feat/p6-s0-contract` from `86db19d`. Worktree `D:\my-repo\amar-gram\.claude\worktrees\p6-s0`. Not pushed. Build commits `21b0ad1`, `3cbdeb3`, `6c63e0f`, `13111cc`; gate-fix commits `6864a40`, `b3e47fd`, `43ed835`, `bdb9759`, `ca1fb2c`, `46f9a58`, `0c5fb48`, `c49d8df`. Handover Amended rows (a) to (f) record every integrator decision.

## 1. Files touched (paths under `web/` unless they start with `docs/`)

S0's §13 block:
- ADRs: `docs/decisions.md` (this is `web/docs/decisions.md`; ADR-FE-109 to 114 and 193 to 197).
- Contract: `lib/api/subscriptions.ts`, `lib/api/staff-subscriptions.ts`, `lib/subscriptions/{copy,dates,errors,keys,labels}.ts`.
- Mocks: `mocks/handlers/areas/subscriptions.ts` (aggregator), `mocks/handlers/subscriptions/{store,schedule,fixtures,control,customer,staff,touchpoints}.ts` (customer, staff, touchpoints are empty stubs).
- Edits to existing mocks: `mocks/handlers/shop/fixtures.ts` (`isSubscribable`, the single `SUBSCRIBABLE_PRODUCT_NUMBERS` list), `mocks/handlers/ordering/store.ts` (channel widened, Subscription-channel order seeds, key bump).
- Tests: `tests/unit/subscriptions/{api-clients,dates,errors,labels,schedule-parity,seeds,source-guard}.test.ts`; `hardening.test.ts` was added by the TEST gate (run 2).

Outside the §13 block, each by an Amended row:
- `mocks/handlers/areas/accounts.ts`: Amended (b), (c), (d). One read-only export `findCustomerAddress`, Sam's seeded Home (default) and Office, a seed-only table for four other seeded subscribers, GUID-correct ids, key `__amargram_accounts_mock_db_p7__`.
- `mocks/handlers/shop/store.ts`: Amended (b), key `__amargram_shop_mock_db__v3`.
- `tests/components/back-office-sales/mock-refusals.test.ts`, `tests/components/back-office-sales/test-gate-s2.test.tsx`, `tests/components/catalogue/catalogue-p5.test.tsx`: Amended (f).
- `tests/e2e/account-area.spec.ts`, `tests/e2e/ordering-customer.spec.ts`, `tests/e2e/ordering-helpers.ts`: Amended (e).
- `docs/handover/HO-P6-SUBSCRIPTIONS.md`: §1 Amended rows (b) to (f) only.

No `src/`, config, dependency or lockfile change. No hook, component, route, navigation entry or MSW handler was built (the three handler files are empty stubs).

## 2. Superseded assertions (old to new), every changed existing test

| File | Old | New |
|---|---|---|
| `tests/components/back-office-sales/mock-refusals.test.ts:205` | `getStaffOrderStatusCounts({ channel: 'subscription' })` resolves `{ total: 0 }` | `total` equals `subscriptionOrderSeeds().length` (the Subscription-channel seeds make 0 false; equality still proves the lower-case name matches exactly that set) |
| `tests/components/back-office-sales/test-gate-s2.test.tsx:44-48` | `listStaffOrders({ channel: 'subscription' })` resolves `{ totalCount: 0 }` | `totalCount` equals `subscriptionOrderSeeds().length`, and every item has channel `Subscription` |
| `tests/components/catalogue/catalogue-p5.test.tsx:203-213` | "pinned at v2": a stale v1 copy is ignored and the store writes `__purrcare_shop_mock_db__v2` | "pinned at v3": a stale copy planted under `__amargram_shop_mock_db__v2` is ignored (products still seeded, districts present) and the store writes `__amargram_shop_mock_db__v3` |
| `tests/e2e/account-area.spec.ts` E-E1 | adds "Home", "Office", "Parents"; removes Home; `getByText('Home')` count 0 | adds "E2E Home", "E2E Office", "E2E Parents"; removes E2E Home; `getByText('E2E Home')` count 0; and the seeded "Home" and "Office" each still count 1 (exact) |
| `tests/e2e/ordering-customer.spec.ts` E-B1/E-B8 | `getByLabel('Home')` is checked | the seeded default `getByLabel(/^Home/)` is checked, then the spec's own `/^E2E Home/` is clicked and checked |
| `tests/e2e/ordering-customer.spec.ts` E-B3 | adds the Gazipur address, opens checkout, expects the refusal | the same, after clicking `/^Gazipur home/` (the seeded in-zone default is otherwise preselected); the "We don't deliver to Gazipur yet" refusal and pickup completion are still asserted |
| `tests/e2e/ordering-helpers.ts` `addAddress` | default label "Home" | default label "E2E Home" |

The handover's §16 E1 row ("The seeds change nothing visible until S1-S3 build the screens") is restored word for word; it is read together with Amended (e).

## 3. OQ defaults built to

OQ-1 to OQ-19 take their recommended defaults (Amended (a)); S0 builds only those that touch the contract and mocks:
- OQ-17: the subscriber discount is seeded at "10.00" (`discountPercent`) and exposed by the mock control.
- Cut-off and notice: `changeCutoffDays` 2 and the notice rule from `SubscriptionTerms`, ported as is (`schedule.ts`).
- The staff unpaid window and the due-tomorrow rule follow the server's query handlers (no default taken).
- OQ-20 (USER_STORIES.md wording) goes to the owner and is not edited.

The other OQ defaults belong to S1 to S3 (screens) and are not built here.

## 4. Mock refusals and rules added, with the server file:line mirrored

`mocks/handlers/subscriptions/schedule.ts` is a line-for-line port, with the server's sentences, of `Domain/DomainServices/SubscriptionSchedule.cs` (IsLocked, FollowingCycleOn, SkippableCycleOn, NoticeDateFor, AllowedActions at :26-34, ChangeTerms, Skip, Pause, Resume, Cancel, WithdrawPending, ProcessCycle, ValidFirstDate, Describe), `SubscriptionClock.cs` and `SubscriptionTerms.Create`, with the codes of `BusinessViolationCodes.Subscriptions.cs:11-28` and the sentences of `SubscriptionMessages.cs`. Views mirror `SubscriptionViews.cs` (address at :93-102, branch at :109-114). No MSW handler returns a refusal yet; S1 to S3 wire these. Behavioural parity is proved by `schedule-parity.test.ts` (U4).

## 5. Fallback sentences written by S0 (§10.3)

`SUBSCRIPTION_CODE_MESSAGES` in `lib/subscriptions/errors.ts`. Copied from the server (`SubscriptionMessages.cs`): `SkuNotSubscribable` (:17), `SubscriptionAlreadyExists` (:13), `SubscriptionLimitReached` (:14), `NoChangeRequested` (:15), `NoPendingChange` (:16), `ReinstatementReasonRequired` (:19), `SubscriptionSuspended` (:37). Written by S0, for the owner to check:

| Code | Sentence |
|---|---|
| `InvalidSubscriptionQuantity` | Choose a quantity between 1 and 20. |
| `InvalidSubscriptionInterval` | Choose how often you want deliveries from the list. |
| `FulfilmentDetailsInvalid` | Choose a delivery address, or an outlet to collect from, to match how you want to receive it. |
| `PaymentMethodNotAllowedForFulfilment` | That payment method isn't available for this way of receiving your order. |
| `InvalidFirstDeliveryDate` | Choose a delivery date within the range shown. |
| `InvalidSubscriptionTransition` | That change isn't possible for this subscription right now. |
| `SubscriptionCannotBeReinstated` | Only a suspended subscription can be restarted. |
| `CycleNoLongerSkippable` | That delivery can no longer be skipped. |
| `SkipAlreadyScheduled` | That delivery is already set to be skipped. |
| `CycleNotDue` | That delivery isn't due yet. |
| `DeliveryAddressNotFound` | Choose a delivery address from your address book. |
| `AddressOutsideServedZones` | We don't deliver to that address yet. Choose another address, or collect from an outlet. |
| `PickupBranchUnavailable` | That outlet isn't available for collection. Choose another. |
| `PaymentMethodUnavailable` | That payment method isn't available for this order. Choose another. |
| `DeliveryTaxNotConfigured`, `ServiceLevelUnavailable` | We can't deliver to that address right now. Please try again later or contact the shop. |
| `CancellationReasonRequired` | Give a reason for cancelling this subscription. |
| `StaleVersion` | This subscription changed in another window. We've loaded the latest. |
| `InvalidPageSize` | That page size isn't available. |
| `InvalidPageNumber` | That page isn't available. |

Also written by S0 (not codes): the generic save sentence ("We couldn't save that. Please check your choices and try again."), "We couldn't find that subscription.", "We couldn't find that product.". `SubscriptionNotFound` has no entry: it is a 404 with no body, handled as `ApiNotFoundError`.

## 6. Where the code differs from the document (§20.2 / §20.6)

1. The address book: the handover said `accounts.ts` is forbidden; the subscriptions mock first kept its own copy. Amended (b) replaced it with one read-only export from `accounts.ts`.
2. Seeded ids built with a two-character prefix were not GUIDs (9-character first group); fixed in Amended (d).
3. The shop store key lives in `shop/store.ts`, outside S0's block, so §11.1.5's "both store keys bumped" needed Amended (b).
4. `SUBSCRIBABLE_SKU_IDS` is derived from the shop's list, not the reverse: the reverse import is circular.
5. The ordering mock does not reseed daily as the subscriptions mock does (noted in `ordering/store.ts`; mocks only).
6. The seeded address book of the signed-in customer is no longer empty, which three run-only e2e specs assumed (Amended (e)).

## 7. Verification (what was seen)

- `npx tsc --noEmit`: clean. `npm run lint` (`--max-warnings 0`): clean.
- Vitest at `--maxWorkers=2`, full suite at `46f9a58`: 248 files / 2398 tests passed (the TEST gate's run). Later targeted runs: `tests/unit/subscriptions` 8 files / 128 tests passed; `catalogue-p5.test.tsx` 18 passed after the Amended (f) change; `tests/components/back-office-sales`, `tests/contract` passed.
- Playwright (chromium and mobile-360, 2 workers, `next dev` on 3126 with mocks): the five E1 specs 98 passed; the run-2 set (E1 five specs, `account-area`, `ordering-customer`, `ordering-customer-orders`, `accounts-a11y-responsive`) 322 passed, 0 failed. My own run of `account-area`, `ordering-customer`, `ordering-customer-orders`, `accounts-a11y-responsive`, `p5-followup-layout-360`: 260 passed and 4 failed before the `.check()` to `.click()` fix; then `ordering-customer.spec.ts` 16 of 16 passed. Baseline cases: none appeared in these specs.

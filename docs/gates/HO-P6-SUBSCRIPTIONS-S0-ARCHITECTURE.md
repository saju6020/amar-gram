GATE: ARCHITECTURE
HANDOVER: HO-P6-SUBSCRIPTIONS (slice S0, shared contract, labels and mock store)
COMMITS: 21b0ad1, 3cbdeb3, 6c63e0f, 13111cc (range 86db19d..13111cc, branch feat/p6-s0-contract)
DATE: 2026-11-07
STATUS: PASS

Reviewed against: docs/handover/HO-P6-SUBSCRIPTIONS.md (Contract inventory, §1 incl. Amended (a), §3-§4, §6, §8.3-§8.6, §9, §10, §11.1, §12, §13, §14, §15 U1-U7, §19 ARCHITECTURE focus);
.ai/architecture.md, .ai/cqrs.md, .ai/read-side-pattern.md, .ai/bounded-contexts.md, .ai/enumeration-pattern.md (backend docs: S0 changes no backend file, so they bind only what the
browser may read, send and compute); web/docs/decisions.md. The wire was checked directly against src/ on this branch:
CustomerSubscriptionsController.cs, StaffSubscriptionsController.cs (incl. StaffCustomerSubscriptionsController), SubscriptionHttp.cs, SubscriptionRequests.cs,
SubscriptionViewModels.cs, SubscriptionViews.cs, SubscriptionStaffQueryHandlers.cs, SubscriptionSchedule.cs, SubscriptionClock.cs, SubscriptionTerms.cs,
SubscriptionRules.cs, SubscriptionMessages.cs, BusinessViolationCodes.Subscriptions.cs, ActionRoles.Subscriptions.cs and the nine Shared/Common/Enums/Subscription*.cs.

CONTRACT CHECK (frontend vs src/)
- Endpoints: all 12 customer (C1-C12) and 9 staff (T1-T9) paths, methods and query names in web/lib/api/subscriptions.ts and web/lib/api/staff-subscriptions.ts match the
  controllers' routes. `subscriptionsCsvPath` strips paging (T4 takes none). C9 sends no body; C10 always sends an object (server binds `ResumeSubscriptionRequest?`);
  C11 always sends `reason`; T8 sends `{ note }` only (reason fixed to StaffCancelled server-side).
- DTOs: every field of SubscriptionViewModel, Terms, Pending, Estimate, Cycle, Options, PaymentMethod, StaffRow, Unpaid, StaffDetail (flattened, as SubscriptionHttp.Flatten
  does), StaffReinstatement, CustomerSummary (`{ live, cancelledCount, suspendedCount }`, anonymous object at StaffSubscriptionsController.cs:163) and DueTomorrow is present with the
  right nullability; no extra field. Money = `{ amount: string, currencyCode }` = MoneyViewModel. Requests match SubscriptionRequests.cs.
- Enumerations: every union lists exactly the server's display names (Status 4, SuspensionReason 2, CancellationReason 9 with the 6 customer choices, PaymentMethod 3,
  Fulfilment 2, CycleOutcome 2, FailureReason 6, CycleOrderState 6, PendingStatusChange 2, actions 6, staff actions 2, unpaid group 2).
- Error codes: SUBSCRIPTION_CODE_MESSAGES covers every code of BusinessViolationCodes.Subscriptions.cs except SubscriptionNotFound (a 404, no body, correctly handled as
  ApiNotFoundError), plus the reused Orders/Accounts/base codes; server sentences cited are verbatim. The `{ error }` 400 shape is handled without touching lib/api/errors.ts.
- Roles: the three arrays equal ActionRoles.Subscriptions.cs:12-14.
- Mock schedule port (mocks/handlers/subscriptions/schedule.ts) is a line-for-line port of SubscriptionSchedule.cs, SubscriptionClock.cs and SubscriptionTerms.Create, with
  the server's sentences. Behavioural parity is U4's to prove (TEST gate).

ARCHITECTURE CHECK
- No client-side schedule logic in lib/** (ADR-FE-110): lib/subscriptions/dates.ts only formats; no date arithmetic, no "today" comparison; `new Date(Date.UTC(...))` from
  split parts for layout only; `new Date(instant)` only for ISO instants. Percent handling is string-only. Date arithmetic exists only in mocks/** (the server, ADR-FE-193).
- No fetch outside lib/api/client.ts; no useQuery/useMutation; no hooks, components, routes, nav entries or MSW handlers created: the three handler files are empty stubs as
  §11.1.4 requires. Nothing from S1/S2/S3 was built.
- lib/api/errors.ts, client.ts, types.ts, lib/format/**, mocks/handlers/index.ts, accounts.ts, shop/store.ts untouched; no src/, tests/ (.NET), config, package or lock change.
- Mock aggregator follows the mocks/handlers/ordering/index.ts pattern (ADR-341 per-area file).

FINDINGS
- [MEDIUM] web/mocks/handlers/subscriptions/fixtures.ts:107-121, web/mocks/handlers/subscriptions/store.ts:278-286 — The subscriptions mock keeps its own copy of customer
  addresses (`addressDirectory`, `registerAddress`) because the accounts mock's book is not exported and mocks/handlers/areas/accounts.ts is §14-forbidden. The server resolves
  `terms.deliveryAddress` and `deliveryAddressMissing` from Accounts' address book (SubscriptionViews.cs:93-102; bounded-contexts: "Addresses are Accounts'"). In the mock the
  signed-in customer's Accounts book is empty (accounts.ts:232 `addresses: []`), yet her seeded subscriptions resolve "Home"/"Office"; on the real API those would read
  `deliveryAddressMissing: true`. An address added through the inline AddressForm (ADR-FE-196) or deleted on /portal/addresses will not be seen by this store unless a handler
  copies it. This is the §20.5 situation (a mock that may refuse what the server accepts, §4.3). Fix (integrator decision before S1 builds C6/C7 handlers, §20.1): either
  route a one-export change to accounts.ts (e.g. a read-only `findCustomerAddress(customerId, id)`) so store.ts reads Accounts' book and the duplicate directory is removed, and
  seed the same Home/Office addresses into the accounts customer; or record an Amended row accepting the copy and requiring S1's handlers to register inline-added addresses.
- [LOW] web/mocks/handlers/shop/fixtures.ts:138-139, 651-656 — §11.1.5 says "both store keys bumped", but the shop mock's key lives in mocks/handlers/shop/store.ts:25
  (`__purrcare_shop_mock_db__v2`), outside S0's §13 block, so it was not bumped. A stale sessionStorage copy loads with `isSubscribable` absent (treated as false) until reset.
  Handover inconsistency, handled defensively; the integrator may bump it or record the decision.
- [LOW] web/mocks/handlers/ordering/store.ts:17 — The bumped key keeps the legacy prefix (`__purrcare_ordering_mock_db__v3`). Since the key was rewritten anyway, the owner's
  "no PurrCare leftovers" direction would favour an `__amargram_` prefix (the new subscriptions store already uses one). Cosmetic.
- [LOW] web/mocks/handlers/subscriptions/fixtures.ts:92-95 vs web/mocks/handlers/shop/fixtures.ts:401-408 — Two lists define what is subscribable (SKU ids here, product numbers
  there); the comment says the shop "reads" SUBSCRIBABLE_SKU_IDS, but it keeps its own set. They agree today (U5 checks), but the comment is wrong and the two can drift.
- [LOW] web/lib/subscriptions/dates.ts:67-85 — §8.4 / ADR-FE-112 say instants go "via formatInZone"; `formatCommerceInstant` re-implements zone formatting with Intl
  (zone still named; `formatCommerceInstantLong` does use formatInZone). Behaviourally compliant; CODE_REVIEW may prefer one path.
- [LOW] web/lib/api/subscriptions.ts:91 — `SubscriptionPendingStatusChange` cites its source file without a line range (Shared/Common/Enums/SubscriptionPendingStatusChange.cs:6-7);
  §4.3 asks for file:line on every type.
- [LOW] docs/handover/HO-P6-SUBSCRIPTIONS.md §13 (handover, not code) — The S0 block lists `docs/decisions.md`, which by §13's own rule ("paths are under web/ unless they start
  with docs/") would mean the repo-root docs/; §9 and §12 make clear it is web/docs/decisions.md, which is what S0 edited. Counted in scope. The handover also names the branch
  `feat/p6-s0-subscriptions-contract`; the work is on `feat/p6-s0-contract`. No effect on compliance.

FOR THE TEST GATE (runtime, not observable here)
- U4 schedule parity and U5 seeds (including that the 11 original ordering orders keep ids and totals) must pass, U3 under two TZ values.
- E1 run-only specs: the new Subscription-channel orders join the staff order queue and status counts; any run-only spec that counts orders or pills must still pass.

SCOPE CHECK
- files in allowed scope: 25/25
  (web/docs/decisions.md; web/lib/api/subscriptions.ts; web/lib/api/staff-subscriptions.ts; web/lib/subscriptions/{copy,dates,errors,keys,labels}.ts;
  web/mocks/handlers/areas/subscriptions.ts; web/mocks/handlers/subscriptions/{store,schedule,fixtures,control,customer,staff,touchpoints}.ts;
  web/mocks/handlers/shop/fixtures.ts (isSubscribable only); web/mocks/handlers/ordering/store.ts (channel widened + subscription-order seeds + key bump only);
  web/tests/unit/subscriptions/{api-clients,dates,errors,labels,schedule-parity,seeds,source-guard}.test.ts)
- files outside allowed scope: none
- forbidden scope (§14) touched: none. New npm dependencies: none.

Note on this record's name: the caller asked for docs/gates/HO-P6-S0-ARCHITECTURE.md; §13 and §19 name gate records docs/gates/HO-P6-SUBSCRIPTIONS-S0-<GATE>.md, and that
is the only gate path inside S0's scope, so this file uses the handover's name.

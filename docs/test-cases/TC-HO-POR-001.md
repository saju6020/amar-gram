# TC-HO-POR-001 -- Customer Portal (backend), phases A, C, D built (re-order retired; subscriptions deferred by owner)

Handover: docs/handover/HO-POR-001.md (sections 15, 16 and 18)
Branch: ho/POR-001 (from master 4a4acb88). Written 2026-10-09 (developer); executed and updated by the TEST gate 2026-10-10/11 on head 38a1c2f0 plus the gate's test-only commit (hash in docs/gates/HO-POR-001-TEST.md).
Scope of this gate: "after Phase D" (HO-POR-001 1 Amended 2026-10-10): subscriptions deferred by owner, portal re-order retired.

> Statuses record what was **observed**. `PASS` = watched passing.
> `PASS (scope)` = the case passes for every section built in the gate's scope (after Phase D); the parts that belong to deferred phases (subscriptions) are named in the evidence and under "Cases I could not run". It does not claim those parts pass.
> `BLOCKED-ON-<area>` = the case needs an upstream area that is not merged on master (HO-POR-001 17 and 20.1) and is **not stubbed in src/**;
> it is written here so the phase that unblocks it has its map. `RETIRED` = retired by owner decision (portal re-order).
> Rows prefixed `X-` were added by the developer beyond the handover's tables.

## Scope built on this branch

| Phase | Upstream | State |
|---|---|---|
| A | ACC, ADM (merged; other upstreams since removed) | **Built**: the section 7 spike, enumeration `PortalSectionState`, constants, `PortalSectionComposer`, `IPortalSectionReader<T>`, profile reader, Q1, `PortalController` dashboard |
| C | BIL (merged) | **Balances reader built** |
| D | SHP, IMP, ORD (all merged) | **Orders reader built** (passes Orders' `canReorder` and `trackingNumber` through). Re-order RETIRED (owner-delegated decision 2026-10-10, owner to review): the customer uses Orders' `POST /api/customers/me/orders/{id}/reorder`; no `ReorderPreviousOrderCommand`, endpoint or `ReorderLineOutcome` here |
| F | SUB (**not merged**) | **DEFERRED by owner** (owner-delegated decision 2026-10-10, owner to review): subscriptions reader not built |

Decision recorded in HO-POR-001 1 Amended: the handover gives no placeholder guidance for sections whose readers do not exist yet, so the
dashboard response has **no key** for them (`subscriptions`, deferred by owner) until their phase adds the key, the reader and the registration.

## Summary

| | Count |
|---|---|
| Handover cases (section 15: 23, section 16: 19) | 42 |
| PASS (watched passing; I-B1, I-B2, I-B3, I-X1 are "PASS (scope)": sections after Phase D) | 19 |
| FAIL | 0 |
| BLOCKED | 0 |
| NOT RUN | 0 |
| RETIRED by owner decision (re-order 22: U-C1..C12, I-A4, I-C1..C9) | 22 |
| DEFERRED-BY-OWNER (subscriptions U-B15; not executable until HO-SUB-001 is built) | 1 |
| X- rows (developer X-2..X-18 less those since removed; TEST gate X-20) | 14, all PASS |
| Regression rows R-2..R-10 less those since removed (earlier gates) | 6: 5 PASS, 1 n/a (open backlog item, no code to regress) |

19 + 22 + 1 = 42. RETIRED and DEFERRED rows were not executed and are not counted as PASS.

Test counts observed (2026-10-10/11, head 38a1c2f0 plus the TEST gate's test-only changes): Domain 1886, Application 427 (47 Portal), Infrastructure 174, Integration 1476 run (Portal filter: 33 matched, 33 passed; 3 of those live in the Unit folder of the Api-referencing project).

## Environment

- Worktree D:/my-repo/cat_ecommerce-wt/POR-001, branch ho/POR-001. `dotnet build CatEcommerce.sln -p:NuGetAudit=false`: 0 warnings, 0 errors.
- Database: ONLY `catecommerce_por` (created for this branch and migrated to master with `dotnet ef database update --connection`). `CATECOMMERCE_TEST_DB` is the full connection string,
  exported in the same command as every run. `PortalApiFactory` throws at construction when it is unset or names `catecommerce_dev` or `catecommerce_test` (observed: a run without the variable failed all tests at once).
- Suites (TEST gate, 2026-10-10/11): Domain 1886 passed; Application 427 passed (47 Portal); Infrastructure 174 passed; Integration: see "Full-suite result (TEST gate)".
- Hosts: one in-process TestServer per test class (FakeTimeProvider that does not tick, real-clock cookie expiry), plus derived hosts (`WithWebHostBuilder`) for I-B5 and I-X1.
- No in-memory or SQLite provider; no TRUNCATE or DROP; every test mints its own customers and asserts only their own data (16.1).
- Client `DateTimeOffset` with an offset: this slice **writes nothing** (no command, no persisted field), so there is no value to normalise; the tests send UTC instants only.

## Unit cases (handover section 15)

Tests are in `tests/CatEcommerce.Application.Tests/QueryHandlers/Portal/` (`PortalConventionTests`, `PortalReaderTests`, `PortalDashboardComposerTests`) unless named otherwise.

| ID | Case | Expected | Status | Evidence |
|---|---|---|---|---|
| U-A1 | Reflection over every `.Portal` type | No aggregate, event, configuration or event handler (ADR-257) | PASS | `PortalConventionTests.U_A1_NoPortalTypeIsAnAggregate_AnEvent_AConfiguration_OrAnEventHandler`, `U_A1_ThereIsNoPortalSchemaTableOrDbSet` |
| U-A2 | Constructors in `Read.QueryHandlers.Portal**` | No DbContext, dispatcher or repository (ADR-258) | PASS | `PortalConventionTests.U_A2_NoPortalQueryHandlerOrReaderTakesADbContext_ADispatcher_OrARepository` |
| U-A3 | Every `Portal*` ViewModel, recursive | No property of another module's ViewModel (ADR-259) | PASS | `PortalConventionTests.U_A3_NoPortalViewModelHoldsAnotherModulesViewModel_Recursively` |
| U-A4 | `PortalController` | `[RequireCustomerSession]` on every action; no route contains `pay` (ADR-264) | PASS | `tests/CatEcommerce.IntegrationTests/Unit/PortalControllerConventionTests`: `U_A4_EveryPortalAction_...`, `U_A4_NoPortalRouteContainsPay`, `ThePortalController_InjectsTheDispatcherAndTheUserContextProviderOnly` (lives in the Api-referencing project) |
| U-B1 | Balances reader throws | balances `Unavailable`, data null, others Ready, one Error log with section and correlation id | PASS | `PortalDashboardComposerTests.U_B1_ABalancesReaderThatThrows_...`, `U_B1_TheLogLineCarriesNoCustomerDataOrUpstreamPayload` |
| U-B2 | Reader throws `OperationCanceledException` | Propagates | PASS | `PortalDashboardComposerTests.U_B2_ACancelledRead_Propagates_NoSectionResult` |
| U-B11 | Balances: BDT 1500 and USD 20 | Two entries, no total; zero -> `hasOutstanding = false`, `[]` | PASS (adapted) | `PortalReaderTests.U_B11_...`. Billing returns ONE commerce-currency Money, so each Money is one entry and is never added to another (1 Amended). Also `Balances_OpenInvoicesOnly_OldestDueFirst_LimitFive_...`, `Balances_WalksInvoicePages_...` |
| U-B12 | Every reader passes caller id, UserContext, CorrelationId | Yes | PASS | `PortalReaderTests.U_B12_EveryReader_...` (profile, balances), `PortalDashboardComposerTests.U_B12_TheCallerIsTheSessionUser...` |
| U-B13 | Orders reader: `canReorder` per status | false, true, true, true | PASS (adapted) | `PortalReaderTests.U_B13_Orders_CanReorder_PerStatus_FollowsOrdersOwnRule` (8 statuses): true only for Cancelled, Delivered, Returned, Refunded = Orders' own order-detail rule, which wins over OQ-2's default (ADR-268); `U_B13_Orders_LimitFive_...` |
| U-B15 | Subscriptions reader | Counts; `nextDelivery`; none -> null | DEFERRED-BY-OWNER | Phase F deferred (owner-delegated decision 2026-10-10, owner to review): HO-SUB skipped |
| U-B16 | Composer invokes readers sequentially | No overlap | PASS | `PortalDashboardComposerTests.U_B16_...` (also asserts the fixed order) |
| U-C1 | Another customer's / unknown order | `OrderNotFound`, cart untouched | RETIRED | Re-order retired (owner-delegated decision 2026-10-10, owner to review): the portal has no re-order; Orders' own endpoint is used |
| U-C2 | `PendingPayment` order | `OrderNotReorderable` | RETIRED | Re-order retired (owner-delegated decision 2026-10-10, owner to review): the portal has no re-order; Orders' own endpoint is used |
| U-C3 | Three eligible lines, empty cart | Three Added; one save; order never saved | RETIRED | Re-order retired (owner-delegated decision 2026-10-10, owner to review): the portal has no re-order; Orders' own endpoint is used |
| U-C4 | Cart holds 2 of 3 / 3 of 3 | AddLine 1 / AlreadyInCart | RETIRED | Re-order retired (owner-delegated decision 2026-10-10, owner to review): the portal has no re-order; Orders' own endpoint is used |
| U-C5 | Eligibility reasons | Five outcomes, none added | RETIRED | Re-order retired (owner-delegated decision 2026-10-10, owner to review): the portal has no re-order; Orders' own endpoint is used |
| U-C6 | Sellable 1 for wanted 3 | AddedWithReducedQuantity | RETIRED | Re-order retired (owner-delegated decision 2026-10-10, owner to review): the portal has no re-order; Orders' own endpoint is used |
| U-C7 | Nothing eligible | Success, zero added, no write | RETIRED | Re-order retired (owner-delegated decision 2026-10-10, owner to review): the portal has no re-order; Orders' own endpoint is used |
| U-C8 | `AddLine` throws on line 2 of 3 | Line 2 NotAdded; one save | RETIRED | Re-order retired (owner-delegated decision 2026-10-10, owner to review): the portal has no re-order; Orders' own endpoint is used |
| U-C9 | Charge line on a combined order | NotAProduct | RETIRED | Re-order retired (owner-delegated decision 2026-10-10, owner to review): the portal has no re-order; Orders' own endpoint is used |
| U-C10 | Price differs | `priceChanged` | RETIRED | Re-order retired (owner-delegated decision 2026-10-10, owner to review): the portal has no re-order; Orders' own endpoint is used |
| U-C11 | No cart exists | Opened through Orders' factory | RETIRED | Re-order retired (owner-delegated decision 2026-10-10, owner to review): the portal has no re-order; Orders' own endpoint is used |
| U-C12 | Validator, empty `OrderId` | Fails on `OrderId` | RETIRED | Re-order retired (owner-delegated decision 2026-10-10, owner to review): the portal has no re-order; Orders' own endpoint is used |

## Integration cases (handover section 16)

| ID | Case | Expected | Status | Evidence |
|---|---|---|---|---|
| I-A1 | Host starts with `ValidateScopes` + `ValidateOnBuild` | Every reader and upstream handler resolves | PASS | `PortalDashboardEndpointTests.I_A1_TheComposingHandlerAndItsReadersResolve`. This is also the **7 spike**: a Scoped query handler that takes other `IQueryHandlerAsync<,>` instances by constructor resolves under scope validation and runs through `IInMemoryDispatcher` (first dashboard call 200) |
| I-A2 | EF model before and after | No new entity, table or migration; probe migration is empty | PASS | `PortalDashboardSectionsEndpointTests.I_A2_ThePortalOwnsNoEntityTableOrMigration`; CLI: `dotnet ef migrations add PortalProbe` (connection via `ConnectionStrings__CatEcommerce` = `catecommerce_por`) produced `Up` and `Down` with empty bodies and an unchanged model snapshot; the two probe files were deleted and the snapshot restored (`git status` clean of Migrations) |
| I-A3 | Each endpoint without a session; staff session only | `401 session_invalid` both | PASS | `PortalDashboardEndpointTests.I_A3_...` (dashboard only: the portal has one endpoint; re-order is retired) |
| I-A4 | Re-order without `X-CSRF-Token` | `403 csrf_token_invalid` | RETIRED | Re-order retired (owner-delegated decision 2026-10-10, owner to review): the portal has no re-order; Orders' own endpoint is used |
| I-B1 | New customer, nothing recorded | every section Ready and empty | PASS (scope) (2026-10-10: also `PortalOrdersEndpointTests.Orders_ACustomerWithNoOrders_...` PASS; subscriptions deferred by owner, key absent by design) | `PortalDashboardEndpointTests.I_B1_...` and `PortalDashboardSectionsEndpointTests.I_B1_...` PASS for customer, balances. orders: the empty-state test in `PortalOrdersEndpointTests` PASS; subscriptions deferred by owner |
| I-B2 | Full customer | Every section Ready and populated | PASS (scope) | `PortalDashboardSectionsEndpointTests.I_B2_...` PASS (TEST gate re-run): issued invoice 1500.00, balances populated. Orders populated: `PortalOrdersEndpointTests.I_B2_Orders_...` PASS (its own host). Subscriptions: deferred by owner |
| I-B3 | Two customers, each with order, invoice | Each sees only its own | PASS (scope) | `PortalDashboardSectionsEndpointTests.I_B3_...` PASS (invoices, name, balance amount; a forged `customerId` / `ownerId` query string is ignored). Orders part: `PortalOrdersEndpointTests.I_B3_Orders_...` PASS (X-17) |
| I-B5 | Billing handler replaced by a throwing fake | 200; balances Unavailable, data null; others Ready; Error log with correlation id | PASS | `PortalDashboardSectionsEndpointTests.I_B5_...` (test-host override via `WithWebHostBuilder`, no production switch; log line `...PortalSectionComposer: Portal section balances unavailable. CorrelationId=<guid> | ...billing is down`; the level is proved by U-B1) |
| I-B8 | 20 sequential calls | p95 <= 1500 ms | PASS | `PortalDashboardSectionsEndpointTests.I_B8_...` (acceptance fix round): **p95 = 126 ms** (min 92, median 104, max 171; 20 calls after a warm-up, development machine) for a customer with records in every section built at the time: profile, an issued invoice plus the placed order's own invoice, a placed order made through the Ordering customer endpoints, and records in sections since removed. The test asserts every section is Ready and non-empty before timing. Not measured: the subscriptions section (deferred by owner, not built). Replaces the earlier 27 ms figure, which was for a customer with no orders |
| I-C1 .. I-C9 | Re-order cases | -- | RETIRED | Re-order retired (owner-delegated decision 2026-10-10, owner to review). Orders' own `POST /api/customers/me/orders/{id}/reorder` is covered by HO-ORD-001's I-E6 |
| I-X1 | Log capture | No signed URL, note text, customer name, money amount | PASS (scope) | `PortalDashboardSectionsEndpointTests.I_X1_...` PASS (acceptance fix round, POR 20): the customer has an issued invoice of 7351.42; the test asserts the amount is on the board, then that no captured line (registration, arrangement, three dashboard reads) contains the customer name, mobile, `7351` or `7,351`. The I-B5 line carries no customer name. Scope: no signed URL or observation note exists in the built sections |

## Rows added by the developer (X-)

| ID | Case | Status | Evidence |
|---|---|---|---|
| X-2 | Profile reader maps `fullName` only; a missing profile is an upstream fault (the section becomes Unavailable, not an empty greeting) | PASS | `PortalReaderTests.Profile_MapsFullNameOnly_...` |
| X-4 | Balances: open invoices only, oldest due first, limit 5, open count of the scan, `howToPay` is guidance only, no url/link property | PASS | `PortalReaderTests.Balances_OpenInvoicesOnly_...` |
| X-5 | Balances walks invoice pages until the last or the cap | PASS | `PortalReaderTests.Balances_WalksInvoicePages_UntilTheLastOne_AndStopsAtTheCap` |
| X-6 | ADR-012 guard for the Portal read side (like `BillingConventionTests.U_X6`): no database type, no `AsNoTracking` + whole-entity fetch, no `ToDictionaryAsync`, no `Task.WhenAll`, no dispatcher | PASS | `PortalConventionTests.U_X6_ThePortalReadSide_TouchesNoDatabase_...` |
| X-8 | Portal messages carry no link or url constant; offline guidance text | PASS | `PortalConventionTests.TheDashboardMessagesAreGuidanceOnly_NoPayLinkAnywhereInThePortalConstants` |
| X-9 | `GeneratedOn` is the clock instant; the dashboard query has no declared properties (no customer id to set) | PASS | `PortalDashboardComposerTests.GeneratedOn_IsTheClockInstant_AndTheDashboardQueryHasNoCustomerIdProperty` |
| X-10 | `Cache-Control: no-store` on the dashboard | PASS | `PortalDashboardEndpointTests.I_B1_...` |
| X-11 | IDOR: a forged `customerId` / `ownerId` on the query string never changes whose dashboard is returned | PASS | `PortalDashboardSectionsEndpointTests.I_B3_...` |
| X-14 | Orders reader asks for the caller's orders page 1 of `DashboardItemLimit`, newest first; item has no tracking, bank or payment-reference field | PASS | `PortalReaderTests.U_B13_Orders_LimitFive_...`, `Orders_NewestFirst_AndTheItemHasNoTracking...` |
| X-15 | Real HTTP: a placed COD order is on the dashboard with number, status, total, item count; Confirmed -> `canReorder` false | PASS | `PortalOrdersEndpointTests.I_B2_Orders_...` (order placed through Ordering's customer endpoints) |
| X-16 | Real HTTP: after cancelling, `canReorder` is true and equals the order detail page's `canReorder` | PASS | `PortalOrdersEndpointTests.Orders_CanReorderMatchesTheOrderDetailPage_...` |
| X-17 | IDOR: two customers, each sees only its own orders; the other sees `Ready` with an empty list | PASS | `PortalOrdersEndpointTests.I_B3_Orders_...` |
| X-18 | Raw dashboard JSON holds no bank details / payment reference / recipient data from orders | PASS | `PortalOrdersEndpointTests.Orders_NoBankDetails...` |

## Rows added by the TEST gate

| ID | Case | Status | Evidence |
|---|---|---|---|
| X-20 | IDOR, merged account: after a staff merge (two accounts sharing a contact number) a third customer's raw dashboard holds no id or name of either merged account; the merged-away account's own session gets 401 on the dashboard; the survivor sees its own name only and (Billing ADR-192) the duplicate's issued invoice | PASS | `PortalOwnershipChangeEndpointTests.AMergedAwayCustomersRecords_NeverAppearOnAThirdCustomersDashboard` |

## Regression cases from earlier gates

| ID | Gate | Finding | Case | Status | Evidence |
|---|---|---|---|---|---|
| R-2 | SECURITY L2 (POR 9) | No rate limit on the fan-out read | None: the handover requires none; open backlog item, no code to regress | n/a | see "Gaps left deliberately" |
| R-5 | CODE_REVIEW L (POR 6) | U-B13 asserted a private copy of the rule | Now asserts Orders' own `CustomerOrderRules` | PASS | `PortalReaderTests.U_B13_OrdersCanReorderRule_PerStatus_...` and X-16 (HTTP: list `canReorder` equals the detail page's) |
| R-7 | Finalise | `trackingNumber` and `canReorder` on orders | Passed through, null before dispatch | PASS | `Orders_CanReorderAndTrackingNumber_ArePassedThroughFromOrdersListItem`; `PortalOrdersEndpointTests.I_B2_Orders_...` |
| R-8 | SECURITY (checked, no finding) | Merged accounts lose access | Behaviour proved over HTTP | PASS | X-20 |
| R-9 | CODE_REVIEW L (POR 5) / ARCHITECTURE | Stale TC sheet wording | Sheet rewritten by this gate | PASS | this sheet |
| R-10 | Re-order retired | No portal re-order endpoint exists; no payment route | Controller conventions | PASS | `PortalControllerConventionTests` (every action `[RequireCustomerSession]`, no `pay` route) |

## Acceptance-criteria coverage (HO-POR-001 18, scope after Phase D)

| Criterion | Covered by | Status |
|---|---|---|
| A1 orders, balances together | U-B11, U-B13, I-B2 | PASS |
| A4 only own data | I-B3, X-11, X-17, X-20 | PASS |
| A5 one failing module leaves the rest usable | U-B1, U-B2, I-B5 | PASS |
| A6..A9 re-order | -- | RETIRED (owner 2026-10-10) |
| A14 no payment action | U-A4 | PASS |
| A15 no persistence | U-A1, U-A2, I-A2 | PASS |
| A16 customer session on every endpoint; scope validation on | U-A4, I-A1, I-A3 | PASS |
| A17 p95 <= 1.5 s | I-B8 (p95 126 ms, every built section populated incl. a placed order) | PASS |

## Full-suite result (TEST gate)

Run on `catecommerce_por` only, `CATECOMMERCE_TEST_DB` exported in the same command. Build 0 errors; 3 warnings, none in Portal files (two CS0108 in Api/Read, one xUnit2000 in the Ordering tests, all from master).

- Domain 1886 passed; Application 427 passed (47 Portal); Infrastructure 174 passed.
- Integration, whole project, first full run: **1476 total, 1472 passed, 2 skipped, 2 failed**, neither in the Portal:
  - `ShopCataloguePerformanceTests.I_E11_...`: known flake, also fails alone (p95 580 ms against a 500 ms budget; fix in progress on another branch). Shop code, reported not hidden.
  - `OrderingPaymentEndpointTests.AReferenceThatLooksLikeACardNumber_...`: failed once in the full run (`TransferAmountMismatch` where `ReferenceLooksLikeCardNumber` was expected; the test hard-codes a grand total of `2135.00m`); passed alone on 4 of 4 reruns. Not on the known-flake list; POR backlog 15 for the ORD owner.
  - The other known flakes (I_E4, FU1_T1, XI_9, I_C10, I_G5_AChangedFollowUp, I_D13, I_X1, I_F4) did not fail in this run.
- Portal filter after the gate's two new tests: 33 matched, 33 passed.

## Cases I could not run

| ID | Why | What would unblock it |
|---|---|---|
| U-B15 | The subscriptions reader does not exist (owner deferral 2026-10-10) | HO-SUB-001 merged, then portal phase F |

## Gaps left deliberately

| Gap | Why not covered | Suggested owner |
|---|---|---|
| Rate limit (POR 9) | Open backlog item, not required by the handover | Integrator |

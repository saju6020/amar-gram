# CONTRACTS — cross-area seams (Step 1)

This is the index the wave agents read before implementing any area. It exists because an area
often calls a port **owned by another area** that has not been built yet (`docs/handover/README.md`).
Everything listed here is an **interface, DTO, enum, or in-memory/fail-closed fake** — no aggregate,
table, handler, controller or domain logic. `dotnet ef migrations has-pending-model-changes` returns
"No changes" against this branch: nothing here adds an entity.

## Amar Gram pivot (owner, 2026-10-23)

Six areas of the product Amar Gram replaced were retired on 2026-10-23, and
[`HO-P1`](HO-P1-RETIRE-CLINIC.md) removed their code on 2026-10-24. The contracts that existed only
for them were removed from this index on 2026-11-07; the consumer columns name only live areas.
The code was also renamed to `AmarGram` (projects, namespaces), and the paths below use the new names.

## The one rule

**Only the owning area may change a contract.** A consumer that needs a different signature does
not edit the port, the DTO or the fake — it stops and reports the gap. When the owning area's real
handover lands, it swaps its own registration in its own module file (see "FAKE until ... lands"
comments below); no consumer's file changes.

## How to read the fakes

- **Fail-closed** — the fake refuses/denies by default, because a false "yes" would let a consumer
  build on an assumption ("stock exists", "there is headroom") that isn't
  true yet.
- **In-memory** — the fake has no business rule to enforce; it just needs to exist so a consumer's
  code compiles and can be exercised in a unit test. Where a port would normally enlist into the
  shared `DbContext` (HO-IMP-001's "enlist without save", HO-BIL-001's push path, HO-NTF-001's
  outbox), the fake cannot truly do that — no aggregate/table for it exists yet, and this pass adds
  none. Each such fake's doc comment says so.

---

## 1. Contract table

| # | Contract | Owner | Consumers (per handovers) | File(s) | Fake | Behaviour |
|---|---|---|---|---|---|---|
| 1 | `IStockLedger` (`PlanAsync`, `ReserveAsync`, `ReleaseAsync`, `ConsumeReservationAsync`, `DeductAsync`, `ReceiveReturnAsync`, `RecordShortfall`, `AdjustAsync`, `GetBranchBalancesAsync`, **`ReserveBatchAsync`, `GetBatchUsabilityAsync`** -- added 2026-10-09, HO-ORD-001 architecture-gate fix, owner decision 2) | HO-IMP-001 §8.8 (ADR-103) | HO-ORD-001 | `src/Domain/AmarGram.Domain/DomainServices/IStockLedger.cs` | `Fakes/Inventory/FakeStockLedger.cs` | **Fail-closed** — every mutating/planning method returns `InsufficientStock`; `GetBranchBalancesAsync` succeeds with an empty list (the truthful read answer) |
| 2 | `StockDemand`, `StockReference`, `StockParty`, `StockPlan`, `StockMovementLine`, `StockResult<T>`, `StockAdjustment`, `BatchBalance`, `StockReturn`, `StockShortfall`, **`StockBatchDemand`, `BatchUsability`** (`src/Domain/AmarGram.Domain/Models/StockBatchModels.cs`, 2026-10-09) | HO-IMP-001 §8.8/§11.3 | same as #1 | `src/Domain/AmarGram.Domain/Models/Stock*.cs` | — (DTOs) | — |
| 3 | `MovementKind`, `StockReferenceKind` | HO-IMP-001 §8.7/§10.1 | same as #1 | `src/Shared/AmarGram.Shared/Common/Enums/{MovementKind,StockReferenceKind}.cs` | — (enums) | — |
| 6 | `IFileStore` (`PutAsync`, `OpenReadAsync`, `DeleteAsync`; ADR-370 adds `PutVariantAsync`, `ExistsAsync`) | HO-FIL-001 (ADR-318, ADR-370) | HO-SHP-001, HO-RPT-001 | `src/Domain/AmarGram.Domain/DomainServices/IFileStore.cs` | **Landed 2026-09-27 — no fake.** `LocalFileStore` (Development/Testing, filesystem under `%TEMP%`) / `GcsFileStore` (Staging/Production, Google Cloud Storage, ADR-318), selected by `FileStorageModule` | Real: streams to/from disk or GCS; `PutAsync` never buffers the whole file in memory; `OpenReadAsync` returns `FileObjectMissing` for a row with no backing object instead of a silent 404 |
| 7 | `IMalwareScanner` (`ScanAsync`) | HO-FIL-001 (ADR-319) | same as #6 | `src/Domain/AmarGram.Domain/DomainServices/IMalwareScanner.cs` | **Landed 2026-09-27 — no fake.** `DevelopmentNoOpScanner` (Development) / `EicarTestScanner` (Testing, deterministic EICAR-string detector) / `ClamAvScanner` (Staging/Production, real `clamd`) / `UnconfiguredMalwareScanner` (Staging/Production with no `clamd` host configured) | **Fail-closed** (ADR-319) outside Development: `UnconfiguredMalwareScanner` always reports `Unavailable`, never `Clean` |
| 8 | `IFileUrlSigner` (`Sign`, `TryVerify`) | HO-FIL-001 §8.6 | same as #6 | `src/Domain/AmarGram.Domain/DomainServices/IFileUrlSigner.cs` | **Landed 2026-09-27 — no fake.** `HmacFileUrlSigner` — HMAC-SHA256 over `{fileId}\|{exp}\|{disp}`, constant-time verification | Real: a tampered or expired signature is refused with 403 and no detail (§8.6) |
| 9 | `FilePutRequest`, `FileStoreResult<T>`, `ScanResult`/`ScanOutcome`, `FilePurpose` | HO-FIL-001 §8.1/§8.3/§10.1 | same as #6 | `src/Domain/AmarGram.Domain/Models/{FilePutRequest,FileStoreResult,ScanResult}.cs`; `Shared/.../Enums/FilePurpose.cs` | — | — |
| 10 | `IBillableChargeRecorder` (`RecordAsync`, `VoidAsync`) | HO-BIL-001 §8.4 (ADR-178) | HO-ORD-001, HO-SUB-001 | `src/Domain/AmarGram.Domain/DomainServices/IBillableChargeRecorder.cs` | `Fakes/Billing/InMemoryBillableChargeRecorder.cs` | **In-memory** — idempotent per `ChargeSourceKey` in a process-local dictionary; cannot truly enlist (no `ChargeAggregate`/table yet) |
| 11 | `ChargeRequestDto`, `ChargeSourceKey`, `BusinessLine`, `ItemKind`, `ChargeSourceKind`, `BillingGroupKind` | HO-BIL-001 §8.2/§8.3/§8.4/§10.1 | same as #10 | `src/Domain/AmarGram.Domain/Models/{ChargeRequestDto,ChargeSourceKey}.cs`; `Shared/.../Enums/{BusinessLine,ItemKind,ChargeSourceKind,BillingGroupKind}.cs` | — | — |
| 16 | `INotificationOutbox` (`Enqueue`) | HO-NTF-001 §8.4 (ADR-056/057) | every area that sends a message (ACC, ADM, IMP, BIL, ORD, SUB, RPT) | `src/Domain/AmarGram.Domain/DomainServices/INotificationOutbox.cs` | `Fakes/Notifications/InMemoryNotificationOutbox.cs` | **In-memory** — records every request into an in-memory queue for test assertions; cannot truly enlist (no `NotificationRequestAggregate`/table yet) |
| 17 | `NotificationRequestDto`, `NotificationRecipientKind`, `NotificationSubjectKind`, `NotificationChannel`, `NotificationCategory` | HO-NTF-001 §11.3/§10.1 (`NotificationChannel`/`NotificationCategory` owned by HO-ACC-001 §10.1, "reused, never duplicated") | same as #16 | `src/Domain/AmarGram.Domain/Models/NotificationRequestDto.cs`; `Shared/.../Enums/{NotificationRecipientKind,NotificationSubjectKind,NotificationChannel,NotificationCategory}.cs` | — | — |
| 18 | `IBusinessSettings` (`GetInt`, `GetDecimal`, `GetBool`, `GetTimeRange`, `GetString` — the fifth method, added by HO-ADM-001 for `SettingType.CurrencyCode`, ADR-054) | HO-ADM-001 §8.9 | HO-ACC-001 (`security.staffIdleTimeoutMinutes`), HO-NTF-001 (`notifications.quietHours`), and every area with a setting (§10.2's Consumer column) | `src/Domain/AmarGram.Domain/DomainServices/IBusinessSettings.cs` | `Fakes/Administration/InMemoryBusinessSettings.cs` | **Documented divergence (gate fix 2026-09-26):** the fake returns each type's zero value (`0`, `0m`, `false`, a zero-length `TimeRange`, `""`) for **any** key, including one not in `SettingDefinitions`, and never throws. The real adapter (`CachedBusinessSettings.Resolve`) throws `InvalidOperationException` for a key absent from `SettingDefinitions` — a caller passing a typo'd or not-yet-registered key finds out at first real use, not silently. Left as a documented difference rather than made to match: the fake exists so an area landing before HO-ADM-001 can compile and run without a real settings row seeded for every key it reads, which the throw-on-unknown behaviour would defeat. |
| 19 | `IBranchCalendar` (`OpenIntervalsAsync`) | HO-ADM-001 §8.9 | HO-ORD-001 (delivery slots), HO-ADM-001's own branch and roster reads | `src/Domain/AmarGram.Domain/DomainServices/IBranchCalendar.cs` | `Fakes/Administration/InMemoryBranchCalendar.cs` | **In-memory (truthful)** — always no open intervals, mirroring the real "closed until hours are set" default |
| 20 | `IActiveBranchAccessor` (`GetActiveBranchId` — returns `ActiveBranchResult { Guid? BranchId, ActiveBranchRefusal? Refusal }`, not a bare `Guid?`, gate fix 2026-09-26) | HO-ADM-001 §8.3/§8.9 (ADR-046) | any staff-facing endpoint needing a branch | `src/Domain/AmarGram.Domain/DomainServices/IActiveBranchAccessor.cs` | `Fakes/Administration/NullActiveBranchAccessor.cs` | **In-memory (truthful)** — always `ActiveBranchResult.NoBranch` (`BranchId: null, Refusal: null`), mirroring the real "customer/anonymous → no active branch, not a refusal" case. A refusal (`BranchNotAssigned` — a bad/out-of-assignment `X-Branch-Id` header; `BranchAssignmentRequired` — no assignment and no safe single-branch default) is for the calling controller to turn into a `403`; it is never silently downgraded to "no branch". |
| 21 | `TimeRange`, `TimeInterval`, `Money`, `Unit` | Cross-cutting primitives depended on by #1–20; no single handover owns a file for them | all of the above | `src/Domain/AmarGram.Domain/ValueObjects/{Money,TimeRange}.cs`; `src/Domain/AmarGram.Domain/Models/TimeInterval.cs`; `src/Shared/AmarGram.Shared/Common/Helpers/Unit.cs` | — | — |
| 22 | `Actions`, `ActionRoles` — `ActionRoles.cs` is no longer an empty shell; Accounts built its reflection-based merge engine there in wave A (ADR-341, the same pattern `RecordClassification.cs` uses for tables) | HO-ACC-001 §12.8 (ADR-036) — enforcement built by Accounts in wave A | every area, when it adds its own `Actions.[Area].cs`/`ActionRoles.[Area].cs` | `src/Shared/AmarGram.Shared/Common/Constants/{Actions,ActionRoles}.cs` | — (no logic in `Actions.cs`; `ActionRoles.cs` holds `ActionRoles.BuildTable`, real logic, not a shell) | Your own `ActionRoles.[Area].cs` needs exactly one member: a `private static readonly (string Action, string[] Roles)[]` field **whose name ends with the literal word `Rows`** (e.g. `BillingRows`), following `ActionRoles.Accounts.cs`'s `AccountsRows` exactly. `BuildTable` discovers candidates by that name, then checks the shape — a right-shaped field with the wrong name, or a right-named member of the wrong shape (a property, a public field, a `Dictionary`), throws at first use naming the offending member, rather than silently dropping your area's rows and failing every one of its `[RequireAction]` endpoints closed with an unexplained 403. |
| 23 | `StaffRoles` | HO-ACC-001 §10.2 | `ActionRoles` rows everywhere, HO-ADM-001's `RosterableRoles` | `src/Shared/AmarGram.Shared/Common/Constants/StaffRoles.cs` | — | — |
| 24 | `SkuRows()` / `SkuRow` (Shop's published SKU projection) | HO-SHP-001 (**Amended 2026-10-09**: `Brand` column, owner-ratified) | HO-IMP-001 (`CatalogueSkuDirectory`), HO-ORD-001 (`CatalogueLookup`), Shop's own read side | `src/Infrastructure/AmarGram.Infrastructure/Product/SkuRows.cs` | — (real projection) | Read-only, untracked; additive columns only |
| 25 | `SkuSaleFactViewModel` / `SkuRows()` (Shop's SKU read contract; `GetSkuSaleFactsQuery`, HO-SHP-001 §8.12) | HO-SHP-001 (**Amended 2026-10-09, FU3**) | HO-ORD-001 (`ICatalogueLookup` -> `SkuSnapshot.ShippingWeightGrams`), HO-IMP-001 | `src/Read/AmarGram.Read/ViewModels/ShopPurchaseViewModels.cs`, `src/Infrastructure/AmarGram.Infrastructure/Product/SkuRows.cs` | — | **Owner decision 2026-10-09:** delivery charges are configurable by weight range. The SKU contract now carries `ShippingWeightGrams` (`int?`, null = not set, 1..100000 g), stored on `product.sku.shipping_weight_grams`, set via the staff add/update SKU commands. Appended as a trailing optional member, so existing consumers compile unchanged. |
| 26 | **`IBillingTransactionScope`** (`RunAsync`, `FlushAsync`) -- the producer entry point: one database transaction around the producer's own change and Billing's published commands; **Billing owns the savepoint rule and the per-branch numbering lock** (`DocumentNumbering` reads the series row `FOR UPDATE` inside an open transaction, ADR-179 amended). Added 2026-10-09, ADR-215 accepted by the owner | HO-BIL-001 §8.13 (Amended 2026-10-09) | HO-ORD-001 (via `ITransactionalScope`), **HO-SUB-001 -- use this, write no transaction or lock code of your own** | `src/Domain/AmarGram.Domain/DomainServices/IBillingTransactionScope.cs`; `Infrastructure/Billing/BillingTransactionScope.cs` | **Landed 2026-10-09 -- no fake** (registered in `BillingModule`) | Real |
| 27 | **`IBillingRefundPlanner`** (`PlanCreditAsync`, `PlanRefundAsync`) + `CreditPlan`, `CreditLinePlan`, `RefundDrawPlan`, `RefundDraw` -- Billing's planning port for a refund: how an amount is credited over an invoice's lines and drawn from payments. A producer then dispatches `IssueCreditNoteCommand` / `IssueRefundCommand`; it never loads Billing's invoice or payment aggregates or injects `IBillingFinder`. Added 2026-10-09 | HO-BIL-001 §8.13 (Amended 2026-10-09) | HO-ORD-001 | `src/Domain/AmarGram.Domain/DomainServices/IBillingRefundPlanner.cs`; `Models/BillingRefundPlanModels.cs`; `Infrastructure/Billing/EfBillingRefundPlanner.cs` | **Landed 2026-10-09 -- no fake** | Real, read-only (`AsNoTracking`) |
| 28 | **`ApprovePaymentCommand` and `RejectPaymentCommand`** published as part of Billing's §8.13 command surface (maker-checker: Billing itself refuses the person who recorded the payment). A producer records the payment as the real first person (`RecordPaymentCommand`), and the real second person approves or rejects through these -- no `UserContext` is ever copied, built or impersonated. Added 2026-10-09 | HO-BIL-001 §8.13 (Amended 2026-10-09) | HO-ORD-001 (held bank transfers) | `src/Application/AmarGram.Application/Commands/Billing/BillingPaymentCommands.cs` | **Landed -- no fake** | Real |
| 29 | **`RecordPaymentCommand.ApprovalWaiverReason`** (additive `string?`, default `null`; replaces the first-cut `bool ApprovalNotRequired`) -- an in-process producer that has already decided a payment needs no second approver sets `CodCollection` (cash-on-delivery collection, method `CashOnDelivery`) or `CounterTender` (counter tender, method `CashInStore` or `CardInStore`; HO-ORD-001 OQ-7 / ADR-204 amended) and Billing accepts the payment at once, whatever its size. Billing refuses every other method/reason pairing (`400 ApprovalWaiverNotAllowed`, so a bank transfer can never skip the second approver), stores the reason on the payment (`approval_waiver_reason`), raises `PaymentApprovalWaivedEvent` and writes the audit row `PaymentApprovalWaived` (`Reason=..; Method=..; Amount=..`). Never bound from an HTTP request (`StaffPaymentsController` builds the command field by field), so payments staff record in Billing keep the approval threshold (BR-17). **Also additive:** `IssueInvoiceFromChargesCommand.PinnedTaxClassId` / `PinnedTaxRateAsOf` (in-process only) -- that class's tax rate is read as of the given instant instead of now; Ordering pins `DELIVERY` to the order's `PlacedOn` when a held transfer is confirmed. Added 2026-10-10 (HO-ORD-001-FU1 D4, fix round ORD 52/53/56) | HO-BIL-001 §8.13 (additive, owner-confirmed 2026-10-10) | HO-ORD-001 (COD collection, counter tenders, transfer confirmation) | `src/Application/AmarGram.Application/Commands/Billing/BillingPaymentCommands.cs`, `.../BillingInvoiceCommands.cs`, `.../CommandHandlers/Billing/PaymentCommandHandlers.cs`, `.../InvoiceIssuing.cs` | **Landed -- no fake** | Real |
| 31 | **`CustomerOrderSummaryViewModel.TrackingNumber` and `.CanReorder`** (`string?`, `bool`; additive trailing members of `GET /api/customers/me/orders`). `CanReorder` is `CustomerOrderRules.CanReorder(status)`, the one rule the order detail also uses -- owner-delegated decision 2026-10-10, owner to review | HO-ORD-001 (**Amended 2026-10-10**) | HO-POR-001 (`OrdersSectionReader` passes both through), HO-ORD-002 | `src/Read/AmarGram.Read/ViewModels/OrderViewModels.cs`, `QueryHandlers/Order/OrderQueryHandlers.cs` | -- (real) | Single source of the re-order eligibility flag; the portal keeps no copy. Additive: no rename or removal |
| 35 | **`GET /api/staff/customers/{customerId}/orders`** (`Orders.View`; `StaffCustomerOrderRowViewModel` rows, paged). Specified in HO-ORD-001 §12.4 but not built; **delivered 2026-10-12** by HO-ORD-001-FU2 (owner decision "Build the endpoint"). Active-branch scope; unknown customer `404` | HO-ORD-001 (**Amended 2026-10-12**) | HO-ORD-002 (`CustomerOrdersPanel`, HO-ACC-002's customer page) | `src/Api/AmarGram.Api/Controllers/StaffCustomerOrdersController.cs`, `src/Read/AmarGram.Read/QueryHandlers/Order/StaffOrderQueryHandlers.cs` | -- (real) | Delivered. See `docs/handover/HO-ORD-001-FU2.md` |
| 41 | **Reporting `varianceDirection`** (HO-RPT-001-FU1; owner decision 2026-10-14 "Over / Short"). A string column `varianceDirection` (`ReportColumnType.Text`) placed right after `variance` in **R13 `payment-reconciliation`** and **R14 `daily-cash-up`**; values `"Over"`, `"Short"`, `"Matched"` or `null` (nothing to compare: card in store, a cash day not yet counted, a day not closed); enum `VarianceDirection` + `VarianceDirections.Of/Name` in `src/Shared/AmarGram.Shared/Common/Enums/VarianceDirection.cs`. `Over` = more received or counted than expected, `Short` = less, `Matched` = equal to the cent. **Not derived from the sign of `variance`**: R13 COD and bank-transfer rows carry expected minus received (positive = short), R13's cash row and all of R14 carry counted minus expected (negative = short); `variance` is unchanged. Also additive: an optional trailing `description` on every column of the catalogue (`GET /api/staff/reports`, `columns[]`) and of the run result (`columns[]`), `null` except for `varianceDirection`, where it states the meaning. Neither report has a totals row | HO-RPT-001 (**Amended 2026-10-14**) | HO-RPT-002 (`lib/format/report.ts` `isNonZeroAmount` / `isVarianceKey`; RPT backlog row 71) | `src/Read/AmarGram.Read/QueryHandlers/Reporting/Sources/PaymentReportBuilders.cs`, `src/Shared/AmarGram.Shared/Common/Constants/ReportCatalogue.Financial.cs` | -- (real) | Delivered. See `docs/handover/HO-RPT-001-FU1.md` |

Module registrations (all "FAKE until ... lands" — see each file's own comment):
`src/Api/AmarGram.Api/Modules/{InventoryModule,FileStorageModule,BillingModule,NotificationsModule,AdministrationModule}.cs`.

Unit tests for every fake's behaviour: `tests/AmarGram.Infrastructure.Tests/Fakes/**`.

---

## 2. The identity header

**`X-CSRF-Token`** (HO-ACC-001 §12.5, ADR-031; enforced at §12.8 rule R7).

The caller's *identity* itself is never carried in a request header the frontend sets — it rides in
two `HttpOnly` session cookies the browser sends automatically (`pc_session` for a customer,
`pc_staff_session` for staff; ADR-031), resolved server-side into `UserContext` by
`SessionAuthenticationMiddleware` / `SessionUserContextProvider` (§12.5). Neither cookie is readable
or settable by client-side script.

The one header the frontend's API client **must** set itself is the CSRF double-submit token: read
the non-`HttpOnly` `pc_csrf` cookie and echo its value in the `X-CSRF-Token` header on every unsafe
method (`POST`/`PUT`/`DELETE`). Missing or mismatched → `403 { "error": "csrf_token_invalid" }`
before the action runs (§12.8 R7). Sign-in, registration, CAPTCHA and reset endpoints carry no
session and are exempt.

`HO-ADM-001` additionally defines a **branch-context** header, `X-Branch-Id` (§8.3, ADR-046) — sent
by a staff client to select which of several assigned branches is active for the request. This is
not an identity header (it does not authenticate anyone); it is reported here because it is the
other header a staff-facing API client needs to know about.

---

## 3. Disagreements found (owner wins per the rule above)

| # | Where | Disagreement | Resolution |
|---|---|---|---|
| D-1 | `StockReference`'s field names | HO-IMP-001 §8.8's own table: `ReferenceKind`, `ReferenceId`, `ReferenceLineId`, `ReferenceLabel`. A consumer handover's inline code sample: `Kind`, `ReferenceId`, `ReferenceLineId`, `Label` | Used the owner's (HO-IMP-001) names. `src/Domain/AmarGram.Domain/Models/StockReference.cs` |
| D-2 | `StockReferenceKind` member names vs. what consumers' inline examples call their own reference kind | HO-ORD-001 says `Order`; HO-IMP-001 §10.1's own pre-declared list has `CustomerOrder` | Used the owner's (HO-IMP-001 §10.1) member list. `src/Shared/AmarGram.Shared/Common/Enums/StockReferenceKind.cs`. A consumer uses the owner's actual member name, not the name its own handover's prose used. The retired areas' members were removed by HO-P1 |
| D-3 | A consumer handover calls the movement-kind enum `StockMovementKind`; HO-IMP-001 §10.1 (the owner) calls it `MovementKind` | Naming slip in the consumer's prose, not a structural conflict | Used `MovementKind` (owner) |
| D-4 | HO-IMP-001 §10.1: "the 14 of §8.7"; §8.7's own table lists 13 members | Documentation inconsistency inside the owning handover itself | Implemented the 13 members §8.7's table actually lists; did not invent a 14th |
| D-5 | A gap raised by a retired area | — | Retired with its area (HO-P1) |

---

## 4. Gaps — no handover gives the exact shape (inferred, flagged in each file's doc comment)

| # | Type | Only evidence available | Where |
|---|---|---|---|
| G-1 | `StockReturn` | HO-IMP-001 §8.8 rule 8's prose ("writes `Return` into the branch's `Quarantine` location only, for a batch the party actually received") and its bare mention in §11.3's DTO list — no field list anywhere | `Models/StockReturn.cs` |
| G-2 | `StockShortfall` | Only one consumer's literal call (`SkuId, LocationId, Quantity`, plus its own ids); generalised to `ReferenceId`/`ReferenceLineId` so any consumer can call it | `Models/StockShortfall.cs` |
| G-3 | `StockPlan.Shortfall` | Inferred from `FefoAllocator.Allocate(...) → Allocation(lines[], shortfall)` (HO-IMP-001 §8.9); `StockPlan` itself is only described as "lines of ..." | `Models/StockPlan.cs` |
| G-4 | A type of a retired area | — | Removed with its area (HO-P1) |
| G-5 | `FilePutRequest` | Inferred from ADR-318's description of `GcsFileStore.PutAsync` and HO-FIL-001 §8.1's `StoredFileAggregate` fields | `Models/FilePutRequest.cs` |
| G-6 | `FileStoreResult<T>` | ADR-318's code block shows only `Task<FileStoreResult<T>>`, never the wrapper's own fields; modelled on `StockResult<T>`'s already-established shape | `Models/FileStoreResult.cs` |
| G-7 | `IMalwareScanner.ScanAsync` signature, `ScanResult` | Only the three-outcome contract (`Clean`/`Infected`/`Unavailable`) and the calling order (ADR-319, HO-FIL-001 §8.2 step 5) are given, never the method signature | `DomainServices/IMalwareScanner.cs`, `Models/ScanResult.cs` |
| G-8 | `IFileUrlSigner.Sign` signature | Only the resulting URL's shape is given (HO-FIL-001 §8.6), never the method name/parameters | `DomainServices/IFileUrlSigner.cs` |
| G-9 | A type of a retired area | — | Removed with its area (HO-P1) |
| G-10 | `TimeRange`, `TimeInterval` | HO-ADM-001 §8.5/§8.9 name the types and describe them only as "any" bounds / "instants (`DateTimeOffset`), sorted, merged" | `ValueObjects/TimeRange.cs`, `Models/TimeInterval.cs` |
| G-11 | A type of a retired area | — | Removed with its area (HO-P1) |

None of these gaps required adding an entity, table or migration. If a real implementation needs a
different shape, that is the owning area's call to make when it lands — these contracts exist only
to unblock compilation and testing in the meantime.

---

## 5. Deliberately out of scope

Ports that are internal to one area's own consumption of another (not published *for* other areas)
were left out, per the task's "at minimum" list plus README's contract table — e.g. `ISkuDirectory` /
`SkuStockProfile` (HO-IMP-001's own adapter over HO-SHP-001, not something a third area calls),
`IInventoryLedgerWriter` (HO-IMP-001 §8.8: "used only by this context's own handlers"). If a wave
agent finds it actually needs one of these before its owner lands, that is a new contract to report,
not something to build unreviewed.

`FileRules` (HO-FIL-001 §8.3, the allow-list table) was left for FIL itself — it is domain
configuration data, not a seam another area calls through.

---

## § Cross-cutting duties — every area, every table (HO-XCT-001)

HO-XCT-001 (Cross-cutting) is built last, but four of its contracts exist **now** so that every
area landing before it can meet duties C-ALL-1…4 (HO-XCT-001 §5.2) in the same change that adds
a table, instead of retrofitting them once Cross-cutting merges:

| # | Contract | File(s) | HO-XCT-001 section |
|---|---|---|---|
| 1 | `RecordClassification` (registry), `TableClassification` (row) | `src/Shared/AmarGram.Shared/Common/Constants/RecordClassification.cs` — one partial file per area, `RecordClassification.[Area].cs` (ADR-341) | §8.2/§10.3, ADR-298 |
| 2 | `RecordClass`, `HardDeletePolicy` (enums) | `src/Shared/AmarGram.Shared/Common/Enums/{RecordClass,HardDeletePolicy}.cs` | §8.2/§10.1 |
| 3 | `IPersonalDataEraser`, `ErasureOutcome` (`Completed`/`Held`/`Failed`) | `src/Domain/AmarGram.Domain/DomainServices/IPersonalDataEraser.cs`, `src/Domain/AmarGram.Domain/Models/ErasureOutcome.cs` | §8.8, ADR-302/ADR-316 |
| 4 | `IRetentionPurgeSource`, `PurgeResult` | `src/Domain/AmarGram.Domain/DomainServices/IRetentionPurgeSource.cs`, `src/Domain/AmarGram.Domain/Models/PurgeResult.cs` | §8.9, ADR-304 |
| 5 | `IRetentionReviewSource`, `RetentionReviewCount` | `src/Domain/AmarGram.Domain/DomainServices/IRetentionReviewSource.cs`, `src/Domain/AmarGram.Domain/Models/RetentionReviewCount.cs` | §8.10 |

Unlike the contracts in §1 above, **there is no fake to register** for these — each area provides
its own real implementation directly (there is nothing to stub: classifying a table and erasing a
context's own data are that area's own knowledge, not a placeholder for someone else's). The
retention worker and purge/erasure orchestration that *consume* these ports are HO-XCT-001's own
later build, not part of this contracts pass.

**The rule every area follows, in the same change that adds a table** (HO-XCT-001 §5.2):

- **C-ALL-1** — classify every table you add in your own `RecordClassification.[Area].cs`, under
  §8.2's ordered rules (money owed/paid/refunded or a price/tax
  in force → `Financial`; named by law → `Regulatory`; an owned collection an aggregate method
  replaces wholesale → `CurrentState`; anything else that accumulates history → `Operational`).
  Never edit another area's `RecordClassification.[Area].cs` file, and never re-classify a table
  another area's file already covers — `RecordClassification`'s aggregation throws on a
  duplicate `(schema, table)` pair.
- **C-ALL-2** — if your context stores a customer's personal data beyond the id, register an
  `IPersonalDataEraser` (`ContextKey` stable once chosen) in your own module. If it stores none,
  exempt it instead with a one-line reason (in `ErasureExemptions`, built by HO-XCT-001 itself).
- **C-ALL-3** — if your context is financial, provide an `IRetentionReviewSource`
  (`retention.financialYears` after the document date, D-9).
- **C-ALL-4** — no method on a financial or regulatory aggregate removes the record, and
  no owned child that is itself a record; a correction is a new entry (D-5).
- **C-ALL-5** — retired by HO-P1 together with the record class it served. There is no audit redaction by
  entity type any more.

---

## 6. What remains

- Every fake above is replaced by its owner in its owner's own module file, per the "FAKE until ...
  lands" comment on each registration. No consumer's file changes when that happens.
- `docs/handover/README.md`'s "Open conflicts between written handovers" table (C-1…C-8) is
  unaffected by anything here — those were resolved before this pass started.
- The recall trace uses the ledger stamp (`StockReference` + `StockParty` on every movement), not a
  per-module fan-out (README C-3).

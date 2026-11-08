GATE: ARCHITECTURE
HANDOVER: HO-P6-SUBSCRIPTIONS (slice S1, customer subscription screens)
COMMITS: ba0a2a1, 43c997a, 5655e75, 06d94c9, 549747e, 8a45479, c1dc7a2 (range f55ea58..c1dc7a2, branch feat/p6-s1-customer; 3492513 is the merge of f55ea58 and adds nothing to this range)
DATE: 2026-11-07
STATUS: PASS

Reviewed against: docs/handover/HO-P6-SUBSCRIPTIONS.md (Contract inventory C1-C12, §1 Amended (a)-(g) and (j), §2, §6, §7, §8.1-§8.6, §9 ADR-FE-109/110/111/112/113/
194/195/196, §10.2, §11.2, §13 S1 block, §14, §15 U24/U25, §16 E7, §20); docs/gates/HO-P6-SUBSCRIPTIONS-S1-SLICE-REPORT.md; .ai/architecture.md, .ai/cqrs.md,
.ai/read-side-pattern.md, .ai/bounded-contexts.md, .ai/decisions/adr.md (ADR-248, ADR-317, ADR-341); web/README.md (fetch only in lib/api/client.ts, hooks only in lib/hooks);
web/eslint.config.mjs. S1 changes no backend file, so the backend docs bind only what the browser may read, send and compute. The mock was checked against src/ on this branch:
CustomerSubscriptionsController.cs (whole file), SubscriptionCustomerCommandHandlers.cs:33-139, SubscriptionCustomerQueryHandlers.cs:25-33, 47, 64, SubscriptionRules.cs:23.
Format follows the S0 record and the S2 record on feat/p6-s2-staff.

ARCHITECTURE CHECK
- Layering (§8.2): only lib/hooks/useSubscriptions.ts imports @tanstack/react-query; no fetch outside lib/api (the mock's own fetch of the accounts endpoint is in mocks/,
  as mocks/handlers/ordering/customer.ts:93 already does). Components import area hooks, which eslint allows outside components/{account,admin,auth,customer}. From lib/api
  the components take only types, error classes (ApiNotFoundError) and the URL helper resolveFileUrl. Pages only unwrap params and mount one screen.
- Cache rule (ADR-FE-194): a change result's `subscription` replaces the detail's subscription part with its cycles kept (useSubscriptions.ts:151-161), then the list, the
  cycles and the options are invalidated. Create seeds the detail with `cycles: []` and invalidates the list, and also the options, because existingSubscriptionId changes
  (:173-186). A refused action re-reads the detail and list. Every key comes from S0's subscriptionKeys. The overview card's key sits under listAll, so it is invalidated with
  the list. useOutletContacts shares ['public','branches'] with the same queryFn, as §11.2.1 asks. No polling (UI-5).
- URL state (§8.3): the list page is `?page=`, the tab is component state, and a tab switch clears the page. `?skip=` (ADR-FE-111) is read once after the detail loads. It
  opens the confirm only when it equals skippableCycleOn; otherwise it explains and offers the server's date. It never mutates, and it is removed with router.replace. A
  malformed value is ignored and removed (SkipLinkHandler.tsx:34-42). `?subscribed=1` is a one-shot welcome flag, read and removed.
- Server owns the schedule (ADR-FE-110, §20.4): action buttons come only from allowedActions (SubscriptionActions.tsx). "Choose another address" appears only when
  allowedActions has ChangeTerms. Locked, pause and cancel wording comes only from isLocked. Pending lines use the server's appliesFromCycleOn and nextDeliveryOn. There is no
  new Date, Date.now, date-fns or addDays anywhere in S1's screens, hook or specs. Number() is used only on the page parameter and on the quantity input.
- Money (ADR-FE-113, ADR-317, OQ-3): the Subscribe form shows the unit price through Amount, the rate as S0's text and the note, with no total. EstimatePanel renders the
  server's estimate as sent, with "−" as text. No arithmetic on money.
- Pager (MySubscriptionsList.tsx:27-28): `Math.ceil(rows / pageSize)` is page-count arithmetic on an integer row count. The same expression is in nine existing components
  (catalogue/Pagination.tsx:17, notifications/SimplePager.tsx:17, orders/MyOrdersList.tsx:139, ...) and in S2's UnpaidSubscriptionsScreen.tsx:23 (rowCount). It is not money
  arithmetic and not a guard ignore comment: the S0 guard matches the token "total" by name, and `totalCount` is a count. See the LOW below for the rename itself.
- BuyBox slot (§11.2.2, NFR-PRF-1): BuyBox gains an optional `subscribe` ReactNode drawn under the actions row only when present (BuyBox.tsx:75). Absent or null leaves
  today's output unchanged. ProductPurchase passes `<SubscribeOffer key={sku.skuId}>` only when signedIn && sku.price, so a variant change remounts and re-reads C1 for the
  new SKU. The product page stays a Server Component with the offer inside the existing client island. C1 is read after render, and loading, failure and not-subscribable
  all show nothing (ADR-FE-195).
- Bounded contexts: addresses come from Accounts (useDeliveryAddresses / useAddDeliveryAddress, inline AddressForm, ADR-FE-196), outlets from Administration (P4), payment
  availability from Orders through C2. The browser joins nothing.
- History layout: CycleHistory switches table and cards on the container width through the existing lib/hooks/useIsNarrow.ts useNarrowContainer (640 px content width,
  HO-IMP-002). StackedTable, RunHistoryTable and ScheduleTable already use it. See the LOW below.
- Account menu and overview: the link sits after My orders, the pill comes after /portal/orders, the 'repeat' icon maps to lucide Repeat and nothing else changed. The
  doc comments are updated. NextDeliveryCard reads C3 live pageSize 1 (the server's order, SubscriptionCustomerQueryHandlers.cs:30, puts the soonest first), shows Manage
  only and is absent on none or on failure (OQ-8).

MOCK vs SERVER (mocks/handlers/subscriptions/customer.ts)
- C1/C2: 404 for an unknown SKU (controller :34, :47). C2 returns [] when neither id is given, and the quantity is clamped. A malformed GUID or int gives the model-binding
  ProblemDetails.
- C3: the `{ error }` 400 uses the controller's exact sentence (:56) and `all` is accepted. Paging follows PagingHelper. The order matches the query handler's OrderBy chain
  (:30) term for term.
- C4/C5: the same bodiless 404 for a foreign, unknown or malformed id (ADR-248). C5 pages newest first (:64), so "Show more" from page 2 at size 12 continues the detail's
  12 (SubscriptionRules.cs:23).
- C6: the `{ error }` parse (:92, :173-191), then the validator (all rules at once), then the handler in the server's order: 404 ProductNotFound, SkuNotSubscribable inactive
  then not offered, AlreadyExists, LimitReached, SubscriptionTerms.Create, servability, aggregate (handler :39-77). 201 with Location (:106).
- C7: the parse, then the validator, then owner, then StaleVersion 409 (:99-105), then terms. Servability is re-checked only when more than the interval changed
  (:121-123).
- C10: SubscriptionSuspended, then SkuNotSubscribable for a paused SKU that cannot be bought. C11: the `{ error }` reason parse (:141-142), then Note length and the
  customer-reason rule.
- The cash-on-delivery check uses the undiscounted price, which is stricter than the server and never looser. Amended (j)(3) accepts it.

FINDINGS
- [MEDIUM] web/components/subscriptions/subscriptionText.ts:1-90, plus inline sentences at CancelDialog.tsx:61, SkipDialog.tsx:43, WithdrawDialog.tsx:34,
  SubscribeOffer.tsx:49, SubscribeForm.tsx:36 and 60, CycleHistory.tsx (the empty line), DetailPanels.tsx:82 — §8.6 makes lib/subscriptions/copy.ts the one copy module
  "so every screen says the same thing", and §8.2 puts pure helpers in lib/subscriptions/**. S1 put its customer-voice sentence builders in a component-local module, which
  is the same shape as S2's staffCopy.ts, and it scattered further sentences inline. Three consequences:
  (a) "Ended on {cancelledOn}" exists twice with different punctuation (subscriptionText.ts:48 has none, DetailPanels.tsx:82 ends with ".").
  (b) The unlocked cancel sentence sits inline while its siblings PAUSE_CONFIRM_UNLOCKED and cancelConfirmLocked are in copy.ts.
  (c) pendingLines (subscriptionText.ts:74-90) and S2's DetailPanels.tsx pendingLines (feat/p6-s2-staff) both encode which date goes with a pending Pause or Cancel
      (nextDeliveryOn or appliesFromCycleOn), in two places with two wordings.
  S0's file was not copied or edited, no S0 sentence is contradicted, every date is a server field formatted by S0's dates.ts, and the strings are disclosed in slice report
  §5. Acceptable for this slice, as S2's was. Fix: the integrator hoists them as Amended (i) did for S2. That means an Amended row authorising additions-only to copy.ts for
  the customer-voice card and status lines (SUSPENDED_SEE_WHY, endedOn, changesScheduledFrom, awaitingTransferBy), the skip, withdraw and unlocked-cancel descriptions and
  the offer line, plus one shared pending-change line builder (taking an audience) that both S1 and S2 call. subscriptionText.ts then keeps only placeText and
  termsSummaryText, or re-exports. Sequence it after S2's (i) edit to copy.ts merges, to avoid a conflict.
- [LOW] web/components/subscriptions/MySubscriptionsList.tsx:27 — `const { totalCount: rows, pageSize } = data` renames the field only so that S0's guard (rule 3 matches
  "total" by name) does not fire. The arithmetic is page counting on a count, not money, so this is not an evasion of §4.3 or §20.4, and slice report §6.7 disclosed it. But a
  rename shaped to a guard's heuristic is a precedent the guard cannot tell from a real dodge, and S2 did the same (rowCount). Fix (integrator, S0's file): teach the guard
  that identifiers ending in Count are counts, or exempt `totalCount`/`pageSize`, then drop the alias in both slices. An alternative is to reuse an existing import-only pager
  (notifications/SimplePager.tsx).
- [LOW] web/mocks/handlers/subscriptions/customer.ts:373-376 with the C8 (:585), C10 (:600) and C11 (:627) handlers — check order. ownedChange checks the owner first, then
  runs the body checks inside. On the server, the controller's reason parse (CustomerSubscriptionsController.cs:141-142), model binding of SkipSubscriptionRequest and
  ResumeSubscriptionRequest, and the validator (ValidateCommand = true) all run before the handler's owner check. For a foreign or unknown id with a bad reason, a note over
  500 or a malformed cycleOn, the server answers 400 and the mock 404. Also, a non-GUID id is a route miss (404) on the server before the session filter, while the mock
  checks the session first (401). Both sides still refuse, the UI cannot reach these cases, and §11.2.10 asks for "validator then handler order as the server". Fix: in C8,
  C10 and C11, parse and validate the body before calling ownedChange's owner lookup, and test the GUID before the session.
- [LOW] web/mocks/handlers/subscriptions/customer.ts:56 — the mock's signed-in customer is always the accounts mock's Sam (CUSTOMER_ID constant; hasCustomerSession only
  checks a pc_session cookie exists). Another registered customer would see and could act on Sam's subscriptions, where the server answers 404 (ADR-248). §11.2.10 says "by
  the signed-in customer only", and §20.5 says never accept what the server refuses. This mirrors the ordering mock's existing pattern: there is no session-to-customer export,
  and areas/accounts.ts is §14-forbidden. It was disclosed in slice report §6.6 and does not affect specs that sign in as Sam. The real-API spec is what proves ownership.
  Fix (integrator follow-up, not this slice): one read-only accounts.ts export resolving the session's customer id, used by both the ordering and subscriptions mocks, under
  an Amended row like (b).
- [LOW] web/components/subscriptions/CycleHistory.tsx:354-356 — §7 UI-1 reads "cards below 768 px (ResponsiveTable or DataTable's card mode)". CycleHistory hand-rolls the
  table and cards and switches on the 640 px content width (useNarrowContainer). That is the project's approved hook for this exact reason (useIsNarrow.ts:5-8: the sidebar
  makes the viewport a poor stand-in), and it serves UI-1's intent better. The deviation is disclosed (slice report §6.4), but no Amended row records it. In jsdom it always
  renders the table, so the card branch is proven only by the 360 e2e (TEST gate). Fix: the integrator notes the container-width rule in the integration record. No code
  change.
- [LOW] docs/gates/HO-P6-SUBSCRIPTIONS-S1-SLICE-REPORT.md §1 and docs/handover/HO-P6-SUBSCRIPTIONS.md:108 — (1) Report §1 lists the Amended (j) edit to AddressForm.tsx and two
  lines later says "Nothing in … AddressForm … was edited". Reword it to "nothing else". (2) The Amended (j) row (an Integration-block file) was committed inside S1's
  c1dc7a2. The caller confirms it is the integrator's decision, so it is counted as authorised. Rows (h) and (i) exist only on feat/p6-s2-staff at the same insertion point,
  so the integrator must merge them in letter order (h), (i), (j) without losing either side.

FOR THE TEST GATE (runtime, not observable here)
- The 360 spec must prove the history card layout (jsdom never shows it) and the 44 px AddressForm fields and buttons on both the subscription and checkout dialogs (Amended (j)).
- subscriptions-customer-real-api.spec.ts was NOT run against a real API (slice report §7). The mock's check-order LOW and the "always Sam" LOW are exactly what that
  run covers.
- Run-only specs that count account-menu links or Tab order (§20.3): the slice searched and ran four, but the full E8 chunks are the TEST gate's.

SCOPE CHECK
- files in allowed scope: 60/60 (the reviewed range; this record is a 61st file, also in the S1 block)
  - 58 in the §13 S1 block: lib/hooks/useSubscriptions.ts; app/(portal)/portal/subscriptions/** (3); app/(shop)/_components/ProductPurchase.tsx (offer only);
    components/product/BuyBox.tsx (slot only); components/subscriptions/** (31); components/portal/{account-nav.ts, AccountSidebar.tsx, dashboard/PortalDashboard.tsx};
    mocks/handlers/subscriptions/customer.ts; tests/components/subscriptions/** (7); tests/components/portal/{account-sidebar,account-p3,dashboard}.test.tsx (superseded
    lines plus U25's required companion case); tests/e2e/subscriptions-customer{,-360,-a11y,-real-api}.spec.ts; tests/e2e/portal-dashboard.spec.ts (E-A2 and the doc comment);
    docs/test-cases/TC-HO-P6-SUBSCRIPTIONS-S1.md; docs/gates/HO-P6-SUBSCRIPTIONS-S1-SLICE-REPORT.md.
  - 2 by Amended (j): web/components/account/AddressForm.tsx (min-h-11 on the fields and Cancel/Save only) and docs/handover/HO-P6-SUBSCRIPTIONS.md (the (j) row,
    append-only).
- files outside allowed scope: none
- forbidden scope (§14) touched: none beyond the AddressForm.tsx change Amended (j) authorises. No src/, config, package or lock change. No S0 shared file (lib/subscriptions/**,
  lib/api/*subscriptions.ts, store, schedule, control, fixtures) edited or copied. New npm dependencies: none.

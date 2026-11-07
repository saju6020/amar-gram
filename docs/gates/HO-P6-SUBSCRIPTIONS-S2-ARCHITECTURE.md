GATE: ARCHITECTURE
HANDOVER: HO-P6-SUBSCRIPTIONS (slice S2, staff subscription screens)
COMMITS: 303f4fe, c46a5ff, 520fdb5, 7182aeb, 7f7e014, 038303a (range f55ea58..038303a, branch feat/p6-s2-staff; d2166a4 is the merge of f55ea58 and adds nothing to this range)
DATE: 2026-11-07
STATUS: PASS

Reviewed against: docs/handover/HO-P6-SUBSCRIPTIONS.md (Contract inventory T1-T9, §1 Amended (a)-(h), §3.2, §4.3, §6, §7, §8.1-§8.6, §9 ADR-FE-110/112/113/114/193/194,
§10.2, §11.3, §13 S2 block, §14, §19, §20.1/§20.4/§20.5/§20.9); docs/gates/HO-P6-SUBSCRIPTIONS-S2-SLICE-REPORT.md; .ai/architecture.md, .ai/cqrs.md, .ai/read-side-pattern.md,
.ai/bounded-contexts.md, .ai/enumeration-pattern.md, .ai/decisions/adr.md (ADR-341); web/README.md; web/eslint.config.mjs. S2 changes no backend file, so the backend docs bind
only what the browser may read, send and compute. The mock was checked line by line against src/ on this branch: StaffSubscriptionsController.cs, PagingHelper.cs,
EnumQueryParameter.cs, SubscriptionStaffQueryHandlers.cs, SubscriptionCustomerQueryHandlers.cs:15, SubscriptionCommandValidators.cs:58-106,
SubscriptionWorkerCommandHandlers.cs:150-175, SubscriptionHandlerSupport.cs:15-32, SubscriptionAggregate.cs:254-276, SubscriptionSchedule.cs:117-182, SubscriptionViews.cs:63-75,
SubscriptionViewModels.cs, SubscriptionStatus.cs, CommerceClock.cs.

ARCHITECTURE CHECK
- Layering (§8.2): only lib/hooks/useStaffSubscriptions.ts imports @tanstack/react-query; no fetch, apiFetch or client call outside lib/api; pages only mount screens; components
  import hooks, which is allowed outside components/{account,admin,auth,customer} (eslint.config.mjs:27-61). components/customer/** untouched.
- Query keys: every query and invalidation uses S0's staffSubscriptionKeys (list, unpaid, detail, cycles, all). Reinstate and cancel invalidate the whole ['staff','subscriptions']
  prefix and re-read; the plain view from T7/T8 is never written into the staff detail (ADR-FE-194, controller :130-134). No polling (UI-5).
- URL-driven state (ADR-FE-183, UI-4): status, suspensionReason, paymentMethod, q, sort and page through useUrlFilterState; Unpaid's page through useUrlParams. A value the
  server does not know is dropped, never sent (no self-inflicted { error } 400). "Show more" depth is component state, which is not a filter. No form value, note or reason
  goes to storage or the URL.
- Server owns the schedule (ADR-FE-110, §20.4): actions render only from allowedStaffActions AND SUBSCRIPTION_MANAGE_ROLES; lock wording only from isLocked; the pending
  lines use pending.appliesFromCycleOn and nextDeliveryOn as §10.2 says (a pending skip skips FollowingCycleOn, which is what appliesFromCycleOn carries,
  SubscriptionSchedule.cs:130-135 / SubscriptionViews.cs:66, so the date shown is right). Status-based wording ("None while paused") reads the server's status, not a date.
  No new Date, Date.now, date-fns or addDays; Number() only on the page parameter.
- Money (ADR-FE-113, ADR-317): EstimatePanel renders the server's estimate through Amount, "-" as text; isZeroPercent is S0's string test. No arithmetic.
- CSV (ADR-FE-114): export goes through downloadBillingFile(subscriptionsCsvPath(filters)); nothing built or previewed; 413 shown as EXPORT_TOO_MANY_ROWS.
- Reads call the owning endpoints only (T1, T2, T5, T6); no N-read joins. T3 and T9 are left to S3 (touchpoints.ts untouched; the T5 mock hands `due-tomorrow` on).
- Nav (ADR-341): nav/areas/subscriptions.ts gains exactly one staff item with SUBSCRIPTION_VIEW_ROLES; staff-nav-groups.ts one Sales entry after Customers.
  staff-shell.tsx changes are exactly the Repeat import and the `repeat: Repeat` table entry authorised by Amended (h).
- Copy: S0's copy.ts and labels.ts are reused for every shared sentence (reinstateTitle, staffCancelTitle, staffCancelLockedText, REINSTATE_DATE_HELP,
  STAFF_ACTIONS_ROLE_NOTE, EXPORT_TOO_MANY_ROWS, cutoffSentence, nextDeliveryLabel, estimateDiscountLabel, every label). S0's file was not copied or edited. See the MEDIUM below
  for staffCopy.ts.
- §20.9: order links are kept on the detail (CycleHistory.tsx:47-49) and the Unpaid page (UnpaidSubscriptionCard.tsx:46-49); nothing hides them, nothing switches the active
  branch, and the slice report (§7.6) raises the cross-branch question for the owner. This is exactly what §20.9 requires. The question itself stays open for the owner; the
  integrator should carry it into the integration record.

MOCK vs SERVER (mocks/handlers/subscriptions/staff.ts)
- Roles: 403 outside View on T1/T2/T5/T6, Export on T4, Manage on T7/T8 (controller :26, :42, :62, :79, :92, :104, :118); arrays equal ActionRoles.Subscriptions.cs:12-14,
  pinned to lib/api by mock-refusals.test.ts:58. 403 body matches the other mocks' ActionNotPermitted shape.
- Filters: status, then reason, then method, each a { error } 400 with the controller's exact sentences (:143-145); blank = no filter, case-insensitive
  (EnumQueryParameter.cs:19 delegates to EnumerationParsing). q over product name, customer name, mobile, case-insensitive (SubscriptionStaffQueryHandlers.cs:26-32).
  Sort: the four sorts with Postgres NULL ordering and Id tiebreak; anything else is the default (:37-43); STATUS_ORDER equals SubscriptionStatus values 1-4.
- Paging: InvalidPageNumber above 1,000,000, InvalidPageSize at 0 or less, clamp to 100, default 20 (PagingHelper.cs:31-47, SubscriptionCustomerQueryHandlers.cs:15).
- Export: 12 columns in the controller's order (:72-74), quoted cells with the injection guard, 413 { error } with the controller's sentence above the cap (:69).
- T5/T6: 404 with no body (:84, :99). T7: validator before handler (ValidateCommand = true, :110), ReinstatementReasonRequired on Reason, length 500 with FluentValidation's
  MaximumLength text (SubscriptionCommandValidators.cs:104), 404 after validation (SubscriptionWorkerCommandHandlers.cs:157), SkuNotSubscribable on SubscriptionId only when
  Suspended (:160-165), then the aggregate via S0's reinstateOf (SubscriptionAggregate.cs:256-262). T8: Note length then Note required with the validator's sentence
  (:63, :69-70), reason fixed StaffCancelled (controller :123), cancel through S0's cancelOf. T7/T8 answer the plain view (:130-134).

FINDINGS
- [MEDIUM] web/components/staff-subscriptions/staffCopy.ts:9-30 — §8.6 makes lib/subscriptions/copy.ts the one copy module "so every screen says the same thing", and §13 /
  §20.1 say a slice that needs a new string raises it for S0 or the integrator to add. S0 already put staff-voice sentences in copy.ts (copy.ts:121-131), which shows staff
  copy belongs there. S2 instead wrote its staff-voice sentences (staffLockedText, ADDRESS_REMOVED_STAFF, NO_DELIVERY_PAUSED/SUSPENDED/CANCELLED, NEVER_RECORDED,
  NOT_CANCELLED, SUSPENDED_NO_ORDERS, unpaidInARow, unpaidShort, page titles and intros) in a component-local module, and disclosed it (slice report §6). It is acceptable for
  this slice: S0's file was not copied, no S0 sentence is duplicated or contradicted, every string is used only by S2, and the dates are server fields formatted by S0's
  dates.ts. It must not spread. S3's CustomerSubscriptionsPanel (§11.4.3) needs the same staff "next delivery or status sentence", and S3 would otherwise duplicate these
  strings or import a component module across areas. Fix: before S3 branches, the integrator hoists the reusable sentences (NO_DELIVERY_*, staffLockedText,
  ADDRESS_REMOVED_STAFF, NEVER_RECORDED, NOT_CANCELLED, SUSPENDED_NO_ORDERS, unpaidInARow/unpaidShort) into lib/subscriptions/copy.ts under an Amended row, and
  staffCopy.ts re-exports them or keeps only the S2 page titles and intros.
- [LOW] web/components/staff-subscriptions/UnpaidSubscriptionCard.tsx:55 — ADR-FE-112 formats instants with the view's commerceTimeZoneId, but UnpaidSubscriptionViewModel
  has none (SubscriptionViewModels.cs:81-88), so pay-by is formatted in DEFAULT_BRANCH_TIME_ZONE ('Asia/Dhaka'). The server's commerce zone is the main branch's editable
  TimeZoneId (CommerceClock.cs:20), so the two can diverge. The zone is always named, so the time shown is correct for the zone it names and nothing is misleading. This is a
  backend gap, and the slice reported it (§7.2). Fix: the integrator records it as a BG-S row (add commerceTimeZoneId to the unpaid view); no frontend change now.
- [LOW] web/components/staff-subscriptions/StaffSubscriptionDialogs.tsx:35, 45, 65, 78-79 — The dialog descriptions and result sentences ("The subscription becomes active
  again…", "Restarted.", "No more orders will be placed. {customer} is told.", "Subscription cancelled.", "Cancellation scheduled.") are inline. Slice report §6 says S2's
  sentences are all in staffCopy.ts. Also, staffCopy.ts:13 (STAFF_UNPAID_INTRO) restates S0's STAFF_ACTIONS_ROLE_NOTE in different words. The "is told" claims are true
  (the handlers enqueue notifications). Fix: move them with the MEDIUM hoist, and reuse STAFF_ACTIONS_ROLE_NOTE in the intro.
- [LOW] web/mocks/handlers/subscriptions/staff.ts:274, 282, 293, 321 / :300 / :209-216 — Three mock edges where the mock and the server differ. None can be reached from the
  UI, which sends GUIDs, a non-blank reason and always a body. (1) The role check runs before the non-GUID 404. On the server a non-GUID segment matches no `{id:guid}` route,
  so the answer is 404 for every role; the mock gives 403 to a role without the action. (2) A blank reinstate reason gets S0's sentence "Give a reason for restarting this
  subscription.". The validator at SubscriptionCommandValidators.cs:104 sets only the error code, not a message, so the real API probably sends FluentValidation's default
  "'Reason' must not be empty.". The aggregate's sentence (SubscriptionAggregate.cs:261-262) is reached only past the validator. (3) A missing or unreadable body is treated
  as `{}`, but the server's non-nullable [FromBody] gives a framework 400. Fix: for (1), resolve the id before the role check. For (2), the TEST gate or the real-API run
  confirms the server's text and the mock copies it. (3) is optional.

FOR THE TEST GATE (runtime, not observable here)
- U33/U34 and the S2 component tests; the four e2e specs on both projects at <= 2 workers. subscriptions-staff-real-api.spec.ts was NOT run against a real API (slice report §8).
  Confirm the blank-reason message on the real API (LOW above).
- §20.3: the new Sales link must not move a Tab or link count in run-only staff-shell-*, staff-auth, staff-customers. The slice saw only baseline failures
  (staff-shell-toggle :29, staff-shell-sheet-closes-on-back-navigation :30), and they fail with the link removed too. Re-check with Amended (h)'s icon in place.

SCOPE CHECK
- files in allowed scope: 37/37
  (S2 block: lib/hooks/useStaffSubscriptions.ts; app/(staff)/staff/subscriptions/{page,unpaid/page,[subscriptionId]/page}.tsx; components/staff-subscriptions/** (16 files);
  nav/areas/subscriptions.ts (one staff item); components/common/staff-nav-groups.ts (one Sales entry); mocks/handlers/subscriptions/staff.ts;
  tests/components/staff-subscriptions/** (5 files); tests/unit/staff-nav-groups.test.ts (one appended case, nothing changed above it); tests/e2e/subscriptions-staff{,-360,-a11y,-real-api}.spec.ts;
  docs/test-cases/TC-HO-P6-SUBSCRIPTIONS-S2.md; docs/gates/HO-P6-SUBSCRIPTIONS-S2-SLICE-REPORT.md.
  Authorised by an Amended row: components/common/staff-shell.tsx (Repeat import + `repeat: Repeat` only, Amended (h)); docs/handover/HO-P6-SUBSCRIPTIONS.md (the Amended (h) row,
  appended after (g), integrator's Integration-block entry).)
- files outside allowed scope: none
- forbidden scope (§14) touched: none (no src/, lib/subscriptions/**, lib/api/**, store.ts, schedule.ts, touchpoints.ts, guards, configs). New npm dependencies: none.

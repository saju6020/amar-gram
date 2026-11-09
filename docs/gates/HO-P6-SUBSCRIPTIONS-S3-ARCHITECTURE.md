GATE: ARCHITECTURE
HANDOVER: HO-P6-SUBSCRIPTIONS (slice S3, back-office subscription touch points)
COMMITS: 5339543, 34f6ea4, 8cee347, b85ae6e, 52404ee (range 16a07b3..52404ee, branch feat/p6-s3-backoffice; base 16a07b3 = feat/phase2-catalogue-theme with S0, S1 and S2 merged)
DATE: 2026-11-09
STATUS: PASS

Reviewed against: docs/handover/HO-P6-SUBSCRIPTIONS.md (Contract inventory, §1 Amended (a)-(l), §3.1, §3.2, §4.3, §6, §8.1-§8.6, §9 ADR-FE-110/112/185/194/197,
§11.4.1-§11.4.6, §12, §13 S3 block and its file splits, §14, §16 E13-E15, §18 A15-A21, §19, §20.1-§20.6); docs/gates/HO-P6-SUBSCRIPTIONS-S3-SLICE-REPORT.md;
docs/gates/HO-P6-SUBSCRIPTIONS-S2-ARCHITECTURE.md (format and the S2 mock precedent); .ai/architecture.md, .ai/cqrs.md, .ai/read-side-pattern.md, .ai/bounded-contexts.md,
.ai/enumeration-pattern.md, .ai/decisions/adr.md (ADR-341); web/eslint.config.mjs. S3 changes no backend file, so the backend docs bind only what the browser may read,
send and compute. The mocks and the lib types were checked against src/ on this branch: StaffSubscriptionsController.cs:50-58 (T3) and :146-166 (T9, the separate
StaffCustomerSubscriptionsController with `{customerId:guid}`), SubscriptionStaffQueryHandlers.cs:185-218 (T9 live = non-cancelled, ordered NextDeliveryOn-null last, then
date, then Id; suspended counted within live; T3 count = Active with NextDeliveryOn = tomorrow), StaffProductDetailViewModel.cs:63 (`bool IsSubscribable = false`, always
sent), StaffProductRequests.cs:32-33 (`bool? IsSubscribable`, omitted leaves it), UpdateProductDetailsCommandHandler.cs:62 (`SetSubscribable` only when a value is sent).

ARCHITECTURE CHECK
- Layering (§8.2): the only new `useQuery` is in lib/hooks/useSubscriptionSummaries.ts; it calls S0's getSubscriptionsDueTomorrow / getCustomerSubscriptionSummary
  (lib/api/staff-subscriptions.ts:179, :229) and uses S0's staffSubscriptionKeys.dueTomorrow / .customer (keys.ts:57, :59), so the ADR-FE-194 prefix invalidation from S2's
  reinstate/cancel reaches both. No fetch or apiFetch outside lib/api. components/customer/CustomerProfile.tsx stays hook-free (imports: react, next/link, back-office
  primitives, a type, CustomerDetail); the T9 read happens in CustomerProfileView and the panel is passed through the new optional slot, exactly as §8.2 prescribes.
  CustomerSubscriptionsPanel is hook-free and lives in the new components/back-office-subscriptions/.
- Owning endpoints (bounded contexts): the dashboard reads T3, the customer tab reads T9, the product flag goes through Shop's own P1/P2 details read and PUT. No N-read
  join; the counts line and the tab label show the server's `suspendedCount`, `cancelledCount` and `live.length` as sent.
- ADR-FE-197 degrade-silently: a 403 resolves to `null` in both hooks; `null` hides the tab (CustomerProfileView passes no panel) and both dashboard rows; refusals (403,
  404) are never retried. The panel is absent only when all three sources are refused; "Checking…" and the existing muted failure line take the third query into account,
  as §11.4.4 requires. No polling (UI-5): refetch on mount and window focus only.
- Server owns the schedule (ADR-FE-110, §4.3): the panel's next-delivery line is nextDeliveryLabel(server date) or a sentence chosen from the server's `status`; no date
  is parsed, compared or computed. No new Date, Date.now, date-fns, addDays, Number( or money arithmetic in any S3 source file (grep). Labels and the S0 sentences
  NO_DELIVERY_PAUSED/SUSPENDED/CANCELLED/SCHEDULED, nextDeliveryLabel, quantityAndIntervalLabel, subscriptionPaymentMethodLabel are imported from lib/subscriptions,
  not copied.
- Product flag (§11.4.1-§11.4.2): `isSubscribable` is added to the staff detail and the details request with view-model/request citations; the editor sends the boolean it
  shows in the same PUT as `expectedVersion`. The optional typing on StaffProductDetail is authorised by Amended (l)(2) and documented in the type comment.
- Status pill: imported from components/staff-subscriptions/SubscriptionStatusPill (import only, props fit: `status`), the duplicate removed, per Amended (l)(4).
  CustomerProfile's second optional prop `subscriptionsCount` is Amended (l)(5). The Channel select's `min-h-11` is Amended (l)(3).
- Orders (§11.4.5): only the blank option's text, the new Subscription option, the doc comment and the Amended (l)(3) class change; the URL and list plumbing already
  carried `channel`.
- Dashboard hrefs `/staff/subscriptions?status=Active|Suspended` use S2's URL filter field `status` (StaffSubscriptionFilters.tsx:17) with server enum display names.

MOCK vs SERVER
- touchpoints.ts T3: 403 outside View using S2's exported MOCK_VIEW_ROLES (staff.ts:41, equal to ActionRoles.Subscriptions.cs:12-14); body from S0's dueTomorrowOf
  (store.ts:540-549), whose filters match the T3 handler line for line; `Cache-Control: no-store` as the controller sets. S2's T5 handler hands `due-tomorrow` on
  (staff.ts:199-204), and the aggregator orders staff before touchpoints, so the route resolves to T3.
- touchpoints.ts T9: non-GUID → 404 with no body (no route), unknown customer → 200 empty; customerSummaryOf (store.ts:552-567) orders live as the server does and counts
  suspended within live, cancelled over all. No-store header as the controller.
- shop/staff.ts: the detail always sends `isSubscribable`; the PUT sets it only for a boolean, leaves it for omitted/null, and answers an object-shaped 400 for a
  non-boolean before the 404 and version check (model binding precedes the action). S3 did not edit S0's store.ts, fixtures.ts or S2's staff.ts.

FINDINGS
- [LOW] web/mocks/handlers/subscriptions/touchpoints.ts:43-45 — The role check runs before the non-GUID 404. On the server a non-GUID `customerId` matches no
  `{customerId:guid}` route (StaffSubscriptionsController.cs:150), so every role gets 404; the mock gives 403 to a role without View. Same edge as S2's LOW (1); not
  reachable from the UI, which passes the customer's GUID. Fix: test `isGuid` before `cannotView`.
- [LOW] web/mocks/handlers/shop/staff.ts:103-113 — The binding-error body is a plausible ProblemDetails, not the one System.Text.Json produces: the real API keys the
  error `$.isSubscribable` with "The JSON value could not be converted to System.Nullable`1[System.Boolean]…" and usually adds a `request` "field is required" entry.
  The shape class (object-shaped `errors`, 400, nothing changed) is right, so the client path is the same; the UI never sends a non-boolean. Fix: the TEST gate or the
  real-API run confirms the server's text and the mock copies it; the slice report (§5) already says there is no server line to cite.
- [LOW] web/components/staff-shop/ProductDetailsForm.tsx:37-39, web/components/back-office-subscriptions/CustomerSubscriptionsPanel.tsx:16-20,
  web/components/back-office-overview/DashboardAttention.tsx:88, :97 — Staff-facing subscription strings (the OQ-18 help text, "No current subscriptions.", the counts
  line, the two dashboard row texts) are local, while §8.6 makes lib/subscriptions/copy.ts the one copy module and Amended (i)/(k) hoisted S1's and S2's wording there.
  Each string is single-use, §11.4.2/§11.4.4 name the file that carries it, no S0 sentence is duplicated or contradicted, and the slice report (§7.5) discloses it and
  notes that no Amended row lets S3 edit copy.ts. Self-contained, so LOW rather than S2's MEDIUM. Fix (optional): the integrator may hoist them under an Amended row; the
  CODE_REVIEW gate owns the copy question.
- [LOW] web/tests/components/back-office-overview/overview-customers.test.tsx:50-67 — §13 allows "supersede :148-170 (Subscriptions part) only"; the SUMMARY_VIEW fixture
  sits outside that range at file scope. It is used only by the superseded case and changes no other assertion, so it is part of the authorised supersession, not
  scope creep. Recorded so ACCEPTANCE's A19 diff check does not trip on it. No fix needed.

No BLOCKER, HIGH or MEDIUM findings. The handover's §6 is complete for a frontend slice. The stale .ai/templates/*.cs are not relevant to a web-only diff.

FOR THE TEST GATE (runtime, not observable here)
- U35-U40 and the S3 component tests; E13/E14 on chromium and mobile-360 at <= 2 workers on a fresh `next dev` with E2E_KEEP_ROUTES=1; the E15 run-only set unchanged.
  The slice ran them (142 passed) but nothing has verified that independently.
- tsc and lint with the optional `isSubscribable` (run-only staff-shop.test.tsx:47 must still compile), and two-step-save.test.tsx green.
- §20.3: the new "Subscriptions (n)" tab between Orders and Billing must not move a Tab count in run-only staff-customers / customers-admin-* specs.
- Confirm the real API's non-boolean `isSubscribable` 400 text (LOW above) when a real API is available.

SCOPE CHECK
- files in allowed scope: 25/25
  (S3 block: lib/hooks/useSubscriptionSummaries.ts; lib/api/staff-shop.ts (isSubscribable fields + comment); app/(staff)/staff/shop/products/[productId]/page.tsx (one
  line); components/staff-shop/ProductDetailsForm.tsx (the checkbox, its schema/default and help text); components/customer/CustomerProfile.tsx (slot, tab, doc comment);
  components/back-office-overview/CustomerProfileView.tsx (mount only); components/back-office-overview/DashboardAttention.tsx (two rows + absence rule);
  components/orders/StaffOrderQueue.tsx (options, doc comment, and `min-h-11` under Amended (l)(3)); components/back-office-subscriptions/CustomerSubscriptionsPanel.tsx;
  mocks/handlers/subscriptions/touchpoints.ts; mocks/handlers/shop/staff.ts (isSubscribable on detail and PUT); tests/components/back-office-subscriptions/** (6 files);
  tests/components/staff-shop/products-p5.test.tsx (U30 supersession); tests/components/back-office-overview/overview-customers.test.tsx (Subscriptions supersession);
  tests/e2e/subscriptions-backoffice{,-360}.spec.ts; docs/test-cases/TC-HO-P6-SUBSCRIPTIONS-S3.md; docs/gates/HO-P6-SUBSCRIPTIONS-S3-SLICE-REPORT.md.
  Authorised by an Amended row: tests/components/back-office-overview/overview-dashboard.test.tsx (one case, Amended (l)(1)); docs/handover/HO-P6-SUBSCRIPTIONS.md (the
  Amended (l) row only, appended after (k), the integrator's Integration-block entry, commit b85ae6e).)
- files outside allowed scope: none
- forbidden scope (§14) touched: none (no src/, .ai/, config, package or lock file, lib/subscriptions/**, lib/api/{subscriptions,staff-subscriptions,client,errors}.ts,
  S0's mock store/schedule/fixtures, S2's staff.ts or components/staff-subscriptions/** (imported only), components/back-office/**, components/ui/**, guards,
  app/(staff)/staff/page.tsx). New npm dependencies: none.

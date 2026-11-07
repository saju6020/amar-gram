GATE: SECURITY
HANDOVER: HO-P6-SUBSCRIPTIONS (slice S2, staff subscription screens)
COMMITS: 520fdb5, 7182aeb, 7f7e014, d2166a4, 038303a (range f55ea58..038303a)
DATE: 2026-11-07
STATUS: PASS

FINDINGS
- [LOW] web/components/staff-subscriptions/CycleHistory.tsx:48, UnpaidSubscriptionCard.tsx:35 and :47,
  SubscriptionRowCells.tsx:18, StaffSubscriptionsList.tsx:110: the order, customer and subscription links
  put server ids into the path as they are (`/staff/orders/${c.orderId}` and the others), without
  `encodeURIComponent`. This cannot be exploited. The ids are server `Guid`s, every href starts with the fixed
  same-origin prefix `/staff/...`, so it cannot become a cross-origin or `javascript:` URL, and the target pages
  check `isGuid` and the server checks authorization again. It does follow the existing convention
  (DashboardLatestOrders.tsx:39, StaffAccountTable.tsx:106, BillingHome.tsx:90). Fix (defence in depth,
  optional): wrap each id in `encodeURIComponent(...)`. This does not block the slice.

Checked:
- Role gating against src/Shared/AmarGram.Shared/Common/Constants/ActionRoles.Subscriptions.cs:12-14. The UI arrays
  (lib/api/staff-subscriptions.ts:26-42, unchanged in S2) and the mock arrays (mocks/handlers/subscriptions/staff.ts:41-43)
  match exactly: View = Reception, Inventory, ShopManager, Accountant, Administrator; Manage = ShopManager,
  Administrator; Export = ShopManager, Accountant, Administrator. `useCanManageSubscriptions` and
  `useCanExportSubscriptions` (useStaffSubscriptions.ts) fail closed while the session is unknown. The UI never
  relies on hiding a control alone:
  - the list, unpaid and detail screens turn a 403 into `AccessRefusedState`, which is `PermissionDeniedState`
    unless the 403 is a branch-assignment refusal (StaffSubscriptionsList.tsx:87, UnpaidSubscriptionsScreen.tsx,
    StaffSubscriptionDetailScreen.tsx:52);
  - a 403 on reinstate or cancel closes the dialog and puts `PermissionDeniedState` in place of the actions
    (StaffActionDialog.tsx:76-79, StaffActions.tsx);
  - a 403 on export is shown as a fixed sentence (ExportCsvButton.tsx);
  - 403 and 404 are not retried.
  The nav item is restricted to `SUBSCRIPTION_VIEW_ROLES` (nav/areas/subscriptions.ts). The staff-nav-groups entry
  has no role limit, but all five staff roles hold View, so it shows the link to no one who would be refused.
- CSV export: the client never builds CSV. `useExportSubscriptions` calls the existing `downloadBillingFile` with
  `subscriptionsCsvPath(filters)`. That path is a constant base plus a query from `URLSearchParams`; paging is
  stripped (S0-reviewed). It uses the same-origin `xhrRequest` with credentials, and the browser saves it as a blob
  with no preview. Formula-injection quoting is done on the server; the mock mirrors `InventoryCsv.Cell` (staff.ts:186-191).
- URL-driven filters: status, suspensionReason and paymentMethod are taken from the address only if they are in
  the known enum lists (StaffSubscriptionsList.tsx:39-40). Any other value is dropped and not sent. `q` and `sort`
  travel only as query values encoded by `URLSearchParams`. The server ignores an unknown sort. The page number is
  coerced to an integer of at least 1. Nothing reads a URL parameter as a navigation target, so there is no open
  redirect. The diff has no `router.push` and no `window.location`.
- PII: customer name and mobile appear only on screens gated by View, which is the set the server returns them to.
  The added web code has no `console.*`, `localStorage` or `sessionStorage` use, and the React Query cache is not
  persisted.
- Dialog input: reason/note is required and at most 500 characters (StaffActionDialog.tsx:19, :66-67), which matches
  `SubscriptionRules.MaxNoteLength`, and the server validates again (the mock mirrors it at staff.ts:300-302 and
  :324-327). The body sends only the explicit fields `{ reason, firstDeliveryOn? }` and `{ note }`. Server text
  (reinstatement reason, cancellation note, errorMessage) is shown only as React text. There is no
  `dangerouslySetInnerHTML`, `innerHTML`, `eval` or `new Function`.
- Detail route: the `subscriptionId` path segment is checked with `isGuid` before any request is made
  (StaffSubscriptionDetailScreen.tsx:46-50). API path segments are encoded in the S0 client.
- Mocks are dev-only. Nothing in app, components or lib imports `mocks/`; only lib/dev/mock-worker.ts loads
  `@/mocks/browser`, behind NODE_ENV=development and NEXT_PUBLIC_USE_MOCKS=true. The mock role check lets a request
  through when it has no modelled session, the same as the other mocks. That is a test-fixture behaviour and not a
  production path.
- Dependencies: web/package.json and the lockfile are unchanged. The diff adds no secrets, keys or tokens.

SCOPE CHECK
- files in allowed scope: 37/37 (S2 app routes, components/staff-subscriptions/*, useStaffSubscriptions hook, staff mock
  handlers, nav area, staff-nav-groups entry, staff-shell icon per Amended (h), tests, gate/test-case/handover docs)
- files outside allowed scope: none (staff-shell.tsx is authorised by Amended (h))

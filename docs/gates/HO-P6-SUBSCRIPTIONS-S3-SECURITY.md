GATE: SECURITY
HANDOVER: HO-P6-SUBSCRIPTIONS (slice S3, back-office subscription touch points)
COMMITS: 5339543, 34f6ea4, 8cee347, b85ae6e, 52404ee (range 16a07b3..52404ee)
DATE: 2026-11-09
STATUS: PASS

FINDINGS
- none. Nothing in this range can be exploited, and no defence-in-depth gap is worth recording.

Checked:
- Role checks in the mocks match the server.
  - T3 `GET api/staff/subscriptions/due-tomorrow` is gated by `[RequireAction(Actions.Subscriptions.View)]`
    (src/Api/AmarGram.Api/Controllers/StaffSubscriptionsController.cs:52-53).
  - T9 `GET api/staff/customers/{customerId:guid}/subscriptions` is gated the same way
    (StaffSubscriptionsController.cs:153, :157).
  - The View roles are Reception, Inventory, ShopManager, Accountant and Administrator
    (src/Shared/AmarGram.Shared/Common/Constants/ActionRoles.Subscriptions.cs:12).
  - web/mocks/handlers/subscriptions/touchpoints.ts:23-26 (`cannotView`) uses `MOCK_VIEW_ROLES`
    (mocks/handlers/subscriptions/staff.ts:41), which is the same five roles.
  - The product PUT stays under `[RequireAction(Actions.Shop.ProductsManage)]` (StaffProductsController.cs:91-92;
    ShopManager and Administrator per ActionRoles.Shop.cs:14). The new `isSubscribable` field goes through that
    existing gate. The server sets it only when it is non-null (UpdateProductDetailsCommandHandler.cs:62;
    `bool? IsSubscribable` at StaffProductRequests.cs:32-33). The product mock does not model roles; that is the
    pre-existing HO-ADM-002 precedent, and S3 does not change it. The mock's 400 for a non-boolean value matches
    ASP.NET model binding.
  - A request with no modelled session passes the mock, the same as every other mock. This is test-fixture
    behaviour, not a production path.
  - Fidelity note, not a security issue: when the role is refused and the id is not a GUID, the T9 mock answers 403.
    The server answers 404 in that case, because the `:guid` route constraint fails before the action filter runs.
    The UI treats both answers as "no tab", so nothing leaks either way.
- A 403 hides the UI and leaks nothing.
  - useSubscriptionSummaries.ts turns `ApiForbiddenError` into `null` and does not retry 403 or 404.
  - CustomerProfileView passes `subscriptionsPanel` only when the data is truthy, so on 403 or any failure the tab
    and its count are absent (CustomerProfile.tsx tab list).
  - DashboardAttention drops both subscription rows when `data === null`. On a non-403 failure it shows the existing
    generic sentence, with no server text and no error detail.
  - No server error message is rendered anywhere in S3.
- URL and id encoding.
  - The T9 client encodes `customerId` (lib/api/staff-subscriptions.ts:232).
  - The tab rows link to `/staff/subscriptions/${encodeURIComponent(view.id)}`
    (CustomerSubscriptionsPanel.tsx), which resolves S2's LOW for the new code.
  - The dashboard row hrefs are constant same-origin strings (`/staff/subscriptions?status=Active|Suspended`). S2's
    list accepts `status` only from its known enum.
  - Every server string (product name, variant label) is rendered as React text. There is no
    `dangerouslySetInnerHTML`, `innerHTML` or `eval`.
- Channel filter: the change only adds a fixed `<option value="Subscription">`.
  - The query is built with `URLSearchParams` (lib/api/staff-orders.ts:189), so a value taken from the address bar
    travels only as an encoded query value.
  - The server parses `channel` with `EnumQueryParameter.TryParse<OrderChannel>` and returns 400 for anything else
    (StaffOrdersController.cs:126, :149).
  - Nothing navigates to a target read from the URL, so there is no open redirect.
- PII.
  - T3 carries only counts and a date. T9 carries product, terms and status, and goes only to View roles, which is
    the set the server answers.
  - The added code has no `console.*`, `localStorage` or `sessionStorage`, and no persisted React Query cache.
  - The diff adds no secrets, tokens or keys.
- The test-only seam `setMockTouchpointRoles` cannot be reached in production.
  - It is defined only in web/mocks/handlers/subscriptions/touchpoints.ts:18. It is referenced only from mocks/ and
    tests/ (customer-tab, dashboard-rows and mock-refusals tests). It is not attached to `window`.
  - Nothing in app/, components/ or lib/ imports `mocks/` except lib/dev/mock-worker.ts. That file dynamically
    imports `@/mocks/browser` only when NODE_ENV=development and NEXT_PUBLIC_USE_MOCKS=true (mock-worker.ts:16-22),
    so the import never reaches a production bundle.
  - Even if the seam were somehow called, it changes only mock responses. The real server enforces roles
    independently.
- Dependencies: web/package.json and the lockfile are unchanged, and there is no `src/` change.

SCOPE CHECK
- files in allowed scope: 25/25 (product editor page/form and staff-shop.ts type, CustomerProfile/CustomerProfileView,
  DashboardAttention, new back-office-subscriptions panel, useSubscriptionSummaries hook, StaffOrderQueue channel option,
  shop/staff and subscriptions/touchpoints mocks, tests, e2e specs, gate/test-case/handover docs)
- files outside allowed scope: none

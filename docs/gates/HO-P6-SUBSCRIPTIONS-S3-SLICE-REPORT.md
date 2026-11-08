# HO-P6 S3 (subscriptions: back-office touch points) - slice report (§17.3)

Branch `feat/p6-s3-backoffice` from `16a07b3` (`feat/phase2-catalogue-theme` with S0, S1 and S2 merged). Worktree `D:\my-repo\amar-gram\.claude\worktrees\p6-s3`. Not pushed, not merged. Commits: `5339543` (code), `34f6ea4` (tests), and the commit that adds this report and the test-case sheet.

## 1. Files touched (paths under `web/` unless they start with `docs/`)

Every file is inside S3's §13 block. Nothing else was edited.

- `lib/hooks/useSubscriptionSummaries.ts` (new): `useSubscriptionsDueTomorrow()` (T3), `useCustomerSubscriptionSummary(customerId)` (T9).
- `lib/api/staff-shop.ts`: `StaffProductDetail.isSubscribable`, `UpdateProductDetailsRequest.isSubscribable?`; the "deliberately NOT here" comment replaced.
- `app/(staff)/staff/shop/products/[productId]/page.tsx`: sends `isSubscribable: values.isSubscribable` in the same `PUT`.
- `components/staff-shop/ProductDetailsForm.tsx`: the "Can be subscribed to" checkbox and its help text.
- `components/customer/CustomerProfile.tsx`: `subscriptionsPanel` slot, `subscriptionsCount`, the tab after Orders, doc comment.
- `components/back-office-overview/CustomerProfileView.tsx`: mounts the panel when T9 succeeded.
- `components/back-office-overview/DashboardAttention.tsx`: two rows from T3 and the third source in the absence rule.
- `components/orders/StaffOrderQueue.tsx`: Channel select options and doc comment (and `className="min-h-11"` on that select, see section 7, item 3).
- `components/back-office-subscriptions/{CustomerSubscriptionsPanel,SubscriptionStatusBadge}.tsx` (new).
- `mocks/handlers/subscriptions/touchpoints.ts` (was S0's empty stub): T3, T9, `setMockTouchpointRoles` test seam.
- `mocks/handlers/shop/staff.ts`: `isSubscribable` on the detail and the details `PUT`.
- Tests: `tests/components/back-office-subscriptions/{product-editor.test.tsx,customer-tab.test.tsx,dashboard-rows.test.tsx,orders-channel.test.tsx,mock-refusals.test.ts,no-literals.test.ts}` (new); `tests/components/staff-shop/products-p5.test.tsx` and `tests/components/back-office-overview/overview-customers.test.tsx` (the named supersessions); `tests/e2e/subscriptions-backoffice.spec.ts`, `tests/e2e/subscriptions-backoffice-360.spec.ts` (new; axe included).
- Docs: `docs/test-cases/TC-HO-P6-SUBSCRIPTIONS-S3.md`, this report.

No `src/`, config, dependency, lockfile, token or `globals.css` change. `lib/subscriptions/**`, `lib/api/*subscriptions.ts`, `mocks/handlers/subscriptions/{store,staff,...}.ts` and `components/staff-subscriptions/**` were only imported, never edited or copied. No real-API spec was written (the handover asks for none for S3).

## 2. Superseded assertions (old to new)

| File | Old | New |
|---|---|---|
| `tests/components/staff-shop/products-p5.test.tsx` U30 (`:243-262`) | title "...and never sends isSubscribable"; `expect(body).not.toHaveProperty('isSubscribable')` | title "...and sends exactly the shown isSubscribable value"; the "Can be subscribed to" checkbox is checked (the seeded oats product is subscribable) and `expect(body).toHaveProperty('isSubscribable', true)`. The district and `expectedVersion` assertions are unchanged |
| `tests/components/back-office-overview/overview-customers.test.tsx` (`:148-175`, Subscriptions part only) | tabs equal `['Orders', 'Billing', 'Notes (2)']`; `queryByRole('tab', { name: /Subscriptions/ })` absent | tabs equal `['Orders', 'Subscriptions (1)', 'Billing', 'Notes (2)']` with T9 stubbed to one live subscription (the id `c1` is not a GUID, so the default mock would 404). "No Subscriber" assertion unchanged. Stronger: the order, the label with the server's count |

## 3. What was built, per §11.4 row

| Row | Built |
|---|---|
| 11.4.1 lib | `isSubscribable` on the staff detail type and the details request (cited to `StaffProductDetailViewModel.cs:63` and `StaffProductRequests.cs:32-33`). Both hooks: a 403 resolves to `null`, a refusal is never retried, refetch on mount and window focus, no polling. Key names come from S0's `staffSubscriptionKeys` (`dueTomorrow`, `customer`) |
| 11.4.2 editor | A 44 px label "Can be subscribed to" after "Listed in shop" in the Organise card, the OQ-18 help text as its accessible description, default from the product. The page sends the boolean in the same `PUT` as `expectedVersion`. The `two-step-save` tests stay green |
| 11.4.3 customers | Tab "Subscriptions (n)" second (after Orders), offered only when the host passes the panel. `CustomerProfileView` passes it only when T9 succeeded (403 or failure: no tab, no banner). The panel lists each live subscription as a card link to `/staff/subscriptions/{id}` (product · variant, status word with icon, "{qty} × every {n} weeks", next delivery or why none, payment method), then "{suspended} suspended · {cancelled} cancelled" as text; empty: "No current subscriptions." The "Subscriber" filter is not built (BG-S2, OQ-10) |
| 11.4.4 dashboard | "Subscription orders due tomorrow" (neutral, `Repeat`, `count`, `/staff/subscriptions?status=Active`) and "Subscriptions suspended" (warning, `suspendedCount`, `?status=Suspended`), each only above zero, after the existing rows. T3 resolving to `null` counts as refused; the panel is absent only when all three are refused; "Checking…" and the failure line cover the third query |
| 11.4.5 orders | The Channel select reads "Any channel", "Online", "Counter", "Subscription". The URL, list and `status-counts` plumbing already carried `channel` |
| 11.4.6 mocks | `touchpoints.ts` (T3, T9) and the shop staff mock (section 5) |

## 4. OQ defaults built to

- OQ-10: no "Subscriber" filter (BG-S2).
- OQ-11: a Channel select option, no extra pill; the blank option is "Any channel".
- OQ-12: both dashboard rows, each only above zero.
- OQ-18: the checkbox wording and help text, verbatim.
- OQ-1, OQ-3, OQ-8, OQ-9 are other slices'. A21's omissions that touch S3 (the "Subscriber" filter) are recorded as not built.

## 5. Mock refusals and rules added, with the server file:line mirrored

| Mock behaviour | Server |
|---|---|
| T3 and T9 answer 403 for roles outside View (Reception, Inventory, ShopManager, Accountant, Administrator); a request with no modelled staff session passes | `StaffSubscriptionsController.cs:53` (T3), `:157` (T9); roles `ActionRoles.Subscriptions.cs:12-14` |
| T3 body `{ dueOn, count, liveCount, suspendedCount, commerceTimeZoneId }`, `Cache-Control: no-store` | `:51-58`, `SubscriptionStaffQueryHandlers.cs:204-218` |
| T9 body `{ live, cancelledCount, suspendedCount }`, live = every non-cancelled one, Suspended included; an unknown customer is 200 with none | `:149-165`, `SubscriptionStaffQueryHandlers.cs:186-200` |
| T9 with a customer id that is not a GUID is a 404 (no route) | `[Route("api/staff/customers/{customerId:guid}/subscriptions")]`, `:150` |
| The staff product detail always sends `isSubscribable` | `StaffProductDetailViewModel.cs:63` |
| Details `PUT`: `isSubscribable` omitted or `null` leaves the flag; a boolean sets it | `StaffProductRequests.cs:32-33`, `UpdateProductDetailsCommandHandler.cs:62` |
| Details `PUT`: a value that is not a boolean is the framework's object-shaped 400, checked before the version check and the command (model binding) and changing nothing | ASP.NET `[ApiController]` model binding for `bool?` (no server line) |
| C1's `subscribable` follows the flag at once (both read the same product object) | `SubscriptionCustomerQueryHandlers.cs:86` |

The T3/T9 roles use S2's exported `MOCK_VIEW_ROLES` (pinned equal to the web array in `mock-refusals.test.ts`). S2's role-override seam is private to `staff.ts`, so `touchpoints.ts` has its own `setMockTouchpointRoles` (tests only).

## 6. E2E results per spec (chromium and mobile-360, `--workers=2`, PORT=3130, one `next dev`)

One run of the new specs together with the E15 run-only set: **142 passed, 0 failed, 0 skipped**. No §1 baseline case appeared in this set (none of the baseline specs is in E15).

| Spec | Cases per project | Result |
|---|---|---|
| `subscriptions-backoffice.spec.ts` (E13) | 4 (editor round trip with the customer's offer; customer tab; dashboard row and link; orders channel) | 8 passed |
| `subscriptions-backoffice-360.spec.ts` (E14) | 8 (four screens at 1280 and at 360, axe included) | 16 passed |
| E15 run-only: `shop-staff`, `catalogue-stock-360`, `catalogue-stock-gate-s3`, `staff-customers`, `customers-admin-360`, `customers-admin-gate-s4`, `dashboard-home`, `ordering-staff`, `sales-gate-s2`, `packed-customer-after-staff` | 59 | 118 passed |

Earlier runs in the batch failed for reasons in the specs, not the app (fixed): a missing `NEXT_PUBLIC_API_BASE_URL` (the worktree has no `.env.local`, so the mock worker never started and every sign-in timed out), `ShopManager` has no Customers permission (the customer spec signs in as Administrator), the route announcer's `role="alert"` matched a global alert count (scoped to the form), the orders list is cards below 1024 px (the spec accepts rows or items), and the Channel select was 36 px (section 7, item 3).

## 7. Where the code differs from the document, and things for the owner or integrator

1. **§20.1: one existing test breaks on the handover's own rule, and it is outside S3's block.** `tests/components/back-office-overview/overview-dashboard.test.tsx` "DashboardAttention — U13 > is absent when both areas are refused" refuses the inventory and billing reads and leaves T3 to the default mock, which now answers (the seeded due-tomorrow count is 1 or more), so the panel is present. U37's rule ("absent only when all three sources are refused") makes that expected. Not edited. Fix for the integrator: add `http.get('*/api/staff/subscriptions/due-tomorrow', forbidden)` to that test's `server.use`. The three-way case is proved in `dashboard-rows.test.tsx`. This is the only red test in the folders run (1004 passed, 1 failed).
2. **`StaffProductDetail.isSubscribable` is typed optional** (`isSubscribable?: boolean`), not required as §11.4.1 writes it. The run-only `tests/components/staff-shop/staff-shop.test.tsx:47` builds a whole `StaffProductDetail` by hand and no longer compiles with a required field (§14 forbids editing it). The server always sends it; the editor reads an absent value as `false`. Same pattern as `districtOfOrigin?`.
3. **The orders Channel select carries `className="min-h-11"`.** §13 limits `StaffOrderQueue.tsx` to the option and the comment, but E14 requires 44 px for "the orders More filters with the channel select" and the shared `SelectField` renders 36 px. I raised only the Channel select (one attribute). The other More-filters selects and the two date inputs are 36 to 38 px and are the orders screen's own, so E14's 44 px check on that screen covers the Channel field only. A visual call for the owner.
4. **`SubscriptionStatusBadge` duplicates S2's `SubscriptionStatusPill` look** instead of importing it, because §10.1 says S1, S2 and S3 depend on nothing from each other at build time. If the integrator prefers one pill, the swap is one import.
5. **Staff-facing wording stays local** (no Amended row authorises more in `lib/subscriptions/copy.ts`): the OQ-18 help text (`ProductDetailsForm.tsx`), "No current subscriptions." and the counts line (`CustomerSubscriptionsPanel.tsx`), the dashboard row texts (`DashboardAttention.tsx`). The next-delivery wording reuses `nextDeliveryLabel`, `NO_DELIVERY_PAUSED`, `NO_DELIVERY_SUSPENDED`, `NO_DELIVERY_CANCELLED` and `NO_DELIVERY_SCHEDULED` from S0's copy.
6. **`CustomerProfile` gained a second optional prop, `subscriptionsCount`**, next to the specified `subscriptionsPanel`, so the hook-free component can write "Subscriptions (n)" without reading the panel. Both are inside the file's allowed change.
7. **Tab order:** Orders, Subscriptions, Billing, Notes ("after Orders" in §11.4.3; the design shows Orders, Subscriptions, Notes).
8. **The panel is a list of cards at every width**, not the design's table, so a 360 px screen never scrolls sideways. A visual call.
9. **E13 and the server-rendered product page.** In mock mode the browser's mock store is shared by staff and customer screens, so the offer (a client island reading C1) follows the flag the staff saved. The server-rendered page itself is the node mock's and is unchanged, as the HO-SHP-002 note in `shop-staff.spec.ts` already records. The real-API half belongs to the integration step.
10. **Environment:** the worktree has no `web/.env.local` (gitignored). Runs pass `NEXT_PUBLIC_API_BASE_URL=http://localhost:5005 NEXT_PUBLIC_USE_MOCKS=true E2E_KEEP_ROUTES=1 PORT=3130`.
11. **§20.9** is not exercised here: the touch points link to `/staff/subscriptions/{id}` only, not to orders.

## 8. Vitest totals (`--maxWorkers=2`)

- `tests/components/back-office-subscriptions`: 6 files, 48 tests, all pass (product-editor 5, customer-tab 4, dashboard-rows 9, orders-channel 3, mock-refusals 16, no-literals 11).
- Wider run (`back-office-subscriptions`, `staff-shop`, `back-office-overview`, `back-office-sales`, `orders`, `dashboard`, `customer`, `subscriptions`, `staff-subscriptions`, `tests/unit/subscriptions`, `tests/guards`, the shared `no-hex-literals` and `no-colour-literals`): 61 files, 1005 tests, 1004 passed, 1 failed (item 1 above).
- `tsc --noEmit` and `npm run lint` (`--max-warnings 0`): clean.
- The full suite and `npm run build` belong to the TEST gate and integration; the build was not run here (mocks need `next dev`).

# HO-P6 S2 (subscriptions: staff screens) - slice report (§17.3)

Branch `feat/p6-s2-staff` from `2a61f70` (`feat/p6-s0-contract`, S0 after its ACCEPTANCE run 2). Worktree `D:\my-repo\amar-gram\.claude\worktrees\p6-s2`. Not pushed, not merged. Commits are listed in section 9.

## 1. Files touched (paths under `web/` unless they start with `docs/`)

All inside S2's §13 block; no file outside it was edited.

- Hook: `lib/hooks/useStaffSubscriptions.ts` (new).
- Routes: `app/(staff)/staff/subscriptions/page.tsx`, `app/(staff)/staff/subscriptions/unpaid/page.tsx`, `app/(staff)/staff/subscriptions/[subscriptionId]/page.tsx` (new).
- Components (new, `components/staff-subscriptions/`): `StaffSubscriptionsList`, `StaffSubscriptionFilters`, `StaffSubscriptionsNav`, `ExportCsvButton`, `SubscriptionStatusPill`, `SubscriptionRowCells`, `UnpaidSubscriptionsScreen`, `UnpaidSubscriptionCard`, `StaffSubscriptionDetailScreen`, `DetailPanels`, `DetailPanelsMore`, `CycleHistory`, `StaffActions`, `StaffSubscriptionDialogs`, `StaffActionDialog`, `staffCopy.ts`. Each is under about 150 lines.
- Navigation: `nav/areas/subscriptions.ts` (one staff item), `components/common/staff-nav-groups.ts` (one Sales entry after Customers).
- Mock: `mocks/handlers/subscriptions/staff.ts` (was S0's empty stub; T1, T2, T4, T5, T6, T7, T8).
- Tests: `tests/components/staff-subscriptions/{helpers.tsx,staff-list.test.tsx,unpaid.test.tsx,staff-detail.test.tsx,mock-refusals.test.ts}`, one case appended to `tests/unit/staff-nav-groups.test.ts`, `tests/e2e/subscriptions-staff{,-360,-a11y,-real-api}.spec.ts`.
- Docs: `docs/test-cases/TC-HO-P6-SUBSCRIPTIONS-S2.md`, this report.

No `src/`, config, dependency, lockfile, token or `globals.css` change. T3 and T9 are not touched (`touchpoints.ts` is S3's).

## 2. Superseded assertions (old to new)

None. No existing assertion was changed or weakened. The only edit to an existing test file is one `it` appended to `tests/unit/staff-nav-groups.test.ts` (U33).

## 3. What was built, per §11.3 row

| Row | Built |
|---|---|
| 11.3.1 lib | `useStaffSubscriptions(filters)`, `useUnpaidSubscriptions(page)`, `useStaffSubscription(id)`, `useStaffSubscriptionCycles(id, page)`, `useReinstateSubscription`, `useStaffCancelSubscription` (both invalidate the whole `['staff','subscriptions']` prefix, ADR-FE-194), `useExportSubscriptions` (`downloadBillingFile(subscriptionsCsvPath(filters), 'subscriptions.csv')`), `useCanManageSubscriptions`, `useCanExportSubscriptions`. One addition: `useStaffSubscriptionMoreCycles(id, lastPage)` (T6 pages 2..n joined) for "Show more". No polling. |
| 11.3.2 nav | One item `Subscriptions` (`icon: 'repeat'`, `audience: 'staff'`, `roles: SUBSCRIPTION_VIEW_ROLES`) and one Sales entry after Customers with `match: '/staff/subscriptions'`, so the link is current on Unpaid and on a detail page. |
| 11.3.3 list | `/staff/subscriptions`: header with Export CSV (export roles only), link nav All/Unpaid, search "Customer, mobile or product", Status, Suspension reason (enabled only for Suspended or empty; cleared when the status moves away), Payment method, Sort, Clear filters; all in the address (`useUrlFilterState`); server paging 25. Rows through the billing `ResponsiveTable` (table from 768 px, cards below): Customer (link to the profile), Mobile, Product (row link to the detail), Each delivery, Status (word + icon, reason on a second line), Next delivery (date, or "None while paused/suspended" / "None: cancelled"), Payment, Unpaid in a row, Last order (number + state). 413 is "Too many rows to export. Narrow the filters."; 403 is the permission sentence; a 403 on the list is `AccessRefusedState`. A value in the address the server does not know is dropped, not sent. |
| 11.3.4 unpaid | `/staff/subscriptions/unpaid`: "Suspended" then "At risk" groups from `group` (empty group omitted), each row with customer, product, "{n} unpaid in a row", the unpaid orders (date, order number linking `/staff/orders/{orderId}`, "Pay by … (zone)", state as text) and Open; paged. |
| 11.3.5 detail | `/staff/subscriptions/[id]`: header (product, customer, status pill), status region, suspension note, actions (only from `allowedStaffActions` and `SUBSCRIPTION_MANAGE_ROLES`; other roles see the who-can-act sentence; a 403 replaces the actions with `PermissionDeniedState`), panels Schedule, Terms, Customer, Records (written out, "Never: none recorded", no reinstater id), Estimate (server figures as sent), and Order history (50 + "Show more" via T6). A non-GUID or unknown id is "We couldn't find that subscription." |
| 11.3.6 dialogs | One `StaffActionDialog` with two wrappers. Restart: "Restart {customer}'s subscription to {product}?", reason required and at most 500 with a counter, optional date with no client min/max and the OQ-16 helper. Cancel: "Cancel {customer}'s subscription to {product}?", locked wording chosen only from `isLocked`, note required and at most 500. Server errors land under their field (`reason`, `note`, `firstDeliveryOn`) or in the dialog; typed text is kept; the result sentence names the date the server returned. |
| 11.3.7 mocks | `staff.ts`, section 5. |

## 4. OQ defaults built to

- OQ-13: All and Unpaid only, as a link nav; the sidebar entry sits in Sales after Customers.
- OQ-15: "Restarted on {date}: {reason}" with no "who" (BG-S5); the reinstater's id is never rendered.
- OQ-16: the restart date is optional with no client min/max and the helper "Leave empty to restart from the earliest possible date."; the server's sentence names the range on a refusal (BG-S6).
- OQ-17 (fixed mock settings) is S0's and was used as it is.

## 5. Mock refusals and rules added, with the server file:line mirrored

`StaffSubscriptionsController.cs` unless another file is named. Each is also cited in `mocks/handlers/subscriptions/staff.ts` and proved in `tests/components/staff-subscriptions/mock-refusals.test.ts` (U34).

| Mock behaviour | Server |
|---|---|
| 403 for roles outside View on T1, T2, T5, T6 | `:26, :42, :79, :92`, roles `Shared/Common/Constants/ActionRoles.Subscriptions.cs:12-14` |
| 403 outside Export on T4 | `:62` |
| 403 outside Manage on T7, T8 | `:104, :118` |
| 400 `{ error }` for a bad status, reason or method (list and export), checked before paging; blank is no filter; case-insensitive display names | `:143-145`, `Shared/Common/Enums/EnumerationParsing.cs:20-30` |
| Unknown `sort` is the default, never a 400; the four sorts, NULLs last ascending and first descending | `Read/QueryHandlers/Subscription/SubscriptionStaffQueryHandlers.cs:37-43` |
| `q` over the product name as subscribed, customer name or mobile, case-insensitive | `SubscriptionStaffQueryHandlers.cs:17-34` |
| 400 `InvalidPageSize` (size 0 or less), `InvalidPageNumber` (above 1,000,000); size clamped to 100; default 20 | `Api/Controllers/PagingHelper.cs:31-47`, `SubscriptionCustomerQueryHandlers.cs:15` |
| An unbindable page number or date is the framework's object-shaped 400 | ASP.NET `[ApiController]` model binding (no server line) |
| 413 `{ error }` above `MAX_EXPORT_ROWS` (test override) | `:69` |
| CSV: the 12 columns, every cell quoted, CSV-injection guard | `:71-75`, `Shared/Common/Helpers/InventoryCsv.cs:13-49` |
| 404 with no body for an unknown or non-GUID id on T5, T6, T7, T8 | `:84, :99`, `SubscriptionWorkerCommandHandlers.cs:157`, `SubscriptionCustomerCommandHandlers.cs:211` |
| T7: validator before handler; `ReinstatementReasonRequired` on `Reason`, at most 500 | `App/CommandHandlers/Validators/SubscriptionCommandValidators.cs:99-106` (`:104`) |
| T7: `SkuNotSubscribable` on `SubscriptionId` while the product cannot be bought (only when Suspended) | `SubscriptionWorkerCommandHandlers.cs:160-165` |
| T7: `SubscriptionCannotBeReinstated`, `InvalidFirstDeliveryDate` | `Domain/Aggregates/Subscription/SubscriptionAggregate.cs:256-277` via S0's `reinstateOf` |
| T8: note required (`CancellationReasonRequired` on `Note`), at most 500; reason always `StaffCancelled`; a cancelled one is `InvalidSubscriptionTransition`; after the cut-off the cancel is scheduled | validators `:58-71` (`:63, :69-70`), `:123`, `SubscriptionSchedule.cs` via S0's `cancelOf` |
| T7 and T8 answer the plain `SubscriptionViewModel`, not the staff detail | `:130-134` |

The roles the mock uses are its own arrays (`MOCK_VIEW_ROLES` and the other two), pinned equal to `lib/api/staff-subscriptions.ts` by a test. `reinstatedBy` and `cancelledBy` are the mock admin's staff id (the accounts mock exports no way to read the caller's id; nothing renders it).

## 6. Strings S2 wrote (reuse of S0's wherever S0 had one)

Reused from S0: every label in `lib/subscriptions/labels.ts`, and from `copy.ts` the `reinstateTitle`, `staffCancelTitle`, `staffCancelLockedText`, `REINSTATE_DATE_HELP`, `STAFF_ACTIONS_ROLE_NOTE`, `EXPORT_TOO_MANY_ROWS`, `nextDeliveryLabel`, `cutoffSentence`, `estimateDiscountLabel`, and the error mapper and its sentences. S0's lock and missing-address sentences are in the customer's voice ("Your delivery on …"), so S2 wrote staff versions, all in `components/staff-subscriptions/staffCopy.ts`, for S0 or the integrator to hoist: `staffLockedText` ("The delivery on {date} is already being prepared."), `ADDRESS_REMOVED_STAFF`, `NO_DELIVERY_PAUSED/SUSPENDED/CANCELLED`, `NEVER_RECORDED`, `NOT_CANCELLED`, `SUSPENDED_NO_ORDERS`, `unpaidInARow`, `unpaidShort`, and the page titles and intros. Screen furniture (panel headings, table headers, filter labels, "Show more") is local to the components.

## 7. Where the code differs from the document, and things for the owner or integrator

1. **Sidebar icon (needs a one-line change outside S2's block).** The nav item uses `icon: 'repeat'` as §11.3.2 says, but the staff shell's icon table (`components/common/staff-shell.tsx:335-362`, forbidden to S2) has no `repeat`, so the sidebar shows the fallback `Sprout` icon. Fix: add `repeat: Repeat` there (§20.1: the integrator routes it). Not a blocker; the label and the link work.
2. **The unpaid view has no zone.** `UnpaidSubscriptionViewModel` carries no `commerceTimeZoneId` (`SubscriptionViewModels.cs:81-88`), so a pay-by time on the Unpaid page is shown in the business zone `Asia/Dhaka` (the constant `DEFAULT_BRANCH_TIME_ZONE`) with the zone named. A backend field would remove the assumption.
3. **Inline links are 44 px targets.** The shared `ResponsiveTable` wraps the primary cell in a plain link, so the product cell, the customer link and the order links carry `inline-flex min-h-11` inside the link. Rows are therefore taller than the design's. A visual call for the owner.
4. **Dialogs hide the shared "X".** `StaffActionDialog` passes `hideClose` (like `ConfirmDialog`): the shared close control is 24 px, and each dialog has an explicit "Keep suspended" / "Keep subscription" button and Escape.
5. **A restarted subscription shows "Never: none recorded" under Suspension**, because `suspendedOn` is cleared on reinstate (the mock mirrors `SubscriptionAggregate.cs:256-277`); the Restart row carries the date and the reason.
6. **§20.9 (cross-branch order links).** Order links are kept on the detail and the Unpaid page. The mock's orders are not branch-scoped, so a refusal cannot be shown here; on the real API an order raised at another branch would show the order page's own 404 or 403. Reported as a question for the owner; nothing hides or redirects.
7. **§20.3 (run-only specs).** `staff-shell-*`, `staff-auth` and `staff-customers` were run once (chromium and mobile-360, workers 1). The new sidebar link did not change a Tab or link count anywhere. Section 8 lists the baseline cases that appeared; with the S2 nav edits stashed, `staff-shell-toggle` :29 and `staff-shell-sheet-closes-on-back-navigation` :30 fail at the same lines, so the link is not the cause.
8. The "Subscriptions" list has no unfiltered counts on the All/Unpaid links (the design shows 1,284 and 5): they would need two extra reads and the handover's nav does not ask for them. An omission, not a gap in the server.
9. Cold compile: `staff-auth` :152 timed out once at 45 s on the first visit of the sign-in route and passed when re-run (resource/compile timing, not a result).

## 8. Verification (what was seen)

- `npx tsc --noEmit`: clean. `npm run lint` (`--max-warnings 0`): clean.
- Vitest at `--maxWorkers=2`, only the files S2 touches plus the nav, guard and source-guard files that scan S2's folders: 20 files, 463 tests passed. S2's own: `tests/components/staff-subscriptions` 4 files, 68 tests; `staff-nav-groups` 19 tests (one appended). The full suite is the TEST gate's.
- Playwright (`next dev` on 3129, mocks, `--workers=1`, chromium and mobile-360):
  - `subscriptions-staff.spec.ts`: 24 passed (12 cases x 2).
  - `subscriptions-staff-360.spec.ts`: 16 passed (8 x 2). Includes the sidebar sheet and a 44 px measurement of every control.
  - `subscriptions-staff-a11y.spec.ts`: 36 passed (18 x 2), axe zero serious/critical at 1280 and 360.
  - `subscriptions-staff-real-api.spec.ts`: 10 skipped (no `E2E_REAL_API=1`). NOT RUN against a real API.
  - Run-only `staff-shell-*`, `staff-auth`, `staff-customers`: 52 cases, 45 passed, 7 failed. Baseline cases that failed, by name: `staff-shell-toggle` :29 (360 and 1440, both projects, four cases) and `staff-shell-sheet-closes-on-back-navigation` :30 (both projects). `staff-shell-manual-expand-overflow` :37 (baseline) passed. `staff-auth` :152 (chromium) failed once on a cold-compile timeout and passed alone; it is not a baseline case.
  - `admin-a11y-responsive` and the rest of E12 were not run (TEST gate).
- No tracked screenshot or report was overwritten. The dev server on 3129 was killed; other processes on 3127, 3128 and 5005 were not touched.

## 9. Commits

`303f4fe` staff mock handlers; `c46a5ff` hooks and the nav entry; `520fdb5` the screens, routes and component tests; `7182aeb` the e2e specs; the docs commit that carries this file and the TC sheet follows them. All end "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>".

## 10. BLOCKED

None. Item 1 in section 7 is a one-line need outside the block (§20.1) that does not stop the slice.

## 11. Gate-fix round (ARCHITECTURE, SECURITY, CODE_REVIEW findings)

- Strings hoisted into `lib/subscriptions/copy.ts` under handover Amended (i) (also records BG-S10). `staffCopy.ts` keeps page titles and intros. `staffLockedText` became `staffScheduleLockedText` (the cancel dialog's `staffCancelLockedText` is unchanged). The dialog descriptions and result sentences are now `reinstateDescription`, `reinstatedMessage`, `staffCancelDescription`, `STAFF_CANCELLED_MESSAGE`, `staffCancelScheduledMessage`. The who-can-act sentence is S0's `STAFF_ACTIONS_ROLE_NOTE` only; the Unpaid intro no longer restates it.
- Mock: a non-GUID id is a 404 before the role check on T5-T8. A blank reinstate reason now carries FluentValidation's default text "'Reason' must not be empty." with the code the validator sets (SubscriptionCommandValidators.cs:104 uses `.WithErrorCode` only; the same default is copied by `areas/accounts.ts:2007`, `admin/rosters.ts:384`, `billing/ops.ts:220`). Not confirmed against a live server.
- "Show more" error path: a failed page keeps a "Try again" button (retries only the failed pages), hides "All N entries shown" while errored, keeps the pages already loaded. Test fails page 2 then page 3 and recovers.
- Unpaid `?page=` past the end says so and offers "Go to the first page". The list drops a stale `suspensionReason` unless the status is empty or Suspended. The export refusal is cleared when the filters change. `StaffActions` renders nothing while the session is loading or when no staff action is allowed.
- Ids in link paths are `encodeURIComponent`-ed. The history test now asserts exact row counts (57 cycles, 58 rows) and no repeated date or order number.
- Verification: see TC sheet "Gate-fix round". Hashes of this round are in the hand-back message.

GATE: CODE_REVIEW
HANDOVER: HO-P6-SUBSCRIPTIONS (slice S2, staff subscription screens)
COMMITS: f55ea58..038303a (branch feat/p6-s2-staff; S2 commits 303f4fe..7f7e014 plus the integrator icon fix 038303a)
DATE: 2026-11-07
STATUS: PASS

FINDINGS
- [MEDIUM] web/components/staff-subscriptions/CycleHistory.tsx:34-38 (`mayHaveMore`) — when "Show more" fails (T6 page n errors after its one retry), `useStaffSubscriptionMoreCycles` reports `totalCount: null` (the last result has no data) and `isFetching: false`, so `mayHaveMore` is false: the "Show more" button is removed and only "We couldn't load more orders. Try again." remains, with nothing to try again with (and the footer "All N entries shown" is then also wrong, since it appears when `!mayHaveMore`). The same happens if page 3 fails after page 2 loaded. The error path has no test. Fix: show the button (labelled "Try again") whenever `more.isError`, and suppress the "All N shown" line while `more.isError`; add a test that fails page 2 once (`server.use`) and asserts the button is still there and loads page 2 on click.
- [LOW] web/tests/components/staff-subscriptions/staff-detail.test.tsx:109 — `toBeGreaterThan(51)` after "Show more" with 55 cycles cannot tell a dropped or duplicated cycle from a correct page. Fix: assert `toHaveLength(56)` (header + 55) and that no order number appears twice.
- [LOW] web/components/staff-subscriptions/UnpaidSubscriptionsScreen.tsx:60-67 — a `?page=` past the last page (a bookmark after the worklist shrank) shows "No unpaid subscriptions. Nothing is suspended…", which is untrue and has no way back (the Pager is only rendered with items). Fix: when `items.length === 0 && page > 1`, show the pager or a "Go to the first page" link, or clamp to page 1.
- [LOW] web/components/staff-subscriptions/UnpaidSubscriptionsScreen.tsx:20-37 — a hand-rolled Pager duplicating the one inside `ResponsiveTable`/shared back-office paging. Acceptable because the screen is grouped cards, not a table; note only so S3/integrator can hoist if a shared pager exists.
- [LOW] web/components/staff-subscriptions/StaffSubscriptionsList.tsx:65-73 — `reasonEnabled` disables the reason select for non-Suspended statuses, but a hand-edited `?status=Active&suspensionReason=UnpaidCycles` is still sent (the memo only whitelists values), giving an empty list while the disabled select looks set. Fix: in the `filters` memo, drop `suspensionReason` unless status is '' or Suspended (as `change` already does for clicks).
- [LOW] web/components/staff-subscriptions/ExportCsvButton.tsx:24-41 — the refusal alert stays after the filters change (it describes the old filters, e.g. a 413) until the next click. Fix: `exporter.reset()` in an effect keyed on the filter values.
- [LOW] web/components/staff-subscriptions/StaffActions.tsx:31 — a role without `Subscriptions.Manage` sees "only a shop manager … can act" even on a Cancelled subscription where no action exists, and the note flashes while the session loads (`useCanManageSubscriptions` is false until `roleIds` arrive). Fix: return null first when `allowedStaffActions` is empty, and render nothing while the session query is pending.
- [LOW] web/components/staff-subscriptions/staffCopy.ts — staff-voice copy kept apart from `lib/subscriptions/copy.ts` is justified (S0's strings are customer-voice: "Your delivery on …"), and the slice report lists them for hoisting. No exact duplicate string found. Naming overlap: `staffLockedText` here vs `staffCancelLockedText` in copy.ts:121 differ in meaning (detail panel vs cancel dialog) but read alike; consider `lockedPanelText`.

DESIGN DEVIATIONS (builder-flagged), judged
- Taller rows from `min-h-11` links: accepted. UI-1 (44 px targets) is binding and the design predates it; the cost is row height only. Keep.
- No counts on the All/Unpaid links: accepted. Handover §11.3.3 lists the nav as "All / Unpaid (`aria-current`)" with no counts; a count needs two extra reads and the "All" count would be wrong under filters. Not a defect; recorded in the slice report (item 8).

NOTES (no action)
- Mock vs server, sampled against src/: controller routes, role attributes and `TryFilters` order/sentences (StaffSubscriptionsController.cs:136-147); unknown `sort` falls to the default and never 400s (SubscriptionStaffQueryHandlers.cs:37-43); Filter semantics (product/customer/mobile, trimmed, case-insensitive); export takes the filters, ignores paging, 413 at `MaxExportRows` with the controller's sentence (:63-76), CSV guard matches `InventoryCsv.Guard` (leading whitespace then `=+-@`); reinstate: validator NotEmpty + MaximumLength(500) on the raw string runs before the handler, then 404, then SkuNotSubscribable for a Suspended one, then aggregate rules (SubscriptionWorkerCommandHandlers.cs:157-165, SubscriptionAggregate.cs:256-277). The dialog's 500-character check on the untrimmed text matches the validator, not the aggregate's trimmed check. Reinstate/cancel answer the plain view (:130-134). All match.
- URL state: filters, sort, page and `q` (debounced, flushed on blur) round-trip through `useUrlFilterState`; the page resets on any filter change; status change away from Suspended clears the reason; unknown status/reason/method values are dropped before the request; export sends the same filters without `pageNumber`/`pageSize` (`subscriptionsCsvPath` strips them).
- Dialogs: typed text kept on a field error, cleared on dismiss/success; `close` is a no-op while busy (Escape included) so a write cannot be orphaned; 403 closes and swaps in `PermissionDeniedState`; `hideClose` removes the 24 px X while Escape and the 44 px "Keep …" button remain; focus returns via `useDialogReturnFocus`. `isLocked && nextDeliveryOn` alone picks the locked wording. Buttons come from `allowedStaffActions` AND the Manage roles.
- A11y: nav `aria-current="page"` on All/Unpaid; status region `aria-live="polite"`; all controls `min-h-11`.
- `npx vitest run tests/components/staff-subscriptions tests/unit/staff-nav-groups.test.ts --maxWorkers=2`: 5 files, 87 tests pass. Playwright, next dev and the full suite not run (per instructions).

SCOPE CHECK
- files in allowed scope: 37/37 (web components, lib hook, mocks, nav, tests, docs/gates and docs/test-cases; no src/ or backend file touched)
- files outside allowed scope: none

---

RUN 2
COMMITS: a7c54ad..ed1e613 (fix commit ed1e613; ARCHITECTURE/SECURITY record commits ignored)
DATE: 2026-11-07
STATUS: PASS

FINDINGS
- [LOW] web/tests/components/staff-subscriptions/staff-detail.test.tsx (new "Try again" test) — relies on two real React Query retry delays per page and 6000 ms `findByText` timeouts, so it is slow and could flake on a loaded machine. Fix: construct the test client with `retryDelay: 0` or fake timers; not blocking.

PRIOR FINDINGS, VERIFIED
- MEDIUM Show more dead end: fixed. `CycleHistory.tsx` renders "Try again" (calls `more.retry`, which refetches only the errored pages and keeps loaded ones) whenever `more.isError`; "Show more" and "All N entries shown" are hidden meanwhile. The new test fails page 2, then page 3, asserts both buttons/text states, and that page 2 stays loaded.
- LOW weak `> 51` assertion: fixed (exact row count, exact footer text, dates and order numbers unique).
- LOW unpaid page past the end: fixed (`totalCount > 0 && items.length === 0` shows "That page is past the end of the list." with a first-page button; `url.set({ page: undefined })` deletes the key); tested.
- LOW stale suspension reason sent: fixed in the `filters` memo; tested against the recorded request.
- LOW export alert stale after filter change: fixed (`reset` in an effect keyed on `filters`); tested. The memoised `filters` keeps identity between renders, so the alert is not cleared spuriously.
- LOW role note on empty actions / flash: fixed (`allowedStaffActions` empty or `session.isPending` returns null before the role note); both cases tested. A session that errors leaves `isPending` false and shows the note, which is acceptable.
- LOW staffCopy naming/duplication: hoisted to lib/subscriptions/copy.ts as `staffScheduleLockedText` etc.; staffCopy.ts keeps titles and intros only.
- SECURITY LOW `encodeURIComponent` on link ids: present on every changed link (customer, subscription row, Open, order links in history and unpaid card); tested for the row link.

NEW-CODE CHECKS
- copy.ts hoist is additive: the diff adds exports below the S0 block and one import (`pendingStatusChangeText` from labels, already a dependency of the module; no import cycle, labels.ts imports only api types and dates). No S0 string or signature changed. `tests/unit/subscriptions` (S0) passes.
- Dialog sentences moved verbatim (`reinstateDescription`, `reinstatedMessage`, `staffCancelDescription`, `STAFF_CANCELLED_MESSAGE`, `staffCancelScheduledMessage`); outputs identical to the inline strings.
- Mock: a non-GUID id is now 404 before the role check on T5/T6/T7/T8, as routing precedes `[RequireAction]` for a `{id:guid}` constraint; `due-tomorrow` still handed on from T5. Blank reinstate reason text `'Reason' must not be empty.` matches FluentValidation's default for a NotEmpty carrying only `WithErrorCode` (SubscriptionCommandValidators.cs:104). The cancel NotEmpty keeps its custom message, which the validator does set (:69-70). Correct.
- STAFF_UNPAID_INTRO reworded (no longer states who may restart); harmless and more accurate.
- `npx vitest run tests/components/staff-subscriptions tests/unit/subscriptions tests/unit/staff-nav-groups.test.ts --maxWorkers=2`: 13 files, 224 tests pass. Playwright and the full suite not run.

SCOPE CHECK
- files in allowed scope: 19/19 changed web files (components, hook, copy, mock, tests)
- files outside allowed scope: none

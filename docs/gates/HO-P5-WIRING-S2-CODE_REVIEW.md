GATE: CODE_REVIEW
HANDOVER: HO-P5-WIRING (slice S2, sales)
COMMITS: run 2 reviewed `git diff db084bb HEAD` (HEAD 3ba6ec8, branch feat/p5-s2-sales). Run 1 was at db084bb.
DATE: 2026-10-31
STATUS: PASS

RUN 1 (db084bb): PASS with 4 MEDIUM (weak pos-p5 tests, untested stale-quote race, tick race on the same line, thin tick tests) and a list of LOW.
RUN 2: all four MEDIUM are closed; most LOW are closed; no BLOCKER, HIGH or MEDIUM remains. New items are LOW only. The still-open LOW from run 1 are kept below.

RUN 1 ITEMS - STATE

- [CLOSED] M1 pos-p5 weak tests. "Show more" now serves 25 items over two pages and asserts 20 tiles, the click, `pageNumber=2`, 25 tiles, and the button gone. The empty-category test overrides browse and asserts the exact "Nothing to sell in household & natural care right now." text and no `... to sell` list. The category test compares each tile's aria-label with the shop catalogue's names for that category, with `0 < n < allCount`. All can fail.
- [CLOSED] M2 stale quote. PosScreen.tsx:98-99 hides the preview while settling, on placeholder data, before cash, and (ab) once a payment exists. pos-ticket.test.tsx adds three cases: hidden after a payment (incl. more cash typed, a 900 ms wait past the 400 ms debounce, then removing the payment brings "Still to pay" back), a basket change with a 1.2 s quote (old 220.00 must be gone while the new request is in flight and after), and a slow answer for 500 landing after 1000. Cases 1 and 2 fail if the `tenders.length === 0` or `isPlaceholderData` term is dropped. Case 3 holds by the tender being in the query key; it would fail only if that were removed. Acceptable.
- [CLOSED, one residue kept as LOW] M3 tick race. StaffOrderSidePanel.tsx:94-95,191: a box whose line is in `justTicked` is `aria-disabled` and its `onChange` does nothing. Tick then untick can no longer overlap on one line. The test asserts one PUT, the box still checked, `aria-disabled` set then removed, then a second click sends `false`; it fails if the guard is removed (sent would be 2). The onError-snapshot case across two different lines remains (LOW below).
- [CLOSED] M4 tick tests. Added: 500 (generic message, box reverts, store unchanged), 404 OrderLineNotFound (not "left the shelf"), refetch mid-write, order switch mid-write. The order-switch test is weak (LOW below).
- [CLOSED] byRider uses `!= null` (StaffOrderPanels.tsx:152).
- [CLOSED] one `useCanManageRiders()` (useStaffOrders.ts:99-102), used by RidersPage, DispatchDialog, PickListPage; unknown roles get nothing. Verified by reading all three call sites; no leftover copy.
- [CLOSED] chart: `Math.max(0, ...)` on bar values; hover and focus kept in separate state, `active = focused ?? hovered`; both have tests that fail on the old code (negative net gives `0%` and the accessible name still shows the figure; pointer leaving keeps the focused bar's readout until blur).
- [CLOSED] mock order of rider checks: shape (whitespace-only name is NotEmptyValidator), then 404, then duplicate, then mobile; matches `RiderCommandHandlers.cs:15-19,45-55`, `RiderAggregate.cs:48` and the validators (`NotEmpty()`, `MaximumLength(30)`). Test pins each step.
- [CLOSED] mock: empty-Guid courier beside a real rider refused as DispatchTargetInvalid after the order 404 (handler `is null`); test added.
- [CLOSED] mock: `lacksRole` on tracking (Fulfil), start-packing (Fulfil) and cancel (Orders.Cancel = Reception, ShopManager, Administrator, `ActionRoles.Orders.cs:20`); test added.
- [CLOSED] `removeAllListeners` moved to `beforeEach` in orders-p5. [CLOSED] E9 no longer relies on the receipt text; it asserts the sale body has no customerName/customerMobile.
- [CLOSED, partly] Dispatch 404 blamed the rider for a missing order: now decided by a list re-read (see LOW 1 for the hole).
- [CLOSED] reserved walk-in mobile: the mock now normalises with `normaliseMobile`, so `+8801000000000`, `8801...`, `008801...` are refused like `01000000000`. (Not in run 1; extra.)
- Quote nulls: the mock sends `changeDue: null, cashShort: null` when absent and exactly one set with a tender. `PosViewModels.cs:12-13` says the same (both null without a tender, exactly one otherwise, zero change is `changeDue` "0.00"), and no ignore-null option exists in `src/`. Client `quote.data?.changeDue` truthiness is safe because a Money object is always truthy.

NEW CHOICES - JUDGEMENT

- Pick checkbox `aria-disabled`: sound. The box stays focusable (a native `disabled` would drop focus mid-write), Space and click are ignored, and a controlled checkbox snaps back to `checked`. Screen readers announce "dimmed/unavailable"; the write is short and a failure raises the existing `role=alert`. Residue: no visual cue (LOW 4). The tests reach the state through a delayed handler; they can fail.
- Dispatch 404 re-read: no race that matters (the list is read after the 404; a concurrent deactivation can only tilt towards "rider not available", which is also true). One real hole: LOW 1. The extra read is one GET, only on a 404. The root error renders (`rootError={errors.root?.message}`).
- `useCanManageRiders`: both states are reached. Allowed: ShopManager/Administrator in the dispatch, pick-list and riders tests (`asRoles`). Not allowed: Reception, and a session answering 401 (roles unknown). The unknown-roles test fails under the old permissive rule (buttons would be there with the table).
- Preset buyer and `router.replace`: the walk-in flow works. The ref is set once the lookup returns; the functional `setCustomer` only fills if the fields are still empty, so a buyer typed first is never overwritten; clearing the fields no longer refills; StrictMode double-run is safe (second run returns early, the state update already queued). No loop: deps are `[preset.data, presetCustomerId]`, neither changes from the effect. `New sale` clears customer, cash and the address. Reopening the same customer from the profile remounts PosScreen, so it presets again; the ref never gets in the way. Only reopening within a still-mounted screen is blocked (LOW 2). Both tests ran and pass; the first fails on the old effect (refill after clear), the second fails if `router.replace` or the buyer text is dropped.
- pos-p5 strengthened tests: they can fail (see M1).
- Mock vs `src/`: rider write order, quote nulls, reserved mobile and role sets match as above.

FINDINGS (LOW, all new unless marked kept)
- [LOW] web/components/orders/DispatchDialog.tsx:93-94 - `refetch()` does not throw; if the re-read fails (network, 5xx), `.data` is the previous list, which still contains the chosen id, so the person is told "This order could not be found" when the rider was in fact removed. Use the result's `isError`/`status`: on failure fall back to the old rider/courier message (or a neutral "could not be checked, try again"). Also untested: only the order-gone and rider-gone paths exist.
- [LOW] web/components/pos/PosScreen.tsx:76-77 - `appliedPreset` is never reset when `presetCustomerId` goes back to `''`, so the same `?customerId=` reached again without leaving the screen would not preset. Not reachable from the profile link (remounts). Reset it in the effect when the id is empty, and add a reopen case to the test.
- [LOW] web/tests/components/back-office-sales/orders-p5.test.tsx (order-switch test) - passes by construction: the old body unmounts and the rerender uses a new QueryClient, so no state or cache from the first order can reach the second. It proves nothing about the hook. Keep it on one client, or assert the cache key. Kept from run 1, the onError snapshot restore across two different lines (useStaffOrders.ts:291-293) is still open; the `onSettled` refetch corrects it.
- [LOW] web/components/orders/StaffOrderSidePanel.tsx:94 - `aria-disabled` has no visual style, so a sighted user sees an ignored click with no cue for the short write. Add an opacity/cursor class on `aria-disabled`.
- [LOW] web/tests/components/back-office-sales/mock-refusals.test.ts (Sales series describe) - the title lost a space ("Sales series -StaffDashboard..."). Cosmetic.
- [LOW, kept] web/mocks/handlers/ordering/pos.ts:296,418 - a named customer who is not the seeded one gets `customerId: null`, so the mock receipt hides the name; the E9 receipt text check was dropped for a body check, which is the right fix for the test, but the mock still differs from the server (which registers the buyer).
- [LOW, kept] riders-dispatch.test.tsx and sales-chart.test.tsx - fixed `setTimeout` waits for negative assertions (now also in orders-p5 and pos-p5 at 100 ms, pos-ticket at 900/1800 ms) can pass before the render they guard. The pos-ticket ones are long enough; the 100 ms ones are not proof but are backed by positive assertions.
- [LOW, kept] staff.ts `allowedActionsOf` for Confirmed + Counter returns [] where the server table gives StartPacking, Cancel, CollectAtCounter, and no role narrowing of the list; unreachable in the mock.
- [LOW, kept] StaffOrderQueue counts and list poll on separate timers and can differ for a moment; no test that `search` reaches the counts request.

VERIFIED
- `tsc --noEmit` in web/: exit 0, no output.
- vitest at `--maxWorkers=1`: pos-p5, pos-ticket, orders-p5, riders-dispatch, mock-refusals = 5 files, 94 tests passed; orders-workbench, pos.test, sales-chart = 3 files, 39 tests passed.
- Conventions: no colour literals or money arithmetic added; comments cite server file:line; no `src/`, `.ai/` or handover files touched.

NOT CHECKED
- e2e specs (ordering-pos E9, ordering-staff riders axe), dev server, the rest of the Vitest suite, lint and build. The slice report's counts were not reproduced beyond the 8 files above.
- Whether the mock's new `CANCEL_ROLES` refusal breaks a spec outside those 8 files (specs that cancel as a non-Cancel role). A request with no staff session still passes, so only an explicit role override could.
- Visual result of `aria-disabled` and of the chart; the Next router's real `replace` timing (the test uses a mock).
- Server behaviour was read from source, not run.

SCOPE CHECK
- files in allowed scope: 26/26 changed files (the diffstat: web components, hooks, lib/api/pos.ts, mocks, tests, e2e, and gate/slice-report docs under Amended (r), (aa), (ab))
- files outside allowed scope: none

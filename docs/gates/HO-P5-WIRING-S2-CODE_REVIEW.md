GATE: CODE_REVIEW
HANDOVER: HO-P5-WIRING (slice S2, sales)
COMMITS: run 3 reviewed `git diff 72004e3 HEAD` (HEAD fa70fcc, branch feat/p5-s2-sales). Run 1 at db084bb, run 2 at 3ba6ec8.
DATE: 2026-11-01
STATUS: PASS

HISTORY
- Run 1 (db084bb): PASS with 4 MEDIUM (weak pos-p5 tests, untested stale-quote race, tick race on one line, thin tick tests) and a list of LOW.
- Run 2 (3ba6ec8): PASS. All four MEDIUM closed; most LOW closed. New LOW only: (1) DispatchDialog trusted the stale list when the re-read failed; (2) the preset ref was never reset; (3) the order-switch test passed by construction; (4) no visual cue for `aria-disabled`; (5) a describe title typo. Kept LOW: mock named-customer `customerId: null`, fixed-sleep negative assertions, Confirmed+Counter `allowedActionsOf`, counts/list on separate timers.
- Run 3 (fa70fcc): no BLOCKER, HIGH or MEDIUM. Run 2 LOW 1 to 5 are closed. Only LOW below.

RUN 2 ITEMS - STATE
- [CLOSED] DispatchDialog.tsx:92-94: the result of `refetch()` is checked with `!reread.isError`; a failed re-read keeps the rider/courier message. The new test (first read ok, later reads 500, 404 on dispatch) fails on the old code (stale list still holds Rafiq, so it would say "could not be found"). Courier path is the same line but untested (LOW 1).
- [CLOSED] preset reset: replaced by the per-link counter (below).
- [CLOSED] order-switch test: now one shared QueryClient; asserts the first order's cache entry is back to unpicked and the shown order kept its ticks. By reading, it fails without the `onError` rollback: the first order has no observer after the switch, so the `onSettled` invalidation does not refetch it and the optimistic `true` would stay. The entry is found by `queryKey[3]`, which matches `['staff','order',branchId,orderId]`. Not run with the rollback removed (read-only).
- [CLOSED] visual cue: label dims, `cursor-progress`, "Saving..." text while the line's write is in flight (StaffOrderSidePanel.tsx:90,99); the test asserts the text appears and goes.
- [CLOSED] describe title typo.

PosScreen REWRITE - JUDGEMENT (PosScreen.tsx:71-94)
- Flow: the id in the address is copied into `presetId`, `presetLink` is bumped, and `router.replace('/staff/pos')` runs, all in one effect on the address. A second effect applies the customer when `preset.data` exists and `appliedLink !== presetLink`, through a functional `setCustomer` that only fills an empty ticket.
- Loop: none. The first effect returns when the address id is empty and its deps are `[presetCustomerId, router]`; it does not write what it reads. If `replace` failed to clear the address the effect does not re-run (deps unchanged). The second effect writes `appliedLink` first, so it applies once per link. StrictMode's double run bumps the counter twice and replaces twice; the apply is still once (one `presetLink` value is current when the data is there), and the empty-ticket guard covers the rest.
- Missed preset: not found. Same customer again: `presetId` unchanged but `presetLink` changes, and the cached `preset.data` is already there, so the second effect re-runs and applies. A different customer B: `useStaffCustomer` has no `keepPreviousData` (useStaffCustomers.ts:18-25), so `preset.data` is undefined for B's key until it loads; A's data cannot be applied for B's link. A customer typed before the lookup returns is not overwritten (by design). A failed lookup (403/404) leaves a silent walk-in, as before.
- Address: the replace happens at once, before any basket exists, so Back from the receipt, a reload, or the unsaved-changes guard cannot put the id back. A link followed inside a mounted screen that already holds a basket could meet the guard; no such link exists (the profile page is a different route, so PosScreen remounts).
- Tests that would pass without the code: checked each. "takes the preset out of the address ... a remount is a walk-in" fails on run 2's code (address kept until New sale, so the remount presets). "a new link presets again" fails on a bare `appliedPreset === id` ref. The bdi test fails without `<bdi>` (`tagName` is checked). "fills the buyer ... clearing both fields" and "after New sale ... walk-in" fail on the original refill effect. The Vitest router mock re-renders on `replace`, so URL changes are really observed. The three e2e cases (Print receipt then Back, reload, Void basket) were read only; they are the only proof against the real Next router and history.
- `summary` as `ReactNode`: only consumer is `DialogDescription` (PosReviewDialog.tsx:48), which renders children; no string operation on it. `reviewText` is `''` when no quote, a fragment otherwise; `bdi` inside the description paragraph is valid. tsc is clean and pos.test / pos-ticket / pos-p5 pass. No other caller of the dialog.
- Dispatch re-read: see above. Saving state: see above.

FINDINGS (all LOW)
- [LOW] web/tests/components/back-office-sales/riders-dispatch.test.tsx:151-174 - the failed re-read is tested for riders only; the courier branch (`couriers.refetch()`, DispatchDialog.tsx:92) has no case. Add a courier variant.
- [LOW] web/components/orders/StaffOrderSidePanel.tsx:90,99 - `opacity-60` on the whole row lowers the contrast of the line text and of "Saving..." (text-ink-muted) for the write's duration; axe could flag it if it samples at that moment. "Saving..." is inside the label, so the checkbox's accessible name changes while focused and is not in a live region; whether it is announced depends on the reader. Dim only the checkbox, or put the text in a polite live region.
- [LOW] web/tests/components/back-office-sales/pos-p5.test.tsx (second new test) - calls `userEvent.setup()` three times inline; works, but one `const user` is the pattern in the rest of the file.
- [LOW, kept] web/mocks/handlers/ordering/pos.ts:296,418 - a named customer who is not the seeded one gets `customerId: null`, so the mock receipt hides the name; E9 checks the sale body instead, which is the right test.
- [LOW, kept] fixed `setTimeout` waits for negative assertions (riders-dispatch, sales-chart, orders-p5, pos-p5 at 100-150 ms) can pass before the render they guard; each is backed by a positive assertion.
- [LOW, kept] web/mocks/handlers/ordering/staff.ts `allowedActionsOf`: Confirmed + Counter returns [] where the server table gives StartPacking, Cancel, CollectAtCounter; no role narrowing of the list. Unreachable in the mock.
- [LOW, kept] StaffOrderQueue: counts and list poll on separate 30 s timers; no test that `search` reaches the counts request.
- [LOW, kept] useStaffOrders.ts:291-293: `onError` restores the snapshot taken at that mutation's start, so with two different lines in flight a later failure can restore a snapshot with the other line's tick; the `onSettled` refetch corrects it.

VERIFIED (run by me, `--maxWorkers=1`)
- `tsc --noEmit` in web/: exit 0, no output.
- vitest: orders-p5, pos-ticket, tests/components/pos/pos.test, pos-p5, riders-dispatch = 5 files, 79 tests passed.
- Conventions: no `src/`, `.ai/` or handover files touched in the diff; no colour literals or money arithmetic added; comments cite server file:line where they describe server behaviour.

NOT CHECKED
- The e2e specs (the three new real-router preset cases, ordering-pos, ordering-staff), a dev server, the rest of the Vitest suite, lint, build. The slice report's "249 tests / 18 e2e passed" is its own claim.
- I did not remove the `onError` rollback to watch the order-switch test fail; the claim rests on reading the cache behaviour and on the slice report.
- Real Next router behaviour (replace timing, history entries, Suspense around `useSearchParams`) and the visual result of the Saving state.
- Server behaviour (read from source earlier, not run).

SCOPE CHECK
- files in allowed scope: 10/10 changed files (DispatchDialog, StaffOrderSidePanel, PosReviewDialog, PosScreen, five test files, the slice report)
- files outside allowed scope: none

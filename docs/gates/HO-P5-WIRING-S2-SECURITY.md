GATE: SECURITY
HANDOVER: HO-P5-WIRING (slice S2), run 3
COMMITS: range 72004e3..fa70fcc (fa70fcc; HEAD fa70fcc, branch feat/p5-s2-sales). Run 1 covered e7826aa...db084bb; run 2 covered db084bb..3ba6ec8.
DATE: 2026-11-01
STATUS: PASS

PASS rests on severity. Run 2's MEDIUM is closed on the ordinary routes. A walk-in sale can still carry X in two narrow races, and both are recorded below as LOW, because each needs unusual timing and both the chip and the review name X before the sale. Neither is an accepted risk: the fix for both is two or three lines in `PosScreen.tsx`, and I recommend making it before merge.

WHAT RUNS 1 AND 2 FOUND AND WHAT CHANGED
- Run 1 (FAIL at db084bb): MEDIUM, on `/staff/pos?customerId=X` the preset refilled X whenever the buyer was empty, so neither clearing the fields nor New sale produced a walk-in. LOW, the mock's reserved-number check missed the `+880` and `880` forms. Both closed by 3ba6ec8.
- Run 2 (FAIL at 3ba6ec8): MEDIUM, the preset was once per mount and the parameter stayed in history, so Back from the receipt or a reload refilled X. LOW, Void very likely left the parameter in the address through the unsaved-changes guard's `history.back()`. LOW, the buyer's name sat in one text run with the money, with no `<bdi>`.
- Commit fa70fcc takes the id into state, calls `router.replace('/staff/pos')` as soon as the id appears (PosScreen.tsx:79-84), applies the preset once per link counter (:86-94), drops the replace from `reset()`, and puts the buyer's name and mobile in `<bdi>` (:195-197).
- Result: run 2's MEDIUM is closed on Back from the receipt and on reload. The Void LOW is closed when the replace commits first, which is the normal order. The `<bdi>` LOW is closed.

FINDINGS
- [LOW] web/components/pos/PosScreen.tsx:180-192, with :86-94 — `reset()` does not cancel a preset whose lookup is still in flight. Reproduced in a scratch test with the lookup held open. Scan, Void, then the lookup answers: the empty ticket becomes X, and the next sale's POST carried `customerName: "Sam Rahman"`, `customerMobile: "01711000999"`. A complete walk-in sale, then New sale, then the answer, also puts X on the new ticket. Reaching this needs the lookup to outlast a scan and a void or a whole sale. That is unusual, though `noRetryOn403` allows one retry (useStaffCustomers.ts:13-16) and a failing first attempt lengthens the wait. Harm is as in run 2. Chip and review both name X. Run 2's record said consuming the parameter would not change this window; it is still open. Remediation: in `reset()`, set `appliedLink.current = presetLink`, so a void or New sale ends the link. Add a test holding the lookup open across a Void.
- [LOW] web/components/pos/PosScreen.tsx:79-84, with web/components/account/UnsavedChangesGuard.tsx:165-172, :198-211 — The counter makes any same-mount return to a `?customerId=X` entry preset again, where run 2's ref refused it. Reproduced with the nav mock: after a Void, the parameter URL returning on the same mount put X on the ticket and in the next POST. The fix keeps such an entry from existing in the normal order, but it can still exist if the replace has not committed. A scan completing during the replace's RSC fetch makes the guard push a sentinel copying `location.href` (Next's patched `pushState` passes it through because the copied state has `__NA`, app-router.js:311). The later replace rewrites only the top entry, so `?customerId=X` stays below it, and Void's `history.back()` lands on it. A link or Back that discards the pending replace (app-router-instance.js:131-134) leaves a similar entry. The window is the replace's round trip, and a scan needs its own SKU lookup inside it, so this is unlikely. This route comes from reading the code and was not run in a browser. The slice report says the same trap appeared with the earlier design under a quick scan. The "later link" the counter exists for cannot happen on one mount in the real UI: the only two links (CustomerProfile.tsx:55, CustomerOrdersPanel.tsx:51) are on other pages, so following one remounts PosScreen. Its only real-world same-mount trigger is this bad one. Remediation: allow one preset per mount, and on any later parameter only call the replace. The test "a new link presets again" (pos-p5.test.tsx) should then remount.
- [LOW] web/components/pos/PosScreen.tsx:85 — A failed lookup loses a genuine preset silently. With 403, 404 and 500 the scratch test showed the URL already clean, no alert and a walk-in chip. `preset.error` is not read anywhere. The direction is safe: the sale is anonymous and the chip and review say so, and nothing lands on the wrong account. But a cashier who followed "New order" for X gets no explanation, and since this commit a reload can no longer retry, because the id has left the address. Staff who hold `Pos.Sell` but not `Customers.View` (ShopManager, ActionRoles.Accounts.cs:29, ActionRoles.Orders.cs:22) get the 403 case if they follow such a link, though they would not normally reach a profile. Separately, by reading only: if the replace's RSC fetch fails, Next falls back to a hard navigation to `/staff/pos` (fetch-server-response.js:151-159, app-router.js:270-277), which also ends as a walk-in. Remediation: show "Couldn't load that customer" in the ticket when `preset.isError`.
- [LOW] web/public/mockServiceWorker.js:1 — Carried unchanged from HO-P5-WIRING-S0-SECURITY; S2 does not touch it.

ROUTE TABLE (can a later walk-in sale carry X?)
Scratch probes ran outside the repo against the unmodified component with the nav mock, 15 of 15 completing.
- Clear both fields: no. Holds through a background refetch of the customer, and the POST has neither field. The counter does not change on a refetch.
- New sale: no. The next POST has neither field.
- Back from the receipt, or a reload (remount): no. The URL is already clean at remount, so the next ticket is a walk-in and the POST has neither field. In the nav mock this is an unmount and render. The real-router version is the e2e below, which I did not run.
- Void: no in the normal order (probe), and the address is clean, so the guard's `history.back()` lands on a clean entry. Yes in the second LOW's race.
- Failed sale, then retry: no. A cleared preset stays cleared and both POST bodies have neither field.
- Typed buyer before the lookup returns: the typed buyer stands. The link is used up, so a later clear does not bring X back.
- Basket before the lookup returns: X fills the open basket, and the sale carries X. That is what the link asked for, and chip and review show it. It is only wrong after a Void or New sale, which is the first LOW.
- StrictMode's double effect: the counter reaches 2 in one batch, the preset fills once, and clearing holds (probe).

DOES ANYTHING LOSE A GENUINE PRESET?
- Slow lookup: no. `presetId` is state and keeps the query alive after the replace; the URL is clean at once and X still arrives (probe). A reload before the answer gives a walk-in, the safe direction.
- Failed lookup: yes, silently. See the third LOW.
- The replace dropping state: no by the code, since `layout-router.js:410` keys state without search params and it is the same page segment. `ordering-pos.spec.ts` asserts the chip is still there after the URL is clean, through the real router; the slice report records that spec passing, and I did not run it.

E2E (`web/tests/e2e/ordering-pos.spec.ts`)
- Print receipt then Back: asserts the POST body. `sales[0]` carries X, `sales` has length 2, and `sales[1]` has neither key.
- Void then next sale: asserts the POST body. `sales[0]` has neither key; if no request were seen, `Object.keys(undefined)` would throw, so it cannot pass empty.
- Reload (:157): does not assert a POST body. It stops at the walk-in chip and makes no sale. That is enough here, since the chip and `payload()` read the same state, but it is the weaker of the three.
- `watchSales` falls back to `'{}'` if `postData()` is null, which alone could pass as "neither key". The first test's positive assertion on `sales[0]` shows bodies are being read.
- None of the three delays the lookup or the replace, so they do not exercise either race. `retries: 1` (:6) could also hide a timing failure.

`<bdi>` IN THE REVIEW SUMMARY
- Correct. The name and mobile are each in their own `<bdi>` (PosScreen.tsx:197), rendered as React children through `summary: React.ReactNode` into `DialogDescription` (PosReviewDialog.tsx:30, :48). The UA's isolation confines an unterminated U+202E, so it cannot reorder Total or Payments, which now sit outside the isolate. The test asserts the tag is `BDI`; jsdom does not lay out text, so the visual effect itself was not observed.
- The chip (:220 onward) and the panel's "Attached:" line still show the name without `<bdi>`, but no money sits beside them. That joins the carry-forward below.

CARRY-FORWARD (not findings in S2, unchanged)
- S1 SECURITY's two MEDIUMs remain open and unaffected by S2: the rider note in the audit table and the shared `Catalogue` rate-limit bucket.
- Customer free text other than the rider note still renders without `<bdi>` on staff screens: `deliveryInstructions` at web/components/orders/StaffOrderPanels.tsx:47 and StaffOrderSidePanel.tsx:188, and the customer name in the queue. Pre-existing and escaped by React.
- E18: `tests/contract/mock-vs-real.contract.test.ts` has not been run against S2's new mock routes.
- Run 1 and run 2's other verified items (riders route and server scoping, `useCanManageRiders` as a hint with `[RequireAction]` as the protection, the reserved number, rider response shape, pick fields, dashboard roles, test seam, `X-Branch-Id`) rest on code this diff does not change in those respects. I did not re-trace them.

VERIFIED IN THE DIFF (no finding)
- `?customerId=` is still only sent through `encodeURIComponent` (lib/api/staff-customers.ts:74), and the buyer is sent by name and mobile only. A crafted link can preset a customer the caller may already view, visibly; that is unchanged, and the server checks `Customers.View`.
- `DispatchDialog` re-read: a failed `refetch()` keeps the rider or courier message. Same list, same hooks, same server checks.
- Pick row "Saving…" and dimming, and the tick rollback test: presentation and tests only.
- No new storage, `dangerouslySetInnerHTML`, raw `fetch`, dependency, config or secret in this diff. Mock code is unchanged here.

NOT CHECKED
- No browser and no dev server, so the e2e specs were not run. The slice report says `ordering-pos.spec.ts` passed 18 of 18 on both projects at this commit; that is its claim, not my observation. The second LOW's real-router path and the hard-navigation fallback are read from source.
- Whether a stored customer name can actually contain U+202E, as in run 2.
- Whether a named counter sale sends X a message, as in runs 1 and 2.
- Mutation testing of the new tests: not repeated this run. Server authorisation read, not tested. Full Vitest, lint and typecheck not run. Run here: the "Preset buyer" tests in `pos-p5.test.tsx` (4 passed) and the 15 scratch probes.

SCOPE CHECK
- files in allowed scope: 10/10 in `git diff 72004e3 HEAD --name-only`. Nine were already in S2's list. `web/components/pos/PosReviewDialog.tsx` is new to it and falls under the handover's `components/pos/*` row; I did not separately confirm that row belongs to S2's §13 block, though BG-6 assigns `components/pos/**` to S2. This record is additional.
- files outside allowed scope: none

GATE: SECURITY
HANDOVER: HO-P5-WIRING (slice S2), run 4
COMMITS: range ba81a15..3584dac (3584dac; HEAD 3584dac, branch feat/p5-s2-sales). Run 1 covered e7826aa...db084bb, run 2 db084bb..3ba6ec8, run 3 72004e3..fa70fcc.
DATE: 2026-11-01
STATUS: PASS

Run 3's two reproduced races and the failed-lookup silence hold closed on every probe. The new failed-lookup alert brings two small LOWs, both from reading `preset.isError` without checking whether data exists. In one of them a sale can still carry X: a failed lookup that later recovers attaches X to the open basket after the alert said walk-in. It needs a failure, then a successful refetch, then the cashier serving someone else on that same ticket, and the chip and review name X. That is why it is LOW and not a blocker, but the fix is small and I recommend it before merge.

WHAT EARLIER RUNS FOUND AND WHAT CHANGED
- Run 1 (FAIL at db084bb): MEDIUM, the preset refilled X whenever the buyer was empty, so clearing the fields or New sale could not give a walk-in. LOW, the mock's reserved-number check missed `+880` and `880` forms. Both closed by 3ba6ec8.
- Run 2 (FAIL at 3ba6ec8): MEDIUM, the preset was once per mount and the parameter stayed in history, so Back from the receipt or a reload refilled X. LOW, Void very likely left the parameter in the address. LOW, the buyer's name shared a text run with the money, with no `<bdi>`. Closed by fa70fcc, apart from the race below.
- Run 3 (PASS at fa70fcc, with fixes recommended): LOW, a lookup in flight across a Void or New sale put X on the next ticket (reproduced). LOW, the counter re-preset on any same-mount return to a parameter entry (reproduced on the nav mock). LOW, a failed lookup was silent.
- Commit 3584dac: `reset()` ends the link (PosScreen.tsx:186-189), `presetTaken` allows one preset per mount and later parameters only get the address cleaned (:80-89), and a failed lookup shows an alert (:245-249). The e2e reload case now asserts a POST body.

FINDINGS
- [LOW] web/components/pos/PosScreen.tsx:92-100, with :245 — A failed lookup leaves the link open, so a later success attaches X after the alert told the cashier "It is a walk-in sale". Reproduced with a 500, an alert, a scan, then a successful refetch: the alert went away, the chip became X and the POST carried `customerName: "Sam Rahman"`, `customerMobile: "01711000999"`. In the app the refetch would come from TanStack's default focus and reconnect refetch; providers.tsx sets no override, and a query with no data is always stale. I called the refetch directly in the probe. Harm is as in the earlier runs, but only on this first ticket: any Void or New sale ends the link (probe), and the customer is the one the link named. It goes wrong only if the cashier takes the alert at its word and serves someone else on that ticket, ignoring the chip and the review. Remediation: end the link when the first load fails, by setting `appliedLink.current = presetLink` when `preset.isLoadingError` is true, so the alert's sentence stays true. Add this case as a test.
- [LOW] web/components/pos/PosScreen.tsx:245 — Stale alert. `preset.isError` is also true when a background refetch fails after a successful load, with the data kept. Reproduced: X loaded, the cashier cleared X, a refetch got a 500, and "We couldn't attach that customer" appeared on a walk-in nobody tried to attach. It also appears if X is attached and the cashier edits to a partial buyer. It stays until a reset or a full buyer. No wrong-account risk: the text is fixed, with no customer data, and the sale is a walk-in as it says. It is only misleading, and it needs a failed refetch (staleTime is 30 s). A remount on a cached failure with a new link can also show it briefly until the refetch answers; I did not observe that directly. Remediation: use `preset.isLoadingError`, which covers the first case and is the same condition as the fix above.
- [LOW] web/components/pos/PosScreen.tsx:80-89 — `presetTaken` lasts one mount, so a surviving `?customerId=X` entry can still preset X if it is reached by a remount. Run 3's second finding is closed for the same mount (probe), but such an entry can still be left by a scan during the replace's fetch, or by a navigation that discards the replace. Example: Back to the clean entry after the receipt is a new mount with nothing taken, and one more Back onto the parameter entry presets X. Read from the code, not run. It needs that race plus a return to that exact entry, and it cannot be told apart from a genuine link, so I do not expect a fix here; I record it as the remaining edge. Chip and review name X.
- [LOW] web/public/mockServiceWorker.js:1 — Carried unchanged from HO-P5-WIRING-S0-SECURITY; S2 does not touch it.

DO THE RACES AND THE SILENCE HOLD CLOSED?
Scratch probes in `preset.test.tsx` (unchanged, its OBSERVE lines now read differently) and `run4.test.tsx`, unmodified component with the nav mock, 26 of 26 completing.
- Lookup held across a Void, then answers: ticket stays walk-in, next POST has neither field. Closed.
- Lookup held across a walk-in sale and New sale, then answers: ticket stays walk-in. Closed.
- Same-mount return to the parameter URL after a Void: walk-in, URL cleaned, next POST has neither field. Closed.
- Failed lookup: an alert for 403, 404 and 500. Closed. A Void hides it, and a further failed refetch does not bring it back (probe). A remount at the clean URL shows none (probe).
- Unchanged routes: clear both (through a refetch), New sale, remount after a sale, Void, failed sale then retry, typed buyer before the lookup, basket before the lookup, slow lookup, and StrictMode all behave as in run 3.

DOES `presetTaken` OR THE ALERT LOSE A GENUINE PRESET?
- `presetTaken`: no. The only two links are on other pages (CustomerProfile.tsx:55, CustomerOrdersPanel.tsx:51), so a link mounts afresh with the ref false. A fresh link after a cached failure refetches and presets X (probe), a cached customer presets at once with a clean URL (probe), and StrictMode's second effect run only repeats the replace. Moving `presetId` to start empty only delays the query by one effect.
- The alert hides nothing and changes no state, apart from `presetNoticeHidden` on reset. New sale and Void after a failed lookup are final for that mount, as intended.

THE 404 TEST'S 15 S WAIT
- It does not mean the query retries for that long. Measured: 404 and 500 reached the alert in about 1.1 s with 2 requests, 403 in about 0.13 s with 1, and no further requests in the next 3 s. `noRetryOn403` allows one retry for anything but a 403 (useStaffCustomers.ts:13-16), with TanStack's 1 s backoff. In `pos-p5.test.tsx` the 404 case itself took about 1.1 s. The 15 s is only an unused timeout ceiling, not time spent.
- Does the window matter? No, not as a finding. For about 1 s plus two round trips the chip reads walk-in with no alert, and on a hung request for longer: `lib/api/client.ts` showed no timeout in my search, and an offline pause would also give no error. A sale could technically proceed in that window, but a scan, a tender and a review take longer than the normal window, and the chip and review both correctly say walk-in. The worst outcome is that a sale meant for X is recorded anonymously, with nothing on any wrong account. If the sale finishes first, the alert does not appear on the completion screen, and New sale hides it. A 404 retry serves no purpose, so skipping it would be a small tidy-up.

E2E
- The reload case now asserts the POST body (`ordering-pos.spec.ts`, `watchSales` registered before the `goto` and the reload), so all three real-router cases do. I did not run them. None of them delays the lookup or the replace.

CARRY-FORWARD (not findings in S2, unchanged)
- S1 SECURITY's two MEDIUMs remain open and unaffected by S2: the rider note in the audit table and the shared `Catalogue` rate-limit bucket.
- Customer free text other than the rider note still renders without `<bdi>` on staff screens: `deliveryInstructions` at web/components/orders/StaffOrderPanels.tsx:47 and StaffOrderSidePanel.tsx (line moved by this diff), the customer name in the queue, and the POS chip and "Attached:" line, none beside money. Pre-existing and escaped by React.
- E18: `tests/contract/mock-vs-real.contract.test.ts` has not been run against S2's new mock routes.
- Earlier runs' verified items (riders route and server scoping, `useCanManageRiders` as a hint with `[RequireAction]` as the protection, the reserved number, `<bdi>` in the review, rider response shape, pick fields, dashboard roles, test seam, `X-Branch-Id`) rest on code this diff does not change in those respects. I did not re-trace them.

VERIFIED IN THE DIFF (no finding)
- The alert's text is fixed, with no customer data or server message in it.
- `StaffOrderSidePanel` "Saving…" status region and checkbox dimming: presentation only, no order data in the region.
- Courier re-read test and the other test edits: tests only. No new storage, `dangerouslySetInnerHTML`, raw `fetch`, dependency, config or secret in this diff.

NOT CHECKED
- No browser and no dev server, so the e2e specs were not run. The slice report's 18 of 18 is its own claim. The nav mock has no history stack, so the third LOW's path and same-mount behaviour through the real guard are read from source and simulated.
- Refetch timing in the first LOW: I called the refetch directly and did not fire a real focus or reconnect event.
- The offline-paused lookup and a hung request were read, not run.
- Mutation testing of the new tests: not done this run. The slice report says the two held-lookup tests fail without the `reset()` line; I did not confirm that.
- As in earlier runs: whether a stored name can contain U+202E, and whether a named counter sale sends X a message. Server authorisation read, not tested. Full Vitest, lint and typecheck not run. Run here: the "Preset buyer" tests in `pos-p5.test.tsx` (9 passed) and the 26 scratch probes.

SCOPE CHECK
- files in allowed scope: 6/6 in `git diff ba81a15 HEAD --name-only`, all already in S2's list. This record is additional.
- files outside allowed scope: none

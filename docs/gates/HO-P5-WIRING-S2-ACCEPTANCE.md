GATE: ACCEPTANCE
HANDOVER: HO-P5-WIRING (slice S2, sales: dashboard, orders workbench, riders, counter sale)
RUN: 1
COMMITS: 625a0da adec50e 9eec889 d26e5d7 230ea43 971c8bd f8ffb4d db084bb 3ba6ec8 fa70fcc 3584dac 962eaa0 d1d18f3 b1b03a6 and the merges from the integration branch (last e638ccd, which merges b38ff88). HEAD b1b03a6, branch feat/p5-s2-sales.
DATE: 2026-11-02
STATUS: PASS

Every §18 row that applies to S2 has evidence. This PASS covers S2's gates only. E17, E18, E19, the contract run, every real-API spec, and a Packed order reached by a real staff transition and seen on the customer's page are still owed at integration. No gate has shown any of them to be good. Specs outside S2's §16 rows were judged as "pass, baseline, or passes alone under (i)" (Amended (i)). Any failure there is rechecked at E18. The screenshots show four layout defects at 360 px. Three are pre-existing, and the fourth is in S2's new pipeline panel. None is tied to an S2 criterion, so none blocks this gate. They are listed under FINDINGS. Three matters need the owner (OWNER DECISIONS).

PRIOR GATES (read from docs/gates/ and docs/test-cases/)
- ARCHITECTURE: PASS (run 1, at db084bb).
- SECURITY: PASS (run 4, at 3584dac; runs 1 and 2 FAIL, run 3 PASS).
- CODE_REVIEW: PASS (run 3, at fa70fcc).
- TEST: PASS. This is the integrator's update of run 1 under Amended (ag), at b1b03a6. The gate's own verdict, at d1d18f3, was FAIL.

THE TEST RECORD'S PASS
I checked that the integrator's update holds. I did not take it on trust.
- Run 1 failed only on M1c and M8. Both were gaps in the slice's own tests: a logic line could be removed and every slice test still passed. Neither was a product defect. The gate's own file closed both gaps: G2 catches M1c and R3 catches M8.
- (ag) adopts that file and `sales-gate-s2.spec.ts` into S2 "unchanged". b1b03a6 adds both files: test-gate-s2.test.tsx with +103 lines and sales-gate-s2.spec.ts with +63. It also edits the TEST record, the TC sheet and handover line 76, and nothing else.
- I cannot compare the files byte for byte against the gate's untracked originals. The sheet's G1-G5 descriptions match what the files contain, and G3-G5 match the spec I read.
- I reran the adopted test file together with sales-chart.test.tsx at HEAD (`--maxWorkers=1`): 2 files, 16 tests, all passed. That is 7 gate cases plus 9 chart cases, matching the sheet's 7 for the gate file (G1).
- Once the file is adopted, M1c and M8 have tests that fail on the mutation: the sheet records each mutation failing the gate test. So 136 PASS and 1 BLOCKED is the right recount. R15 is the BLOCKED row: SECURITY run 4's LOW 3, an accepted edge with no test possible. It is not counted as a pass.
- Not rerun after the merge at e638ccd: full Vitest, `next build`, the served-output check and X1. They ran at afff3ca. Between afff3ca and e638ccd the merge brought in S1's files and Amended (ad)-(af), and none of them is an S2 file. The integrator's recheck after the merge covers E7, E8, E9 and G3-G5 on both projects.

GATES VERSUS LATER COMMITS
- 962eaa0 came after SECURITY run 4 and CODE_REVIEW run 3. I read its product diff (PosScreen.tsx, 6 lines). It is exactly the fix SECURITY run 4 recommended for its LOW 1 and LOW 2: `preset.isLoadingError` marks the link as applied, and the alert reads `isLoadingError` instead of `isError`. It adds no input, storage or rendering. TEST ran it (R13, R14, M1d), and no gate conclusion changes. No gate formally reviewed this commit. I do not require a rerun.
- 3584dac came after CODE_REVIEW run 3. SECURITY run 4 reviewed it and TEST ran it. Its changes are local to PosScreen's preset handling.
- e638ccd merges integration b38ff88. That brings S1's files, Amended (ac) to (af), and (af)'s OrderTracker change. None of them is in S2's diff (scope below).

S0 CARRY-FORWARDS OWED BY S2 (from HO-P5-WIRING-S0-ACCEPTANCE.md:130-135): ALL MET
- Packed in StaffOrderQueue: StaffOrderQueue.tsx:53 (STATUSES) and :54 (PILL_STATUSES). Seen as the "Packed 1" pill.
- Packed actions and MarkPacked in the staff mock:
  - mocks/handlers/ordering/staff.ts:112 offers `MarkPacked` from Packing, and :117 gives the `Packed` case its actions.
  - Cancel accepts Packed (:720-721). Dispatch and ready-for-collection accept it too (:828, :881). Picking accepts it (:776).
  - The packed handler sets `Packed` (:761).
  - The pick list stays Confirmed and Packing only. That matches the server (`StaffOrderQueryHandlers.cs:215-216`) and is ruled by Amended (x).
  - M2a and M2b (TEST) show the Packed actions are tested.
- The riders handler does not send DbRider.branchId: `riderView` (staff.ts:417-420) returns only `{ id, name, mobileNumber, isActive }`. The T5 served-output check found no `DbRider` in the bundle.
- Rider mobile numbers are behind Orders.Fulfil and Riders.Manage. GET /riders checks `lacksRole(request, FULFIL_ROLES)` (staff.ts:1082), and POST and PUT check `RIDER_MANAGE_ROLES` (:1096, :1120). The shipment carries only `riderId` and `riderName` (:182-188). M5b and M5c show the 403s are tested.
- Pick fields stay out of `orderLineView`: customer.ts:230-245 has no `picked`, `pickedOn` or `pickedBy`. pos.ts:22 and :382 import it unchanged. The staff line view adds them separately (staff.ts:160-162). S2 did not touch customer.ts.
- The staff rider note is rendered as isolated text: `<bdi>{f.riderNote}</bdi>` at StaffOrderPanels.tsx:49 and StaffOrderSidePanel.tsx:192. orders-p5 asserts the `BDI` tagName (R16). Seen at 1280 on both the side panel and the order page.
- U47 has a row on the sheet: TC sheet rows U47a to U47j.
- "Passes alone under (i)" is stated up front: TC sheet lines 20-21. E17 is stated as outside the counts under (l): lines 22-23.
- `orderChannelLabel` now has a caller (StaffOrderQueue.tsx:71), and U19b renders it. `StaffOrderRow.channel` is widened (ARCHITECTURE).

CRITERIA
- A6 MET.
  - Chart: U16a-e passed in T3. I reran sales-chart.test.tsx: 9 passed.
  - Pipeline: U17a-c.
  - Rider-cash tile roles: U47h.
  - The branch switch refetches: R3, the adopted gate test, which I reran and it passed.
  - E7a-d passed on both projects. E7c covers the 14 bars, the readout, the 15-row table and the pipeline link to `?status=Packing`. E7d covers axe and no sideways scroll at 360, 768, 1024 and 1440.
  - ADR-FE-188, by hand: the only conversion is `toChartNumber(day.net)`, used for bar length (U27c; ARCHITECTURE).
  - Seen at both widths: 14 bars, the server total "৳185,812.50", the focused bar's readout "6 Oct 2026: ৳23,387.50, 17 orders", the table alternative, the pipeline's four bars with counts and "Every order: 13", and the "Cash on delivery out with riders" tile for the Administrator.
- A7 MET.
  - U18a-c, U19a-b, U20a-d and U21a-b passed. M4 and M7 show the tick tests can fail. E8a-d passed on both projects. E8c shows a tick survives a reload, and E8d covers Mark packed.
  - Seen: pills with counts including "Packed 1", the Packed filter, area and slot on delivery rows ("Dhaka", "3 Nov 2026 · 10:00-13:00"), a server tick on the side panel, "Packed Mon 2 Nov, 20:07" from `packedOn` with both lines ticked, Mark packed on the order page, and Packed in the history afterwards.
- A8 MET.
  - U22a-e and U23a-d passed. M5a-c show the role checks are tested. E8d (dispatch to a rider; the shipment shows the rider with no tracking action) and E8e (riders page, duplicate name, axe on the list and the open dialog) passed on both projects. G3 passed.
  - Seen: the "Send with" Courier/Rider choice with "Which rider" and no tracking field, the shipment reading "Rider: Rafiq Hasan", the riders table at 1280 and cards at 360, and the add dialog showing "A rider with this name already exists at this branch." under Name.
  - The "No riders set up" state rests on U22b only. I did not capture it.
- A9 MET.
  - U24a-c, U25a-b, U26a-b, U27a and U27c passed. M1a2, M1b, M1d, M1f, M1g, M3 and M6 show the tests can fail. G2 (now the slice's) covers M1c.
  - E9a-i passed on both projects. E9b covers browse, a tile, change 220.00 for 1000, still to pay 280.00 for 500, and an anonymous sale whose POST body has neither name nor mobile. G4 covers axe and 360 px with the preview showing, and the preview hiding once a payment is added (ab).
  - No card UI: the `no-card-ui` guard passed (U27a).
  - Seen at both widths: the "Item categories" tabs, "Rice & grains" chosen, "Change due ৳220.00", "Still to pay ৳280.00", the "Walk-in (no customer) · Add customer" chip, the chip reading "Sam Rahman · 01799999999" after the preset with the address cleaned to /staff/pos, and the half-entered buyer blocking with "Enter both the name and the mobile number, or neither."
- A18 (S2's part) MET.
  - U46: both colour guards passed, and the back-up `rg` found 0 matches.
  - Axe: E7d, E8e, G3, G4 and G5 on both projects, plus X1 (`ordering-a11y-responsive`, 68 of 68 first time at afff3ca).
  - My added-line sweep agrees with ARCHITECTURE.
  - E19 is integration.
  - The 360 px findings below are not axe or overflow failures, and no spec catches them.
- A19 (S2's part) MET.
  - U47a-j passed. M9 shows the list's 400s are now tested through G1, which is adopted.
  - I spot-checked the rider handlers against the slice report's citations.
  - Name uniqueness is case-sensitive, as the code is (Amended (x)), not as §11.3.14 says.
- A20 MET. See SCOPE CHECK. Nothing subscription-shaped: the channel select offers Online and Counter only, and there is no `/subscriptions` call and no `isSubscribable` (ARCHITECTURE; my grep of the diff agrees).
- A21 (S2's part) MET.
  - T1 typecheck, T2 lint, T3 full Vitest (2004 passed, 0 failed, `--maxWorkers=2`), T4 `next build` and T5 the served-output check all ran at afff3ca.
  - After the merge, the integrator reran typecheck, ESLint on the two adopted files, and 9 files with 131 tests.
  - I did not rerun the full set. The full e2e half is E18.
- A1-A5 and A10-A17: not S2's. A22: a recorded non-goal.

SCOPE
- Out-of-scope work found: none.
  - The riders page is OQ-9's minimal page, with no nav item.
  - The "Manage riders" link on the pick list and in the dispatch dialog is §11.3.9 and §11.3.10.
  - "Picked." on the full order page (StaffOrderPanels.tsx:99) is a read-back of a field §11.3.8 wires.
- §20 conditions worked around: none. (x), (y), (z), (aa) and (ab) were recorded as Amended rows before the gates relied on them.

UNDECLARED DEVIATIONS
- Implementation: none found. ARCHITECTURE's MEDIUM, a missing "Add customer", was fixed in 3ba6ec8 (R1, and seen on screen). Its LOWs were recorded under (aa) and (ab).
- Records: the TC sheet's header (line 3) cites Amended (a)-(ae), although (af) and (ag) now apply. Only its Summary rows carry the (ag) update. LOW.

SCREENSHOTS (Amended (j)), at docs/gates/screenshots/HO-P5-WIRING-S2/, 47 images
Setup and review:
- Captured on a fresh `next dev` on :3122 with MSW (NEXT_PUBLIC_USE_MOCKS=true), signed in as the seeded Administrator, with the mock reset before each screen.
- Chromium, one worker, a viewport of 1280x900 or 360x780.
- I looked at every image I list below. The full-page captures freeze the sticky staff rail where the page was scrolled to, so the rail appears lower down or floating in some images (pos-category-change-due-*, pos-add-customer-half-1280). That is an artifact of the capture, not of the page.
- No back-office `.dc.html` was rendered for comparison. HO-P4 already interpreted those designs, and HO-P5 adds no new design. §19 asks for a comparison against the matching `.dc.html`, and I did not make one. NOT CHECKED below.

Dashboard: dashboard-1280, -360; dashboard-chart-focused-1280, -360; dashboard-chart-table-1280, -360.
- Chart, readout, table alternative and pipeline as A6 describes. The chart sits 2/3 and the pipeline 1/3 at 1280, and they stack at 360. Bars at 360 are about 14 px wide, which is the trade-off the slice report declared, and the table carries the same days.
- Wrong at 360: in "Orders in progress" each bar's track shrinks to about 12 px. A count of 1 becomes a half-filled dot and 2 a full dot, so the bars say nothing. The count is shown as text, so no information is lost (FINDINGS).
- Wrong at 360: the table alternative scrolls inside its own frame, and "Net sales" is cut with "Orders" off-screen until scrolled. TableFrame does this by design (§7 UI-1). It is noted, not a defect.
- Wrong at both widths: the money tiles wrap mid-number ("৳1,380.0 / 0" in the new rider-cash tile; "৳4,200. / 00" in Payments today). The tile renderer is HO-P4's and unchanged. The new tile only shows the existing behaviour (FINDINGS).

Orders queue: orders-pills-1280, -360; orders-packed-filter-1280, -360.
- Pills read "Packed 1", "All 13" and so on, and the pills wrap at 360 without overflow.
- Delivery rows show "Dhaka" and the slot. Counter and pickup rows show neither.

Order page: order-confirmed-*, order-packing-mark-packed-*, order-after-mark-packed-*, order-packed-seed-*, order-dispatched-rider-seed-*, order-dispatched-rider-*, order-rider-note-*.
- "Mark packed" appears beside Dispatch only while the order is Packing. After it is pressed, the badge reads Packed and the history adds "Packed".
- The seeded Packed order shows "Picked." under each line.
- The rider note appears as the "Note for the rider" row.
- Wrong at 360: in the "Customer and fulfilment" and "Shipment" panels the value column is a few characters wide, so text breaks mid-word ("Rafiq Hasa / n", "Sam Rah / man", "Deliv / ery"). The 9rem label column and `[overflow-wrap:anywhere]` predate S2 (the Row component is unchanged). S2's new "Rider" and "Note for the rider" rows inherit it. Not caught by any spec, because nothing overflows (FINDINGS).
- Wrong at 360: on the seeded Packed order the "Reallocate Organic Rolled Oats" button appears to run to the card's edge. That is pre-existing HO-P4 code; I did not measure it.

Side panel at 1280 (writable ticks live only here, per (aa)): side-panel-pick-tick-1280, side-panel-packed-1280, side-panel-rider-note-1280.
- A server tick, "Packed Mon 2 Nov, 20:07", and both a "Note:" line (the delivery instructions) and a "Note for the rider:" line.
- Seed order 112 (Mizanur Rahman) shows Sam's phone and address. That is S0's known CODE_REVIEW LOW and is seed only.

Dispatch: dispatch-courier-1280, -360; dispatch-rider-1280, -360. The radiogroup, the rider select and no tracking field. The dialog fits at 360.

Pick list: pick-list-1280, -360. "Manage riders" sits beside "Start packing 1 order".
- Wrong at 360: the printable sheet's Quantity and Orders columns are cut off. The sheet is pre-existing HO-P4 code; S2 added only the link.

Riders: riders-list-1280, -360; riders-add-duplicate-1280, -360. A table at 1280 and cards at 360, with "Not active" for Kamal Mia. The duplicate-name error shows under Name. Under the riders page the Orders tabs show with none selected, as the slice report disclosed.

Counter sale: pos-browse-all-walkin-*, pos-category-change-due-*, pos-still-to-pay-*, pos-add-customer-half-*, pos-customer-chip-*.
- At 1280 the category tabs scroll within their own row ("Puls…" cut at the edge, as §7 UI-1 intends).
- At 360 the ticket and tender come after the whole tile grid: about 20 tiles for "Rice & grains", so a long scroll after each tap. A UX observation for the owner (D3), not a criterion.
- Mock dates: the dashboard reads "Today — 14 Oct 2026" while orders and slots carry 2 to 3 Nov 2026. This comes from the mocks' fixed dashboard date and is not a product matter.

OWNER DECISIONS
- D1. A split payment hides the change preview (Amended (ab), an integrator decision). The server's quote evaluates one `tenderedCash` on its own, so once any payment is on the ticket, no change or still-to-pay figure is shown before completion. If the owner wants a preview on split payments, the quote needs to take the tenders already added. That is a backend change.
- D2. Accepted preset edge, R15, SECURITY run 4's LOW 3. A `?customerId=X` history entry that survives and is reached again by a remount can still preset X. Chip and review name X, so the cashier sees it. Closing it needs a one-time preset token or similar. Needs an owner yes or no; it does not block S2.
- D3. Layout at 360 (FINDINGS 1-3): the pipeline bars, the panels' value column, and the counter sale's ticket placed below the whole grid. Each needs an owner to decide whether it is a follow-up. Two of them are in code §14 forbids S2 to edit, or that S2 did not write.
Carried, still without a decision: S1's D1, the rider note in the audit table, and the rate-limit MEDIUM. The rider note is now also shown to staff.

CARRY-FORWARDS
Before merging S2:
- Commit this record and the 47 screenshots. Both are uncommitted, and docs/gates/screenshots/HO-P5-WIRING-S2/ is untracked.
- Optionally correct the TC sheet's header (line 3) to name (af) and (ag).
Integration:
- E17 (Amended (l)) and E18 (§17.2 chunks, fresh `next dev` each, `portal-dashboard` in its own chunk per (ae)).
- Under (i), recheck by name every failure outside S2's rows. TEST found none: X1 passed 68 of 68.
- E19 `sweep:a11y`, and A21's full set: typecheck, lint, full Vitest at `--maxWorkers=2`, build.
- Add S2's new GETs to `tests/contract/mock-vs-real.contract.test.ts` and run `test:contract` if a scratch API exists: sales-series, status-counts, riders, pos/browse. Expect ARCHITECTURE's LOW on the quote's null fields: the mock now always sends them (U47f).
- Real-API specs: not run by anyone.
- See a Packed order through a real staff transition on the customer's page (S1 ACCEPTANCE carry-forward). S2 now provides the transition: Start packing then Mark packed on /staff/orders/{id} as seen here, then sign in as that customer. Not done by this gate: no customer page was opened. Under mocks, use an order belonging to the seeded customer, such as 104, which this gate moved to Packed and Dispatched from the staff side.
- The "No riders set up" dispatch state and the 403 riders page have been seen in component tests only, not in a browser.

FINDINGS
- [MEDIUM] web/components/back-office-overview/DashboardPipeline.tsx (S2, new): at 360 px each status bar's track is about 12 px wide (dashboard-360, dashboard-chart-focused-360). The counts are text, so A6 holds and axe and overflow pass. The bar is meaningless at phone width. A follow-up for S2 or the integrator: give the bar its own row below the label at narrow widths.
- [MEDIUM] web/components/orders/StaffOrderPanels.tsx:18-24 (Row, pre-existing, unchanged by S2) with the S2 rows at :49 and in ShipmentPanel. At 360 px the value column of the "Customer and fulfilment" and "Shipment" panels is about 4 characters wide, so names, addresses and "Rafiq Hasan" break mid-word (order-dispatched-rider-360, order-packed-seed-360). Every staff order page at phone width is affected. No spec catches it, because nothing overflows. Needs an owner; a follow-up, not this slice.
- [LOW] Dashboard money tiles wrap a figure mid-number ("৳1,380.0 / 0") at both widths, including S2's seeded rider-cash tile. The tile renderer is HO-P4's and untouched by S2.
- [LOW] web/components/fulfilment/PickListPage.tsx printable sheet at 360: the Quantity and Orders columns are cut off (pick-list-360). The sheet predates S2.
- [LOW] Counter sale at 360: the ticket and tender sit below the full category grid (pos-category-change-due-360). It is usable, but the cashier must scroll past every tile after each tap. HO-P4's layout with S2's grid added (D3).
- [LOW] web/components/pos/PosScreen.tsx: `presetTaken` is redundant, and its comment's "per-link counter" does not match `setPresetLink(1)` (TEST G6, M1e). Carried; harmless.
- [LOW] docs/test-cases/TC-HO-P5-WIRING-S2.md:3: the header stops at Amended (ae).
- [LOW] No gate formally reviewed 962eaa0 after SECURITY run 4. I read it, and it is SECURITY's own remediation. Recorded so the history is complete.

SCOPE CHECK
- files in allowed scope: 52 of 52 in `git diff --name-only b38ff88 HEAD`, checked by hand. b38ff88 is the merge base and the integration branch's head.
  - §13 S2 block: 44 web files.
  - Amended (z): components/back-office/tab-parts.tsx.
  - Amended (ag): test-gate-s2.test.tsx, which also falls under back-office-sales/**, and tests/e2e/sales-gate-s2.spec.ts.
  - Amended (r): 5 gate records plus the TC sheet.
  - The handover: only line 76 differs, which adds (ag). Append-only.
- files outside allowed scope: none. There are no changes in src/, .ai/, nav/, the guards, config, package or lock files, globals.css, the shared stores, or customer.ts.
- merge target: feat/phase2-catalogue-theme is at b38ff88, the merge base, with 0 commits ahead of HEAD.

NOT CHECKED
- Not rerun by me: full Vitest, typecheck, lint, build, the served-output check, E7, E8, E9, X1 and the mutations. Those rest on TEST run 1 and the integrator's recheck, and no raw logs survive.
- What I ran:
  - test-gate-s2.test.tsx and sales-chart.test.tsx: 16 passed.
  - The screenshot script: 17 browser tests, all passed. They exercised Start packing, Mark packed, a rider dispatch, a pick tick, the riders duplicate name, browse, change due, still to pay, a half-entered buyer and the preset chip.
  - The dev log for the session: 0 error or warn lines.
- No comparison against the back-office `.dc.html` files (§19). The screens keep HO-P4's interpretation, which HO-P4's ACCEPTANCE compared.
- The customer-side view of a staff-made Packed order, the "No riders set up" state, the 403 riders page, and a branch switch in a browser.
- Anything against a real API or database. Owner ratification of (m)-(ag) beyond their text.

WRITTEN BY THIS GATE
- This record and 47 PNGs under docs/gates/screenshots/HO-P5-WIRING-S2/.
- Nothing committed. No source, test or handover file touched.
- The Playwright script and its config stayed in the session scratchpad.
- The `next dev` on :3122 that I started (PID 18588 and its tree) is stopped, and :3122 is free. No chrome-headless-shell is left running.

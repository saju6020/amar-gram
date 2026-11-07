GATE: ACCEPTANCE
HANDOVER: HO-P6-SUBSCRIPTIONS (slice S2, staff subscription screens)
COMMITS: 303f4fe c46a5ff 520fdb5 7182aeb 7f7e014 d2166a4 038303a abfa183 a7c54ad f96a54a ed1e613 fc7ea06 678a404 0658df8 (range f55ea58..0658df8, branch feat/p6-s2-staff; d2166a4 merges the base f55ea58 back in)
DATE: 2026-11-07
STATUS: PASS

PRIOR GATES (read from docs/gates and docs/test-cases, not from commit messages)
- ARCHITECTURE: PASS (HO-P6-SUBSCRIPTIONS-S2-ARCHITECTURE.md, range f55ea58..038303a). Its MEDIUM (hoist staff copy) and its LOW (unpaid view has no zone) became Amended (i) and BG-S10.
- SECURITY: PASS (-SECURITY.md, range ..038303a). One LOW (encodeURIComponent on link ids), fixed in ed1e613.
- CODE_REVIEW: run 1 PASS, with one MEDIUM and several LOWs. Run 2 PASS (range a7c54ad..ed1e613); every earlier finding is verified fixed. The run-2 LOW (slow retry test) is fixed in 678a404.
- TEST: PASS (-TEST.md at 678a404). Sheet TC-HO-P6-SUBSCRIPTIONS-S2.md: 37 builder rows, plus G1-G6 and T1-T12. 0 FAIL, 0 BLOCKED. The only NOT RUN is T7, the real-API spec, which is an integration step (E18). Full Vitest at --maxWorkers=2: 255 files, 2493 tests passed. tsc and lint exit 0. S2 specs: 76 passed on chromium and mobile-360. Run-only E12: 284 passed. Two staff-customers load flakes passed on a clean rerun at 1 worker.
- Slice report: HO-P6-SUBSCRIPTIONS-S2-SLICE-REPORT.md exists and covers every item §17.3 asks for.
- Note: the ARCHITECTURE and SECURITY records were written before ed1e613. That commit holds the Amended (i) copy.ts hoist, the mock 404-before-role fix and the link encoding. CODE_REVIEW run 2 and TEST cover it. I checked the copy.ts diff myself (see SCOPE).

My own re-run at 0658df8: `npx vitest run tests/components/staff-subscriptions tests/unit/staff-nav-groups.test.ts tests/unit/subscriptions --maxWorkers=2` gave 13 files and 224 tests passed.

CRITERIA (§18 rows that bind S2: A12, A13, and A17-A20 as far as S2 reaches)
- A12 MET. URL filters, sort, CSV with the 413 explained, and the unpaid worklist grouped Suspended / At risk.
  - tests/e2e/subscriptions-staff.spec.ts:
    - Suspended + UnpaidCycles writes `status=` and `suspensionReason=`, keeps 2 rows across a reload, and Clear filters empties the URL.
    - Export: the request query equals `{status:'Suspended', sort:'product'}` (no paging), the file name is `subscriptions.csv`, and the header row carries the quoted 12 columns.
    - With `setMaxExportRows(2)`, the alert says "Too many rows to export. Narrow the filters.".
    - The Unpaid regions are "Suspended" and "At risk", with ORD- links and "Expired unpaid".
  - Component tests: staff-list.test.tsx :157 (413) and :165 (403); unpaid.test.tsx (U29); U27a-f and U28a-c.
  - All of these pass in TEST T3/T4 and in my re-run.
- A13 MET. Restart and cancel are limited to ShopManager/Administrator, other roles see the record only, and a 403 is shown in place.
  - E9 restart: an empty reason is refused with its sentence; with a reason the status region shows "Restarted. Next delivery on…", Records shows the reason, and the row leaves Suspended.
  - E9 cancel: unlocked ends at once ("Cancelled by the shop, {note}"). After `lock`, the dialog uses the prepared-delivery wording and the result is "Cancellation scheduled. Ends after…".
  - Reception and Accountant see the who-can-act sentence and no Restart or Cancel.
  - staff-detail.test.tsx:263 sends a 403 on reinstate. The test asserts "You don't have permission to do this." and that both action buttons are gone.
  - Role arrays: mock = web = ActionRoles.Subscriptions.cs:12-14 (U34a, mock-refusals.test.ts).
- A17 MET (S2 part).
  - E10 subscriptions-staff-360.spec.ts (8 cases × 2) covers the list cards, Unpaid, detail, both dialogs and the sidebar sheet, with no sideways scroll and 44 px controls.
  - E11 subscriptions-staff-a11y.spec.ts (18 cases × 2) finds zero serious or critical issues on every screen, both dialogs and the 413 message.
  - Colour-literal rg check: 0 hits (TEST T11).
  - My own measurement: page overflow is 0 at 1280 and at 360.
- A18 MET (S2 part).
  - U34 mock-refusals.test.ts covers the { error } 400s, the 403 per role, 413 above the cap, 404 with no body (non-GUID before the role check), the validator-before-handler order and the reinstate/cancel rule codes.
  - Slice report §5 cites the server file:line for each one.
  - ARCHITECTURE checked the mock line by line against src/.
- A19 MET. Every changed file is in S2's §13 block or is authorised by an Amended row (see SCOPE). There is no src/, .NET test, config, package or lock change: `git diff --name-only f55ea58..0658df8` lists only web/** and docs/**.
- A20 MET (per-slice part). tsc exit 0, lint exit 0 and full Vitest pass at --maxWorkers=2 (TEST T1-T3, at 678a404). 0658df8 changes only docs. Build, full e2e and the contract test are integration steps (§17.2, E16/E18).
- A21 not breached. S2 builds no BG-S item: there is no Subscriber filter, and T3/T9 are left to S3. The staff mock skips `due-tomorrow` (staff.ts:204).

SCREENSHOTS (§19), compared at 360 and 1280 with docs/design/subscriptions/{StaffSubscriptions,StaffUnpaid,StaffSubscriptionDetail,StaffDetailReadOnly,StaffDialogs}.dc.html
- docs/gates/screenshots/HO-P6-S2/ holds 20 PNGs:
  - list: all, filtered Suspended, 360 viewport, and 1280 scrolled right
  - unpaid
  - detail: suspended manager, active manager, read-only Reception
  - Restart dialog: empty, and refused without a reason
  - Cancel dialog
- How they were taken: `next dev` on PORT=3129 with mocks and API base http://localhost:5005. The capture spec and config lived in the scratchpad only. The server was killed afterwards; 3129 is free, and 3128 and 5005 were not touched.
- Tokens: today's back-office tokens throughout. That means the staff shell, the Fraunces headings, the accent buttons and the warning band for suspension. Status pills are a word plus an icon.
- Wording matches the design or the handover's revised copy: "Restart {customer}'s subscription to {product}?", "Keep suspended", "Keep subscription", "Never: none recorded", "Not cancelled", "None while paused/suspended" and "Pay by … (Asia/Dhaka)".
- Deviations from the design, all declared or required by the handover:
  - Taller list rows, because links are 44 px targets (UI-1). Declared in slice report §7.3 and accepted by CODE_REVIEW.
  - No counts on All/Unpaid. The design shows 1,284 and 5; §11.3.3 does not ask for counts. Declared in slice report §7.8 and accepted by CODE_REVIEW.
  - The design's separate "Reason" column is a second line under the status pill, as §11.3.3 says.
  - "Unpaid in a row" and "Last order" columns are added (§11.3.3).
  - "Discount" in Records is replaced by the server Estimate panel (§11.3.5).
  - "Reinstate" is labelled "Restart" (§10.2).
  - Omitted because the view has no data (ADR-FE-177):
    - customer email on the detail (T5 `customer` is id/name/mobile)
    - payment method and next order on Unpaid rows (T2 view)
    - "subscribed online on" (no channel field)
  - The Restart dialog shows no restart-date range (BG-S6 / OQ-16).
  - The reinstater's name is not shown (BG-S5 / OQ-15).
- At risk shows an Active subscription with "0 unpaid in a row" and one cycle awaiting payment. That is the server's rule, not a mock error: SubscriptionStaffQueryHandlers.cs keeps an Active row with `Streak >= 1 || any AwaitingPayment` in group AtRisk.

FINDINGS (none blocks a criterion)
- [LOW] web/components/staff-subscriptions/StaffSubscriptionsList.tsx (ResponsiveTable at ≥ 768 px) — at 1280 with the expanded sidebar, the nine-column table is wider than its container. I measured scrollWidth 1142 against clientWidth 966. "Unpaid in a row" and "Last order" sit off-screen behind an inner horizontal scroll (list-1280.png; list-1280-scrolled-right.png shows them). The page itself does not scroll sideways, so UI-1 holds. But the worklist columns a reader most needs are hidden at the reference desktop width, and the off-screen two-line "Last order" cells make some rows taller than the visible content explains. A visual call for the owner or integrator: narrower columns, or merging Mobile into Customer, would fit it.
- [LOW] Process — the ARCHITECTURE and SECURITY records predate the gate-fix commit ed1e613. Coverage is adequate (CODE_REVIEW run 2, TEST, and my scope check below), so this is noted only.

SCOPE
- Out-of-scope work (§4) found: none.
  - No T3/T9 handler or hook use.
  - No Subscriber filter.
  - No payment capture.
  - No client schedule or money arithmetic (ARCHITECTURE, CODE_REVIEW).
  - One extra hook, `useStaffSubscriptionMoreCycles`, serves §11.3.5's "Show more via T6" and is in S2's own file.
- Files in S2's §13 block: all web/app/(staff)/staff/subscriptions/**, web/components/staff-subscriptions/** (16), lib/hooks/useStaffSubscriptions.ts, mocks/handlers/subscriptions/staff.ts, tests/components/staff-subscriptions/** (5), tests/e2e/subscriptions-staff{,-360,-a11y,-real-api}.spec.ts, and the S2 docs/gates and docs/test-cases files.
  - nav/areas/subscriptions.ts has exactly one staff item, as in §11.3.2.
  - components/common/staff-nav-groups.ts has exactly one Sales entry after Customers.
  - tests/unit/staff-nav-groups.test.ts only has one describe appended; no existing line changed.
- Outside the block, authorised:
  - web/components/common/staff-shell.tsx, under Amended (h). The diff is the `Repeat` import and `repeat: Repeat` and nothing else.
  - web/lib/subscriptions/copy.ts, under Amended (i). The diff adds exactly the listed exports, plus `pendingStatusChangeText` added to an existing import line. No existing export changed.
  - docs/handover/HO-P6-SUBSCRIPTIONS.md, integrator §1 rows. `git diff f55ea58..0658df8` on it has no removed lines. It adds only the "| Amended |" rows (h) and (i) and the BG-S10 gaps-table row that (i) names.
- Files outside allowed scope: none.

UNDECLARED DEVIATIONS
- none. Every design difference above is declared in the slice report, set by the handover text, or an omission for lack of data. The 1280 inner-scroll observation is new, but it is a layout effect, not a deviation from any rule.

FOR THE OWNER
- §20.9 cross-branch order links. Order links on the detail and Unpaid pages are kept and never hidden or redirected. On the real API, an order raised at another branch would show the order page's own 404 or 403. The mock's orders are not branch-scoped, so this is unproven. It is an open question.
- BG-S10 (new): `commerceTimeZoneId` on `UnpaidSubscriptionViewModel` (SubscriptionViewModels.cs:81-88). Until it exists, Unpaid pay-by times are shown in Asia/Dhaka with the zone named. The server's zone is the main branch's editable TimeZoneId, so the two could diverge.
- BG-S5 (reinstater's name) and BG-S6 (staff restart-date range) shape S2's screens directly. BG-S1-S4 and BG-S7-S9 stay open as listed in the handover.
- Blank-reason text on the real API: the mock sends FluentValidation's default "'Reason' must not be empty.". This is unconfirmed until the E18 real-API run.
- The 1280 list width (LOW above).

SCOPE CHECK
- files in allowed scope: 42/42 changed files (f55ea58..0658df8), counting the Amended-authorised files, plus this record and the screenshots
- files outside allowed scope: none

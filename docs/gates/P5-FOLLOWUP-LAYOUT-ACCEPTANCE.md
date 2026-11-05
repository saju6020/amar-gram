GATE: ACCEPTANCE
HANDOVER: P5-FOLLOWUP-LAYOUT (no handover document; the criteria are the original wording of the seven findings in docs/gates/HO-P5-WIRING-S2/S3/S4-ACCEPTANCE.md, as listed in the launching agent's brief)
COMMITS: 62d5849 1e1490b 7d93b0a f3a9b00 ed5701f 0641789 1dd9d10 4e7dcce c071242 f74430a 6e0e3e2 906e3b7 c0b42cf 230a0d0 (HEAD 230a0d0, branch feat/p5-followup-layout)
DATE: 2026-11-05
STATUS: FAIL

PRIOR GATES
- ARCHITECTURE: PASS (P5-FOLLOWUP-LAYOUT-ARCHITECTURE.md, commits up to 1dd9d10)
- SECURITY: PASS (P5-FOLLOWUP-LAYOUT-SECURITY.md, commits up to 1dd9d10)
- CODE_REVIEW: PASS (P5-FOLLOWUP-LAYOUT-CODE_REVIEW.md, commits up to 1dd9d10)
- TEST: PASS (P5-FOLLOWUP-LAYOUT-TEST.md, e42c3a6..4e7dcce plus the c071242 work; the integrator addendum covers 906e3b7)

EVIDENCE I GATHERED
- Ran my own Playwright probe (scratch spec outside the repo, using web/tests/e2e/fixtures) against next dev on :3121 with mocks, at HEAD 230a0d0. 9/9 and 3/3 passed. Screenshots are saved as docs/gates/screenshots/p5-followup-layout/acc-*.png.
- Vitest tests/components/dashboard and tests/components/fulfilment: 3 files, 23/23 pass.
- Viewed dashboard-768/1024/1440.png and pick-list-1280.png (TEST), plus all acc-*.png.

CRITERIA
- S4 F4: "/staff/customers at 360 px: the search input is about 118 px wide beside the Search button, so the placeholder is cut ("Name, ı") and a typed term scrolls."
  NOT MET. The input is now 206 x 44 px. The Search button sits below it at 44 px. A typed "Rahman" no longer scrolls (scrollWidth 204 = clientWidth 204), and the page has no overflow. But the placeholder is still cut. "Name, mobile or email" measures 156 px in the input's font, while the content box is 152 px. acc-customers-360.png shows "Name, mobile or em". The label is visually hidden, so the cut placeholder is the only visible prompt. The finding names this as the defect. TEST I1/N4 only check width >= 200 and height, so they cannot see it.
- S4 F5: "At 360 px the value column is about 50 px wide and mobile, email and area break mid-word."
  MET. CustomerDetail.tsx puts the label above the value below sm, so each dd is now 206 px wide. The probe returned "01799999999" and "Dhanmondi" on one line each. The email wraps only at its hyphen ("signed-in- / customer@example.com"). The spec's splitWords check (I2) returns []. See acc-customer-profile-360.png.
- S4 F7: "The roster page's exception "Cancel" link-buttons are 20 px tall."
  MET. Measured 63 x 44 px at 360 and at 1280, on an exception added for today (roster page.tsx:234, min-h-11). See acc-roster-exceptions-360/1280.png.
- S2 order panels: "At 360 px the value column of the "Customer and fulfilment" and "Shipment" panels is about 4 characters wide, so names, addresses and "Rafiq Hasan" break mid-word."
  MET. ROW_LIST in StaffOrderPanels.tsx:19-20 covers all three panels. At 360, all 14 dd measure 198 px. The address wraps only between words. The splitWords check (I4) returns []. See acc-order-panels-360.png.
- S2 money tiles: "Dashboard money tiles wrap a figure mid-number ("৳1,380.0 / 0") at both widths."
  MET. Line count from a Range over each figure's text: every one of the 13 figures is 1 line at 360 and at 1280, including ৳1,380.00 and ৳58,000.00. Span height is 35 px against a line-height of 35 px. N1 shows no figure overflows its tile or overlaps another at 360/768/1024/1280/1440. The 906e3b7 unit test asserts that <wbr> follows only thousands separators. On the desktop change (figures stacked in one column, taller tiles), the 768/1024/1440 screenshots show every figure whole and readable. The tiles are taller, with blank space in the shorter tiles of a row. I accept that as a deliberate trade-off.
  Note: the I5 assertion `getClientRects().length === 1` is vacuous. The span is a flex item, so it is blockified and returns one rect however many lines it has. It would have passed on the original bug as well. The evidence above comes from my Range measurement, not from I5.
- S2 pick list: "printable sheet at 360: the Quantity and Orders columns are cut off."
  MET as worded. The region's scrollWidth is 182 and its clientWidth is 182, with no page overflow. "Qty" and "Orders" are visible (I6). Print at 794 px still shows Expires (N2). The 1280 screenshot shows all five columns with no wrapping.
  New defect introduced by this fix (see FINDINGS): at 360 the new inline "Expires …" line breaks mid-word in every row ("Expire / s").
- S3 F2: "At 1280 the Status column is cut at the frame's edge; at 360 only Select and a ~60 px Product column show until scrolled, names wrap a word a line and the page is about 3,700 px tall."
  MET. At 1280 the frame's scrollWidth is 966 and its clientWidth is 966. The Status header ends at x=1176, inside the frame, which ends at 1252. At 360 the Product header is 208 px wide, no td word breaks mid-word, and the page is 2,853 px tall (was 3,694). See acc-products-360/1280.png. On the desktop change (px-2.5 padding), product names now wrap to 3-5 lines at 1280. I accept that as the cost of fitting eleven columns.

SCOPE
- Out-of-scope work found: none. The POS ticket is untouched. All 8 source files map to one of the seven findings.
- Files outside allowed scope: none. The changes are 8 web/ source files, 2 web/tests unit files, 1 e2e spec and docs/gates artifacts.

FINDINGS
- [LOW, blocks this gate] web/components/customer/CustomerBrowsePanel.tsx:86-96. S4 F4 is only partly fixed: the placeholder "Name, mobile or email" is still clipped at 360 (text 156 px, content box 152 px). Shrinking the input's horizontal padding or icon gap by about 4 px, or using a shorter placeholder, would close it. Add a test assertion that compares the placeholder width to the content box.
- [LOW] web/components/fulfilment/PickListPage.tsx:58-61. The new inline `Expires {date}` span sits inside a td with `[overflow-wrap:anywhere]`. At 360 the cell is narrow enough that "Expires" splits "Expire / s" in all 3 rows (measured; visible in acc-pick-list-360.png). The fix introduced this mid-word break. Put `[overflow-wrap:normal]` or `whitespace-nowrap` on the word, or keep the date on its own line.
- [LOW] web/tests/e2e/p5-followup-layout-360.spec.ts:91-92. The "no money figure splits across lines" assertion counts getClientRects() on a flex item, which always returns 1. Measure with a Range over the text, or compare the height to the line-height.
- [LOW] Process: c071242 (DashboardTile grid) and 906e3b7 (TileFigure <wbr>) change production code after the ARCHITECTURE, SECURITY and CODE_REVIEW runs (their COMMITS stop at 1dd9d10). No gate after TEST saw 906e3b7, only the integrator's addendum. I read both: they change classes and markup only, add no data or HTML injection (`<wbr>` is a React element), and are covered by my measurements above. Not blocking, but it needs recording.
- [LOW] Process: the TEST case sheet lives in docs/gates/P5-FOLLOWUP-LAYOUT-TEST.md, not in docs/test-cases/TC-P5-FOLLOWUP-LAYOUT.md. I accepted it, since the content is a full TC sheet.

UNDECLARED DEVIATIONS
- The pick list "Expire / s" mid-word break, introduced by ed5701f and not reported by any gate.
- F4 was reported as fixed by width alone. The placeholder clipping the finding names was not addressed or declared.

SCOPE CHECK
- files in allowed scope: 11/11 (web) plus docs/gates artifacts
- files outside allowed scope: none

---

# Run 2

GATE: ACCEPTANCE
HANDOVER: P5-FOLLOWUP-LAYOUT (same criteria as run 1)
COMMITS: run 1 set plus e7cdce1 8d8e2a5 8009c2c (HEAD 8009c2c, branch feat/p5-followup-layout)
DATE: 2026-11-05
STATUS: FAIL

PRIOR GATES
- ARCHITECTURE / SECURITY / CODE_REVIEW: PASS as recorded, up to 1dd9d10. The delta review of c071242, 906e3b7 and e7cdce1 is below (finding 4).
- TEST: PASS (P5-FOLLOWUP-LAYOUT-TEST.md and its addendum). The integrator reports 42/42 for p5-followup-layout-360 and customers-admin-360 at 8d8e2a5. I re-ran p5-followup-layout-360 myself on chromium and mobile-360: 36/36 pass.

EVIDENCE I GATHERED
- next dev on :3121 with mocks, at HEAD 8009c2c. Ran the run-1 probe again (acc.spec.ts and probe2.spec.ts, screenshots to the scratchpad): 12/12. Ran the run-2 probe (run2.spec.ts and run2b.spec.ts): 5/5. Ran the repo spec: 36/36.
- Refreshed acc-customers-360.png and acc-pick-list-360.png. Added acc-customers-360-field.png (the field as rendered) and acc-customers-360-field-no-cancel-button.png (the same field with the UA cancel button hidden, for comparison).
- The repo spec rewrote pick-list-1280.png as a side effect. I restored it to the committed version.

CRITERIA
- S4 F4: NOT MET (finding 1 is still open). The panel padding change widened the input from 206 px to 214 px (inner 160 px). The placeholder measures 155.7 px (canvas) and 155.3 px (rendered span), so on paper it fits. On screen it does not: acc-customers-360.png and acc-customers-360-field.png both show "Name, mobile or ema". The cause is Chrome's `input[type=search]` (web/components/back-office/SearchField.tsx:51). Its `::-webkit-search-cancel-button` keeps its layout space even when the field is empty, which takes roughly 10-15 px from the editable area. Two checks prove it:
  - If I hide that pseudo-element, the full placeholder shows (acc-customers-360-field-no-cancel-button.png).
  - If I set the input's value to the placeholder text, it scrolls: scrollWidth 221 > clientWidth 212.
  The typed term "Rahman" no longer scrolls (212 = 212), and the page has no overflow.
  The new spec assertion (p5-followup-layout-360.spec.ts:51-59) compares the canvas text width with clientWidth minus padding. That cannot see the reserved cancel-button area, so it passes while the defect is visible.
- S4 F5: MET, unchanged. Each dd is 206 px wide. "01799999999" and "Dhanmondi" are one line each, the email wraps only at its hyphen, and splitWords returns [].
- S4 F7: MET, unchanged. Cancel is 63 x 44 px at both 360 and 1280.
- S2 order panels: MET, unchanged. All 14 dd are 198 px wide and splitWords returns [].
- S2 money tiles: MET, and finding 3 is closed. Every one of the 13 figures is 1 line at 360 and at 1280 by the Range line-top count. The spec now uses the same count (spec:100-108). Sensitivity check: I squeezed each figure to 40 px with overflow-wrap:anywhere. The new count then reported [1,1,1,1,1,5,1,5,5,5,3,5,1]; the 1s are figures short enough to still fit. The old getClientRects() count still reported all 1s. So the test can now fail.
- S2 pick list: MET, and finding 2 is closed.
  - At 360 the region's scrollWidth is 182 and its clientWidth is 182, with no page overflow.
  - splitWords over tbody td returns [] in my probe, and the spec now asserts the same (spec:213-214).
  - Each inline line reads "Expires / 31 Mar / 2027", breaking only between words. The `[overflow-wrap:normal]` word does not overflow its 52 px cell: the rightmost span ends at x=226 and the td at x=232.
  - Print at 794 px: the Expires header is visible, the date cell is a table-cell holding "31 Mar 2027", and the inline copy is display:none. The repo print test passes on both projects.
- S3 F2: MET, unchanged. At 1280 the frame's scrollWidth is 966 and its clientWidth is 966, with Status ending at x=1176. At 360 the Product header is 208 px wide, splitWords returns [], and the page is 2,853 px tall.

FINDING 4: DELTA REVIEW (ARCHITECTURE, SECURITY, CODE QUALITY) OF c071242, 906e3b7, e7cdce1
- c071242 (DashboardTile.tsx): removes `@container` and switches the dl to `grid-cols-[repeat(auto-fit,minmax(min(100%,12rem),1fr))]`. Presentational only, inside the component, no new dependency. Security: nothing. Quality: fine. Rows of tiles now have uneven heights, which run 1 accepted as a trade-off.
- 906e3b7 (TileFigure.tsx and dashboard.test.tsx): splits the formatted text on `(?<=,)` and puts React `<wbr />` elements between the parts. There is no dangerouslySetInnerHTML, the text is still React-escaped, and the accessible text is unchanged (covered by the unit test). Architecture: still renders only formatFigure's output, so ADR-FE-131's single rendering path holds. Two LOW quality notes, neither blocking:
  - (a) Dropping `whitespace-nowrap` means figures with spaces (unit suffix "N unit", dates "dd MMM yyyy", instants) can now wrap between words. No mock figure does, but no test covers it.
  - (b) Dropping `[overflow-wrap:anywhere]` means a long comma-free figure overflows instead of wrapping. N1 checks containment only on the mock data.
  - The regex lookbehind needs Safari 16.4 or later. Acceptable for current targets.
- e7cdce1 (CustomerBrowsePanel.tsx, PickListPage.tsx): class and markup changes only. Security: nothing. Architecture: fine. Quality: the pick-list change is correct and minimal. The F4 change aims at the wrong constraint, because the panel padding was not what clips the placeholder (see F4 above).
- Conclusion: none of the three adds security or architecture risk. The process gap from run 1 is closed by this review.

SCOPE
- Out-of-scope work found: none. e7cdce1 changes only the two files tied to findings 1-2. 8d8e2a5 changes only the follow-up spec.
- Files outside allowed scope: none.

FINDINGS
- [LOW, blocks this gate] S4 F4 is still not met. The placeholder is visibly clipped at 360 because Chrome reserves the search cancel button's space in `type="search"` (web/components/back-office/SearchField.tsx:46-60). Possible fixes:
  - a shorter placeholder for this screen;
  - another ~12 px of width;
  - hiding the cancel decoration while the field is empty, e.g. `[&:placeholder-shown::-webkit-search-cancel-button]:hidden`. That keeps the clear button when there is text.
  SearchField is shared, so a change there needs a check of its other callers.
- [LOW, blocks this gate together with the above] p5-followup-layout-360.spec.ts:51-59. The placeholder-fit assertion uses canvas width against clientWidth minus padding, which cannot see the UA-reserved area, so it passes while the defect is visible. A sound check: set `input.value = input.placeholder` and assert `scrollWidth <= clientWidth`, then clear it. It measured 221 > 212 here.
- [LOW, non-blocking] TileFigure.tsx: the nowrap and overflow-wrap removals, notes (a) and (b) above.
- Closed: run-1 finding 2 (Expires split), finding 3 (vacuous dashboard test) and finding 4 (process gap, by this delta review).

UNDECLARED DEVIATIONS
- e7cdce1 and 8d8e2a5 were reported as fixing the placeholder. The placeholder is still visibly cut, and the new test cannot detect it.

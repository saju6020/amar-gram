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

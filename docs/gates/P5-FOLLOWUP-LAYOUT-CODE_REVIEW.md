GATE: CODE_REVIEW
HANDOVER: P5-FOLLOWUP-LAYOUT
COMMITS: 62d5849 1e1490b 7d93b0a f3a9b00 ed5701f 0641789 1dd9d10
DATE: 2026-11-05
STATUS: PASS

FINDINGS
- [LOW] web/components/dashboard/TileFigure.tsx:25 — whitespace-nowrap on the figure span removes the parent dd's overflow-wrap:anywhere safety net. In the 2-column state (container >= 20rem, columns ~154 px) a long money value at 28 px bold could spill past its column into the neighbouring figure. The E2E only asserts the span stays inside the tile's right edge, not that it clears the sibling column. Suggest also asserting figure.right <= next figure.left, or keeping `min-w-0 max-w-full` and a smaller font at narrow container widths.
- [LOW] web/components/dashboard/DashboardTile.tsx:34,39 — desktop-visible: switching from viewport `min-[420px]` to `@[20rem]` (320 px of content box, tile minus 36 px padding) means multi-figure tiles in multi-column dashboard grids at 1024/1280 now stack to 1 column where they were 2-up before. Intentional per the goal and covered at 1280 by a test, but it makes those tiles taller; owner should eyeball 768/1024/1440.
- [LOW] web/components/staff-shop/StaffProductTable.tsx:313 — bulk-select label still `-m-3` (12 px) against the new 10 px cell padding (px-2.5). Tap box overhangs the cell by ~2 px each side, into neighbouring cell padding only (adjacent Product cell also has 10 px padding, so no content overlap and no overlap with another target). Not a defect; change to `-m-2.5` for tidiness.
- [LOW] web/components/customer/CustomerBrowsePanel.tsx:86 — form becomes flex-col below sm; if SearchField carries `flex-1`, in a column flex container it only matters for height and is harmless with auto height, but the F4 test checks only width (>=200) and button height, not that the field itself did not grow vertically. Optional.
- [LOW] web/tests/e2e/p5-followup-layout-360.spec.ts:64-75 — roster F7 now adds an exception through the UI. The mock DB persists via browser storage (rosters.ts PERSIST_KEY), i.e. per browser context, so a 2-worker run does not share it, and retries:1 simply adds a second row (cancels.first() / all-boxes assertion still valid). It relies on the form defaulting to today and on the mock listing it in the current-week view; if the default date ever changes the test fails by timeout on cancels.first(), not with a clear message. Acceptable. No other spec uses the 'Roster exceptions' region or Nadia Karim exceptions in a conflicting way (grep).
- [LOW] web/components/fulfilment/PickListPage.tsx:54-62 — below sm the Expires date is rendered twice in the DOM (inline under Batch, plus a display:none td). Correct for AT (display:none is skipped) and for print (viewport is >= sm on A4), but jsdom tests see both. The Vitest change to accessible-name matching is sound (4/4 pass) and does not assert the mobile inline "Expires" text; optional.

NOTES (no action)
- tsc --noEmit clean; vitest tests/components/fulfilment 4/4 pass. E2E not run per instructions.
- Tailwind 4.3.3, so `@container` / `@[20rem]` are core utilities; no plugin needed.
- Roster Cancel: min-h-11 inline-flex px-2 meets 44 px height; li is flex-wrap, so no desktop regression.
- Products table: px-4 -> px-2.5 applied via the headerClassName/cellClassName props; `min-w-52 sm:min-w-0` keeps Product readable at 360 and lets it shrink at >= 640. Status nowrap keeps the pill whole. Table semantics unchanged (scope=col headers kept, region keeps tabIndex/name).
- Order panels / customer detail: label-over-value below sm; dt/dd semantics preserved.
- No superseded-architecture items; frontend-only change.

SCOPE CHECK
- files in allowed scope: 10/10 (web only)
- files outside allowed scope: none

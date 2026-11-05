GATE: ARCHITECTURE
HANDOVER: P5-FOLLOWUP-LAYOUT (no handover document; scope taken from the launching agent's brief, see SCOPE BASIS)
COMMITS: 62d5849, 1e1490b, 7d93b0a, f3a9b00, ed5701f, 0641789, 1dd9d10 (range e42c3a6..HEAD -- web; merge 5be5bec adds nothing under web/ to this range)
DATE: 2026-11-05
STATUS: PASS

SCOPE BASIS
There is no `docs/handover/` document for this change, so there is no §6/§13/§14 to review against.
This gate used the launching agent's brief as the allowed scope: fix the 7 LOW/MEDIUM layout items
recorded in docs/gates/HO-P5-WIRING-S2-ACCEPTANCE.md (order panels at :156, dashboard money tiles at
:157, pick list at 360), HO-P5-WIRING-S3-ACCEPTANCE.md F2 (:137), and HO-P5-WIRING-S4-ACCEPTANCE.md
F4/F5/F7 (:213-216), presentation only, with the POS ticket left out. Each changed file was matched
to one of those findings. The brief says the owner approved this; this gate cannot check that.
The `.ai/` backend checklist (layers, aggregates, CQRS, persistence, events, host) does not apply:
the diff touches no file outside `web/`, and nothing under `web/` changes API calls, mocks, types
or data handling.

FINDINGS
- [LOW] web/components/dashboard/TileFigure.tsx:25 — `whitespace-nowrap` on the figure span sits inside a `dd` that still has `[overflow-wrap:anywhere]`. A figure wider than its tile now overflows the tile instead of wrapping. The `@container` / `@[20rem]` switch in DashboardTile.tsx:34,39 should keep every seeded figure inside its column, but this gate cannot observe that. Marked for TEST: at 360 and 1280, check the longest money figure (the rider-cash tile) stays inside its tile.
- [LOW] web/components/fulfilment/PickListPage.tsx:46,63 — below `sm` the Expires column is `hidden`, and the date moves into the Batch cell (:60). That is acceptable, but print depends on `sm:table-cell` matching the print page width. A4/Letter print widths are above 640 px, so this should hold. Marked for TEST/ACCEPTANCE: the printed pick list still shows the Expires column.
- [LOW] No handover document governs this change (see SCOPE BASIS). This is a process note, not a code defect. Later gates should cite this same brief as the scope.

Checks with no finding:
- Presentation only. All 8 changed source files change only `className` strings, JSX layout wrappers and one local `const expires` that reuses the existing `formatDateOnly` call. No fetches, hooks, props contracts, mock handlers, types or business rules change. The fulfilment unit test (fulfilment.test.tsx:31-35) now asserts header accessible names instead of textContent, and still checks the same five columns in the same order. The new e2e spec only measures layout.
- Tokens and conventions. Only theme tokens (`text-ink-muted`, `text-danger-ink`, `border-border`) and default Tailwind scale classes (`min-h-11`, `px-2.5`, `min-w-52`, `gap-y-0.5`) are used. No new arbitrary values are introduced. `@container` / `@[20rem]` is built into Tailwind 4.3.3 (web/package.json:63), so no plugin or dependency is added.
- Shared components. StaffProductTable sets padding through the existing `headerClassName`/`cellClassName` props on DataTable (DataTable.tsx:51-52). DataTable merges those props with `cn()` = `twMerge(clsx())` (web/lib/utils.ts:6-7), so `px-2.5` deterministically replaces the base `px-4`, and DataTable itself is unchanged. The stacked `dl` pattern (ROW_LIST in StaffOrderPanels.tsx:19-20, and the matching classes in CustomerDetail.tsx:53-66) follows the local per-component `dl` grid convention. No shared description-list component exists to reuse (about 10 components each define their own grid). It is not a one-off divergence.
- Accessibility parity. The roster Cancel button is now 44 px (`min-h-11`), which matches the 44 px minimum in docs/design/orders/README.md:117. In the pick list, the "Qty" abbreviation is `aria-hidden` and the full "Quantity" is kept as `max-sm:sr-only`, so the column header keeps the same accessible name.
- Desktop-visible changes, judged acceptable:
  - Dashboard tiles stack figures at 1280 when a tile is narrower than 20rem. This is the intended fix for figures that wrapped mid-number (S2 :157 reported it at both widths).
  - Expires is `whitespace-nowrap` at all widths. Dates should not wrap.
  - Roster Cancel is 44 px at all widths. Touch targets are not width-specific.
  - Products table padding is `px-2.5` at all widths. This is the S3 F2 fix at 1280 itself.
  - Pick list layout at `sm` and above: only the padding classes are restated and Expires gains nowrap. The `text-sm`, four-column and five-column layouts are otherwise as before.
- No new npm dependency. The package.json files are unchanged.

SCOPE CHECK
- files in allowed scope: 10/10 (8 source files, each tied to a listed finding: roster page = S4 F7, CustomerBrowsePanel = S4 F4, CustomerDetail = S4 F5, DashboardTile/TileFigure = S2 money tiles, StaffOrderPanels = S2 order panels, PickListPage = S2 pick list, StaffProductTable = S3 F2; plus fulfilment.test.tsx updated for the pick-list header change and the new p5-followup-layout-360.spec.ts)
- files outside allowed scope: none (the POS ticket is untouched)

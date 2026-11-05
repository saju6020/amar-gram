GATE: SECURITY
HANDOVER: P5-FOLLOWUP-LAYOUT
COMMITS: 62d5849, 1e1490b, 7d93b0a, f3a9b00, ed5701f, 0641789, 1dd9d10 (range e42c3a6..1dd9d10, path web/)
DATE: 2026-11-05
STATUS: PASS

FINDINGS
- none

Checked:
- All 8 source files change only Tailwind classes and markup: roster page, CustomerBrowsePanel, CustomerDetail,
  DashboardTile, TileFigure, PickListPage, StaffOrderPanels, StaffProductTable. They add no new data fields,
  props, fetches or API calls.
- PickListPage moves `expiresOn` into a second span (shown below `sm`). It is the same field, already
  rendered, and React still escapes it as text. StaffOrderPanels only pulls the shared `dl` class into
  the `ROW_LIST` constant and leaves the fields shown unchanged (including the customerAnonymised branch).
- No dangerouslySetInnerHTML, innerHTML, eval or new URL/href built from data anywhere in the diff.
- Auth and role gating are unchanged. Roster Cancel only gets new classes, with the same onClick and the
  same confirm flow. The staff product Select column is still gated by the existing condition.
- No package.json or lockfile changes, so no new dependencies.
- The test code (web/tests/components/..., web/tests/e2e/p5-followup-layout-360.spec.ts) stays under
  web/tests. App code does not import it, so it is not in the app bundle. The e2e spec uses the existing
  signInAsStaff fixture and mock fixture IDs, with no hardcoded credentials, tokens or env secrets.

SCOPE CHECK
- files in allowed scope: 10/10 (8 layout source files, 2 test files)
- files outside allowed scope: none

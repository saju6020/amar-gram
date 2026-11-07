GATE: CODE_REVIEW
HANDOVER: BASELINE-FIXES
COMMITS: 9ce36a8 544278e 2cfa2b7 2118044 c00e1ae 66bc645
DATE: 2026-11-07
STATUS: PASS

FINDINGS
- [LOW] web/components/operations/OverdueRestoreBanner.tsx:25 — the new suppression has no test. No unit or e2e asserts the banner is absent on /staff/admin/operations/backup* (xct-operations E-D1 only checks it appears on /staff/admin/branches). Add a case that the banner is hidden on the backup page and still shown on a sibling such as /staff/admin/operations/drill. Match is `startsWith('/staff/admin/operations/backup')`, which would also match a future `/backup-something`; use `pathname === BACKUP_HREF || pathname.startsWith(BACKUP_HREF + '/')`.
- [LOW] web/components/admin/AdminNav.tsx:77 — below sm the active chip (aria-current) can sit outside the visible part of the scrolling row, and the row is not scrolled to it. Keyboard reach is fine (links are focusable and the browser scrolls a focused link into view), but a sighted user opening the group on the page they are on may not see which chip is current. Scroll the active chip into view with the same container-scroll approach as staff-shell. Chips are min-h-10 (40 px), under the 44 px target; this is unchanged by the diff, but the new scroller makes them the only row of targets. Raise to min-h-11 when touched. A scrollable region with no tabindex is acceptable here because its content is focusable.
- [LOW] web/components/common/portal-header.tsx:187-190 — aria-label "Inbox, N unread messages" replaces the visible text "Messages", so the accessible name does not contain the visible label (WCAG 2.5.3 Label in Name; speech-control users saying "Messages" would miss). The same name is used by the desktop envelope button and the e2e relies on it, so this is consistent with the existing pattern. Prefer a name starting with the visible text, e.g. "Messages, N unread", and update inboxAccessibleName or the spec together.
- [LOW] web/tests/components/back-office-overview/*.test.tsx, receiving-layout.test.tsx — vi.setConfig({testTimeout: 30_000}) is file-wide, so a real regression to a 20 s test will now pass. Justified by the recorded 24.7 s under-load run; acceptable, but keep it per-file and record the unloaded duration so a real slowdown stays visible.
- [LOW] web/tests/e2e/xct-operations.spec.ts:76-81 — setBackup now re-invalidates inside toPass up to 30 s. The comment explains a real React Query in-flight race that is a test-harness artefact, so the retry is justified. It would also hide a product defect where invalidation never refreshes the status, though the final visible assertion still proves the page can show the scenario.

NOTES (no action)
- staff-shell.tsx: scrolling the nav container directly keeps the first Tab at the top of the page (scrollIntoView set the sequential focus starting point). The offset arithmetic is correct (rect delta, centred by clientHeight and offsetHeight). With the aside hidden, all rects are 0 and scrollTop is unchanged. Only the aside container gets the ref; the sheet is not affected.
- Test edits are stale-test fixes, not weakened assertions. Billing E-A1 now ticks three named charges and adds an assertion for Home delivery (the old Select-all pulled in intentionally blocking Shop charges). Admin E-B1 keeps the same three status assertions, read from the list below 768 px. The back-nav spec opens the collapsible group and uses the real label "Inventory & batches". The notifications spec checks the same link name via the account menu below 640 px and closes it again.
- TileFigure: the NBSP binds only a trailing unit and not-recorded is skipped; overflow-wrap:anywhere is the fallback. Mock window hook is gated by typeof window and is empty by default. Unit tests (9, portal-header and tile-figure) pass with --maxWorkers=2. Playwright not run, per instructions.
- PosScanField and StaffOrderQueue placeholders were shortened to fit at 360 px and the new e2e measures fit. Prompt text changes only; labels are untouched.
- Frontend-only; no superseded-architecture items.

SCOPE CHECK
- files in allowed scope: all (web only, plus this record)
- files outside allowed scope: none

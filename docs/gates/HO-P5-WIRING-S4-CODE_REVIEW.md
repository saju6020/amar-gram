GATE: CODE_REVIEW
HANDOVER: HO-P5-WIRING (slice S4, customers, money and admin; BG-19..BG-23)
COMMITS: run 3 (narrow). `git diff dce96bb..291058e`, HEAD 291058e, branch feat/p5-s4-customers-admin. The one new code commit is 291058e (integrator, run-2 fixes). Run 2 reviewed `0a14dbc...798efbb`.
DATE: 2026-11-02
STATUS: PASS

RUN 1 (summary)
FAIL at a4725c1 with 1 HIGH, 4 MEDIUM and 12 LOW findings. HIGH: the roster grid read `roster-cells`, but pattern set, scheduled-pattern cancel, exception create and exception cancel did not invalidate it. MEDIUM: the cash-up response written into every branch's cached day; `CustomerProfileView` not keyed by customer; a U40 test that could not fail; a past-day roster test that could not fail. Twelve LOWs (documents-ops strength, cash-up test gaps, row-error mapping, duplicated VarianceText, dead CustomerSearchPanel, hand-rolled pager with no way back from past the end, typed tag dropped on Save, 'UTC' fallback and 100-staff cap, a vacuous "keeps its shift" test, mock refusal order, an import alias, the e2e dash comment).

RUN 2 (summary)
FAIL at 798efbb. Every run-1 HIGH and MEDIUM was fixed and mutation-checked (M1-M10). One new MEDIUM: the customers pager had moved to `SimplePager`, whose Previous/Next are `size="sm"` (`h-8`, 32 px), below HO-P5 §1's 44 px targets (HO-P3 UI-6). LOWs: the per-source mock checked the total cap before the date (server: date first); the past-the-end empty state still read "No customers yet"; only exception cancel was shown to refetch roster cells; the 'UTC' fallback and 100-staff cap; dead CustomerSearchPanel.

SUMMARY (run 3)
The run-2 MEDIUM and the two LOWs the fix commit targets are fixed, and the new assertions fail when their fix is undone. The 291058e diff adds no new bug. No control S4 added is `size="sm"`/`h-8` without a `min-h-11` override. Run 3 found one new LOW, about 40 px controls on S4's new screens; it does not block. The three files are all inside the §13 S4 block.

RUN-2 FINDINGS: STATUS
- MEDIUM pager 32 px: FIXED. web/components/customer/CustomerBrowsePanel.tsx:215-233 is a local `BrowsePager`. Its Previous and Next (:224, :227) are `variant="secondary"` md buttons with `min-h-11` (44 px). The text is the same as `SimplePager`'s ("Page {page} of {pageCount} · {total} total"). Disabled at the ends, hidden when there is one page. The `SimplePager` import is gone, and `SimplePager` itself is untouched. Test: overview-customers.test.tsx:136 checks `min-h-11` on both buttons. Mutation M1 (Next without `min-h-11`) failed "pages the list". Mutation M3 (BrowsePager's Previous back to `size="sm"`) also failed it. Each was reverted.
- LOW per-source mock order: FIXED. web/mocks/handlers/billing/ops.ts:251-258 now checks `CashUpDateInFuture` before the sum cap. The server order is the same: `RecordSourceCounts` (CashUpAggregate.cs:83-110) calls `RecordCount(total, …)` at :110, which runs RequireOpen, then the date (:58), then the amount cap (:61), then the explanation length and card number (:65-67). The mock's card check stays last (:259-260). The comment at :238 now names the cap, and the citation at :251 now points at :110-111 → :58, :61. No test pins date-before-cap for a future day with an over-cap sum. mock-refusals.test.ts:150-168 covers each refusal on its own. No screen can reach that case, so I raise no finding.
- LOW past-the-end wording: FIXED. CustomerBrowsePanel.tsx:138-145. When `page > 1` the title reads "Nothing on this page" and the text "The list is shorter than this page. Go back to the first page.", with the existing "Back to the first page" action (:148). This applies to both the filtered and unfiltered branches. Test: overview-customers.test.tsx:223-224 checks the new title is present and "No customers yet" is absent. Mutation M2 (title back to the filtered/unfiltered pair) failed "a page past the end says so". Reverted.
- LOW only exception-cancel refresh tested (roster-cells.test.tsx:804-834): LEFT, accepted as LOW.
- LOW 'UTC' fallback and 100-staff cap (roster/page.tsx:40,90): LEFT, accepted as LOW.
- LOW dead CustomerSearchPanel: LEFT, accepted as LOW (for the integrator).

FINDINGS
- [LOW] Some controls S4 added are 40 px or less, not 44 px. The defaults are `Button` md = `h-10` (web/components/ui/button.tsx:28), and inputs and selects styled `px-3 py-2 text-sm` with no `min-h` (about 38 px). They are:
  - web/components/back-office-admin/CashUpSources.tsx:237, :240: the Record count and Close day buttons, both md.
  - CashUpSources.tsx:83: `INPUT`, the per-source amount inputs.
  - web/components/back-office-customers/CustomerTagsDialog.tsx:165, :168: Cancel and Save, both md.
  - web/components/branches/BranchDetailsForm.tsx:212: the new Type `<select>`.

  This is not a regression of the run-2 kind. Each copies the established staff style: about 400 of the roughly 409 `<Button>`s under web/components have no `min-h-11`, and BranchDetailsForm's new select copies that file's other fields (:188 and its inputs). The 32 px `size="sm"` pattern is not among them: the only `size="sm"` S4 added is CustomerTagsControl.tsx, and it carries `min-h-11`. Strictly, UI-6 ("no control is smaller than 44 × 44 px") covers these too. The cheap fix is to add `min-h-11` to the six controls, as S4 already does on its other new buttons, inputs and selects. The alternative is to have the owner rule that md 40 px stands for staff screens.

NEW-DIFF REVIEW (dce96bb..291058e)
- BrowsePager: `pageCount = max(1, ceil(total/pageSize))`, so it returns null for a single page. Past the end, the panel shows the empty state, not the pager, so neither "Page 9 of 3" nor a live Next can appear. `onPage(page ± 1)` matches the old `SimplePager` contract. `nav aria-label="Pages"` matches it too. No new bug.
- Empty state: `page > 1` takes precedence over `filtered`. That is right, because a filtered or unfiltered list past its end is the same situation. With `page > 1` and a total of 0, the message still holds and the action still recovers.
- Mock: a pure reorder plus the comments. No change to state writes.

VERIFIED (run by me, from web/)
- `npx vitest run tests/components/back-office-overview/overview-customers.test.tsx --maxWorkers=1`: 11/11 pass on clean code.
- Mutations M1-M3 above: each failed exactly the named test (1 failed, 10 passed), and each was reverted with `git checkout -- components/customer/CustomerBrowsePanel.tsx`.
- `npx vitest run tests/components/back-office-admin/mock-refusals.test.ts --maxWorkers=1`: 19/19 pass.
- `npx tsc --noEmit`: clean. `npx eslint --max-warnings 0` on the 3 changed files: clean.
- Grep of every `+` line in `git diff 0a14dbc..HEAD -- web/components web/app` for `size="sm"`, `size="icon"`, `h-6/7/8/9`, `size-7/8`, `SimplePager`: one hit, CustomerTagsControl.tsx (`size="sm"` with `min-h-11`, which renders 44 px). All other new `<button>`/`<input>`/`<select>`/`<Button>` lines were read; the LOW lists the ones under 44 px. RosterWeekView's cell button has `min-h-11` (:105), the tag remove buttons are `size-11`, the customer rows are `min-h-14`, and the panel's `SELECT` is `min-h-11`.
- `git status --short` is empty after the mutations (only this record is written).

NOT CHECKED
- The full Vitest suite, e2e and the build. Rendered sizes in a browser (read from classes; jsdom has no layout).

SCOPE CHECK (dce96bb..291058e)
- files in allowed scope: 3/3, all in the §13 S4 block (docs/handover/HO-P5-WIRING.md:462-500): web/components/customer/CustomerBrowsePanel.tsx (`components/customer/**`), web/mocks/handlers/billing/ops.ts, web/tests/components/back-office-overview/overview-customers.test.tsx.
- files outside allowed scope: none

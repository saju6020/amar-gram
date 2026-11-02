# TC-HO-P5-WIRING-S4 — Customers, money and admin (BG-19 … BG-23)

Handover: docs/handover/HO-P5-WIRING.md (S4: §1 Amended (a)-(aj), esp. (i), (l), (n), (ac), (ae), (ai), (aj); §11.5; §13 S4 block; §15 U37-U45, U46, U47; §16 E13-E16; §17; §18 A14-A17, A18-A21; §19)
Commit(s) under test: feat/p5-s4-customers-admin at HEAD 794188b (base 0a14dbc; S4 commits 3d6f14b … 794188b)
Written: 2026-11-02 (before any command ran)  ·  Executed: 2026-11-02 to 2026-11-03 (see Evidence column)

> Statuses record what was **observed**, not inferred. The Evidence column names what was actually
> seen. `BLOCKED` marks a case that could not be executed or whose result was reasoned about rather
> than watched. The handover's U-rows are prose rows; IDs keep the handover's U37-U47 and E13-E16
> and add sub-letters (U37a …) and gate-added rows (T*, R*, M*, X*, G*), which I assigned.

## What counts as a pass (stated before running)

- **Every row assigned to S4 must pass as worded.** S4's rows are: T1-T5, the U-rows (U37-U45, U46, U47), E13, E14, E15, E16
  (every test in the named specs on both `chromium` and `mobile-360`), the regression rows R*, the mutation rows M*, and the gate rows G*.
- **Baseline exceptions (§1 Known e2e baseline), named before running:** `billing-functional` :18 E-A1 and :216 E-F1 (both projects),
  `admin-functional` :56 E-B1 on `mobile-360`, `billing-a11y-responsive` :86 (dialog contrast). Each may fail **as recorded**; failing in a
  new way blocks. Passing is also fine.
- **First attempt counts.** `--retries=0` is passed; none of S4's specs sets an in-file `retries`, but if any test is retried in-file and
  passes on the retry, it is a first-attempt failure and is recorded FAIL with a note. No rerun turns a FAIL into a PASS; a rerun alone is a
  labelled diagnostic only.
- **Other specs** (rows X*) are not S4's §16 rows. Expected, written now: "pass, baseline, or passes alone under (i)". A failure there that
  passes alone is recorded under Amended (i) and rechecked at E18; it does not block S4.
- **E17 is not a slice row** (Amended (l)); it is checked at E18 and is outside the counts.
- **T3 (full Vitest) has flaky-under-load files.** A file that fails in T3 and passes when run alone is recorded as such: it is an S4 FAIL
  only if the file is one S4 owns or changed (§13 S4 block, or Amended (ai)); otherwise it is an (i) row, rechecked at E18.
- An overflow or a11y failure is looked at **on the rendered page** (screenshot / DOM measurement) before any cause is named; a cause is
  named only if measured.
- **Mutations:** edit one line of product code, run the named files at `--maxWorkers=1`, record which tests failed, `git checkout -- <file>`,
  confirm `git status` shows only gate files. PASS = at least one named test failed. A mutation no slice test catches is a FAIL row (a test
  gap, not a product defect), even if a gate test catches it (noted, as S2's M1c/M8).
- **E2E environment:** a fresh `next dev` per chunk on PORT=3124, NEXT_PUBLIC_USE_MOCKS=true, NEXT_PUBLIC_API_BASE_URL=http://localhost:5005
  (no API listening), routes warmed with curl, `--workers=1 --retries=0`, both projects. `portal-dashboard` is not in S4's rows (Amended (ae)).
- Me: no product code and no existing spec edited, nothing committed. Gate tests go in new files (G*).

## Summary

| | Count |
|---|---|
| Total | 142 (E17 and the acceptance table not counted) |
| PASS | 131 |
| FAIL | 10: 7 mutation rows (M1b, M1c, M1d, M2b, M5b, M5c, M6b) and the 3 regression rows that depend on them (R1, R2, R17). Each is a gap in the slice's own tests, not a product defect, and each is closed by a gate-added test (G1, G9, G2, G8, G3) that passes on clean code and fails under the mutation |
| BLOCKED | 1 (U47j: `NoResetChannel` cannot be reached in the mock as seeded) |
| NOT RUN | 0 |

## Environment

- Worktree `D:/my-repo/amar-gram/.claude/worktrees/agent-a5549fe8ddc12704c`, branch `feat/p5-s4-customers-admin` at 794188b (base 0a14dbc). Product code and existing specs untouched by the gate (every mutation restored with `git checkout -- <file>`; `git status` after each showed only gate files). Nothing committed.
- Gate files (untracked): this sheet; `docs/gates/HO-P5-WIRING-S4-TEST.md`; `web/tests/components/back-office-admin/test-gate-s4.test.tsx` (G1, G2, G3, G7, G8: 9 tests); `web/tests/components/back-office-admin/test-gate-s4-cashup.test.tsx` (G9: 1 test); `web/tests/e2e/customers-admin-gate-s4.spec.ts` (G4, G5: 4 tests). ESLint `--max-warnings 0` clean on all three.
- Runs: 2026-11-02 (T1-T5, unit, mutations, chunks E13-E16b) into 2026-11-03 after midnight (E16c, X1, X2). Node v24.21.0. Free physical memory before each chunk 18.0-18.6 GB, free commit 17.9-18.2 GB. A keep-awake (SetThreadExecutionState) ran for the whole session and was stopped at the end.
- Unit: Vitest `--maxWorkers=2` for T3; mutation and gate runs at `--maxWorkers=1`.
- E2E: MSW only (`NEXT_PUBLIC_USE_MOCKS=true`, `NEXT_PUBLIC_API_BASE_URL=http://localhost:5005`, no API listening). One fresh `next dev` on :3124 per chunk (`.next` removed first), routes warmed with curl (every warmed route 200), `PORT=3124 npx playwright test <spec> --project=chromium --project=mobile-360 --workers=1 --retries=0`. Chunks: E13 (+G4/G5), E14, E15, E16a (`billing-a11y-responsive`), E16b (`admin-a11y-responsive`), E16c (`admin-filters` + `admin-branch-calendar`), X1 (`accounts-a11y-responsive`), X2 (`ordering-staff` :333). No resource crash, no 0xC0000142, no stuck port.
- After each chunk the :3124 server tree and any chrome-headless-shell from this worktree were killed; at the end nothing listens on :3124, no chrome-headless-shell is running, and no node process from this worktree remains.
- No real API, database or broker: real-API specs and the E-CAL8 real-API case are not run (skipped by the spec).

## Command rows

| ID | Case | Expected | Status | Evidence |
|---|---|---|---|---|
| T1 | `npx tsc --noEmit -p .` | exit 0 | PASS | `npx tsc --noEmit -p .` from web/ at 794188b: exit 0, no output. |
| T2 | `npm run lint` (`--max-warnings 0`) | exit 0 | PASS | `npm run lint` (`eslint . --max-warnings 0`): exit 0, no findings. |
| T3 | `npm test -- --maxWorkers=2` (full Vitest) | exit 0; 0 failed (a failing file outside S4 that passes alone → (i)) | PASS | `npm test -- --maxWorkers=2 --reporter=default --reporter=json` exit 0: Test Files 229 passed, 1 skipped (230); Tests 2150 passed, 45 skipped, 0 failed (514.8 s). No file failed, so no (i) rerun was needed. S4's files: overview-customers 11/11, staff-record 8/8, customers mock-refusals 17/17, cash-up-sources 10/10, admin mock-refusals 19/19, money-and-admin 9/9, branch-form-type 3/3, roster-cells 15/15, documents-ops 15/15, merge-review 6/6. The gate file `test-gate-s4.test.tsx` was written after collection and is not in these counts (run alone: 9/9, see G rows). |
| T4 | `rm -rf .next && npx next build` (no dev server) | exit 0 | PASS | No dev server on 3000/3123/3124 (checked); `rm -rf .next && npx next build` exit 0 at 794188b; the route table lists /staff/admin/branches, /staff/admin/branches/[branchId]/roster, /staff/billing/cash-up and /staff/customers. |
| T5 | Served-output check over `.next` excluding `cache` for S4's mock data terms (seed customer names/notes/tags, `Rezwan Ahmed`, `ca220000-…`, masked destinations, mock seam names `setMockStaffLockedUntil`, `registerStaffBranchesProvider`, `isStaffAssignedToBranch`, `expectedSourcesOf`, `setupWorker`, `msw/browser`, persist keys `_p5__`) | 0 files per term; a positive control finds S4's UI strings | PASS | `grep -rlF` over `.next` excluding `cache`: 0 files for each of 21 terms (Sam Rahman, the seeded note text, Rezwan Ahmed, staff-cash id ca220000-…01, setMockStaffLockedUntil, registerStaffBranchesProvider, isStaffAssignedToBranch, expectedSourcesOf, staffSourceKey, staffRecordRefusal, setupWorker, msw/browser, mockServiceWorker, `_mock_db_p5__`, `__purrcare_accounts_mock_db`, Gate Collector, the fixture customer email, Nadia Reception, Rafiq Inventory, Dhanmondi outlet, London outlet). Positive controls: 'Send password reset' 2 files, 'Counted for ' 9, 'Edit tags' 2, 'Change shift' 2, 'Delivers to' 2. |

## Unit cases (§15)

| ID | Case | Expected | Status | Evidence |
|---|---|---|---|---|
| U37a | Browse list loads with no search first (`?sort=recent&pageNumber=1&pageSize=20`), walk-in registration offered (`overview-customers` :80) | pass | PASS | T3: overview-customers.test.tsx 11/11 passed (this case included). |
| U37b | "No customer matches" empty state (:95) | pass | PASS | T3: overview-customers.test.tsx 11/11 passed (this case included). |
| U37c | Submit writes `search=` to the URL and drops the selection (:102) | pass | PASS | T3: overview-customers.test.tsx 11/11 passed (this case included). |
| U37d | search, tag, sort, page reach `browse` in order; tag and sort selects write the URL; tag options = seen + URL value (:111) | pass | PASS | T3: overview-customers.test.tsx 11/11 passed (this case included). |
| U37e | Pager: Next writes `page=`, shows "Page x of y · n total", both buttons `min-h-11` (:130) | pass | PASS | T3: overview-customers.test.tsx 11/11 passed (this case included). |
| U37f | Selecting a customer sets `?customer=` (:141) | pass | PASS | T3: overview-customers.test.tsx 11/11 passed (this case included). |
| U37g | The POS customer panel still uses the exact `findCustomers` lookup (not `browse`) | a test asserts the POS lookup endpoint (none found while writing the sheet: gate test G7); `browse` is not called from POS code | PASS | Code: `lib/hooks/usePos.ts:112-115` `usePosCustomerLookup` calls `findCustomers({ mobile })`; `PosCustomerPanel.tsx:22` uses it; no POS file imports `browseCustomers`. No slice test drove it; gate test G7 (`usePosCustomerLookup` sends `?mobile=01711000001`, never browse) passed on clean code. |
| U38a | Profile: Customer since, Orders, Lifetime spend (server string via Amount), Area, tag chips; tabs exactly Orders, Billing, Notes (n); no Subscriptions (:148) | pass; supersedes HO-P4 U17 "no Notes" | PASS | T3: overview-customers.test.tsx 11/11 passed (this case included). |
| U38b | A role without staff-record actions (Accountant) sees tags but no Edit tags / Add a note / Send password reset (:243) | pass | PASS | T3: overview-customers.test.tsx 11/11 passed (this case included). |
| U38c | No erase panel for a non-Administrator (:229) | pass | PASS | T3: overview-customers.test.tsx 11/11 passed (this case included). |
| U39a | Notes newest first with author and time; markup rendered literally (`staff-record` :65) | pass | PASS | T3: staff-record.test.tsx 8/8 passed (this case included). |
| U39b | Add a note ≤ 1000 with counter; list refetches after 201 (:82) | pass | PASS | T3: staff-record.test.tsx 8/8 passed (this case included). |
| U39c | Refused note shows the server message and keeps the text (:115) | pass | PASS | T3: staff-record.test.tsx 8/8 passed (this case included). |
| U40a | ≤ 10 tags, ≤ 30 chars in the dialog; whole set sent; chips show the server's (different) returned set (:145) | pass | PASS | T3: staff-record.test.tsx 8/8 passed (this case included). |
| U40b | A tag typed but not added is saved with the set; a bad one blocks Save with a message (:188) | pass | PASS | T3: staff-record.test.tsx 8/8 passed (this case included). |
| U40c | Server refusal keeps the dialog open with the message (:211) | pass | PASS | T3: staff-record.test.tsx 8/8 passed (this case included). |
| U41a | Reset: confirm dialog; result "Reset link sent by {channel} to {masked}… expires …"; no token or link text; one call (:239) | pass | PASS | T3: staff-record.test.tsx 8/8 passed (this case included). |
| U41b | Reset 403 shows the permission message (:262) | pass | PASS | T3: staff-record.test.tsx 8/8 passed (this case included). |
| U42a | One input per source labelled "Counted for {label}", Expected per source (`cash-up-sources` :32) | pass | PASS | T3: cash-up-sources.test.tsx 10/10 passed (this case included). |
| U42b | Submit sends `counts[]` with `wireMoney` JSON numbers; per-source pills, server total and day variance shown (:50) | pass | PASS | T3: cash-up-sources.test.tsx 10/10 passed (this case included). |
| U42c | Closed per-source day reads as a table with no inputs (:106) | pass | PASS | T3: cash-up-sources.test.tsx 10/10 passed (this case included). |
| U42d | A row refusal (`Counts[i].CountedCash`) shows under that row (:127) | pass | PASS | T3: cash-up-sources.test.tsx 10/10 passed (this case included). |
| U42e | Missing/malformed amount blocked before any request, naming the source (:147) | pass | PASS | T3: cash-up-sources.test.tsx 10/10 passed (this case included). |
| U42f | `UnknownCashUpSource` and `DuplicateCashUpSource` map to "The sources changed while you were counting…" (:164 it.each) | pass (2 cases) | PASS | T3: cash-up-sources.test.tsx 10/10 passed (this case included). |
| U42g | Close day disabled until the count is saved (:186) | pass | PASS | T3: cash-up-sources.test.tsx 10/10 passed (this case included). |
| U42h | No sources → the HO-P4 single input remains (`cash-up-sources` :196; `money-and-admin` U36 :61) | pass | PASS | T3: cash-up-sources :196 passed (10/10) and money-and-admin U36 :61 passed (9/9). |
| U42i | Money lint (ADR-FE-080) covers `CashUpSources.tsx`: no `Number(`/`parseFloat(` (Amended (aj)) | T2 clean and the block lists the file; mutation M8 makes lint fail | PASS | `web/eslint.config.mjs:166-172` lists `components/back-office-admin/CashUpSources.tsx` in the ADR-FE-080 block; T2 clean; M8 shows the rule fires on that file. |
| U42j | `documents-ops` U-D1/U-D2 follows the per-source count ("Counted for Till", "Short BDT 10.00" ×2) (Amended (ai)) | pass | PASS | T3: documents-ops.test.tsx 15/15 passed; :84 uses `/Counted for Till/`, :87 `toHaveLength(2)` (read). |
| U43a | Outlet cards: type pill, address, "Today: {summary}", "Delivers to …", "{n} staff" (`money-and-admin` :115) | pass; supersedes HO-P4 U38 | PASS | T3: money-and-admin.test.tsx 9/9 and branch-form-type.test.tsx 3/3 passed (this case included). |
| U43b | Warehouse pill; the server's "Closed"; no "Delivers to"/address when none (:145) | pass | PASS | T3: money-and-admin.test.tsx 9/9 and branch-form-type.test.tsx 3/3 passed (this case included). |
| U43c | "Add outlet" hidden from a non-creator; empty state (:154) | pass | PASS | T3: money-and-admin.test.tsx 9/9 and branch-form-type.test.tsx 3/3 passed (this case included). |
| U43d | Type select on create: Outlet/Warehouse, default Outlet, sends the chosen type (`branch-form-type` :33) | pass | PASS | T3: money-and-admin.test.tsx 9/9 and branch-form-type.test.tsx 3/3 passed (this case included). |
| U43e | Type select on edit starts at the branch type and saves a change (:48) | pass | PASS | T3: money-and-admin.test.tsx 9/9 and branch-form-type.test.tsx 3/3 passed (this case included). |
| U43f | Server refusal of the type shown under the field (:59) | pass | PASS | T3: money-and-admin.test.tsx 9/9 and branch-form-type.test.tsx 3/3 passed (this case included). |
| U44 | Staff table: Outlet column primary first "(primary)", "—" when none; Status from server incl. Locked on a `hasPassword: true` row (`money-and-admin` :162) | pass | PASS | T3: money-and-admin.test.tsx 9/9 passed (U44 case included). |
| U45a | `nextRosterShift` Morning → Evening → Off → Morning; Custom → Morning (`roster-cells` :34) | pass | PASS | T3: roster-cells.test.tsx 15/15 passed (this case included). |
| U45b | `describeShiftError` maps roster codes to plain language, never shows the code (:41) | pass | PASS | T3: roster-cells.test.tsx 15/15 passed (this case included). |
| U45c | Editable cell is a button named "{person}, {day}: {shift}, {times}. Change shift" (:83) | pass | PASS | T3: roster-cells.test.tsx 15/15 passed (this case included). |
| U45d | A click reports person, day and current shift (:91) | pass | PASS | T3: roster-cells.test.tsx 15/15 passed (this case included). |
| U45e | Non-rosterable row and past day are text, not buttons (:97) | pass | PASS | T3: roster-cells.test.tsx 15/15 passed (this case included). |
| U45f | Leave as text; legend lists names without hours; polite announcement (:108) | pass | PASS | T3: roster-cells.test.tsx 15/15 passed (this case included). |
| U45g | "Outside opening hours" still said in words (:119) | pass | PASS | T3: roster-cells.test.tsx 15/15 passed (this case included). |
| U45h | Without `onCycle` the grid is read-only (:142) | pass | PASS | T3: roster-cells.test.tsx 15/15 passed (this case included). |
| U45i | Page: one click → one PUT with the next shift; cell replaced by the response; announced (:228) | pass | PASS | T3: roster-cells.test.tsx 15/15 passed (this case included). |
| U45j | Only the rosterable person has buttons, only for days from today (count = upcoming × 2) (:246) | pass | PASS | T3: roster-cells.test.tsx 15/15 passed (this case included). |
| U45k | A wholly past week has no buttons and still says each shift (:255) | pass | PASS | T3: roster-cells.test.tsx 15/15 passed (this case included). |
| U45l | Cancelling a roster exception refetches the cells (:264) | pass | PASS | T3: roster-cells.test.tsx 15/15 passed (this case included). |
| U45m | A Custom day asks first; Cancel sends nothing; Replace sends Morning (:296) | pass | PASS | T3: roster-cells.test.tsx 15/15 passed (this case included). |
| U45n | `ShiftDateInPast` / `StaffNotRosterable` shown in plain language; the clicked cell keeps its shift (it.each) | pass (2 cases) | PASS | T3: roster-cells.test.tsx 15/15 passed (this case included). |
| U46 | `no-hex-literals` and `no-colour-literals` pass; back-up `rg` for colour literals over `components app` finds nothing in S4's files | pass; 0 matches in S4 files | PASS | T3: no-hex-literals 213/213, no-colour-literals 2/2, no-money-arithmetic 2/2 passed. `rg -n --glob "*.{ts,tsx}" "#[0-9a-fA-F]{3,8}\|rgba?\(\|hsla?\(\|-\[#" components app`: 0 matches anywhere (sanity: `rg -c bg-` finds CashUpSources.tsx). |
| U47 | **Mocks mirror validation (one case per new mocked refusal, §11.5.9).** Every refusal the slice report lists has a case in `back-office-customers/mock-refusals.test.ts` or `back-office-admin/mock-refusals.test.ts`, and both files pass | every listed refusal has a case and passes; any refusal with no case is named | PASS | T3: both files pass (17/17, 19/19). Read each refusal in the slice report's "Mock refusals added" table against the test titles: browse (4 bare 400s, 403), detail fields, notes (blank, 2000, 1000, 200, CustomerNotFound/AccountNotActive, 403), tags (InvalidCustomerTag, CustomerTagLimitExceeded, >50 PredicateValidator, 403, AccountNotActive), reset (403, CustomerNotFound/AccountNotActive), staff status/branches, cash-up (>50, key/amount shape, CashUpClosed, Duplicate, Unknown, CashUpDateInFuture, sum cap), branch type (create/update unknown), roster cells (reversed, >31 days), shifts (validator blank/unknown/Custom, StaffNotRosterable, BranchNotAssigned, ShiftDateInPast) each have a case. One exception: `NoResetChannel` has none (U47j). `BranchNotFound` on a shift write has no own case (the branch read is shared with BranchNotAssigned); noted, not counted against. The order of the browse 400s is asserted only by gate test G8 (see M5c). |
| U47a | Accounts mock: browse four bare 400s in order, 403 for Inventory, active only, search rules, tag/sort/page (customers mock-refusals :57, :69, :74, :90) | pass | PASS | T3: back-office-customers/mock-refusals.test.ts 17/17 and back-office-admin/mock-refusals.test.ts 19/19 passed (this case included). |
| U47b | Detail summary fields (:108) | pass | PASS | T3: back-office-customers/mock-refusals.test.ts 17/17 and back-office-admin/mock-refusals.test.ts 19/19 passed (this case included). |
| U47c | Notes: newest first, unknown → `[]`; blank/2000/1000 refusals; 200 limit; missing/inactive 400 on CustomerId; 403 (:123, :133, :153, :171) | pass | PASS | T3: back-office-customers/mock-refusals.test.ts 17/17 and back-office-admin/mock-refusals.test.ts 19/19 passed (this case included). |
| U47d | Tags: trim/dedupe; InvalidCustomerTag, CustomerTagLimitExceeded, PredicateValidator; 403 and AccountNotActive (:180, :189, :204) | pass | PASS | T3: back-office-customers/mock-refusals.test.ts 17/17 and back-office-admin/mock-refusals.test.ts 19/19 passed (this case included). |
| U47e | Reset: mobile masked, 15 min, no token; email fallback; 403 and CustomerNotFound/AccountNotActive (:213, :225, :233) | pass | PASS | T3: back-office-customers/mock-refusals.test.ts 17/17 and back-office-admin/mock-refusals.test.ts 19/19 passed (this case included). |
| U47f | Staff accounts `status` and `branches` (:249, :261) | pass | PASS | T3: back-office-customers/mock-refusals.test.ts 17/17 and back-office-admin/mock-refusals.test.ts 19/19 passed (this case included). |
| U47g | Cash-up per source: sources read, sum, total-only clears, Duplicate/Unknown, shape rules, future day, sum cap, aggregate order, freeze at close (admin mock-refusals :65-:194) | pass | PASS | T3: back-office-customers/mock-refusals.test.ts 17/17 and back-office-admin/mock-refusals.test.ts 19/19 passed (this case included). |
| U47h | Branch type and card fields: list/single fields, "Closed", create/update type rules (:213-:248) | pass | PASS | T3: back-office-customers/mock-refusals.test.ts 17/17 and back-office-admin/mock-refusals.test.ts 19/19 passed (this case included). |
| U47i | Roster cells and shifts: range rules, presets, Custom replaced, ShiftDateInPast / StaffNotRosterable / BranchNotAssigned, validator wording (:264-:329) | pass | PASS | T3: back-office-customers/mock-refusals.test.ts 17/17 and back-office-admin/mock-refusals.test.ts 19/19 passed (this case included). |
| U47j | `NoResetChannel` (mirrored in the mock) has a case | a case exists | BLOCKED | No case exists, and none can be written against the mock as seeded: the only customer with neither mobile nor email is `mergeAlreadyMergedId` (`accounts.ts:384-397`), which is Merged and is refused earlier with `AccountNotActive` (`staffRecordRefusal`, :1972). The accounts mock exports no seam to add one. The slice report records this ("unreachable from the seeds"). Unblock: a seed or seam for an Active customer with no contact, then one case. |

## Integration cases (§16; first attempt counts; both projects)

A row is PASS only if both `chromium` and `mobile-360` passed on the first attempt (baseline rows excepted as stated).

| ID | Case | Expected | Status | Evidence |
|---|---|---|---|---|
| E13a | `staff-customers` :11 E-H1 walk-in with a new number / existing number | pass | PASS | Chunk E13 (fresh `next dev` :3124, 10 routes warmed, all 200; `--workers=1 --retries=0`, list reporter): :11 passed chromium (4.4 s) and mobile-360 (3.7 s), first attempt. |
| E13b | `staff-customers` :32 E-I1 merge a duplicate pair | pass | PASS | Chunk E13: :32 passed chromium (3.2 s) and mobile-360 (3.2 s). |
| E13c | `staff-customers` :52 E5 search, select, profile, New order | pass | PASS | Chunk E13: :52 passed chromium (4.0 s) and mobile-360 (3.9 s). |
| E13d | `staff-customers` :82 E13 search by name → lifetime spend; add a note; edit tags; reset → masked destination | pass | PASS | Chunk E13: :82 passed chromium (4.0 s) and mobile-360 (4.1 s), incl. its axe and no-sideways-scroll checks. |
| E13e | `staff-customers` :127 E13 filter by tag and sort by name | pass | PASS | Chunk E13: :127 passed chromium (2.6 s) and mobile-360 (2.4 s). Chunk total 18 passed (10 S4 + 8 gate), 0 failed, 0 flaky, 1.1 min. |
| E14a | `billing-functional` :18 E-A1 | **baseline**: pass, or fail as recorded | PASS | BASELINE, failed as recorded. Chunk E14 (fresh `next dev` :3124, 22 billing/portal routes warmed; `--workers=1 --retries=0`): :18 E-A1 failed on chromium (7.6 s) and mobile-360 (7.4 s): `expect(getByRole('button', {name:'Issue invoice'})).toBeEnabled()` received disabled (spec :23), after 'Select all in Shop' and the estimate banner showed. Recorded baseline: HO-P4 TEST 'billing-functional:18 E-A1 (both, baseline fails)'; S4 slice report: failed on both projects. No written record names the assertion, so 'the same way' is checked only as far as: same test, both projects, a step before any S4 screen. `git diff 0a14dbc..HEAD -- web/mocks/handlers/billing web/components/billing web/lib` touches only the cash-up (store.ts staffCash/sources, ops.ts count, CashUpScreen, billing-cashup.ts), nothing the invoice composer reads. Counted as the accepted baseline, not a pass of the test. |
| E14b | `billing-functional` :34 E-A2, :52 E-B1, :75 E-B3, :89 E-B2, :96 E-B4, :105 E-C1/C2, :120 E-C3, :129 E-C1b, :137 E-E1 | pass | PASS | Chunk E14: :34, :52, :75, :89, :96, :105, :120, :129, :137 each passed on chromium and mobile-360, first attempt (2.4-3.6 s each). |
| E14c | `billing-functional` :150 E-D1 (selector "Counted for Till") | pass | PASS | Chunk E14: :150 E-D1 passed chromium (4.4 s) and mobile-360 (10.0 s). |
| E14d | `billing-functional` :174 E-D2, :185 E-D3, :202 E-D4 | pass | PASS | Chunk E14: :174, :185, :202 passed on both projects. |
| E14e | `billing-functional` :216 E-F1 | **baseline**: pass, or fail as recorded | PASS | BASELINE, passed: :216 E-F1 passed on chromium (4.3 s) and mobile-360 (3.3 s). |
| E14f | `billing-functional` :231 E14 count two sources → per-source variance, server total | pass | PASS | Chunk E14: :231 E14 passed chromium (3.6 s) and mobile-360 (4.0 s), incl. its axe and no-sideways-scroll checks. Chunk total: 30 passed, 2 failed (both E-A1 baseline), 2.1 min. |
| E15a | `admin-functional` :56 E-B1 | chromium pass; mobile-360 **baseline** (pass, or fail as recorded) | PASS | Chunk E15 (fresh `next dev` :3124, 21 routes warmed, all 200; `--workers=1 --retries=0`): chromium passed (14.3 s). mobile-360 failed (18.8 s), BASELINE as recorded (HO-P4 TC E13: 'admin-functional:56 E-B1 fails mobile-360 only'): spec :104-106 `getByRole('grid').getByRole('gridcell', { name: /Monday 25 December 2028/ })` not found. That is consistent with E-CAL6 (below 768 px the calendar is a list and the grid is hidden); I did not measure it further. S4 changed no calendar code. |
| E15b | `admin-functional` :125 E-B2 | pass | PASS | Chunk E15: :125 passed on chromium and mobile-360, first attempt. |
| E15c | `admin-functional` :159 E15 outlet cards; warehouse created | pass | PASS | Chunk E15: :159 passed on chromium and mobile-360 (the slice report's earlier mobile timeout did not recur). |
| E15d | `admin-functional` :197 E15 roster cell cycles, announced | pass | PASS | Chunk E15: :197 passed chromium (3.9 s) and mobile-360 (4.8 s). |
| E15e | `admin-functional` :224 E-D1, :277 E-F1, :328 E-F2, :378 E-G1, :414 E-G3, :422 E-H1, :441 E-B3 | pass | PASS | Chunk E15: :224, :277, :328, :378, :414, :422, :441 each passed on both projects. |
| E15f | `staff-admin` :14 E-G1, :34 E-F1 | pass | PASS | Chunk E15: staff-admin :14 and :34 passed on both projects. |
| E15g | `staff-admin` :49 E15 Outlet column, server Status, dash for none | pass | PASS | Chunk E15: staff-admin :49 passed chromium (3.5 s) and mobile-360 (4.5 s). Chunk total: 27 passed, 1 failed (E-B1 mobile-360 baseline), 3.1 min. |
| E16a | `billing-a11y-responsive` (all; :86 baseline excepted) | pass; :86 pass or fail as recorded | PASS | Chunk E16a (fresh `next dev` :3124, 27 routes warmed, all 200; `--workers=1 --retries=0`): `billing-a11y-responsive` 62 passed, 0 failed, 0 flaky, 15.7 min, both projects. Baseline :86 (dialog contrast) PASSED this run on both projects. Includes axe and the 360/768/1024/1440 overflow checks on `/staff/billing/cash-up` (today, till alone) and `/staff/customers/{C}` (the S4 profile). Dev log: 0 error/warn lines. |
| E16b | `admin-a11y-responsive` (all, incl. the roster route) | pass | PASS | Chunk E16b (fresh `next dev` :3124, 27 routes warmed, all 200; `--workers=1 --retries=0`): `admin-a11y-responsive` 234 passed, 0 failed, 0 flaky, 13.4 min, both projects. Includes axe and no-sideways-scroll at 360/768/1024/1440 on `/staff/admin/branches` (S4's outlet cards), `/staff/admin/branches/new` (Type select) and `/staff/admin/branches/{main}/roster` (S4's cell buttons). Dev log: 0 error/warn lines. |
| E16c | `admin-filters` (all) | pass | PASS | Chunk E16c (fresh `next dev` :3124, 12 routes warmed, all 200; `--workers=1 --retries=0`): `admin-filters` 12 passed (6 tests × 2 projects), 0 failed, first attempt. Run with E16d in one 2.3 min chunk. |
| E16d | `admin-branch-calendar` (all) | pass | PASS | Chunk E16c: `admin-branch-calendar` 12 passed on both projects, 2 skipped (E-CAL8 :196 'real API', `plainTest.skip` unless a real API is configured; not a mock case). 0 failed. Dev log: 0 error/warn lines. |
| E17 | Not a slice row (Amended (l)); checked at E18 | not counted | NOT RUN | outside the counts |
| X1 | `accounts-a11y-responsive` (E17 spec; covers `/staff/admin/staff-accounts` and `/staff/customers/{id}`, which S4 changed) | pass, or passes alone under (i) | PASS | Chunk X1 (fresh `next dev` :3124, 21 routes warmed, all 200; `--workers=1 --retries=0`): `accounts-a11y-responsive` 196 passed, 0 failed, 0 flaky, 11.5 min, both projects, first attempt. Covers axe and 360/768/1024/1440 overflow on `/staff/admin/staff-accounts` (S4's Outlet and Status columns) and `/staff/customers/{customerId}` (S4's profile). Dev log: 0 error/warn lines. |
| X2 | `ordering-staff` :333 "customer page Orders panel lists the customer's orders" (E17 spec on S4's profile screen) | pass, or passes alone under (i) | PASS | Chunk X2 (fresh `next dev` :3124, 6 routes warmed): `ordering-staff.spec.ts -g 'customer page Orders panel'` :333 passed on chromium (5.2 s) and mobile-360 (4.8 s), first attempt; no retry line (the file sets in-file `retries: 1`; not used). |

## Regression cases from earlier gates

| ID | Gate | Finding | Case | Status | Evidence |
|---|---|---|---|---|---|
| R1 | CR run 1 HIGH | roster-cells not invalidated by pattern set, scheduled-pattern cancel, exception create, exception cancel | U45l; M1a-M1e; G1 (each of the four hooks invalidates `roster-cells`) | FAIL | Fixed in code: `invalidateCells` is called in all four hooks (useAdminRosters.ts:49,61,86,100), and U45l passes (T3). But the slice's suite protects only exception cancel: M1b, M1c, M1d each survive it (FAIL rows); only gate test G1 catches them. M1a/M1e PASS. Recorded FAIL as a slice-suite gap, closed by G1. |
| R2 | CR run 1 MEDIUM + SECURITY LOW 1 | cash-up response written into every branch's cached day | `cash-up-sources` :91; M2a, M2b | FAIL | Fixed in code (useBillingMutations.ts: `setQueryData(['billing','cash-up',branchId,date], view)`); cash-up-sources :91 passes (T3) and fails under M2a (PASS). But M2b (reply written under a key without branchId) survives the slice's suite: only gate test G9 catches it. FAIL as a slice-suite gap, closed by G9. |
| R3 | CR run 1 MEDIUM | `CustomerProfileView` not keyed: note draft / reset result / tab carried over | `overview-customers` :179; M3 | PASS | overview-customers :179 passed in T3 and failed under M3 (key removed). |
| R4 | CR run 1 MEDIUM | U40 test could not fail (mock returned the draft) | U40a; M4b | PASS | staff-record :145 passed in T3; mock returns ['Regular','Wholesale','VIP'] against the ['Regular','Wholesale'] sent (read); failed under M4b. |
| R5 | CR run 1 MEDIUM | past-day roster test could not fail | U45j, U45k; M7a, M7b | PASS | roster-cells :246 and :255 passed in T3; :246 failed under M7a and M6c, :255 under M7b. |
| R6 | CR run 1 LOW | `documents-ops` `findAllByText(...).length > 0` too weak | `toHaveLength(2)` present (read) and U42j passes | PASS | documents-ops.test.tsx:87 reads `expect(await screen.findAllByText(/Short BDT 10\.00/)).toHaveLength(2)` (read); the file passed 15/15 in T3. |
| R7 | CR run 1 LOW | cash-up-sources: variance value unchecked, `rawJSON` conditional, no closed readout case | U42b asserts "Over BDT 1.00" and an unconditional rawJSON check (read + run); U42c | PASS | cash-up-sources :50 asserts 'Variance: Over BDT 1.00' (:84) and `expect('rawJSON' in JSON).toBe(true)` unconditionally (:71) (read); :106 closed readout case exists; all passed in T3 (10/10). |
| R8 | CR run 1 LOW | per-row server violation not mapped to the row input | U42d; M9 | PASS | U42d (cash-up-sources :127) passed in T3 and failed under M9. |
| R9 | CR run 1 LOW | `VarianceText` duplicated | `CashUpScreen` delegates to `SourceVariancePill` (read); U42h/U36 pass | PASS | CashUpScreen.tsx:54-57 `VarianceText` returns `<SourceVariancePill variance={view.variance} />` (read); money-and-admin U36 and cash-up-sources passed in T3. |
| R10 | CR run 1 LOW | pager with no way back from past the end; no loading cue | `overview-customers` :219 (way back); "Updating the list…" status exists (read; test if any) | PASS | overview-customers :219 ('a page past the end says so and offers the first page') passed in T3 and failed under M11. The loading cue 'Updating the list…' exists (CustomerBrowsePanel.tsx:205, read) but no test asserts it; noted in Gaps. |
| R11 | CR run 1 LOW | typed tag dropped on Save | U40b; M4a | PASS | U40b (staff-record :188) passed in T3 and failed under M4a. |
| R12 | CR run 1 LOW | "the cell keeps its shift" could not fail | U45n asserts the clicked cell's exact label (read + run) | PASS | roster-cells it.each (ShiftDateInPast / StaffNotRosterable) reads the clicked button's `aria-label` and asserts that exact label is still present (read); both passed in T3. Not mutation-run. |
| R13 | CR run 1 LOW | mock refusal order (closed first on `Status`, card last, per-source sum cap) | admin mock-refusals :157, :172; M5a | PASS | admin mock-refusals :157 (sum cap) and :172 (order) passed in T3; :172 failed under M5a. |
| R14 | CR run 1 LOW | type alias between imports | `useBillingMutations.ts` alias sits after the imports (read) | PASS | useBillingMutations.ts: the import block is at the top of the file (:1-35) with no declaration between imports; `type RecordCashCountInput` is at :256, beside its hook (read). |
| R15 | CR run 1 LOW | e2e "no outlet reads as a dash" had no assertion | E15g asserts the dash (read + run) | PASS | staff-admin.spec.ts:59-62 asserts `newHire.getByText('—').first()` visible (read); E15g passed on both projects. |
| R16 | CR run 2 MEDIUM | customers pager 32 px (`SimplePager` `size="sm"`) | U37e (`min-h-11` class); G4 rendered ≥ 44 px at 360 if the list has >1 page in the mock; M10 | PASS | U37e asserts `min-h-11` on both pager buttons and fails under M10 (PASS). Rendered size NOT measured: G4's pager case ran on both projects but was 'not reached' (annotation: the mock list fits on one page, no pager rendered). The same `min-h-11` class measured 44 px on other S4 buttons in G4. |
| R17 | CR run 2 LOW | per-source mock checked the sum cap before the date | G2 (future day with an over-cap sum → `CashUpDateInFuture`); M5b | FAIL | Fixed in code (ops.ts:251-258, date before cap, read), but no slice test pins it: M5b survives the slice suite; gate test G2 catches it. FAIL as a slice-suite gap, closed by G2. |
| R18 | CR run 2 LOW | past-the-end wording "No customers yet" | `overview-customers` :219; M11 | PASS | overview-customers :219 passed in T3 (asserts 'Nothing on this page' and no 'No customers yet'); failed under M11. |
| R19 | CR run 3 LOW (fixed in 794188b, no test added) | 40 px controls: cash-up Record count / Close day buttons and per-source inputs, tags dialog Cancel / Save, Type select | G4: rendered height ≥ 44 px at mobile-360 for each | PASS | G4 on both projects: Counted for Till, Counted for Rezwan Ahmed, Save count, Close day, tags Cancel, Save tags, Type select all ≥ 44 px (chunk E13). Mutation check of the gate itself: with `min-h-11` removed from Save tags (the 794188b fix undone), G4 failed on chromium and mobile-360 with 'Save tags is 40px tall, below 44px'; restored. |

## Mutation checks (logic removed; the tests must fail; restore with git)

| ID | Mutation | Tests expected to fail | Status | Evidence |
|---|---|---|---|---|
| M1a | `useAdminRosters.ts` `invalidateCells` body → no-op | `roster-cells` :264 | PASS | `invalidateCells` body made a no-op. roster-cells :264 ('cancelling a roster exception … refetches the cells') failed, plus all four G1 cases; 19 others passed. Restored (`git checkout`), tree clean. |
| M1b | remove `invalidateCells` from `useSetRosterPattern` only | slice: none expected (CR run 2 LOW); G1 pattern case | FAIL | Slice test gap (as CODE_REVIEW run 2 LOW said). With `invalidateCells` removed from `useSetRosterPattern` only, roster-cells.test.tsx passed 15/15; only gate G1 'saving a weekly pattern marks the cached roster-cells week stale' failed. Restored. |
| M1c | remove it from `useCancelScheduledRosterPattern` only | slice: none expected; G1 | FAIL | Slice test gap. Removed from `useCancelScheduledRosterPattern` only: roster-cells 15/15 passed; only G1 'cancelling a scheduled pattern …' failed. Restored. |
| M1d | remove it from `useCreateRosterException` only | slice: none expected; G1 | FAIL | Slice test gap. Removed from `useCreateRosterException` only: roster-cells 15/15 passed; only G1 'adding a roster exception …' failed. Restored. |
| M1e | remove it from `useCancelRosterException` only | `roster-cells` :264 | PASS | Removed from `useCancelRosterException` only: roster-cells :264 failed, and G1 'cancelling a roster exception …'. Restored. |
| M1f | `useSetRosterShift`: drop the `setQueriesData` cell replacement | `roster-cells` :228 | PASS | `useSetRosterShift`'s `setQueriesData` replaced by a no-op: roster-cells :228 ('one click sends one PUT … the cell shows the server's answer') failed. Restored. |
| M2a | `useRecordCashCount`: back to `setQueriesData({queryKey:['billing','cash-up'], predicate: q => q.queryKey[3] === date})` | `cash-up-sources` :91 | PASS | Back to `setQueriesData({queryKey:['billing','cash-up'], predicate: q => q.queryKey[3] === date})`: cash-up-sources :91 ('writes the reply to this branch's cached day only …') failed; 33 others in cash-up-sources, money-and-admin, documents-ops passed. Restored. |
| M2b | `useRecordCashCount`: key without `branchId` (`['billing','cash-up',date]`) | `cash-up-sources` :91 or :50 | FAIL | Slice test gap. Reply written under `['billing','cash-up',date]` (no branchId): cash-up-sources, money-and-admin and documents-ops all passed (34/34), because `invalidateAfterPosting`'s refetch puts the same figures on screen moments later, so no test sees that the reply itself never reached the screen's key. Gate test G9 (`test-gate-s4-cashup.test.tsx`: every read after the save is held, so only the reply can show ৳1,201.00) passed on clean code and failed under M2b (3.7 s timeout). Restored. |
| M3 | `customers/page.tsx`: remove `key={selectedId}` | `overview-customers` :179 | PASS | `key={selectedId}` removed: overview-customers :179 ('selecting another customer starts a fresh profile …') failed; 10 passed. Restored. |
| M4a | `CustomerTagsDialog` submit saves `draft` (ignores the typed tag) | `staff-record` :188 | PASS | Submit saves `draft` (typed tag ignored): staff-record :188 ('a tag typed but not added is saved with the set …') failed; 7 passed. Restored. |
| M4b | `CustomerTagsDialog` `onSaved(toSave)` in place of `onSaved(result.tags)` | `staff-record` :145 | PASS | `onSaved(toSave)` in place of `onSaved(result.tags)`: staff-record :145 ('… shows the set the server stored') failed; 7 passed. Restored. |
| M5a | `billing/ops.ts` total-only path: card-number check moved before the closed check | admin `mock-refusals` :172 | PASS | Total-only path: card-number check moved before the closed check: admin mock-refusals :172 ('refuses in the aggregate's order …') failed; 27 others passed. Restored. |
| M5b | `billing/ops.ts` per-source path: sum cap moved before the date check | slice: none expected (CR run 3: no test pins it); G2 | FAIL | Slice test gap (CODE_REVIEW run 3 said no test pins it). Per-source path: sum cap before date: admin mock-refusals 19/19 passed; only gate G2 failed (InvalidAmount instead of CashUpDateInFuture). Restored. |
| M5c | `areas/accounts.ts` browse: swap the pageSize and sort 400 checks | customers `mock-refusals` :57 (its title claims the order, but each request has one bad input; may survive); G8 | FAIL | Slice test gap. Browse: pageSize and sort checks swapped: customers mock-refusals 17/17 passed (its :57 'in the controller's order' sends one bad input per request, so it cannot see order); only gate G8 failed. Restored. |
| M6a | `CustomerProfileView`: `canEditRecord` always true | `overview-customers` :243 | PASS | `canEditRecord` always true: overview-customers :243 ('a role without the staff-record actions sees the tags but not Edit tags …') failed; 27 others passed. Restored. |
| M6b | `CustomerProfileView`: drop `&& active` (a Merged customer gets the record controls) | slice: unknown; G3 | FAIL | Slice test gap. `active` always true (a Merged customer gets the record controls): overview-customers 11/11 and staff-record 8/8 passed; only gate G3 'a Merged customer shows the tags but no Edit tags …' failed. Restored. |
| M6c | roster page: every staff member rosterable | `roster-cells` :246 | PASS | Every staff member rosterable: roster-cells :246 ('only the person who can be rostered has buttons (Ada has none) …') failed; 14 passed. Restored. |
| M6d | `areas/accounts.ts`: drop `requireAction(…, 'Customers.AddNote')` on POST notes | customers `mock-refusals` :171 | PASS | First form (`requireAction(…,'Customers.View')` on POST notes) SURVIVED as an EQUIVALENT mutant: in the mock both actions map to ['Reception','Administrator'] (accounts.ts:923,927), so nothing can tell them apart. Redone as M6d2: 'Customers.AddNote' roles gain 'Inventory': customers mock-refusals :171 ('needs Customers.AddNote: Inventory gets a 403 …') failed; 16 passed. Restored. PASS on M6d2. |
| M7a | roster page `date >= todayInZone(zone)` → `>` | `roster-cells` :246 | PASS | `date >= todayInZone(zone)` → `>`: roster-cells :246 failed (button count). Restored. |
| M7b | roster page: drop the date rule (`editable: rosterable`) | `roster-cells` :255 | PASS | Date rule removed: roster-cells :255 ('a week that is wholly past has no buttons at all …') failed. :246 did not fail, as expected on a Monday (every day of this week is upcoming). Restored. |
| M8 | add `Number(` on a money value in `CashUpSources.tsx` | `npx eslint components/back-office-admin/CashUpSources.tsx` fails (Amended (aj)) | PASS | Added `data-n={Number(source.expected.amount)}` at CashUpSources.tsx:66: `npx eslint --max-warnings 0 components/back-office-admin/CashUpSources.tsx` exit 1, '66:75 error Money stays a string (HO-BIL-002 ADR-FE-080): do not convert it with Number() … no-restricted-syntax'. Restored; eslint on the clean file exit 0. |
| M9 | `CashUpSources.tsx`: drop the per-row `setError` | `cash-up-sources` :127 | PASS | Per-row `setError` dropped: cash-up-sources :127 ('a refusal of one row's amount appears under that row's input …') failed; 9 passed. Restored. |
| M10 | `CustomerBrowsePanel` `BrowsePager` Next without `min-h-11` | `overview-customers` :130 | PASS | `BrowsePager` Next without `min-h-11`: overview-customers :130 ('pages the list …') failed; 10 passed. Restored. |
| M11 | `CustomerBrowsePanel` past-the-end title back to "No customers yet" | `overview-customers` :219 | PASS | Past-the-end title back to the filtered/unfiltered pair: overview-customers :219 failed; 10 passed. Restored. |

## Gate-added cases (new test files; no existing test or product file touched)

| ID | Case | Expected | Status | Evidence |
|---|---|---|---|---|
| G1 | `test-gate-s4.test.tsx`: each of `useSetRosterPattern`, `useCancelScheduledRosterPattern`, `useCreateRosterException`, `useCancelRosterException` marks a cached `roster-cells` query invalidated on success | pass on clean code; fails under M1b/M1c/M1d/M1e respectively | PASS | `test-gate-s4.test.tsx` G1 (4 it.each cases) passed on clean code (file 9/9); failed under M1a (all 4), M1b, M1c, M1d, M1e (each its own case). |
| G2 | `test-gate-s4.test.tsx`: per-source count for a future day whose sum is over the cap → `CashUpDateInFuture` on `BusinessDate` (server order: date before cap) | pass on clean code; fails under M5b | PASS | Passed on clean code; failed under M5b. |
| G3 | `test-gate-s4.test.tsx`: a Merged customer's profile, for an Administrator, shows no Edit tags, Add a note or Send password reset | pass on clean code; fails under M6b | PASS | Both cases (Active control shows the three controls; Merged hides them) passed on clean code; the Merged case failed under M6b. |
| G4 | `customers-admin-gate-s4.spec.ts` at mobile-360 and chromium: rendered height ≥ 44 px for the cash-up Record count, per-source inputs, tags dialog Cancel/Save, branch Type select (R19), and the customers pager if present (R16) | pass | PASS | Chunk E13: 4 tests × 2 projects passed (cash-up 3.7/3.5 s, tags dialog 3.7/3.6 s, Type select 2.5/2.4 s, pager 2.4/2.3 s). The pager case was not reached (one page). Shown able to fail: 40 px Save tags under the reverted 794188b line (R19). |
| G5 | `customers-admin-gate-s4.spec.ts`: the per-source cash-up day (two sources) and the profile with the tags dialog open: no sideways scroll at the project width, axe clean (serious/critical) | pass | PASS | Chunk E13: per-source cash-up day (Till + Rezwan Ahmed) and the profile with the Edit tags dialog open: axe (serious/critical) clean and no sideways scroll on chromium and mobile-360. |
| G6 | Dev log of each chunk: no error lines | no error | PASS | Dev logs of chunks E13, E14, E15, E16a, E16b, E16c, X1, X2 (`tg_dev-*.log` in the scratchpad): 0 lines matching error, warn or the Next error mark in each. |
| G8 | `test-gate-s4.test.tsx`: browse with two bad inputs at once answers the controller's earlier check (pageNumber, pageSize, sort, search/tag) | pass on clean code; fails under M5c | PASS | Passed on clean code; failed under M5c. Uses `fetch` after the mock's own sign-in cookie, because `apiFetch` turns a bare 400 into a generic message. ESLint clean on the file. |
| G9 | `test-gate-s4-cashup.test.tsx` (added after M2b survived): with every cash-up read after the save held, the screen still shows the server total ৳1,201.00, so the PUT reply reached the active branch's exact key | pass on clean code; fails under M2b | PASS | Passed on clean code (1/1); failed under M2b. ESLint clean. |
| G7 | `test-gate-s4.test.tsx`: `usePosCustomerLookup` sends `GET /api/staff/customers?mobile=<trimmed>` and never `browse` (U37g) | pass on clean code | PASS | Passed on clean code (`seen` = ['?mobile=01711000001'], browse not called). Not mutation-run. |

## Acceptance-criteria coverage

| Criterion | Covered by | Status |
|---|---|---|
| A14 (US-ACC-10, 11): browse with name search and tags, profile summary, notes, tags, staff password reset | U37a-g, U38a-c, U39a-c, U40a-c, U41a-b, U47a-e, E13a-e, R3, R4, R10, R11, R16, R18, M3, M4*, M6*, G3, G7, G8 | PASS on every listed U/E/R row. Two slice-suite gaps: M6b (a non-Active customer's record controls) and M5c (browse 400 order), closed only by gate tests G3 and G8. The POS lookup (U37g) is proved only by gate test G7 |
| A15 (US-BIL-12): per-source cash-up with the server's variance | U42a-j, U47g, E14c, E14f, R2, R7, R8, R13, R17, M2*, M5*, M8, M9, G2, G5, G9 | PASS on every U/E row. R2 and R17 FAIL as slice-suite gaps (M2b, M5b), closed by gate tests G9 and G2 |
| A16 (US-ADM-01, 02, ACC-07): outlet cards, staff outlets and status | U43a-f, U44, U47f, U47h, E15c, E15g, R15 | PASS |
| A17 (US-ADM-03): roster cells cycle through the server | U45a-n, U47i, E15d, R1, R5, R12, M1*, M6c, M7*, G1 | PASS on every U/E row. R1 FAILs as a slice-suite gap: pattern set, scheduled-pattern cancel and exception create refetching the cells is protected only by gate test G1 (M1b-d) |
| A18 (S4 part): no colour literals; a11y specs pass | U46, E16a-d, X1, G4, G5, R19 | PASS (E16a's baseline :86 passed too). The 44 px targets fixed in 794188b are measured only by gate spec G4 |
| A19 (S4 part): every new mocked input refused as the server refuses | U47, U47a-j, M5*, M6d, G2, G8 | PASS on U47 and U47a-i. U47j BLOCKED (NoResetChannel unreachable). Refusal order on the per-source cap (M5b) and on browse (M5c) is pinned only by gate tests G2 and G8. Roster and branch mocks still answer no 403 (SECURITY LOW 3, inherited, not fixed) |
| A20: diff inside §13 / nothing in §14 | ARCHITECTURE gate's check, not rerun | BLOCKED (not this gate's check; the ARCHITECTURE record and the CODE_REVIEW run 3 scope check say in scope) |
| A21 (S4 part): typecheck, lint, Vitest, build | T1-T5 | PASS |

## Cases I could not run

| ID | Why | What would unblock it |
|---|---|---|
| U47j | `NoResetChannel` is mirrored in the mock, but the only customer with neither mobile nor email is Merged and is refused earlier with `AccountNotActive`; the accounts mock has no seam to add an Active one | A seed or a test seam for an Active customer with no contact, then one case |
| A20 | Diff scope against §13/§14 is the ARCHITECTURE gate's check, not rerun here | ARCHITECTURE / ACCEPTANCE diff review |
| E17, E18, E19 | Not slice rows (Amended (l)); integration | E18/E19 at integration |
| (not rows) | §19 ACCEPTANCE screenshots; real-API specs (`billing-real-api` incl. its :260 edit under Amended (ai)); the contract test | ACCEPTANCE gate; a real API process |

## Gaps left deliberately

| Gap | Why not covered | Suggested owner |
|---|---|---|
| M1b-d, M2b, M5b, M5c, M6b are closed only by the gate's own tests (G1, G9, G2, G8, G3) | I may not edit the slice's tests; the gate files are untracked and not committed | Integrator: adopt `web/tests/components/back-office-admin/test-gate-s4.test.tsx`, `test-gate-s4-cashup.test.tsx` and `web/tests/e2e/customers-admin-gate-s4.spec.ts` into S4 (as Amended (ag) did for S2), or have S4 add equivalent cases |
| The customers pager's rendered 44 px is not measured: the mock list fits on one page, so G4's pager case is not reached | It needs more than 20 active seeded customers or a pageSize override; seeding is not the gate's | S4 (a seed), or leave on the class assertion (U37e) plus M10 |
| No test asserts the "Updating the list…" status while the previous page is held (CustomerBrowsePanel.tsx:205) | Read in code only | S4 implementer |
| Roster and branch mocks answer no 403 for `Rosters.View/Manage` and `Branches.Manage` (SECURITY LOW 3) | Inherited, not fixed by S4, so no regression row | Integrator / a later mock pass |
| The 'UTC' zone fallback and the 100-staff cap on the roster page; dead `CustomerSearchPanel.tsx` (CODE_REVIEW LOWs left open) | Not fixed, so no regression row | Integrator |
| `BranchNotFound` on a shift write has no case of its own | Low value; the same branch read serves `BranchNotAssigned`, which has a case | Optional |
| E-A1 :18's baseline failure mode is not recorded in writing beyond "fails on both projects" | Comparing it to the base would need a second worktree and build; the diff shows S4 touched no invoice code | E18 can name the assertion (`Issue invoice` stays disabled, spec :23) in the baseline record |

GATE: ACCEPTANCE
HANDOVER: HO-P5-WIRING (slice S4: customers, money and admin; BG-19..BG-23)
RUN: 1
COMMITS: 3d6f14b 31aa1bc c185721 0146979 e3db66a a4725c1 10ccce9 81c2239 798efbb dce96bb 291058e 9844088 794188b 2976c4d 6067790. HEAD 6067790, branch feat/p5-s4-customers-admin, base 0a14dbc. The integration branch feat/phase2-catalogue-theme is still at 0a14dbc.
DATE: 2026-11-03
STATUS: PASS

Every §18 row that applies to S4 (A14-A17, plus S4's part of A18-A21) has evidence. This PASS covers S4's own gates. E17, E18, E19, the contract run, every real-API spec and the NoResetChannel case are still owed at integration, and no gate has shown any of them to be good.

The screenshots show two S4-introduced layout defects at 360 px that no spec catches, because the pages do not scroll sideways and axe passes:
- The customers browse list breaks the name and mobile of every Incomplete customer one letter per line. Every walk-in is Incomplete.
- The staff list's new Outlet column breaks outlet names mid-word.

Both are MEDIUM. Neither contradicts the wording of A14 or A16, which hold, so under the same reading S2's ACCEPTANCE applied to its 360 px pipeline bars, they do not block this gate. A stricter reading of §7 UI-1 ("every new element works at 360 px") would make them blocking. I record that call openly (OWNER DECISIONS D1) and ask the integrator to fix both before E18, as Amended (ah) did for S2.

PRIOR GATES (read from docs/gates/ and docs/test-cases/)
- ARCHITECTURE: PASS (run 1, at a4725c1). 1 MEDIUM (CashUpSources outside the billing lint block) and 9 LOW.
- SECURITY: PASS (run 1, at a4725c1). 3 LOW plus 1 carried.
- CODE_REVIEW: PASS (run 3, at 291058e). Run 1 FAIL at a4725c1 and run 2 FAIL at 798efbb. Run 3 left 1 LOW, the 40 px controls, which 794188b fixed.
- TEST: PASS. This is the integrator's update of run 1 under Amended (al), in 6067790. The gate's own verdict, at 2976c4d on product commit 794188b, was FAIL for slice-test gaps only.

THE TEST RECORD'S PASS (checked, not taken on trust)
- Run 1 failed only on M1b, M1c, M1d, M2b, M5b, M5c and M6b, and on R1, R2 and R17, which rest on them. Each was a test gap: a logic line could change and every slice test still passed. The record names no product defect. Each gap is closed by a gate test that the sheet records failing under its mutation: G1 (M1b-d), G9 (M2b), G2 (M5b), G8 (M5c) and G3 (M6b).
- 6067790 adds exactly the three files (al) names:
  - test-gate-s4.test.tsx, +239 lines;
  - test-gate-s4-cashup.test.tsx, +60 lines;
  - customers-admin-gate-s4.spec.ts, +78 lines.
- It also edits the TEST record, the TC sheet summary and handover line 76. On line 76 a word diff shows a pure append of (al). Nothing else changes.
- The files' describe and test titles match the sheet's G1, G2, G3, G7 and G8 (9 tests), G9 (1 test), and G4 and G5 (4 e2e tests). I cannot compare them byte for byte against the gate's untracked originals.
- I reran test-gate-s4.test.tsx, test-gate-s4-cashup.test.tsx and overview-customers.test.tsx at HEAD with `--maxWorkers=1`: 3 files, 21 tests, all passed. That is 10 gate cases plus 11 slice cases, matching the sheet.
- So 141 PASS and 1 BLOCKED is the right recount. The BLOCKED row is U47j. It is not counted as a pass.
- No product file changed after 794188b, the commit TEST ran. 2976c4d and 6067790 touch only docs and tests.

GATES VERSUS LATER COMMITS
- 798efbb (eslint.config.mjs money block, and one `Number(` removed in CashUpSources.tsx, Amended (aj)): reviewed by CODE_REVIEW run 2, whose range was 0a14dbc...798efbb. TEST then ran it (U42i, and M8 shows the lint fires on CashUpSources.tsx). Covered.
- 291058e (44 px customers pager, past-the-end wording, mock cash-up date before cap): reviewed by CODE_REVIEW run 3, whose range was dce96bb..291058e, which passed it. TEST ran it (R16, R18, M10, M11, and G2 for the order). Covered.
- 794188b (`min-h-11` on Save count, Close day, the per-source inputs, the tags dialog's Cancel and Save, and the Type select): no review gate ran after it. I read the diff: 3 files, 6 class-only lines, no logic. It is exactly the fix CODE_REVIEW run 3's LOW proposed. TEST ran it as R19: G4 measured each control at 44 px or more on both projects, and failed on "Save tags is 40px tall" with the fix undone. My screenshot measurements agree: none of these controls is under 44 px. Covered by TEST. No rerun of the review gates is needed.
- 81c2239 (the CODE_REVIEW run 1 fixes) came after ARCHITECTURE and SECURITY. CODE_REVIEW run 2 reviewed it. It closes SECURITY LOW 1, the cross-branch cash-up cache: `useRecordCashCount` writes the exact key. TEST covers it through R2, G9 and M2a/M2b.

CRITERIA
- A14 MET. Customers: a browsable list with name search and tags, a profile summary, notes, tags, and a password reset started by staff.
  - Tests: U37a-g, U38a-c, U39a-c, U40a-c and U41a-b passed in T3. Mutations M3, M4a, M4b, M6a, M6c, M6d2, M10 and M11 show the tests can fail. G3 (Merged has no record controls) and G7 (the POS still uses `findCustomers`, OQ-14) are now the slice's.
  - E13a-e passed on both projects, first attempt. E13d covers search → lifetime spend, add a note, edit tags, and a reset showing the masked destination, with axe and no sideways scroll. E13e covers the tag filter and sort.
  - Seen at both widths:
    - The list loads before any search, with "11 customers".
    - Search "Rahman" writes `search=Rahman` and shows 1 row.
    - The tag filter "Regular" writes `tag=Regular`.
    - After I registered 14 walk-ins through the mocked API, the pager reads "Page 1 of 2 · 25 total". Next goes to page 2, with Next disabled on the last page.
    - `?page=9` shows "Nothing on this page" and "Back to the first page".
    - The profile shows Customer since, Orders "3", Lifetime spend "৳4,250.00" and Balance owed, plus Area "Dhanmondi" and the tag chips.
    - The Notes (1) tab became Notes (2) after a note, newest first, with author and time and the zone named.
    - The tags dialog shows three chips, "3 of 10 tags · up to 30 characters each", and the stored set on the chips after Save.
    - The confirm reads "Send a password reset link to Sam Rahman? It goes to their own mobile or email."
    - The result reads "Reset link sent by mobile to ***999. It expires at 01:21 (Asia/Dhaka)." No token or link is anywhere on the page.
  - 360 px defects are listed under FINDINGS F1 and F4.
- A15 MET. Cash-up counts per source, with the server's per-source variance.
  - Tests: U42a-j passed. M2a, M8 and M9 can fail them. G9 (the exact-key reply) and G2 (date before cap) are the slice's now.
  - E14f passed on both projects with axe and no sideways scroll. The baselines E-A1 :18 (failed as recorded) and E-F1 :216 (passed) are in E14a/E14e.
  - Amended (ai): documents-ops U-D1/U-D2 passed (U42j). billing-real-api:260 is not run.
  - Seen at both widths on the two-source day, 1 Nov:
    - Open: Source / Expected / Counted / Over or short, with Till ৳0.00 and Rezwan Ahmed ৳1,200.00, "Not counted yet" on each, and "Counted for {label}" inputs.
    - Counted at 100 and 1100: Till "Over BDT 100.00", Rezwan "Short BDT 100.00", "Counted in total: ৳1,200.00 · Variance: Balanced". Close day becomes enabled.
    - Closed: "This day is closed and read-only. Closed by Ada Administrator on 3 Nov 2026, 01:06 (Asia/Dhaka)." Per-source rows with no inputs, then Counted cash and Variance tiles.
  - Today's till-only day shows one "Counted for Till" row.
  - The money lint covers CashUpSources.tsx: eslint.config.mjs:166-172 (Amended (aj)).
- A16 MET. Outlet cards show type, address, today's hours, delivery areas and staff count; the staff list shows outlets and status.
  - Tests: U43a-f and U44 passed. E15c (outlet cards, and a warehouse created) and E15g (Outlet column, server Status, a dash for none) passed on both projects.
  - Seen:
    - Dhanmondi shows the "Outlet" and "Active" pills, "12 Gulshan Avenue, Dhaka", Today "09:00-13:00, 14:00-18:00", Delivers to "Dhaka City", and "2 staff".
    - London shows no "Delivers to", which is correct when there are no areas.
    - The Type select appears on the new form (set to Warehouse) and on the edit form (Outlet), with the hint "An outlet serves customers; a warehouse is where stock is kept."
    - The staff list shows "Dhanmondi outlet (primary) / London outlet", "—" for none, and Status Active / Not set up from the server. The footer reads "Roles: Administrator · Reception · Inventory." (BG-22 residual).
  - "Today" is a dt/dd pair rather than the literal "Today: {summary}". That is a presentation of the same server text, as ARCHITECTURE found.
  - 360 px defects are listed under F2 and F3.
- A17 MET. Roster grid cells cycle Morning/Evening/Off through the server.
  - Tests: U45a-n passed. M1a, M1e, M1f, M6c, M7a and M7b can fail them. G1 (all four roster writes refresh the cells) is the slice's now.
  - E15d passed on both projects with axe and no sideways scroll.
  - Seen at both widths:
    - The week grid shows Nadia Karim with Custom 09:00–17:00 on 2-4 Nov and Off on 5-8 Nov, and a legend with names only (OQ-15).
    - Clicking 3 Nov (Custom) asked "Replace this day's hours?". After confirming, the cell reads "Morning 08:00–14:00", which is Amended (aj)'s Custom → Morning.
    - The write appears in "Roster exceptions" as a cancelled shift plus an extra shift, as the slice report's §20.2 point 5 discloses.
- A18 (S4's part) MET.
  - U46: both colour guards and the back-up `rg` found 0 matches.
  - Axe: E13d, E14f, E15c, E15d, G5 (the two-source day and the open tags dialog), E16a-d (320 passed with the baseline excepted), and X1 (accounts-a11y-responsive, 196/196).
  - E19 is integration.
  - The 360 px findings are not axe failures.
- A19 (S4's part) MET, with one owed case.
  - U47a-i passed. G2 and G8 pin the refusal orders.
  - U47j (NoResetChannel) is BLOCKED. The rule is mirrored in the mock (SECURITY checked it against `IdentifierMasking` and the handler), but no seeded Active customer lacks both channels and the mock has no seam. It is carried, not counted.
  - The roster and branch mocks have no 403, an inherited gap (SECURITY LOW 3). It is carried.
- A20 MET. See SCOPE. Nothing subscription-shaped: the profile tabs are exactly Orders, Billing and Notes (U38a), and ARCHITECTURE's added-line sweep agrees.
- A21 (S4's part) MET.
  - At 794188b: T1 typecheck, T2 lint, T3 full Vitest (2150 passed, 0 failed, `--maxWorkers=2`), T4 `next build` and T5 the served-output check.
  - The integrator's recheck at the same product commit covered tsc and ESLint on the three adopted files.
  - My rerun of 3 files: 21 passed.
  - The full e2e half is E18.
- A1-A13: not S4's. A22: a recorded non-goal.

AMENDED (aj) DECISIONS: JUDGEMENT
- Status pill only for Incomplete: ACCEPTED.
  - The browse read returns Active customers only (`BrowseCustomersQueryHandler.cs:22`, `Status == Active`), so a row can only be Complete or Incomplete. The design (`docs/design/back-office/Customers.dc.html:127-131`) draws pills only for Subscriber and Incomplete, and Subscriber is out of scope.
  - A "Complete" pill on every row would be noise.
  - But see F1: at 360 px this very pill squeezes the row's text to about one character wide.
- Tag options collected across pages: ACCEPTED.
  - `customers/page.tsx:56-66` keeps a set of tags seen on any page this visit, plus the URL value, sorted. It only widens §11.5.3's "current page plus URL value". It never offers a tag the server did not send, and a stale option filters to an honest empty list.
  - There is no server tag catalogue to do better with.
- Custom → Morning: ACCEPTED.
  - ADR-FE-192 is silent on which preset replaces a Custom day. Morning is the first shift in the cycle. The confirm says so in words ("Setting a shift replaces them with the Morning shift for that day", roster/page.tsx:251), and the server allows only Morning/Evening/Off.
  - Seen on screen. U45m covers Cancel (nothing sent) and Replace (sends Morning).
- AdminBranch extends BranchSummary: ACCEPTED.
  - The server has two view models (`BranchSummaryViewModel` and `AdminBranchViewModel`). Widening `BranchSummary` would break run-only test literals and `StaffBranchAssignmentPanel`.
  - `admin-branches.ts:54-79` keeps `BranchSummary` unchanged, and `getAdminBranches` and `BranchDetail` return `AdminBranch`. The stricter mirror of the server.
- ESLint block: ACCEPTED, and verified at eslint.config.mjs:166-172. The one change to config is within (aj)'s words, and M8 shows it fires.

SCOPE
- Out-of-scope work found: none. No subscription surface, no backend, no nav, no new dependency. `CustomerSearchPanel.tsx` is left dead rather than deleted (carried).
- Files outside allowed scope: none. `git diff --name-only 0a14dbc HEAD` lists 59 files:
  - §13 S4 block: 49 files, among them the 4 `app/(staff)/staff/{customers,admin/branches}/**` pages.
  - Amended (ai): documents-ops.test.tsx and billing-real-api.spec.ts.
  - Amended (aj): web/eslint.config.mjs.
  - Amended (al): the 3 gate test files, which also sit under §13 globs or are named by (al).
  - Amended (r): the 5 gate records, the slice report and the TC sheet.
  - The handover: only line 76, appending (ai), (aj) and (al).
- §20 conditions worked around: none. The two out-of-block edits were raised as §20 requests in the slice report and ruled by (ai) before use.

UNDECLARED DEVIATIONS
- Implementation: none found. Each §11.5 departure is declared in the slice report and recorded in (aj).
- Records:
  - The TEST record's STATUS line and INTEGRATOR UPDATE are the integrator's, not the gate's own words, and they say so.
  - The TC sheet's header (line 3) still names Amended (a)-(aj), not (al). LOW.

SCREENSHOTS (Amended (j)), at docs/gates/screenshots/HO-P5-WIRING-S4/, 46 images
Setup and review:
- Captured on a fresh `next dev -p 3124` with MSW (`NEXT_PUBLIC_USE_MOCKS=true`, `NEXT_PUBLIC_API_BASE_URL=http://localhost:5005`), routes warmed with curl (8 routes, all 200), signed in as the seeded Administrator (`signInAsStaff`).
- One Chromium, one worker, a viewport of 1280x900 or 360x780, full-page captures. A fresh browser context per test, so each starts from the seeded mock.
- The scratch config and specs stayed in the session scratchpad: 14 browser tests, all passed. The dev log has 0 error or warn lines.
- I measured each page's scrollWidth: none scrolls sideways at either width. I also listed every visible control under 44 px. The only S4 controls in that list are pre-existing primitives (below).
- I looked at every image.
- Full-page captures freeze the sticky staff rail and dialog overlay at the scroll position, so the rail sometimes appears part-way down the page. That is a capture artifact.
- No back-office `.dc.html` was rendered for comparison. HO-P4 interpreted those designs and HO-P5 adds none. NOT CHECKED below.

Customers list: customers-list-*, customers-search-rahman-*, customers-tag-regular-*, customers-pager-page1-*, customers-pager-page2-*, customers-past-the-end-*.
- 1280: correct. The pager's Previous and Next are 44 px tall, and "Page 1 of 2 · 25 total" shows.
- WRONG at 360 (F1): every row with the "Incomplete" pill breaks the name and the mobile one or two letters per line ("W / al / k / - / in / P / ri / m …"). customers-pager-page1-360 is 7,582 px tall because all 15 walk-ins are Incomplete.
- WRONG at 360 (F4): the search field is about 118 px wide beside the Search button. The placeholder reads "Name, ı" and a typed "Rahman" shows as "ahman".

Profile: profile-tiles-*, profile-notes-*, profile-tags-dialog-*, profile-tags-saved-*, profile-reset-confirm-*, profile-reset-result-*.
- 1280: correct. Tiles in two columns. The tags dialog and the reset confirm are centred and fit. The reset result sits under the actions.
- 360: the tiles stack, the tags dialog and the confirm fit the width, and the note text wraps cleanly.
- Inherited at 360, not S4 code:
  - The profile's dl value column is about 50 px wide, so values break mid-word ("017999 / 99999", "signed / -in- / custo / mer@", and S4's new "Area" row reads "Dhan / mondi"). `CustomerDetail.tsx`'s grid predates S4; S4 added one row to it (F5).
  - The orders panel's "New counter sale for this customer" button and the erase panel's two selects run past the card's right edge (CustomerOrdersPanel.tsx and the erase panel are HO-P4).
- Primitives under 44 px: the dialog close "×" (24 px, components/ui), and the ConfirmDialog's Cancel and Send reset link (40 px, components/common). Both are outside S4's scope.
- Mock oddity: Sam's "Customer since" reads 3 Nov 2026, later than his seeded note of 20 Oct 2026. Seed only.

Cash-up: cashup-two-sources-open-*, cashup-two-sources-counted-*, cashup-two-sources-closed-*, cashup-today-till-*, plus cashup-two-sources-counted-scrolled-360.
- 1280: correct, as described under A15. The Save count, Close day and per-source inputs are 44 px.
- 360: the per-source table sits in a TableFrame, as §7 UI-1 requires. Only Source and Expected show until the frame is scrolled; scrolled, the inputs and the Over/Short pills show.
- Usable, but the counting inputs start off-screen (LOW, F6; it is the layout §7 asks for).
- The "Count saved" toast covers part of the table for about 5 s after saving. Not a defect.

Outlets: outlets-cards-*, outlets-new-type-*, outlets-edit-type-*.
- 1280: correct.
- WRONG at 360 (F3): "Dhanm / ondi outlet". The heading breaks mid-word because S4's new `flex-none` pill group ("Outlet" plus "Active") leaves the name about 70 px.
- The forms at 360 are correct, with a full-width Type select.

Staff list: staff-outlet-column-*, staff-outlet-column-scrolled-360.
- 1280: correct.
- WRONG at 360 (F2): inside the table frame, S4's new Outlet column collapses to 72 px. "Dhanmondi outlet (primary) / London outlet" renders as "Dhan / mond / outle / prim / ary) / Lond / on / outle", and Ada's row is 241 px tall. I measured the cell widths in the browser.

Roster: roster-week-*, roster-week-cycled-*.
- Correct at both widths: a table at 1280, and day cards at 360.
- After a cycle the 3 Nov cell reads Morning 08:00–14:00, and the exceptions list shows the two exceptions the write made.
- The "Cancel" link-buttons in that list are 20 px tall. That list is HO-P4 code, now reached more often because a cell write lands there (LOW, F7).

OWNER DECISIONS
- D1. Whether S4's two 360 px layout defects (F1, F2) block. I followed S2's precedent: a §7 UI-1 layout defect not contradicting a §18 criterion's wording is a MEDIUM finding, fixed by the integrator (as (ah)). If the owner reads UI-1 as binding at ACCEPTANCE, this verdict becomes FAIL on A14 and A16 until both are fixed. Recommended either way: fix both before E18.
  - F1: let the pill wrap below the text, or give the text column `min-w-[8rem]`.
  - F2: give the Outlet column a minimum width, or drop `[overflow-wrap:anywhere]` in favour of normal word wrapping.
- D2. Rate limit on staff password reset (SECURITY LOW 2). `StaffCustomersController.cs:148-161` has no `[EnableRateLimiting]`. A Reception or Administrator user can send reset after reset to the same customer, each with a fresh token and SMS or email. The cost is SMS and nuisance, with an audit trail.
  - Fix in the backend: a per-staff and per-customer policy, with the UI showing its 429.
  - Optional UI interim: disable the button for the token's 15 minutes after a success.
  - The owner decides whether, and when.
- D3. OQ-15 is still open in substance. The roster shows the server's presets (08:00–14:00 and 14:00–20:00), not the design's "Morning 8–4 / Evening 2–10". The owner was to confirm which hours are intended.
- D4. Delete the dead `components/customer/CustomerSearchPanel.tsx`? It has no importer. The integrator may delete it under a short Amended row.
Carried, still without a decision: S1's rider note in the audit table and the shared `Catalogue` rate-limit bucket (S1 SECURITY MEDIUMs), and S2's D1-D3.

CARRY-FORWARDS
Before merging S4:
- Commit this record and the 46 screenshots. Both are uncommitted, and docs/gates/screenshots/HO-P5-WIRING-S4/ is untracked.
- Fix F1 and F2, or have the owner rule under D1. Optionally fix F3.
- Optionally correct the TC sheet's header (line 3) to name (al).

Integration:
- E17 (Amended (l)) and E18 (§17.2 chunks, a fresh `next dev` each, `portal-dashboard` in its own chunk per (ae)). Under (i), recheck by name every failure outside S4's rows. TEST found none.
- E19 `sweep:a11y` against baseline 67691e9, and A21's full set at the merge: typecheck, lint, full Vitest at `--maxWorkers=2`, build.
- Contract run: add S4's new routes to `tests/contract/mock-vs-real.contract.test.ts` and run `test:contract` if a scratch API exists:
  - customers browse, notes, tags and password-reset;
  - cash-up with `sources` and the per-source count;
  - the admin branch list with the BG-21 fields;
  - staff accounts with status and branches;
  - roster-cells and shifts.
- Real-API: no one has run `billing-real-api:260` (Amended (ai)) or any other real-API spec against S4.
- Dead `CustomerSearchPanel.tsx`: no importer (D4).
- Roster and branch mock 403s (SECURITY LOW 3, inherited): `GET …/roster-cells`, `PUT …/shifts/{date}` and the branch `type` writes never answer 403. A mock run therefore cannot reach the roster page's cells-403 branch. Add the `requireAction` pattern and one U47 case each.
- U47j NoResetChannel seam: add an Active customer with neither mobile nor email, or a test seam in `areas/accounts.ts`, then one U47 case. Until then the mirror is unverified by any test.
- Not seen by this gate: the Locked staff status in a browser (component test only; the mock has no lockout), a 403 on any S4 screen in a browser, a branch switch on the cash-up in a browser, and the roster with a ShiftDateInPast or StaffNotRosterable refusal.

FINDINGS
- [MEDIUM] F1 web/components/customer/CustomerBrowsePanel.tsx:177-197 (S4, new). At 360 px the "Incomplete" pill (`CustomerStatusBadge`, nowrap) takes the row's spare width. The `min-w-0 flex-1` text column shrinks to about one character, so the name and mobile break letter by letter (customers-list-360, customers-pager-page1-360). Every Reception walk-in is Incomplete, so this is the common row at a counter. The row stays clickable and axe passes. The same markup existed in HO-P4's CustomerSearchPanel, but there it showed only exact matches; the browse list shows it on every visit.
- [MEDIUM] F2 web/components/admin/StaffAccountTable.tsx (S4's new Outlet column, `[overflow-wrap:anywhere]` with no minimum width). At 360 px, inside the table frame, the column is 72 px wide and outlet names break mid-word (staff-outlet-column-scrolled-360, measured).
- [LOW] F3 web/components/branches/BranchTable.tsx:83 (S4's `flex-none` pill group). At 360 px the outlet name breaks mid-word ("Dhanm / ondi outlet").
- [LOW] F4 /staff/customers at 360 px: the search input is about 118 px wide beside the Search button, so the placeholder is cut ("Name, ı") and a typed term scrolls.
- [LOW] F5 web/components/customer/CustomerDetail.tsx (pre-existing grid; S4 added the Area row). At 360 px the value column is about 50 px wide and mobile, email and area break mid-word. This is the same class of finding as S2's StaffOrderPanels Row.
- [LOW] F6 Cash-up at 360 px: the per-source inputs start off-screen in the TableFrame. This follows §7 UI-1's own instruction; noted for the owner's eye only.
- [LOW] F7 The roster page's exception "Cancel" link-buttons are 20 px tall (HO-P4 code). A roster cell write now adds two exceptions to that list.
- [LOW] Pre-existing, outside S4's scope: on the customer profile at 360 px, the orders panel's "New counter sale for this customer" button and the erase panel's selects run past the card edge.
- [LOW] docs/test-cases/TC-HO-P5-WIRING-S4.md:3 names Amended (a)-(aj), not (al).
- [LOW] No review gate ran after 794188b. I read it: class-only, CODE_REVIEW's own remedy, and TEST measured it (R19, G4). Recorded for completeness.

NOT CHECKED
- Not rerun by me: full Vitest, typecheck, lint, build, served-output, E13-E16, X1, X2 and the mutations. Those rest on TEST run 1 (at 794188b) and the integrator's recheck.
- What I ran:
  - The 3 Vitest files: 21 passed.
  - The screenshot specs: 14 browser tests passed, with page-width and control-size measurements.
- No comparison against the back-office `.dc.html` files (§19). The screens keep HO-P4's interpretation.
- Anything against a real API or database. Owner ratification of (m)-(al) beyond their text.

WRITTEN BY THIS GATE
- This record, and 46 PNGs under docs/gates/screenshots/HO-P5-WIRING-S4/.
- Nothing committed. No source, test, config or handover file touched. `git status` shows only the untracked screenshots folder and this file.
- The Playwright config and specs stayed in the session scratchpad.
- The `next dev` on :3124 that I started (PID 17584 and its tree) is stopped, and :3124 is free.
- No chrome-headless-shell is left running. The chrome.exe processes running before I started are the user's, and I did not touch them.

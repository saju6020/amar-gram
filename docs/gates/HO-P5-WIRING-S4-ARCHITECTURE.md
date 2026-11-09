GATE: ARCHITECTURE
HANDOVER: HO-P5-WIRING (slice S4: customers, money and admin, BG-19 … BG-23)
RUN: 1
COMMITS: 3d6f14b 31aa1bc c185721 0146979 e3db66a a4725c1 (base 0a14dbc, HEAD a4725c1, branch feat/p5-s4-customers-admin)
DATE: 2026-11-02
STATUS: PASS

There are no BLOCKER or HIGH findings. One MEDIUM and nine LOW findings are open. This verdict covers the code as written. I ran `tsc`, ESLint on the new folders, and the money and card guards. Every other test result in the slice report is the report's own claim.

FINDINGS
- [MEDIUM] web/components/back-office-admin/CashUpSources.tsx:48,87 (with web/eslint.config.mjs:166) — The per-source cash-up table, the count form and the variance pill are Billing presentation. They live in `components/back-office-admin/`, which the billing ESLint block (`components/billing/**`) does not cover, so the "money stays a string" rule (no `Number(`, `parseFloat(`, `parseInt(`, unary `+`) does not cover this file. Today the file breaks no such rule: I checked by hand. It uses `moneySign`, `withoutSign`, `normaliseMoney` and `Amount`, does no arithmetic, and sends each amount as a string through `wireMoney`. The report's reason is that §14 forbids new files in `components/billing/*` (decision 1). But §13 also lets S4 put this code in `CashUpScreen.tsx` itself, where the guard applies. The current layout drops a §7 C-6 guard for future edits, and §20.4 says a guard is never relaxed. It also files a Billing-context screen (`.ai/bounded-contexts.md`: cash sources belong to Billing) in an admin folder. Fix: either fold the component into `CashUpScreen.tsx`, or record an Amended entry and have the integrator add `components/back-office-admin/CashUpSources.tsx` to the billing block at integration. `eslint.config.mjs` is §14 config, so S4 cannot edit it.
- [LOW] web/lib/api/admin-branches.ts:68 — §11.5.1 says to widen `BranchSummary`. The code adds `AdminBranch extends BranchSummary` and leaves `BranchSummary` unchanged (report, silent decision 2). The code is right: `StaffBranchAssignmentPanel.tsx:9,23` and the run-only `staff-branch-assignment-panel.test.tsx:9-10` build `BranchSummary` literals, and the server's `BranchSummaryViewModel` is a different shape from `AdminBranchViewModel` (`AdministrationBranchViewModels.cs:5-17`). No export is removed. `StaffAccount` narrowing to `Omit<…,'status'|'branches'>` (staff-admin.ts:63) also matches the server's `StaffAccountViewModel`. This departs from the handover's text, so it needs an Amended entry.
- [LOW] web/app/(staff)/staff/customers/page.tsx:57-67 — §11.5.3 says "tags seen on the current page plus the URL value". The code collects the tags from every page visited in the session. This is harmless and the code comment says so, but the slice report does not list it. Needs an Amended entry or a fix.
- [LOW] web/components/customer/CustomerBrowsePanel.tsx:186 — §11.5.3 lists a "status pill" on each row. Only `Incomplete` gets a pill (silent decision 5). This matches HO-P4 and the design, and is acceptable. ACCEPTANCE should judge it, and an Amended entry should record it.
- [LOW] web/app/(staff)/staff/admin/branches/[branchId]/roster/page.tsx:257 — ADR-FE-192 does not say which shift a confirmed `Custom` day becomes. The code uses Morning, the first shift in the cycle (silent decision 6), and the confirm dialog says so. Acceptable; needs an Amended entry.
- [LOW] web/components/roster/RosterWeekView.tsx:228 — The legend says "Custom days are set by the weekly pattern". A Custom day can also come from a roster exception made in the exception form, which stays reachable on this page. A copy fix for CODE_REVIEW.
- [LOW] web/lib/api/staff-customers.ts:96,154 — ADR-FE-185 asks for file:line citations, and two point at the wrong lines. `StaffCustomerListItemViewModel` is `StaffCustomerViewModel.cs:26-28`, not `:21-23` (`:21` is `StaffCustomerSummaryViewModel`). `CustomerNoteViewModel` is `:31`, not `:36`.
- [LOW] web/lib/api/staff-customers.ts:113 — The `search` doc says email matches only "a term with `@`". The report's code-over-handover point 1 is right: `BrowseCustomersQueryHandler.cs:24-35` always matches name and email by substring, and the mock follows the code. The comment repeats the superseded handover wording.
- [LOW] web/lib/api/billing-cashup.ts:77 — `CashUp.sources` is optional, but the server always sends it (`BillingCashUpViewModels.cs`, last positional field; `CashUpCalculator.CalculateSources` always lists the till). The comment explains the choice, and `CashUpScreen` treats a missing list as `[]`. Under ADR-FE-185 a required field would be the stricter mirror. No change is needed before integration.
- [LOW] web/lib/hooks/billing/useBillingMutations.ts:31 — `type RecordCashCountInput` sits between two import blocks. Cosmetic.
- [LOW] web/mocks/handlers/admin/branches.ts:2-3,240 — Two new cross-area mock links. (1) The admin branches mock reads S0's `ordering/store` `db.zones` for `deliveryAreas`. It only reads, which the §13 ownership note allows (S2's dashboard mock reads the same store). (2) A reverse link: `areas/accounts.ts` now reads staff branches through a module-level provider that `admin/branches.ts` registers when it loads. If the accounts mock runs without the branches module loaded, every staff row gets `branches: []` and nothing fails. The full MSW registry loads both, so the app is fine. A component test that loads only the accounts handlers would see empty outlets. For TEST to note, not a defect.

SCOPE CHECK
- files in allowed scope: 50/50
- files outside allowed scope: none
- 46 files sit inside the §13 S4 block, by exact path or glob: 5 `lib/api` files, 4 hooks (`useBillingMutations.ts`: only `useRecordCashCount` and its input type changed), 4 `app/(staff)/staff/{customers,admin/branches}/**` pages, 15 component files across `components/{customer,back-office-customers,back-office-admin,roster}/**`, `CustomerProfileView.tsx`, `CashUpScreen.tsx`, `BranchTable.tsx`, `BranchDetailsForm.tsx` and `StaffAccountTable.tsx`, 5 mocks, and 13 test files. `tests/components/customer/merge-review.test.tsx` is under `tests/components/customer/**`, and only fixture fields were added to it.
- Amended (r), 1 file: docs/gates/HO-P5-WIRING-S4-SLICE-REPORT.md.
- Amended (ai), 2 files: web/tests/components/billing/documents-ops.test.tsx (U-D1/U-D2 only: the label regex, and `findAllByText` in place of `findByText`; `findAll` still throws when nothing is found, so the assertion is no weaker) and web/tests/e2e/billing-real-api.spec.ts:260 (the label only).
- §14 handover row, 1 file: docs/handover/HO-P5-WIRING.md. A word diff shows a pure append of (ai) to the §1 Amended cell, which §14 allows ("append-only §1 Amended rows").
- §14: `git diff --stat 0a14dbc...HEAD` is empty for src, tests (.NET), .ai, deploy, web/package.json, the lock file, web/nav, web/tests/guards, web/tests/setup.ts, web/docs, web/app/globals.css, mocks/handlers/ordering, mocks/handlers/shop, lib/api/errors.ts, lib/api/client.ts, lib/format, lib/money, components/ui, components/back-office and components/common. No new dependency. Shared test helpers (`reports-helpers`, `fixtures`) are imported, not edited.
- Handover §6 is complete.

REPORT ITEMS JUDGED

Code over handover (§20.2), all checked against src/:
1. Browse search: HOLDS. `BrowseCustomersQueryHandler.cs:24-35` always matches name and email with ILIKE, and matches a mobile only when the term is phone-like (digits, space, `+`, `-`) with at least 3 digits. The mock (`accounts.ts`, browse handler) mirrors this. Only the lib comment is stale (LOW above).
2. 400 rather than 404 for notes, tags and reset; `GET …/notes` returns `200 []`: HOLDS. The controller (`StaffCustomersController.cs:110-161`) returns `BadRequest(ValidationResult)` on failure and `Ok(result)` for notes, with no 404 branch.
3. No browser masking: HOLDS. `StaffCustomerViewModel` and `StaffCustomerListItemViewModel` carry the raw `MobileNumber` and `EmailAddress`. Only the reset destination is masked (`RequestCustomerPasswordResetCommandHandler.cs:52,70`). The channel values `Mobile` and `Email` match `PasswordResetChannel.cs`.
4. `counts: []` means total-only: HOLDS. `CashUpCommandHandlers.cs:46-58` takes the per-source path only when `Counts is { Count: > 0 }`. The client sends `counts` only when `sources.length > 0`.
5. A cell write stored as exceptions, with "Outside opening hours" and "On leave" still taken from the availability and leave reads: ACCEPTED. All three reads belong to Administration, and the flag is the availability read's own `outsideOpeningHours` field, not a value the browser works out, so `.ai/read-side-pattern.md` and §3.2 "no client join" hold. The roster page no longer shows interval or exception labels in a cell, because the cell's server shift replaces them (§11.5.8).
6. Seeded `orderCount` and `lifetimeSpend`: ACCEPTED under §20.5. The mock has no orders or payments to derive them from. The client shows them as sent, `lifetimeSpend` through `Amount`.

Decisions where the handover was silent:
1. `CashUpSources.tsx` in `back-office-admin`: in scope, but MEDIUM above (it falls outside the billing ESLint block).
2. `AdminBranch` beside `BranchSummary`: correct; LOW (needs an Amended entry).
3. The second cash source seeded two days ago: ACCEPTED. Today's 2,950.00 is a contract that U-D1 counts against. §12 says seeds are additive, and this one is (`staffCash` is new; no existing amount moved).
4. Branch-local `customerSince` date, and note times with the zone named: consistent with ADR-FE-015.
5. Status pill only for `Incomplete`: LOW.
6. A confirmed Custom day becomes Morning: LOW.
7. A refused tag stays in the input: UX only, no architectural effect.

§11.5 item by item:
- 11.5.1: built. The `BranchSummary` shape is the LOW above. `recordCashCount` keeps the total-only form and adds `counts[]`, each through `wireMoney`. `getRosterCells` and `setRosterShift` are typed to `RosterCellViewModels.cs:5-7`, and the settable shift excludes `Custom` (`RosterCommandValidators.cs:47-49`).
- 11.5.2: built. `useAdminBranches.ts` and `useStaffAdmin.ts` needed no change, because the request types widened. Query keys are namespaced (`['staff-customers', …]`, `['admin','branches',id,'roster-cells',…]`). The cash-up mutation writes the full read the command returns into the cache (`.ai/cqrs.md`; §6 notes that the count `PUT` returns the read), and so does the cell `PUT`.
- 11.5.3: built. `search`, `tag`, `sort` and `page` are in the URL (UI-4), `customer=` still selects, and the POS keeps `findCustomers` (OQ-14). `CustomerSearchPanel.tsx` is now unused by any page, but the slice did not delete it, and no export was removed. Tag options: LOW above.
- 11.5.4: built. KPI tiles (Customer since, Orders, Lifetime spend, Balance owed when Billing allows it), Area, tag chips with the edit dialog (≤ 10 tags, ≤ 30 characters, counter, saves the whole set and shows the stored set), the "Notes (n)" tab with author and time and a ≤ 1000 counter, and a reset confirm whose result shows the masked destination and expiry and never a token. The controls are hidden for roles outside `ActionRoles.Accounts.cs:33-35` as a hint only; the server's 403 still decides.
- 11.5.5: built. Source / Expected / Counted / Over or short, with one labelled input per source ("Counted for {label}"). Each pill takes its sign from the server's string. The total and the variance are the server's. `UnknownCashUpSource` and `DuplicateCashUpSource` map to the sentence §11.5.5 gives. An empty `sources` keeps the HO-P4 input. Close day is unchanged.
- 11.5.6: built. Type pill, address, "Today: summary" (the server's text), "Delivers to" only when there are areas, "{n} staff", and a Type select on create and edit.
- 11.5.7: built. Outlet column with the primary first and "(primary)", "—" for none. Status comes from the server's `status`, no longer from `hasPassword`. The footer is unchanged.
- 11.5.8: built to ADR-FE-192. One `PUT` per click, Custom asks first, past days and non-Reception people are not buttons, the cell shows the server's shift and slots, the button name follows UI-6 ("Nadia, Tuesday 4 Nov: Morning, 08:00–14:00. Change shift"), there is a polite announcement, and the legend lists names only (OQ-15). The pattern editor and the exception form are still on the page.
- 11.5.9: built. The mock refusals I sampled match the code the report cites. The HO-P4 staff fixtures (Nadia Reception, Rafiq Inventory) are unchanged. Three persisted keys were bumped. The rosters key was not bumped because its stored shape did not change.

§4.3 forbidden shapes: NONE FOUND.
- Money arithmetic: none in added `app`, `components` or `lib` lines. The one added `Number(` is the URL page number (customers/page.tsx). The mocks sum the sources, which is the server's role there (§11.5.9).
- No colour literal, `localStorage`, `sessionStorage`, `fetch(`, subscription endpoint or `isSubscribable` in any added line. Hooks are called only from `lib/hooks`. `components/customer/**` and `components/admin/**` import no hooks (ESLint passes).
- No new dependency, config change or `globals.css` edit.

ADRs: ADR-FE-185 is met apart from the citation LOWs, and the mocks carry the server's codes and property names. ADR-FE-192 is met. ADR-317 and ADR-FE-080 are met (see the MEDIUM on guard coverage). The other ADRs belong to other slices. ADR-341: the mock handlers stay in their per-area arrays, with the cross-area reads noted above.

CHECKS RUN
- `tsc --noEmit --incremental false -p .` from web/: exit 0.
- `eslint components/back-office-admin components/back-office-customers components/customer components/roster components/billing/CashUpScreen.tsx lib/hooks/billing/useBillingMutations.ts --max-warnings 0`: exit 0.
- `vitest run tests/guards/no-money-arithmetic.test.ts tests/guards/no-card-ui.test.ts --maxWorkers=1`: 2 files, 5 tests passed. The money guard scans the Ordering files only. I checked the S4 billing and customer files by hand.

NOT CHECKED (for TEST and later gates)
- Not run: the rest of Vitest, Playwright, the build and the contract test. No server was started. Screenshots and the visual calls in the report are for ACCEPTANCE.
- I compared mock-to-server parity on a sample, not every rule: browse, the notes and tags endpoints, the cash-up command branch, `CalculateSources`, the reset handler result, and the branch and staff view models. I did not open `CashUpAggregate`, `SetRosterShiftCommandHandler`, `RosterShiftCells`, `StaffAvailability`, `AdminBranchCardDetails` or the validators, so the report's citations to them are unverified.
- I did not read the test files in full, so the report's "at least as strong" table is for TEST. That gate should also try a mutation of the per-source sign pill and of the roster cycle.
- Architecture docs: I read the parts of `.ai/read-side-pattern.md`, `.ai/bounded-contexts.md` (by handover §6 reference) and ADR-341 that bear on this diff. No `src/` file changed, so the backend layering, aggregate, persistence and host rules do not apply.
- An untracked docs/gates/HO-P5-WIRING-S4-SECURITY.md appeared in the worktree during this run. It is another gate's file; I did not read or touch it.

# HO-P5 S4 (Customers, money and admin: BG-19 … BG-23) — slice report (§17.3)

Written by the S4 implementer. Everything below that says "passed" was seen to pass in this worktree; what was not run is said so. Nothing could be seen rendered: the visual calls are listed under "Decisions to double-check".

## Branch and HEAD

| Field | Value |
|---|---|
| Branch | `feat/p5-s4-customers-admin`, created with `git switch -c` from `0a14dbc` (`feat/phase2-catalogue-theme` with S0, S1 and S2 merged) |
| Worktree | `D:\my-repo\amar-gram\.claude\worktrees\agent-a5549fe8ddc12704c` |
| Pushed / merged | No / no |
| Commits | `git log 0a14dbc..HEAD --oneline` (the report commit is last) |

## Files touched (all inside S4's §13 block; paths under `web/`)

New: `components/customer/CustomerBrowsePanel.tsx`; `components/back-office-customers/{CustomerNotesPanel,CustomerTagsControl,CustomerTagsDialog,CustomerPasswordReset}.tsx`; `components/back-office-admin/CashUpSources.tsx` (see decision 1); `components/roster/shiftCycle.ts`; tests `tests/components/back-office-customers/{mock-refusals.test.ts,staff-record.test.tsx}`, `tests/components/back-office-admin/{cash-up-sources.test.tsx,mock-refusals.test.ts,branch-form-type.test.tsx}`, `tests/components/roster/roster-cells.test.tsx`.

Changed: `lib/api/{staff-customers,billing-cashup,admin-branches,staff-admin,admin-rosters}.ts`; `lib/hooks/{useStaffCustomers,useStaffCustomerMutations,useAdminRosters}.ts`, `lib/hooks/billing/useBillingMutations.ts` (the cash-up count mutation only); `app/(staff)/staff/customers/page.tsx`, `app/(staff)/staff/admin/branches/{new/page,[branchId]/page,[branchId]/roster/page}.tsx`; `components/{back-office-overview/CustomerProfileView,customer/CustomerProfile,customer/CustomerDetail,billing/CashUpScreen,branches/BranchTable,branches/BranchDetailsForm,admin/StaffAccountTable,roster/RosterWeekView}.tsx`; `mocks/handlers/{areas/accounts,billing/ops,billing/store,admin/branches,admin/rosters}.ts`; tests `back-office-overview/overview-customers`, `back-office-admin/money-and-admin`, `customer/merge-review` (two fixtures gained the new required fields, no assertion changed), e2e `staff-customers`, `billing-functional`, `admin-functional`, `staff-admin`.

Not touched although in the block: `lib/hooks/useAdminBranches.ts`, `useStaffAdmin.ts` (the request types gained `type`, so the hooks needed nothing), `app/(staff)/staff/admin/staff-accounts/page.tsx`, `app/(staff)/staff/billing/cash-up/**`, `tests/components/billing/payment-flows.test.tsx` (it has no cash-up cases; see §20 request 1).

Persisted-state keys bumped (mocks, §12): `__purrcare_accounts_mock_db_p5__`, `__purrcare_admin_branches_mock_db_p5__`, `__purrcare_billing_mock_db_p5__`. The rosters store changed no shape and keeps its key.

## §20 requests (files outside the S4 block that need a change)

1. **`tests/components/billing/documents-ops.test.tsx`, case "CashUpScreen — U-D1/U-D2" (line ~84-86), now FAILS.** The real server always lists the till in `sources`, so the cash-up count is always one input per source (§11.5.5) and today's day has the till alone. The case needs two edits, neither a weaker assertion: `findByLabelText(/Counted cash/)` becomes `/Counted for Till/`, and `findByText(/Short BDT 10\.00/)` becomes `findAllByText(...)` (the till row and the day's variance line both say it; the figures are unchanged: 2,940.00 against 2,950.00). The handover names `payment-flows.test.tsx` for the cash-up cases, but they live in `documents-ops.test.tsx`, which is in no §13 block.
2. **`tests/e2e/billing-real-api.spec.ts:260`**: `getByLabel(/Counted cash/)` has the same cause (real-API run only; "not run" here). It becomes `getByLabel(/^Counted for /)` for the till.
3. Nothing else. No change was needed to `lib/api/errors.ts`; the plain-language mappings for `UnknownCashUpSource`, `DuplicateCashUpSource`, `ShiftDateInPast`, `StaffNotRosterable`, `BranchNotAssigned` and `BranchNotFound` live in `components/back-office-admin/CashUpSources.tsx` and `components/roster/shiftCycle.ts`.

## Superseded assertions (old → new, at least as strong)

| Where | Old | New |
|---|---|---|
| `overview-customers.test.tsx` (HO-P4 U16) | empty state "Search by mobile number or email."; `q=` written on submit; an `@` term sent as `email`, a number as `mobile` | the list loads with no search (`?sort=recent&pageNumber=1&pageSize=20`); `search=` written on submit and the selection dropped; search, tag, sort and page reach `browse` in that order (`?search=Rahman&tag=Regular&sort=name&pageNumber=2&pageSize=20`); the tag filter offers the tags seen plus the URL's; the pager writes `page=`; selecting writes `customer=`; "No customer matches" empty state |
| same (HO-P4 U17) | tabs are exactly `['Orders','Billing']`, no `Subscriptions\|Notes` | tabs are exactly `['Orders','Billing','Notes (2)']`, still no `Subscriptions`, no "Subscriber"; plus Customer since / Orders / Lifetime spend tiles, Area and the tag chips; role cases for Accountant (no Edit tags, no reset, no add-a-note) and Reception (no erase) |
| `money-and-admin.test.tsx` U36 | single "Counted cash" input on today's day | the same assertions unchanged, against a day whose read has `sources: []` (the HO-P4 single input remains, §11.5.5); the per-source cases are `cash-up-sources.test.tsx` |
| same, U38 | `queryByText(/address\|staff count\|\d+ people/i)` absent | type pill, address, "Today" with the server's text (and "Closed"), "Delivers to" (absent when none), "9 staff" present |
| same, U39 | status text from `hasPassword`; `queryByRole('columnheader', {name: /outlet/i})` absent | status from the server's `status` including `Locked` on a row whose `hasPassword` is true; an "Outlet" header, primary first with "(primary)", "—" when none |
| e2e `staff-customers.spec.ts` E5 | label "Mobile number or email", `q=`, text "Search by mobile number or email." | label "Name, mobile or email", `search=`, the list shown before any search; Notes tab added to the tab check |
| e2e `billing-functional.spec.ts` E-D1 | `getByLabel(/Counted cash/)` | `getByLabel('Counted for Till')` (all other lines unchanged) |

## OQ defaults built to

OQ-14 (the Customers screen is the browsable list; the POS customer panel keeps `findCustomers`), OQ-15 (the roster legend lists shift names only; each cell shows the server's own slot times).

## Mock refusals added (server file:line mirrored). One or more cases each in the U47 files named

`tests/components/back-office-customers/mock-refusals.test.ts` (accounts) and `tests/components/back-office-admin/mock-refusals.test.ts` (billing, branches, rosters).

| Mock | Refusal | Server |
|---|---|---|
| `GET …/customers/browse` | `pageNumber` > 1,000,000, `pageSize` > 100, `sort` not `recent`/`name` (case-sensitive), `search`/`tag` > 100 characters: each a bare 400 `{ error }`, in that order; only **active** customers; `search` matches name and email (substring, any case) always, and a mobile only for a phone-like term (digits, space, `+`, `-`) with 3+ digits; `tag` is an exact match; `Customers.View` (403) | `StaffCustomersController.cs:52-74`, `BrowseCustomersQueryHandler.cs:17-71`, `ActionRoles.Accounts.cs:29` |
| `GET …/customers/{id}` | adds `customerSince`, `area`, `orderCount`, `lifetimeSpend` (money string), `tags`, `noteCount` | `StaffCustomerViewModel.cs:11-13` |
| `GET …/{id}/notes` | newest first; the author's name as it is now (`null` when gone); an unknown customer is `200 []` | `CustomerStaffRecordSupport`/`GetCustomerNotesQueryHandler` (`GetStaffCustomerQueryHandler.cs:63-87`) |
| `POST …/{id}/notes` | blank → 400 `NotEmptyValidator` on `Text`; > 2000 → `MaximumLengthValidator`; unknown customer → 400 `CustomerNotFound` and merged/anonymised → `AccountNotActive`, both on `CustomerId` (**400, not 404**); after trimming empty or > 1000 → `InvalidCustomerNote`; the 201st note → `CustomerNoteLimitExceeded`; `Customers.AddNote` (403); author = the signed-in staff member; 201 `{ noteId }` | `CustomerStaffRecordCommandValidators.cs:9-18`, `CustomerStaffRecordCommandHandlers.cs:14-62,108-125`, `CustomerStaffRecordAggregate.cs:35-53`, `StaffCustomersController.cs:115-129` |
| `PUT …/{id}/tags` | > 50 sent → `PredicateValidator` "has too many tags."; a blank tag or > 30 characters or a control character → `InvalidCustomerTag`; > 10 after de-duplication → `CustomerTagLimitExceeded`; trimmed and de-duplicated case-insensitively keeping the first spelling; 200 `{ tags }` as stored; `Customers.SetTags` (403) | `CustomerStaffRecordCommandValidators.cs:21-29`, `CustomerStaffRecordAggregate.cs:55-86`, `StaffCustomersController.cs:131-146` |
| `POST …/{id}/password-reset` | to the customer's mobile, else email; `{ channel, maskedDestination, expiresOn }` only (no token); masked `***` + last three, or first letter + `***` + domain; expires in 15 minutes; no channel → `NoResetChannel`; the same customer checks as notes; `Customers.RequestPasswordReset` (403) | `RequestCustomerPasswordResetCommandHandler.cs:34-80`, `IdentifierMasking.cs:11-24`, `AccountOptions.cs:26` |
| `GET /api/staff-accounts` | each row has `status` (`NotSetUp` without a password, `Locked` while a lockout runs, else `Active`) and `branches` (primary first, then by name; empty with no assignment) | `StaffAccountStatusRules.cs:11-15`, `GetStaffAccountsQueryHandler.cs:36-72` |
| `PUT …/cash-ups/{date}/count` with `counts[]` | > 50 entries → `PredicateValidator` on `Counts`; blank/over-60/control-character key and a negative, over-cap or 3-decimal amount → violations on `Counts[i].SourceKey` / `Counts[i].CountedCash`, all reported together; closed day → `CashUpClosed` on `Status`; a repeated key → `DuplicateCashUpSource`, an unknown key → `UnknownCashUpSource` (both on `counts`); a future day → `CashUpDateInFuture`; the total is the sum of the sources (done in the mock, which is the server's role there); a recount replaces; a total-only count clears the per-source counts; the card-number explanation guard now runs before anything is written | `BillingCashUpCommandValidators.cs:8-23`, `CashUpAggregate.cs:56-108`, `CashUpCommandHandlers.cs:26-69`, `StaffCashUpController.cs:33-52` |
| `GET …/cash-ups/{date}` | `sources[]`: the till first, then each staff collector; expected sums to the expected cash; `counted`/`variance` null while uncounted on an open day and for a total-only day; a source left out reads as counted nothing once the day is closed and something was counted; frozen at close | `CashUpSources.cs:21-40`, `CashUpCalculator.cs:83-112`, `CashUpQueryHandlers.cs:42-60` |
| `POST/PUT …/admin/branches` | `type` blank is fine; a name matches without regard to case; anything else → 400 `PredicateValidator` on `Type` "is not a recognised BranchType."; an absent type is Outlet on create and unchanged on update | `BranchCommandValidators.cs:19,31`, `ValidationRuleExtensions.cs:48-50`, `EnumerationParsing.cs:20-30`, `BranchRequests.cs:11-12,22-23` |
| `GET …/admin/branches[/{id}]` | the full `AdminBranchViewModel`: `type`, `todayHours` (branch-local today, closures applied, "Closed" when none), `deliveryAreas` (active zones by priority, from the ordering mock), `activeStaffCount` | `AdministrationBranchViewModels.cs:10-26`, `AdminBranchCardDetails.cs:20-69` |
| `GET …/roster-cells` | `to` before `from` → 400 `{ error }`; more than 31 days → 400 `{ error }`; every day of the range for each rostered person (or the one asked for); Morning/Evening only for exactly the preset hours, Off for none, else Custom | `AdminRostersController.cs:70-86`, `LeaveRules.cs:10`, `StaffAvailability.cs:72-94`, `RosterShiftCells.cs:14-26` |
| `PUT …/rosters/{id}/shifts/{date}` | validator: blank → `NotEmptyValidator`, unknown → "is not a recognised RosterShift.", `Custom` → "must be Morning, Evening or Off."; then `StaffNotRosterable` (no account, or no Reception role) on `StaffAccountId`, `BranchNotFound` on `BranchId`, `BranchNotAssigned` on `branchId`, `ShiftDateInPast` on `Date` (branch-local today is allowed); a click is stored as a whole-day cut plus one extra shift with deterministic ids, so a second click replaces rather than stacks; 200 with the cell | `RosterCommandValidators.cs:40-51`, `SetRosterShiftCommandHandler.cs:30-104`, `RosterCommandHandlers.cs:75-86`, `AdminRostersController.cs:49-68` |

Test seams added: `setMockStaffLockedUntil` and `registerStaffBranchesProvider` / `getMockStaffRoleIds` in `accounts.ts` (the accounts mock cannot import the branch mock, which imports it); `isStaffAssignedToBranch` in `admin/branches.ts`.

## Where the code differs from the handover (§20.2: the code won)

1. **Browse search.** §11.5.9 says email "when it contains `@`". The handler always matches name and email by substring, and matches a mobile only for a phone-like term of 3+ digits (`BrowseCustomersQueryHandler.cs:24-35`). The mock follows the code.
2. **Notes, tags and reset refuse a missing or inactive customer with a 400** on `CustomerId`, not a 404, and `GET …/notes` for an unknown customer is `200 []`.
3. **The server does not mask a customer's mobile or email** in the list or the profile (staff with `Customers.View` read them whole). Only the password-reset destination is masked, and that is what the UI shows. Nothing further is masked in the browser.
4. **`counts: []` is not a per-source count.** The handler falls through to the total-only path with `countedCash` (`CashUpCommandHandlers.cs:46-58`); the client never sends an empty list (a day with no sources keeps the HO-P4 input).
5. **A cell write is stored as roster exceptions** (a whole-day cut and an extra shift), so those appear in the page's "Roster exceptions" list too, as they do from the real server. The grid itself deliberately applies neither leave nor opening hours (`GetRosterCellsQueryHandler.cs`), so the page still reads the availability only to say "Outside opening hours" and "On leave" in words, as HO-ADM-002 did.
6. **`orderCount` and `lifetimeSpend` in the accounts mock are seeded figures** (Sam Rahman: 3 orders, ৳4,250.00): the mock has no orders or payments to compute them from, and the server computes them (`StaffCustomerViewModel.cs:3-13`). §20.5: the minimum state that makes the rule true.

## Decisions where the handover was silent

1. **Cash-up sources live in `components/back-office-admin/CashUpSources.tsx`**, not in `components/billing/`: §14 forbids new files in `components/billing/*`. `CashUpScreen.tsx` imports it.
2. **`BranchSummary` is unchanged and a new `AdminBranch extends BranchSummary` carries the BG-21 fields** (`getAdminBranches` and `BranchDetail` return it). §11.5.1 says to widen `BranchSummary`, but `tests/components/branches/staff-branch-assignment-panel.test.tsx` (run-only) builds `BranchSummary` literals and would stop compiling. `StaffAccount` is now `Omit<StaffAccountSummary, 'status' | 'branches'>`, because the single-account read does not send them.
3. **The seeded second cash source is two days ago, not today.** Today's seeded expected cash (2,950.00) is a contract that `documents-ops.test.tsx` U-D1 counts against, so today's cash-up has the till alone and `?date=<today−2>` has the till and "Rezwan Ahmed" (a staff-collected 1,200.00 on delivery). E14 uses that day.
4. **Dates of the server's `customerSince`** are shown as a branch-local date (`formatDateOnly(localDateOf(...))`), note times with the zone named (ADR-FE-015).
5. **The customers list shows a status pill only for `Incomplete`** (as before; the design draws only that one). §11.5.3 says "status pill"; a "Complete" pill on every row would be noise.
6. **The roster's Custom day goes to Morning once confirmed** (ADR-FE-192 does not say which preset a Custom day becomes; Morning is the first of the cycle).
7. **A refused tag stays in the tag box** to be corrected rather than being cleared.

## Decisions to double-check (visual or UX; nothing here could be seen rendered)

* Customers list: search runs on Enter / the Search button (not as you type), tag and sort are two selects above the list, and a Previous / Next pager sits below it.
* Profile: four KPI tiles in two columns (Customer since, Orders, Lifetime spend, Balance owed); "Tags" chips under the contact block with an "Edit tags" button; "Send password reset" beside "New order".
* The reset result reads "Reset link sent by mobile to ***999. It expires at 15:42 (Asia/Dhaka)." — "by mobile" is the server's channel word, lower-cased.
* Cash-up count: a four-column table (Source, Expected, Counted, Over or short) inside a scroll region at phone width, then "Counted in total: … · Variance: …" in a polite live region.
* Outlet cards: type and Active pills at the top right, then address, then a Code / Time zone / Today / Delivers to / Staff list.
* Roster: shift buttons are colour-coded by tone (Morning green, Evening amber, Off grey) and always carry the shift name and times as text.

## Verification

Commands from `web/`. Memory note: S3 was running, so Vitest ran at `--maxWorkers=2` and Playwright at `--workers=1`. The full Vitest suite and the full e2e were **not** run (the TEST gate does that, per Amended (n)).

| Check | Result |
|---|---|
| `npx tsc --noEmit -p .` | exit 0, no output |
| `npx eslint . --max-warnings 0` (the whole of `web/`) | exit 0, no output |
| Vitest, the files this slice adds or changes plus the folders around them: `tests/components/{admin,branches,customer,roster,back-office-admin,back-office-customers,back-office-overview,billing,staff}`, `tests/unit`, `tests/guards` (`no-money-arithmetic`, `no-card-ui`, ordering scope), `shop/no-hex-literals` and `back-office/no-colour-literals` (U46) | 91 files: **90 passed, 1 failed**; 829 tests passed, 1 failed. The failure is `billing/documents-ops.test.tsx` U-D1/U-D2 and is §20 request 1 (a selector in a file outside the block). Nothing else failed. The four folders S4 owns (`back-office-customers`, `back-office-admin`, `roster`, `back-office-overview`) alone: 13 files, 104 tests, all passing |
| e2e E13 `staff-customers.spec.ts`, both projects, `--workers=1`, fresh `next dev` on 3124 | 10 passed (twice). First run: E5 on `chromium` failed axe `document-title` ("no non-empty title"); a replica with the same steps passed and failed on alternate runs, so it is a head swap during the client-side URL change, not the page. The spec now waits for `toHaveTitle(/.+/)` before axe; both later runs 10/10 |
| e2e E14 `billing-functional.spec.ts` (E-D1 selector edit + new E14), both projects | 30 passed, 2 failed: **E-A1 :18 on both projects, the §16 baseline failure, failing as recorded**. E-F1 :216 passed this time. After moving E14 to the end of the file (so :18 and :216 keep their line numbers) and the E-D1 edit to one line, `-g "E14|E-D1|E15"`: 10 passed |
| e2e E15 `admin-functional.spec.ts` + `staff-admin.spec.ts`, both projects | first run 26 passed, 2 failed: **E-B1 on `mobile-360` (:56, baseline, same two errors as recorded)**, and my new outlet-card case on `mobile-360` timed out in a `fill` right after E-B1's failure (the same dev-server family of trouble). It passed alone (15 s) and in a rerun of the whole `mobile-360` chunk (13 passed, only E-B1 failed). After the last edit (dynamic import so E-B1 stays at :56) the new cases passed on both projects |
| e2e E16 run-only: `billing-a11y-responsive`, `admin-a11y-responsive`, `admin-filters`, `admin-branch-calendar`, both projects, `--workers=1` | **320 passed, 2 skipped (the real-API cases), 0 failed** in 35 minutes. `billing-a11y-responsive` :86 (the baseline) did not fail this time. This includes axe and the 360 px check on `/staff/billing/cash-up` (till alone) and on the `/staff/customers/<id>` profile with its new tiles, tags and Notes tab |

No resource crash (no 0xC0000142) and no timeout counted as a result. S3's server was on 3123 during the runs; mine was started on 3124, warmed with curl first, and killed at the end (port 3124 free). `chrome-headless-shell` processes still listed after my run are S3's (its server is still up); mine had exited with Playwright.

Not run: the full Vitest suite; E17 specs; `sweep:a11y`; `npm run build`; the contract tests; the real-API specs.


## Anything left undone

* §20 requests 1 and 2 (the two out-of-block selector edits). Until the first is routed, `documents-ops.test.tsx` U-D1/U-D2 fails.
* No e2e case for a Locked staff status (the mock has no lockout; `setMockStaffLockedUntil` is a component-test seam). The Locked pill is proved by `money-and-admin.test.tsx` U39/U44 and the mock rule by `mock-refusals.test.ts`.
* `NoResetChannel` is mirrored in the mock but unreachable from the seeds (no active customer has neither a mobile nor an email); it has no test.
* `tests/contract/mock-vs-real.contract.test.ts` is the integration step's.

## Round 2 (CODE_REVIEW run 1 fixes; ARCHITECTURE and SECURITY passed)

Commit: `fix(web): ... (HO-P5 S4 CODE_REVIEW run 1)`. Nothing under `docs/handover` or `eslint.config.mjs` was touched.

**Must fix**
1. HIGH, roster cells stale: `useSetRosterPattern`, `useCancelScheduledRosterPattern`, `useCreateRosterException` and `useCancelRosterException` now all invalidate `['admin','branches',branchId,'roster-cells']` (one `invalidateCells` helper; cancel-pattern and cancel-exception also refetch availability); `useSetRosterShift` also invalidates `rosters`. Page test in `roster-cells.test.tsx`: cancelling a "Roster cell" exception turns the grid from Morning to Off. Shown to fail with the invalidation removed.
2. MEDIUM, cross-branch cache write: `useRecordCashCount` reads `useBranchScope()` itself and does `setQueryData(['billing','cash-up',branchId,date], view)`. Test in `cash-up-sources.test.tsx` seeds another branch's entry for the same day and asserts it is the same object after a save.
3. MEDIUM, profile state carried over: `CustomerProfileView key={selectedId}`. Test (`overview-customers.test.tsx`): note draft, reset result and the Notes tab do not carry to a cached next customer. Shown to fail without the key.
4. MEDIUM, U40: the mocked PUT now returns a set that differs from what was sent (a colleague's "VIP" added); the chips must show it.
5. MEDIUM, past days: two tests. This week's Nadia buttons equal twice the days on or after today (table plus day list); after "Previous week" there are no buttons at all while the shifts still read as text.
6. LOW, `documents-ops.test.tsx` now `toHaveLength(2)`.

**Cheap LOWs**
- `staff-customers.ts`: citations now `:26-28` (list item) and `:31` (note); the search comment no longer says "email only with @".
- Roster legend: "Custom days have hours of their own, from the weekly pattern or an exception."
- `useBillingMutations.ts`: the type alias moved below the imports.
- "The cell keeps its shift" now checks the clicked cell's exact label.
- `staff-admin.spec.ts` now asserts the dash for a person with no outlet.
- `CashUpSources.tsx`: `Counts[i].SourceKey` / `.CountedCash` violations go under that row's input (root message cleared when every violation was a row one); `CashUpScreen`'s `VarianceText` delegates to `SourceVariancePill`, one component (both in the block). Test added.
- `cash-up-sources.test.tsx`: asserts "Variance: Over BDT 1.00"; the `rawJSON` assertion is unconditional; closed per-source readout case added (no inputs, Short BDT 100.00 / Balanced).
- `CustomerTagsDialog`: a tag typed but not added is added on Save (a bad one blocks the save with the same message as Add). Tests for both.
- `CustomerBrowsePanel`: uses `SimplePager`; an empty page past the end offers "Back to the first page"; an "Updating the list..." status shows while the previous page is held (`isRefreshing` from `isPlaceholderData`). Pager text is now "Page 1 of 3 - 45 total"; test updated. Test for the way back.
- `billing/ops.ts`: total-only and per-source counts check in the aggregate's order (open first, `CashUpClosed` on `Status`; then the date; the card-number guard last); a per-source sum above 9,999,999,999.99 is `InvalidAmount` on `countedCash`. Tests: both orders and the cap.

**Record only**
- `components/customer/CustomerSearchPanel.tsx` is dead (no importer; the POS has its own panel). Left in place as instructed; the integrator may delete it.
- The `'UTC'` zone fallback and the 100-staff read cap on the roster page: left as they are.
- Roster and branch mock 403s (SECURITY LOW 3, inherited): not added. The admin mocks model no staff session by design (`admin/fixtures.ts`), so a role check needs a new seam across `accounts.ts`; not cheap.

**Verification:** typecheck and `eslint . --max-warnings 0` clean. Vitest, 54 files / 585 tests (guards, U46 and every folder S4 touches or that imports its mocks: admin, branches, customer, roster, back-office-admin, back-office-customers, back-office-overview, billing, staff) at `--maxWorkers=2`: all passed. e2e on a fresh `next dev` (3124), both projects, `--workers=1`: `staff-admin` + `staff-customers` 16 passed; `billing-functional -g "E14|E-D1"` 4 passed. Server killed (3124 free).

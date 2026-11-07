# TC-HO-P6-SUBSCRIPTIONS-S2 — Subscriptions frontend: staff subscriptions (list, unpaid, detail, restart, cancel, export)

Handover: docs/handover/HO-P6-SUBSCRIPTIONS.md (S2 rows U27–U34, U40 for S2's files, §16 E9–E12, §18 A12/A13/A17/A18, OQ-13/15/16)
Commit under test: the S2 build commits on `feat/p6-s2-staff` (based on `feat/p6-s0-contract` at 2a61f70). See the slice report for the hashes.
Written: 2026-11-07 (by the implementer, with the build; the TEST gate re-runs everything and records its own results)

> Statuses record what the implementer saw inside the batch (§17.1): typecheck, lint, the Vitest files S2 touches and S2's own
> new Playwright specs. The full Vitest suite and the §16 run-only set (E12) belong to the TEST gate and are NOT RUN here, except
> the staff-shell/staff-auth/staff-customers specs, which were run once because of §20.3 (see E12).

## Summary

| | Count |
|---|---|
| Rows | 37 |
| PASS | 35 |
| PASS with baseline (E12: only the §1 baseline cases fail, same lines, same reasons, with and without the new link) | 1 |
| NOT RUN (belongs to the TEST gate) | 0 (E12 remainder closed by T10) |
| FAIL / BLOCKED | 0 |

## Environment

Worktree D:/my-repo/amar-gram/.claude/worktrees/p6-s2. `tsc --noEmit` exit 0; `npm run lint` (`--max-warnings 0`) exit 0.
Vitest 5.0.1 at `--maxWorkers=2`, only the files S2 adds or touches plus the nav, guard and source-guard files that scan S2's folders.
Playwright against `next dev` on PORT=3129, `NEXT_PUBLIC_USE_MOCKS=true`, `NEXT_PUBLIC_API_BASE_URL=http://localhost:5005`,
`E2E_KEEP_ROUTES=1`, `--workers=1`, projects chromium and mobile-360. No real API was used (the real-API spec skips). The dev server was
stopped afterwards; no tracked screenshot or report was overwritten (`git status` shows only S2's files).

## Component and unit cases (Vitest)

| ID | Case | Expected | Status | Evidence |
|---|---|---|---|---|
| U27a | `staff-list.test.tsx` lists the server rows with the nine columns of 11.3.3; customer link `/staff/customers/{id}`; row link `/staff/subscriptions/{id}`; status as a word, `1 × every 4 weeks` | pass | PASS | tests/components/staff-subscriptions: 4 files, 68 tests |
| U27b | Status is a word; a suspension names its reason on a second line | pass | PASS | same |
| U27c | Status, reason, method, sort, search write the address (search on blur), the server filters | pass | PASS | same |
| U27d | The reason select is enabled only for Suspended or no status; changing the status away drops the reason | pass | PASS | same |
| U27e | A reload issues the same request (`status, suspensionReason, paymentMethod, q, sort, pageNumber, pageSize`); a status the server does not know is not sent | pass | PASS | same |
| U27f | Empty state with "Clear filters"; 403 shows the permission message in place of the list; All/Unpaid link nav with `aria-current` | pass | PASS | same |
| U28a | Export CSV shown to ShopManager, Accountant, Administrator; not to Reception or Inventory | pass | PASS | same |
| U28b | Export calls `downloadBillingFile('…/export.csv?status=…&q=…&sort=…', 'subscriptions.csv')` with the current filters and no `page` | pass | PASS | same |
| U28c | 413 shows "Too many rows to export. Narrow the filters."; 403 shows the permission sentence | pass | PASS | same |
| U29a | Unpaid: "Suspended" heading before "At risk", rows grouped by the server's `group` | pass | PASS | `unpaid.test.tsx`, 5 tests |
| U29b | Each row lists date, order number as a link to `/staff/orders/{id}`, "Pay by … (Asia/Dhaka)", state as text, "2 unpaid in a row"; Open links to the detail | pass | PASS | same |
| U30a | Detail: customer, schedule, terms, records written out ("Never: none recorded", "Not cancelled", cancelled with reason label and note), history with order links | pass | PASS | `staff-detail.test.tsx`, 22 tests |
| U30b | Actions only from `allowedStaffActions` (Restart+Cancel suspended; Cancel active; none cancelled) | pass | PASS | same |
| U30c | Reception, Accountant, Inventory see the "Only a shop manager or an administrator…" sentence and no action | pass | PASS | same |
| U30d | After a restart no staff id is in the DOM; "Restarted on …: {reason}" is | pass | PASS | same |
| U30e | Locked subscription: staff locked sentence and pending terms as text; unknown/non-GUID id: "We couldn't find that subscription." with no request for the non-GUID | pass | PASS | same |
| U30f | History pages past 50 ("Show more" requests T6 page 2, then "All N entries shown"); server estimate with "Subscription discount −10%" | pass | PASS | same |
| U31a | Reinstate: dialog names customer and product; reason required; over 500 refused with a counter; date has no min/max and the OQ-16 helper | pass | PASS | same |
| U31b | POST `{ reason }` (trimmed; no `firstDeliveryOn` when empty); the staff detail is re-read; status region "Restarted. Next delivery on …" | pass | PASS | same |
| U31c | `ReinstatementReasonRequired` and `InvalidFirstDeliveryDate` land on their fields with what was typed kept; `SubscriptionCannotBeReinstated` and `SkuNotSubscribable` show in the dialog | pass | PASS | same |
| U31d | A 403 replaces the actions with `PermissionDeniedState` | pass | PASS | same |
| U32a | Staff cancel: note required; unlocked ends at once ("Subscription cancelled."), record shows "Cancelled by the shop, {note}" | pass | PASS | same |
| U32b | Locked wording only when `isLocked`; result "Cancellation scheduled. Ends after the delivery on …" and the Schedule panel shows it after the re-read | pass | PASS | same |
| U32c | `CancellationReasonRequired` on the Note field, typed text kept; "Keep subscription" sends nothing | pass | PASS | same |
| U33 | `tests/unit/staff-nav-groups.test.ts` (one case appended): Subscriptions in Sales right after Customers, current on `/unpaid` and a detail, no other group changed, nothing under "More" | pass | PASS | 1 new case; file 19 tests green |
| U34a | `mock-refusals.test.ts`: mock role arrays equal the web arrays equal ActionRoles.Subscriptions.cs:12-14; 403 per role for View (T1, T2, T5, T6), Manage (T7, T8), Export (T4) | pass | PASS | 24 tests |
| U34b | Bad status/reason/method → 400 `{ error }` with no `errors` array (list and export); unknown `sort` never 400; sort orders; `q` over product/customer/mobile | pass | PASS | same |
| U34c | Paging: size 0 → `InvalidPageSize`, page > 1,000,000 → `InvalidPageNumber`, size clamped to 100, default 20 | pass | PASS | same |
| U34d | Export: 413 `{ error }` above the cap (override), CSV with the 12 quoted columns below it | pass | PASS | same |
| U34e | 404 with no body for unknown/non-GUID ids on T5–T8; validator before handler; reinstate/cancel rule codes; plain-view answers; `SkuNotSubscribable` | pass | PASS | same |
| U40 | Colour-literal guards and the subscription source guard (U6) over S2's folders; every control `min-h-11`; the 360 spec measures them | pass | PASS | `tests/unit/subscriptions` + `tests/guards` green; E10 measures 44 px |

## End-to-end cases (Playwright, chromium + mobile-360)

| ID | Spec | Expected | Status | Evidence |
|---|---|---|---|---|
| E9 | `subscriptions-staff.spec.ts` (12 cases): filters in the address and reload; search → detail; Export CSV request/filename/columns; 413 message; Unpaid groups; restart with a reason leaves Suspended; order link opens the staff order page; cancel unlocked; cancel after the cut-off scheduled; sidebar entry current; Reception no actions/no Export; Accountant Export, no actions; unknown id | pass | PASS | 24 passed (12 cases x 2 projects) |
| E10 | `subscriptions-staff-360.spec.ts` (8 cases): list cards, filtered/empty list, Unpaid, detail (manager and read-only), both dialogs, the sidebar sheet entry — no sideways scroll, 44 px controls | pass | PASS | 16 passed (8 cases x 2 projects) |
| E11 | `subscriptions-staff-a11y.spec.ts` (18 cases: 8 screens/dialogs/413 at 1280 and 360, plus dialog focus trap/Escape/return and the link nav): zero serious/critical | pass | PASS | 36 passed on both projects |
| E11b | `subscriptions-staff-real-api.spec.ts` | skips without `E2E_REAL_API=1` | PASS (skips) | 10 skipped on both projects; NOT RUN against a real API |
| E12 | Run-only: `staff-shell-*`, `staff-auth`, `staff-customers` (52 cases) | only the §1 baseline fails | PASS with baseline | 45 passed, 7 failed. Baseline cases: `staff-shell-toggle` :29 (360 and 1440, both projects) and `staff-shell-sheet-closes-on-back-navigation` :30 (both projects). With the S2 nav edits stashed, the same cases fail at the same lines (`reachedToggle` :44, the "Inventory" link :45). `staff-auth` :152 failed once on a cold-compile 45 s timeout in the sign-in fixture and passed when re-run alone. `staff-shell-manual-expand-overflow` :37 (a baseline case) passed. No Tab-count or link-count change from the new link was found (§20.3) |
| E12b | Run-only: `admin-a11y-responsive` | pass | PASS | TEST gate T10 |

## Not covered by S2 (by design)

T3 (due tomorrow) and T9 (customer summary) are S3's. The real-API run (E18) and `npm run test:contract` are the integrator's. The full
Vitest suite and the rest of the §16 run-only set are the TEST gate's. The acceptance screenshots are the ACCEPTANCE gate's.

## Gate-fix round (after ARCHITECTURE, SECURITY, CODE_REVIEW)

| ID | Case | Status | Evidence |
|---|---|---|---|
| G1 | Show more: page 2 then page 3 each fail twice; "Try again" shown, "All N entries shown" hidden, loaded pages kept, recovers; exact row counts (57 cycles, 58 rows), no repeated date or order number | PASS | staff-detail.test.tsx |
| G2 | Unpaid `?page=99` says the page is past the end and offers the first page | PASS | unpaid.test.tsx |
| G3 | Stale `suspensionReason` not sent unless status is empty or Suspended; export refusal cleared when filters change; encoded ids in links | PASS | staff-list.test.tsx |
| G4 | No role note while the session loads; none on a cancelled subscription | PASS | staff-detail.test.tsx |
| G5 | Mock: non-GUID id is 404 before the role check (T5-T8); blank reason text and code | PASS | mock-refusals.test.ts |
| G6 | Re-run: tsc, lint, 20 Vitest files / 472 tests (--maxWorkers=2); Playwright `--workers=1` chromium + mobile-360 on PORT 3129: the four S2 specs (real-API 10 skipped) plus `staff-shell-toggle` and `staff-shell-sheet-closes-on-back-navigation`: 86 passed, 10 skipped, 0 failed (the two staff-shell baseline cases now pass) | PASS | this round |

## TEST gate run (2026-11-07, 678a404)

Written before running; every row starts NOT RUN and is updated one at a time below.

| ID | Case | Expected | Status | Evidence |
|---|---|---|---|---|
| T1 | `tsc --noEmit` | exit 0 | PASS | `npx tsc --noEmit` exit 0 |
| T2 | `npm run lint` | exit 0 | PASS | `npm run lint` (--max-warnings 0) exit 0 |
| T3 | Full Vitest `--maxWorkers=2` | all pass | PASS | 255 files passed, 1 skipped; 2493 tests passed, 62 skipped; 538 s at --maxWorkers=2; no flaky file |
| T4 | E9 `subscriptions-staff.spec.ts`, chromium + mobile-360, 2 workers | pass | PASS | Run 1 (4 S2 specs together, chromium + mobile-360, --workers=2): 76 passed, 10 skipped, 0 failed; E9 12 cases x 2 projects |
| T5 | E10 `subscriptions-staff-360.spec.ts` | pass | PASS | same run: E10 8 cases x 2 passed |
| T6 | E11 `subscriptions-staff-a11y.spec.ts` | pass | PASS | same run: E11 18 cases x 2 passed |
| T7 | E11b `subscriptions-staff-real-api.spec.ts` | NOT RUN (real API) | NOT RUN (real API) | 10 skipped (5 x 2 projects) in run 1 without E2E_REAL_API=1; no backend started |
| T8 | E12 run-only `staff-shell-*` (all 6 specs): no Tab/link count moved by the Sales link | pass | PASS | Run 2: all 6 staff-shell-* specs passed on both projects, including staff-shell-toggle :29 and sheet-closes-on-back-navigation :30 (baseline cases now pass). No Tab/link count moved by the Sales link (Amended (h) icon in place) |
| T9 | E12 run-only `staff-auth`, `staff-customers` | pass | PASS | staff-auth: all passed (incl. :152). staff-customers: under load in run 2 chromium :11 (`getByText('Incomplete')` not found, 5 s) and :32 (URL stayed /duplicates) failed; rerun alone with --workers=1 both projects: 10 passed. Recorded as load flake, not S2 (spec files do not touch subscription routes) |
| T10 | E12 run-only `admin-a11y-responsive` | pass | PASS | Run 2: admin-a11y-responsive all passed both projects (run 2 total 284 passed, 2 failed = the two flakes above) |
| T11 | Colour-literal back-up check (U40) `rg` over components app | no hits in S2 files | PASS | rg over components/staff-subscriptions and app/(staff)/staff/subscriptions: 0 hits; over components app: 0 hits |
| T12 | A12/A13/A17/A18 criteria each map to a passing case (see coverage table in gate record) | covered | PASS | A12 -> U27-U29, E9; A13 -> U30-U32, E9; A17/A18 (360 and a11y) -> E10, E11, U40; all those cases PASS above |

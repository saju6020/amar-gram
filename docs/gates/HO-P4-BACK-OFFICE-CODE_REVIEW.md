GATE: CODE_REVIEW
HANDOVER: HO-P4-BACK-OFFICE
COMMITS: 2f9006a (S0), c32a506 / 7cc5af5 (S2), de2a0de / 899ddad (S3), eaa9e52 / 9cc9f33 (S1), ed3028a / e65c852 (S4), bdcebe4 / 8baea3b (S5), 7cdfd78, a8bf606, 5d9ffbc, 4680214
DATE: 2026-10-30
STATUS: PASS

FINDINGS
- [LOW] web/tests/e2e/shop-staff.spec.ts:~100-107 (de2a0de) — E-C1's draft-slug check went from `expect(draft?.status()).toBe(404)` to "Page not found" h1 plus `meta[name=robots]` noindex. The HTTP status is no longer asserted, so this is weaker on one axis. The cause is documented in the spec (streaming `loading.tsx` fixes the status at 200) and the change is declared in Amended (iv) / HO-P3 Amended (h) D-A. The new assertions still prove a draft is not rendered. No action; noted for §15/§16 completeness.
- [LOW] web/tests/e2e/dashboard-home.spec.ts:~33 (eaa9e52) — E-A2's page-wide `getByText(/payments|receivables|revenue/i)).toHaveCount(0)` is now scoped to `section[aria-labelledby^="tile-"]`. The scope is narrower, but the commit adds a page-wide h2 check for /payments|receivables/ and a check that the approvals link is absent. The reason is given (the Latest-orders panel can say "Waiting for payment"). Net strength is equal or higher for the thing under test.
- [LOW] web/tests/components/staff-shop/staff-shop.test.tsx:~311, ~481 (de2a0de) — two negative assertions were dropped (`queryByText(/saving replaces the set/i)` absent, `queryByLabelText(/upload/i)` absent). Both asserted the old "upload not available" state, which ADR-FE-035 as corrected now reverses; the replacement asserts the upload button is enabled and the virus-scan note is present. Not a regression.
- [LOW] web/tests/e2e/admin-functional.spec.ts:~416-438 (bdcebe4) — E-B3 dropped the 360 px row-overflow and `max-w-md` (448 px) width assertions and the viewport widths [360, 768, 1024, 1440] became [1440, 1024, 768] plus a separate sheet check at 360. The sidebar picker has no `max-w-md` (it fills the aside), and the new checks (inside the aside, inside the viewport, inside the sheet at 360) are the equivalent bound for the new layout. Acceptable.
- [LOW] web/tests/components/admin/admin-nav.test.tsx (bdcebe4) — U-A1 and "shows every item for an administrator" were rewritten. The positive checks for Settings/Leave approvals/Audit log/System are kept in U37 plus the shop-manager test, so coverage is not lower. The old "renders nothing" test was already vacuous and is honestly renamed.
- [LOW] web/mocks/handlers/billing/staff.ts:~878 — the mock checks pending, then recorder, then reason. If the real handler validates the reason before the aggregate, a recorder who sends an empty reason sees ReasonRequired on the server and ApproverMustDiffer in the mock. The UI never offers Reject to the recorder, so no user can reach this. No action.

ITEMS PASSED FROM EARLIER GATES
1. Rewritten tests, §15/§16. Every rewritten spec or unit test was compared with its parent (pos.test, ordering-pos, staff-shop.test, shop-staff, dashboard.test, dashboard-home, control.test, inventory-flows/-real-api/-routes, procurement-flows, admin-nav.test, payment-flows, admin-functional, billing-functional, staff-admin, nav-roles, staff-nav-groups, staff-shell.test, data-table). No test was turned into a skip. No regex was loosened to match more. Most edits are selector or label renames for the redesign (radio to button, "Paid with" to a radiogroup, "Home" to "Dashboard", group names). Several were strengthened (E-C1 "Done: Country of origin is set." plus a food-labelling publish step; U35 now checks Approve and Reject are both absent on the own card and that both the approve and reject forced requests return ApproverMustDiffer; nav-groups gained label and prefix cases). Four assertion removals or narrowings are listed above as LOW, each with a stated reason and a replacement. None got weaker without compensation.
2. ActiveBranchPicker, aside and sheet instances. Both can be mounted, but neither can cause a conflicting write.
   - Seeding: `useMyBranches` runs in both. They share one query (same key, deduped). Its seed effect reads `ACTIVE_BRANCH_KEY` first and returns if the cached id is set and is one of the user's branches. The second instance's effect therefore finds the value the first wrote, or writes the same server value. The effect depends on `query.data`, which keeps its reference across an unchanged refetch, so it does not re-seed over a user's pick. If a refetch does change the data, the guard still preserves a valid pick.
   - Writing: only `onChange` calls `setActiveBranch`, and both selects are controlled by the same cache value. The aside picker is `hidden` below sm and the sheet is modal (and only exists below sm in practice), so no user can drive both at once. A write by one re-renders the other.
   - DOM ids: the sidebar variant uses `useId`, so there is no duplicate-id clash.
   - Covered by active-branch-picker.test and the staff-shell "outlet picker at the top of the sheet" test.

4680214 SCOPE (Amended (i) as corrected 2026-10-29)
- web/components/billing/ApprovalsQueue.tsx: the warning replaces both Approve and Reject on a self-recorded card. This is exactly the row's text ("...must approve or reject it.").
- web/mocks/handlers/billing/staff.ts: reject applies the pending and recorder checks. Granted by the row.
- web/mocks/handlers/billing/store.ts: the self-recorded seed payment moves to yesterday. Granted.
- web/tests/e2e/billing-functional.spec.ts: E-B2 follows the new text; E-D1 rejects the other staff member's payment. Granted. E-D1 still exercises the Reject dialog path (reason, "Reject payment") and the close-blocking flow.
- web/tests/components/billing/payment-flows.test.tsx U35: not named in the row but is the unit test for the same behaviour (§11.6.2 rewritten); the change is strictly stronger.
- docs/handover/HO-P4-BACK-OFFICE.md: §1 Amended row only (append-only).
- Nothing else in the commit. Within scope. Other mock consumers of the moved seed payment: tests/components/billing (5 files, 48 tests) pass.

CHECKS RUN
- `npx tsc --noEmit -p web`: clean (no output).
- `npx eslint` on components/billing, components/common, components/branches, mocks/handlers/billing: clean.
- vitest: payment-flows, tests/components/billing, tests/components/branches, tests/unit/staff-shell, tests/components/admin/admin-nav (12 files, 90 tests passed); billing dir (5 files, 48 tests passed).
- Full e2e not re-run, per the brief.

CHECKS THAT CAME BACK CLEAN
- No correctness regression found in the reviewed diff: ApprovalsQueue `recordedByMe` path (the `canApprove` false case also hides both buttons), error and busy handling unchanged.
- No new `any`, hex colours, or browser-side money arithmetic found in the 4680214 diff.

SCOPE CHECK
- files in allowed scope: 4680214 6/6 (handover §1 row; ApprovalsQueue.tsx; the two billing mock files; payment-flows.test.tsx; billing-functional.spec.ts), all under Amended (i) correction. Earlier commits as recorded in the ARCHITECTURE run 2 (157/157).
- files outside allowed scope: none

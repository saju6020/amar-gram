GATE: ARCHITECTURE
HANDOVER: HO-P4-BACK-OFFICE
COMMITS: 2f9006a (S0), c32a506 / 7cc5af5 (S2), de2a0de / 899ddad (S3), eaa9e52 / 9cc9f33 (S1), ed3028a / e65c852 (S4), bdcebe4 / 8baea3b (S5), 7cdfd78 (wordmark, under the §1 Amended 2026-10-25 row), a8bf606 (integration: mock fixture role, ADR-FE-183/184 status, ADR-FE-035 correction, Amended (i)-(iv)), 5d9ffbc (integration: notifications e2e fixes)
DATE: 2026-10-29
STATUS: FAIL

Run 1.

Method. Each slice commit has a single parent (S0's parent is 1aa6e76; S1 to S5 branch from 4171184) and is diffed against that parent. The five merges have no combined-diff content, and every slice file is the same at the merge as at the slice tip. HO-P3 commits in the 2f9006a^..HEAD range (e29a0ae ... 4171184) are excluded, except 7cdfd78, which the HO-P4 §1 Amended row puts under this handover's gates. The HO-P4 BG-1..23 backend commits are out of scope, as instructed. The only reason .ai/ (architecture, cqrs, read-side-pattern, bounded-contexts, namespace-conventions, adr) applies here is the §6 rule that the UI must not work around a server rule. No HO-P4 front-end commit touches src/, tests/ (backend), deploy/, web/lib/**, web/package*.json or any lint, test or build config.

FINDINGS
- [BLOCKER] web/mocks/handlers/areas/accounts.ts:61, :430-438 (5d9ffbc). §14 forbids web/mocks/**, and §4.3 says "No edit to any MSW handler". This commit seeds a new staff account (`inventoryStaffId`, "Rafiq Hossain", role Inventory) and adds three `accountsFixtureIds` keys. Amended (ii) covers only the `secondStaff` role swap back to Reception in a8bf606. It does not cover a new mock record. Needed: an owner-ratified §1 Amended row, or a revert with E-E2 handled another way.
- [BLOCKER] web/tests/e2e/fixtures.ts:65-80 (5d9ffbc). §14 lists this file as shared test infrastructure. The commit adds the `inventoryStaff` export and rewrites the `secondStaff` contract comment ("... and the message log ..."). No Amended row covers it.
- [BLOCKER] web/tests/e2e/notifications-log.spec.ts:1, :105-106 (5d9ffbc). The notifications-* specs are run-only (§14) and must "Pass unchanged" (E14). §20.3 says never edit a spec outside your block. E-E2 now signs in as `inventoryStaff`. Root cause: Amended (ii) made the second staff login Reception, which holds NotificationLog.View, so the documented `secondStaff` contract no longer excludes notifications. A ratified amendment is the right fix, and it should state the revised fixture contract.
- [BLOCKER] web/tests/e2e/notifications-templates.spec.ts:18-19 (5d9ffbc). Same rule (run-only, E14, §20.3). The spec now opens the "More administration" disclosure. The underlying change is the one §11.6.6 asks for: the S5 "More" disclosure hides "Message templates". So the deviation follows from the design, but §20.3 says such a break is raised as BLOCKED and routed through the owner, not fixed in a run-only spec.
- [MEDIUM] web/components/inventory/fields.tsx:210, :223 (ed3028a). `PageHeading`/`Panel` now wrap the back-office `PageHeader`/`Panel`. That restyles every inventory, procurement and recall page, about 70 importers, all inside S4's own §13 globs. §4.2 says routes S4 owns only to keep compiling get "no layout change". The deviation is recorded only in the ADR-FE-184 status line (web/docs/decisions.md:1982, a8bf606). It is not in Amended (iv), which lists S4's other declared deviations. Self-contained and token-only, but it should be ratified in the §1 row.
- [LOW] web/components/back-office/KpiTile.tsx:26, web/components/back-office/SearchField.tsx:32-33 (2f9006a). S0 added the props `headingLevel`, `inputRef` and `onKeyDown` beyond the fixed §11.1 contract. They are additive and documented in code, and nothing else edits the S0 files. §20.6 says additive props are recorded as a §1 Amended row, and none is.
- [LOW] web/docs/decisions.md:1974, :1982 (a8bf606). The ADR-FE-183/184 Status lines were rewritten in place, not appended. This follows the HO-P3 precedent (5bd5508) and the content matches the code. Recorded only for completeness.

Verified compliant:
- Layering (§8.1, §3.3). No changed component calls useQuery/useMutation or fetch. Data comes only through existing lib/hooks. Components that compose hooks (back-office-overview, back-office-stock, orders, pos) follow the baseline pattern (119 component files at 46929be import lib/hooks). The ESLint-scoped folders components/{customer,admin} import no hooks: CustomerSearchPanel and CustomerProfile take props, and CustomerProfileView in back-office-overview wires them.
- No browser-side figures (§4.3, ADR-317, FE-092). The cash-up pill reads the sign of the server's variance (`moneySign`). The POS "Exact" button fills in the quote's total string, and no change due is shown before completion. The side panel's next action comes only from `allowedActions`. Pick-list ticks are local state and are not persisted. Dashboard alert rows use the server's per-kind counts. The approvals row counts the unpaged pending list the queue already renders. StockPager arithmetic is page navigation only, not a domain figure. Staff & roles lists the role catalogue's `roleIds`.
- Backend gaps are left out, not stubbed (ADR-FE-184, §20.2). No "Sample data" text, no lifetime spend, subscriptions, notes, riders or "Receive into" control. Customer lookup is by mobile or email (`@` test) only.
- Reads stay per context (`.ai/bounded-contexts.md`, read-side-pattern §5). The dashboard and customer profile call each context's own hook. Batches load per SKU only when a row is expanded (§11.5.3). No N-fetch join for a list figure.
- Shell (§8.2, ADR-FE-181/182). Groups and labels come from staff-nav-groups.ts overrides. Area nav edits are exactly 11.1.3 and 11.1.4. `ActiveBranchPicker variant="sidebar"` is mounted in a hidden-at-rail container, so the seed effect always runs.
- §8.4 and §4.3 shapes. Selection lives in the URL (`?order=`, `?customer=`). No new localStorage/sessionStorage (the only hit is a test's `sessionStorage.clear()`). No `data-theme`. `role="tab"` appears only in the `mode="state"` tab primitive. Link navs use `<nav>` with `aria-current`. No colour literals in added code outside the U41 test's own fixtures.
- No new dependency. The ADR-FE-035 correction (FileUploader, Status card in the editor header) and Amended (i)-(iv) match the code (ApprovalsQueue keeps Reject when self-recorded; secondStaff is Reception in a8bf606).
- 7cdfd78. HearthLogo gains only `accentClassName` (default `text-leaf`), and staff-shell passes `text-leaf-soft`, as the 2026-10-25 Amended row says.

For TEST (runtime, not observable here): typecheck, lint, Vitest and the e2e counts. Whether the two `ActiveBranchPicker` instances (aside and open sheet) seeding at once cause a double write. That U24's guards still scan the new components/orders/StaffOrderDialogs.tsx and StaffOrderSidePanel.tsx. E15 axe sweep against 46929be.
For CODE_REVIEW: whether the e2e specs the slices rewrote (ordering-*, shop-staff, inventory-*, procurement-flows, billing-functional, admin-functional, staff-admin, staff-auth, staff-customers, dashboard-home) keep assertions of at least the same strength (§15/§16).

To reach PASS: an owner-ratified §1 Amended row on this handover covering 5d9ffbc (the new mock staff record, the fixtures.ts `inventoryStaff` export and the revised `secondStaff` contract, and the two notifications spec edits), plus the S4 fields.tsx restyle. No code change is needed if the owner accepts them.

SCOPE CHECK
- S0 2f9006a: 30/30
- S2 c32a506: 22/22
- S3 de2a0de: 15/15
- S1 eaa9e52: 31/31
- S4 ed3028a: 25/25 (fields.tsx is in scope by path. Its §4.2 layout effect is the MEDIUM above)
- S5 bdcebe4: 23/23
- 7cdfd78: 2/2 (staff-shell.tsx S0; HearthLogo.tsx under the §1 Amended 2026-10-25 waiver)
- a8bf606: 3/3 (handover §1 row is append-only §1; decisions.md is the integrator's ADR append per §9 and Amended (iv); mocks/accounts.ts is under Amended (ii))
- 5d9ffbc: 0/4
- files in allowed scope: 151/155
- files outside allowed scope: web/mocks/handlers/areas/accounts.ts (5d9ffbc change), web/tests/e2e/fixtures.ts, web/tests/e2e/notifications-log.spec.ts, web/tests/e2e/notifications-templates.spec.ts

---

GATE: ARCHITECTURE
HANDOVER: HO-P4-BACK-OFFICE
COMMITS: as run 1, plus bd13079 (owner-ratified §1 Amended (v)-(vii) and the run-1 record)
DATE: 2026-10-29
STATUS: PASS

Run 2. bd13079 touches only the handover's §1 Amended row (append-only, §14) and this file. `git diff 5d9ffbc bd13079` has no code change, so the run-1 code review stands. Each new row was checked against the code.

RESOLVED SINCE RUN 1
- Run-1 BLOCKERs, 5d9ffbc (web/mocks/handlers/areas/accounts.ts, web/tests/e2e/fixtures.ts, notifications-log.spec.ts, notifications-templates.spec.ts): covered by Amended (v), which matches the code.
  - accounts.ts:61, :430-438 seeds `inventoryStaffId` (Rafiq Hossain, role `Inventory`) with three fixture keys.
  - fixtures.ts:65-80 adds `inventoryStaff` and restates the `secondStaff` contract (Reception: Stock.View and the message log, no receiving or procurement).
  - notifications-log.spec.ts:105-106 signs E-E2 in as `inventoryStaff`.
  - notifications-templates.spec.ts:18-19 opens "More administration" first.
  - The stated cause holds. src/Shared/AmarGram.Shared/Common/Constants/ActionRoles.Notifications.cs:14 grants NotificationLog.View to Reception and Administrator only, so an Inventory login is the right 403 case.
- Run-1 MEDIUM, web/components/inventory/fields.tsx:210, :223: covered by Amended (vi), which names the file, the PageHeading/Panel wrap and the §4.2 exception. That matches ed3028a.
- Run-1 LOW, S0 additive props: covered by Amended (vii) (KpiTile `headingLevel`; SearchField `inputRef`, `onKeyDown`). That matches KpiTile.tsx:26 and SearchField.tsx:32-33.

FINDINGS
- [LOW] web/docs/decisions.md:1974, :1982 (a8bf606). Carried from run 1: the ADR-FE-183/184 Status lines were rewritten in place, not appended. This follows the HO-P3 precedent (5bd5508). No action needed.

The run-1 notes for TEST and CODE_REVIEW still apply.

SCOPE CHECK
- slice and integration commits as run 1; 5d9ffbc: 4/4 under Amended (v)
- bd13079: 2/2 (handover §1 row, append-only; docs/gates record)
- files in allowed scope: 157/157
- files outside allowed scope: none

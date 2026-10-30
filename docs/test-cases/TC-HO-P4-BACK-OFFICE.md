# TC-HO-P4-BACK-OFFICE — Back office rebuilt to the approved design

Handover: docs/handover/HO-P4-BACK-OFFICE.md (§15 U1-U41, §16 E1-E15, §17 step 5, §18, §1 Amended)
Commit(s) under test: 2f9006a (S0), S1 eaa9e52/9cc9f33, S2 c32a506/7cc5af5, S3 de2a0de/899ddad, S4 ed3028a/e65c852, S5 bdcebe4/8baea3b, 7cdfd78, a8bf606, 5d9ffbc, 4680214; HEAD 68297a7; baseline 46929be
Written: 2026-10-30  ·  Executed: 2026-10-30

> Statuses record what was **observed**, not inferred. The Evidence column names what was actually seen. `BLOCKED` marks a case that could not be executed or whose result was reasoned about rather than watched.
> The handover's U and E rows are numbered; IDs here are the handover's own. Rows I added are G (gate-added), D (HO-P3 D-B carry-over) and R (regression).
> The sheet was written first, every row NOT RUN, before any command ran. Rows were then updated after each run.
> "Pre-existing" means the same case also failed on baseline 46929be when I ran it there (worktree baseline-46929be, 1 worker, fresh server), or is on the brief's baseline-verified list.

## Summary

| | Count |
|---|---|
| Total | 74 |
| PASS | 64 |
| FAIL | 8 |
| BLOCKED | 2 |
| NOT RUN | 0 |

FAIL rows: E1, E10, E12, E13, E14, E16 (all because of pre-existing failures, listed below) and D1, D2 (the owner-assigned idle-lock fix is not delivered). No HO-P4-introduced regression was found.

## Environment

- Build: `npm run build` exit 0. `tsc --noEmit -p .` clean. `npm run lint` (--max-warnings 0) clean.
- Vitest, full run: 208 files; 7 failed, 200 passed, 1 skipped; 1852 tests pass, 13 fail, 45 skip (tests/contract, real API). The 13 are 5 s / 20 s timeouts under load in goods-receipt-form (6), receiving-layout (1), control (1), shared-pieces (1), overview customers (1), pos (2), reports viewer U-C9 (1). Re-run alone on 2 workers, the same 7 files pass 92/92.
- Playwright: `next dev` on :3120 started by me with NEXT_PUBLIC_USE_MOCKS=true, one server at a time, fresh server per chunk (the server grows to 8-9 GB inside a chunk, and tests then time out; those timeouts were re-run on a fresh server). Chunked runs at 2 workers, re-runs at 1 worker. chromium + mobile-360 both projects. Once the host suspended mid-run (ERR_NETWORK_IO_SUSPENDED); that chunk was re-run.
- Baseline: worktree baseline-46929be, own node_modules, dev server on the same port, 1 worker.
- Not reachable: real API (no backend started). The *-real-api specs and journey-real-api were not run.

## Unit cases (handover §15)

All executed in the one full vitest run (plus re-run of the 7 load-failed files). File per row from the test names.

| ID | Case | Expected | Status | Evidence |
|---|---|---|---|---|
| U1 | Sidebar groups | Groups in order; every link once | PASS | tests/unit/staff-shell.test.tsx + staff-nav-groups: passed in full run |
| U2 | Label overrides | Dashboard / Counter sale / Billing & cash-up | PASS | tests/unit/staff-shell.test.tsx passed |
| U3 | Active link on receipts/new | Goods receiving current, Inventory not | PASS | tests/unit/staff-shell.test.tsx passed |
| U4 | Sidebar footer | Name, roles, Sign out below sm | PASS | tests/unit/staff-shell.test.tsx passed |
| U5 | ActiveBranchPicker sidebar 2 / 1 branches | Select / nothing; seed runs | PASS | tests/components/branches/active-branch-picker.test.tsx passed |
| U6 | Existing shell behaviours | All staff-shell cases | PASS | tests/unit/staff-shell.test.tsx passed |
| U7 | PillTabs state | tablist, aria-selected, keyboard | PASS | tests/components/back-office/primitives.test.tsx passed |
| U8 | Link tabs | nav, aria-current, no role=tab | PASS | primitives.test.tsx passed |
| U9 | StatusPill, KpiTile, AttentionRow | Text, aria-hidden icon, no inline colour | PASS | primitives.test.tsx passed |
| U10 | TableFrame, DataTable | Named focusable region; data-table.test green | PASS | primitives.test.tsx and tests/unit/data-table.test.tsx passed |
| U11 | StaffAuthFrame | h1, helper, form, no data-theme | PASS | tests/components/back-office-overview/overview.test.tsx passed |
| U12 | Dashboard server tiles | Tile count, no "Sample data", h1 | PASS | overview.test.tsx passed |
| U13 | Needs attention with approvals 403 | Inventory rows, no approvals row, no banner | PASS | overview.test.tsx passed |
| U14 | Latest orders | 5 rows, AmountCell, link | PASS | overview.test.tsx passed |
| U15 | Reports layout | Report-list nav, table alternative, aria-live | PASS | overview.test.tsx and tests/components/reports/viewer.test.tsx (U-C9 timed out in the loaded run, passed alone) |
| U16 | Customers search | email / mobile lookup, ?customer= | PASS | overview.test.tsx; the search case timed out at 24.7 s in the loaded run, passed in the 7-file re-run |
| U17 | Customer profile panel | Orders and Billing tabs, New order link, erase for Administrator | PASS | overview.test.tsx passed |
| U18 | Orders status pills | status= in URL, All clears, no counts | PASS | tests/components/back-office-sales/orders-workbench.test.tsx passed |
| U19 | Selection survives refetch | Panel and ticks kept | PASS | orders-workbench.test.tsx passed |
| U20 | Actions from allowedActions | Only listed; [] none | PASS | orders-workbench.test.tsx passed |
| U21 | Pick list | Server-order allocations; Start packing gated | PASS | orders-workbench.test.tsx passed |
| U22 | POS tiles and ticket | Tile adds line; quote total; radiogroup | PASS | tests/components/back-office-sales/pos-ticket.test.tsx passed |
| U23 | POS money rules | Exact = quote string; no change before completion | PASS | pos-ticket.test.tsx passed; tests/components/pos/pos.test.tsx change cases timed out in the loaded run, passed in the re-run |
| U24 | Guards scan the new files | Guards pass AND scan StaffOrderDialogs.tsx and StaffOrderSidePanel.tsx | PASS | Guards pass 5/5. Mutation: appended `order.total * 2` and `"cvv"` to each of StaffOrderDialogs.tsx and StaffOrderSidePanel.tsx in turn; both guard tests (no-money-arithmetic, no-card-ui) failed naming that file and line (e.g. components/orders/StaffOrderSidePanel.tsx:259); each file restored with git checkout, guards green again, git status clean |
| U25 | Products status pills | All, Draft, Active, Archived | PASS | tests/components/staff-shop/products-design.test.tsx passed |
| U26 | Products header | Banners link, no Categories, CSV keeps filters | PASS | products-design.test.tsx passed |
| U27 | Editor section nav | Link tabs, select below md | PASS | products-design.test.tsx passed |
| U28 | Status card | Transition buttons with expectedVersion | PASS | products-design.test.tsx passed |
| U29 | Two-step save and conflict | Four named files pass | PASS | two-step-save, sku-shipping-weight, route-id-not-found, staff-shop tests passed |
| U30 | Stock row expand | aria-expanded; query on first expand | PASS | tests/components/back-office-stock/stock-by-item.test.tsx passed |
| U31 | Adjust from a row | Preselected SKU; approval note per server | PASS | stock-by-item.test.tsx passed; inventory/control.test.tsx U-E1 timed out in the loaded run, passed in re-run |
| U32 | Goods receipt | No Receive-into; inline line error; aria-live | PASS | back-office-stock/receiving-layout.test.tsx (timed out loaded, passed in re-run); goods-receipt-form.test.tsx 6 timeouts loaded, all pass in re-run |
| U33 | Inventory section nav | Link tabs "Alerts n open" | PASS | stock-by-item.test.tsx passed |
| U34 | Billing nav | Approvals/Cash-up/Invoices first; hidden for non-accounts | PASS | tests/components/back-office-admin/money-and-admin.test.tsx passed |
| U35 | Approvals self-recorded | Warning; Approve and Reject both absent | PASS | tests/components/billing/payment-flows.test.tsx passed. Read the assertions: queryByRole Approve and Reject absent inside the own card, and a forged approve and reject both return 400 ApproverMustDiffer. Strong |
| U36 | Cash-up | lines[], server variance pill, confirm | PASS | money-and-admin.test.tsx passed |
| U37 | Admin tabs | Link tabs, More, role-filtered | PASS | admin/admin-nav.test.tsx passed |
| U38 | Outlet cards | Cards and links, no address or staff count | PASS | money-and-admin.test.tsx passed |
| U39 | Staff & roles footer | Role ids from catalogue | PASS | money-and-admin.test.tsx passed |
| U40 | Settings hub | Cards link; settings-form.test | PASS | money-and-admin.test.tsx passed |
| U41 | No colour literals | None in the three trees | PASS | back-office/no-colour-literals.test.ts passed (including its pattern self-check); my own `rg` (G5) also zero hits |
| G1 | `npx tsc --noEmit -p .` | Clean | PASS | exit 0, empty output |
| G2 | `npm run lint` | Clean | PASS | exit 0, 0 warnings |
| G3 | `npx vitest run` | All pass bar load timeouts that pass alone | PASS | 1852 pass / 13 fail / 45 skip; the 13 are timeouts and all pass in the 7-file re-run (92/92). Disclosed above; not a clean first pass |
| G4 | `npm run build` | Compiles | PASS | exit 0, route table printed |
| G5 | rg colour-literal check, §17 step 5 | No hits | PASS | `rg -n "#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|-\[#" "app/(staff)" "app/(auth)/staff" components` returned nothing |

## Integration cases (handover §16)

| ID | Case | Expected | Status | Evidence |
|---|---|---|---|---|
| E1 | staff-shell-* (7 specs) | Pass | FAIL | 5 of 7 files green. staff-shell-toggle:29 (both widths, both projects), staff-shell-manual-expand-overflow:37, staff-shell-sheet-closes-on-back-navigation:30 fail on a fresh server at 1 worker. Baseline: toggle (baseline line 28) fails 4/4, overflow and sheet-closes fail. All three are pre-existing and on the brief's list. toggle: the loop presses Tab at most 15 times and never reaches the "Expand menu"/"Collapse menu" button (`reachedToggle` false at line 44); this fails identically at baseline. staff-shell-manual-expand-occludes-content:72 failed once under load, passed on a fresh server |
| E2 | New staff-shell-toggle case at 360 px | No h-scroll; Sign out visible; sheet has outlet picker on top | PASS | "StaffShell — back-office sidebar (HO-P4)" @360px and @1440px both ok, chromium and mobile-360 |
| E3 | dashboard-home.spec.ts | Pass | PASS | Chunk A, both projects ok |
| E4 | reports-viewer.spec.ts | Pass | PASS | Chunk E ok both projects. reports-real-api.spec.ts not run (see I-list); the viewer half is PASS |
| E5 | staff-customers.spec.ts + new case | Pass | PASS | Chunk A: the new E5 case ok; E-H1 (brief: baseline failure) did not fail here |
| E6 | staff-auth.spec.ts | Pass | PASS | Chunk A, all ok both projects |
| E7 | ordering-staff.spec.ts + new case | Pass | PASS | Chunk E, all ok |
| E8 | ordering-pos.spec.ts | Pass | PASS | Chunk E, all ok |
| E9 | shop-staff.spec.ts | Pass | PASS | R3 fresh server, 1 worker, whole file ok in both projects (includes E-C1). Earlier failures in loaded runs (E-C1 mobile, E-C2, E-F1) were dev-server memory timeouts |
| E10 | inventory-flows, inventory-a11y-responsive, procurement-flows + new expand-Adjust case | Pass | FAIL | inventory-flows 22/22 ok (E-X3 ok), inventory-a11y-responsive 460/460 ok (230 chromium in chunk C, 230 mobile in D2). procurement-flows:95 E-A3 fails both projects; baseline fails both (pre-existing, brief list) |
| E11 | inventory-real-api.spec.ts | Real-API only | BLOCKED | Needs a live API, none started. Unblock: `npm run test:e2e:real-api` against a running backend |
| E12 | billing-functional, billing-a11y-responsive | Pass | FAIL | billing-a11y 62 and billing-functional 30 run on fresh server: failures only billing-a11y:86 (dialog contrast, both projects) and billing-functional:18 E-A1 (both) and :216 E-F1 (chromium). Baseline fails :86 and :18 on both projects (pre-existing). Mobile route cases :65 failed in a suspended run, ok in R1 re-run. E-B2 and E-D1 (Amended (i)) ok. billing-real-api not run |
| E13 | admin-*, staff-admin | Pass | FAIL | admin-a11y-responsive 234/234 ok (R5, fresh server); admin-branch-calendar, admin-filters, staff-admin ok; admin-functional:56 E-B1 fails mobile-360 only (pre-existing: baseline mobile fails too, brief list). admin-functional:211 ok on fresh server |
| E14 | Run-only specs | Pass unchanged | FAIL | accounts-a11y-responsive:122 fails (D1/D2). Pre-existing: notifications-inbox:16, :28 mobile; ordering-a11y-responsive:133 (baseline fails too); xct-operations:76 (both projects here; baseline mobile fails). reports-schedules, notifications-log/templates/unsubscribe, xct-offline, ordering-a11y rest: ok. A few load flakes passed on re-run (reports-schedules:21, notifications-log:66, account-area, accounts-auth) |
| E15 | `npm run sweep:a11y`, staff routes, vs baseline | No new axe violations | PASS | SWEEP_AUDIENCE=staff, workers 1, same config. HEAD: 139 passed, 0 failed (serious/critical, wcag2a/aa/21a/21aa, alert text has no GUID or code). Baseline 46929be: 138 passed, 0 failed. One extra route at HEAD (/staff/customers), also clean. Note the sweep fails only on serious/critical |
| E16 | Full `npm run test:e2e` (HO-P3 E16 waiver) | Whole suite run; failures named | FAIL | Run in 8 area chunks covering every non-real-API spec file, both projects, with fresh servers. Not green: the pre-existing set under E1, E10, E12, E13, E14 plus D1/D2. HO-P3 specs (portal-*, shop-* bar shop-staff): 194 tests, 189 pass, 4 skip, shop-portal E-D1 failed loaded and passed alone (R4). Not run: reports-real-api, inventory-real-api, billing-real-api, portal-real-api, xct-real-api, real-api-verification, journey-real-api (BLOCKED, need a backend) |

## HO-P3 D-B carry-overs (handover §1 Amended 2026-10-25)

| ID | Case | Expected | Status | Evidence |
|---|---|---|---|---|
| D1 | accounts-a11y-responsive "E-X1 (idle lock open)" chromium | Pass (HO-P4 must fix) | FAIL | Failed in every run, fresh server included (R1, R2, R3). `page.getByRole('dialog').waitFor()` at spec line 150 times out at 45 s. The failure snapshot shows the staff sign-in form, not a dialog. Baseline fails identically, so HO-P4 did not fix it. Sibling staff-auth E-G2 tests use the same `__forceStaffIdleExpired` and `__invalidateQueries` hooks and pass (they fill a field first; this spec does not). Cause not isolated |
| D2 | same, mobile-360 | Pass | FAIL | Same, every run |
| D3 | shop-staff E-C1 chromium | Pass | PASS | R3 ok. Baseline fails it, so HO-P4 fixed it |
| D4 | shop-staff E-C1 mobile-360 | Pass | PASS | R3 ok. Baseline fails it |

## Regression cases from earlier gates

| ID | Gate | Finding | Case | Status | Evidence |
|---|---|---|---|---|---|
| R1 | ARCH run 1 | 5d9ffbc inventoryStaff mock | notifications-log (E-E2 403 as inventoryStaff) both projects | PASS | R3 whole-file ok both projects |
| R2 | ARCH run 1 | "More administration" disclosure | notifications-templates | PASS | Chunk F, all ok |
| R3 | ARCH / Amended (ii) | secondStaff back to Reception | inventory-flows incl. E-X3 | PASS | D1 chunk, 22/22 |
| R4 | ARCH (vi) | fields.tsx restyle of ~70 importers | inventory-a11y-responsive (460) and procurement-flows bar E-A3 | PASS | Chunks C/D2 ok. E-A3 is the pre-existing failure and is counted under E10 |
| R5 | ARCH note | Two ActiveBranchPicker instances | active-branch-picker.test plus E2 sheet case | PASS | Both ok. Double-write itself not separately probed at runtime |
| R6 | SECURITY / CODE_REVIEW | Recorder cannot reject own payment | U35, billing-functional E-B2, E-D1 | PASS | U35 passed; E-B2 and E-D1 ok both projects |
| R7 | 7cdfd78 | Wordmark contrast | axe on all 139 staff routes (E15) | PASS | 0 serious/critical |
| R8 | CODE_REVIEW | Rewritten assertions kept equal strength | Read the rewritten tests | BLOCKED | I read U35 only (strong). I did not re-audit the other ~18 rewritten files and relied on CODE_REVIEW's comparison. Unblock: a second reviewer diff of those files |

## Acceptance-criteria coverage

| Criterion | Covered by | Status |
|---|---|---|
| A1 | U1-U6, E1, E2 | Partial: units and E2 PASS; E1 has pre-existing failures |
| A2 | U7-U10 | PASS |
| A3 | U11, E6 | PASS |
| A4 | U12-U14, E3 | PASS |
| A5 | U15, E4 | PASS |
| A6 | U16, U17, E5 | PASS |
| A7 | U18-U21, E7 | PASS |
| A8 | U22-U24, E8 | PASS |
| A9 | U25, U26, E9 | PASS |
| A10 | U27-U29, E9 | PASS |
| A11 | U30, U31, U33, E10 | Units PASS; E10 has pre-existing E-A3 failure (procurement) |
| A12 | U32, E10, E11 | Units PASS; E11 BLOCKED |
| A13 | U34-U36, E12 | Units PASS; E12 has pre-existing failures |
| A14 | U37-U40, E13 | Units PASS; E13 has pre-existing mobile failure |
| A15 | E1, E10, E12, E13, E14, E15 | E15 PASS; billing dialog contrast (:86) and idle-lock axe (:122) still fail |
| A16 | U41, G5 | PASS |
| A17 | ARCHITECTURE diff review | not a TEST case |
| A18 | G1-G4, E16 | typecheck, lint, test, build PASS; test:e2e not green (pre-existing set and D1/D2) |

## Cases I could not run

| ID | Why | What would unblock it |
|---|---|---|
| E11, reports-real-api, billing-real-api, portal-real-api, xct-real-api, real-api-verification, journey-real-api | Need a running API and database | Start the backend, then `npm run test:e2e:real-api` / `test:e2e:journey` |
| R8 | Not independently re-audited | Second reviewer |

## Gaps left deliberately

| Gap | Why not covered | Suggested owner |
|---|---|---|
| Root cause of the idle-lock E-X1 failure | Gate does not fix product code; not isolated | HO-P4 implementer / owner (D-B follow-up) |
| Sweep checks serious and critical axe impacts only | Existing sweep design | Owner decision if moderate findings matter |
| Double-write probe for the two ActiveBranchPicker instances | Reasoned in CODE_REVIEW; no direct runtime probe | Optional follow-up |
| Dev-server memory growth makes full e2e unreliable in one pass | Machine/Next dev limit; mitigated by chunking | CI should run chunked or against a production-mode mock build |

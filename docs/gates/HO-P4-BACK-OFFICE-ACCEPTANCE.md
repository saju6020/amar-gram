GATE: ACCEPTANCE
HANDOVER: HO-P4-BACK-OFFICE
COMMITS: 2f9006a (S0), c32a506 / 7cc5af5 (S2), de2a0de / 899ddad (S3), eaa9e52 / 9cc9f33 (S1), ed3028a / e65c852 (S4), bdcebe4 / 8baea3b (S5), 7cdfd78, a8bf606, 5d9ffbc, 4680214, d8f07b6; docs only: bd13079, d51a7d4, 813788d, 68297a7, 17f2a76, a1956c7, 9a66532 (HEAD). Baseline 46929be.
DATE: 2026-10-31
STATUS: PASS

Run 1.

PRIOR GATES (from docs/gates/ and docs/test-cases/, not from commit messages)
- ARCHITECTURE: run 1 FAIL, run 2 PASS (HO-P4-BACK-OFFICE-ARCHITECTURE.md; 157/157 in scope under Amended (i)-(vii))
- SECURITY: PASS (HO-P4-BACK-OFFICE-SECURITY.md; no findings)
- CODE_REVIEW: PASS (HO-P4-BACK-OFFICE-CODE_REVIEW.md; 6 LOW; covers 4680214 scope and the rewritten-test comparison)
- TEST: run 1 FAIL, run 2 PASS (HO-P4-BACK-OFFICE-TEST.md); sheet TC-HO-P4-BACK-OFFICE.md: 74 rows, 66 PASS / 6 FAIL / 2 BLOCKED / 0 NOT RUN

AMENDED (ix) CROSS-CHECK: every failing case in the six FAIL rows is on the list
- E1: staff-shell-toggle :29, staff-shell-manual-expand-overflow :37, staff-shell-sheet-closes-on-back-navigation :30. All on (ix). (occludes-content :72 failed once under load and passed on a fresh server.)
- E10: procurement-flows :95 E-A3. On (ix).
- E12: billing-a11y-responsive :86, billing-functional :18 E-A1 and :216 E-F1. All on (ix). (Mobile :65 failed only in the host-suspended run and passed on re-run.)
- E13: admin-functional :56 E-B1 (mobile-360). On (ix). (:211 load flake, passed fresh.)
- E14: notifications-inbox :16/:28 (mobile-360), ordering-a11y-responsive :133, xct-operations :76. All on (ix). D1/D2 (accounts-a11y :122) now pass.
- E16: the union of the above. The HO-P3 shop-portal E-D1 failed under load and passed alone.
- No failure outside the list.

"Failing in a new way" re-checks run by this gate (fresh `next dev` on :3120, mocks on, --workers=1, --retries=0):
- xct-operations :76. TEST recorded chromium failing at HEAD and baseline failing on mobile only. I ran it on both trees, both projects. HEAD and baseline 46929be fail identically in both projects, at line 83: the alert "Restore test overdue" is not found on /staff/admin/operations/backup. That is a route §4.2 does not rebuild, and the failure comes before the spec reaches any HO-P4 screen. Same way.
- billing-functional :216 E-F1. HEAD 4/4 pass (2 repeats x 2 projects) and baseline 2/2 pass on a warm server, so it is load-flaky on both trees. This is a customer invoice page, not an HO-P4 screen.
- staff-shell-toggle :29 fails at HEAD, all four variants, at line 44 (`reachedToggle` false), the same assertion TEST recorded at baseline.
- admin-functional :56 fails at HEAD on mobile-360 only (line 106, the Christmas holiday gridcell) and passes on chromium, matching (ix) "(mobile-360)".
- procurement-flows :95 E-A3 times out at HEAD on chromium (30 s test budget, page on "Loading…" at the final receipts-list step). It passed on mobile-360 in the same run, including the final step `getByRole('link', { name: /^GRN-/ })` toHaveCount(2) on the S4-restyled /staff/inventory/receipts. So the restyled list is not what breaks.

CRITERIA
- A1 MET. Unit evidence: U1-U4 and U6 tests/unit/staff-shell.test.tsx (:249 groups in order, :263 label overrides, :280 longest prefix on receipts/new, :292 footer with Sign out below sm); U5 tests/components/branches/active-branch-picker.test.tsx :153/:163 (seed runs with one branch). E2 (360 px: no h-scroll, Sign out, outlet picker on top of the sheet) is PASS in both projects. The E1 failures are all on (ix) and are pre-existing at baseline.
- A2 MET. tests/components/back-office/primitives.test.tsx: U7 (:27 tablist, aria-selected, keyboard, count only when given), U8 (:57 nav, aria-current, no role=tab), U9 (:79-:117), U10 (:135 named focusable region); data-table.test.tsx passes. Additive props KpiTile `headingLevel` and SearchField `inputRef`/`onKeyDown` are ratified in Amended (vii).
- A3 MET. U11 overview.test.tsx :60 (h1, helper, form, no data-theme). E6 staff-auth.spec.ts PASS in both projects (TEST run 2: 10/10). The HO-P4 changed-file list contains no web/components/auth/** file; only the two (auth)/staff pages changed.
- A4 MET. U12 overview.test.tsx :84 (payload tiles only, pinned h1, no "Sample data"), U13 :122/:139/:154 (approvals 403 drops only that row, no banner), U14 :182/:209. E3 dashboard-home PASS. No "Sample data" text in non-test app/(staff) or components.
- A5 MET. U15 overview.test.tsx :226 (nav "Report list", aria-current) and :261 (table alternative, polite readout); E4 reports-viewer PASS in both projects. reports-real-api is opt-in only (see BLOCKED rows below).
- A6 MET. U16 overview.test.tsx :313/:320 (email vs mobile param, ?customer=), U17 :339/:358 (Orders and Billing tabs only, New order to /staff/pos?customerId=, erase only for Administrator). E5 including the new search → profile → New order case: PASS.
- A7 MET. tests/components/back-office-sales/orders-workbench.test.tsx: U18 :30 (no counts), U19 :75 (after invalidating both query keys, `?order=`, the heading and the tick all survive; I read the body), U20 :96/:105, U21 :126. E7 ordering-staff with the new case: PASS.
- A8 MET. pos-ticket.test.tsx U22 :38/:51 ("Terminal slip number", never a card number), U23 :78 (I read the body: Exact = "780.00" quote string, and `document.body.textContent` has no change-due text before completion), :98 (server changeDue after completion). U24: the guards pass, and TEST planted a money multiplication and "cvv" in StaffOrderDialogs.tsx and StaffOrderSidePanel.tsx; both guards failed on each file. E8 ordering-pos PASS.
- A9 MET. products-design.test.tsx U25 :78, U26 :96 (Banners link, no Categories, CSV keeps filters). E9 shop-staff PASS in both projects on a fresh server.
- A10 MET. products-design.test.tsx U27 :181, U28 :233 (expectedVersion, no status radio); U29 two-step-save, sku-shipping-weight, route-id-not-found and staff-shop pass; E9 PASS. The Status card in the header and FileUploader are declared in Amended (iv).
- A11 MET. stock-by-item.test.tsx U30 :49 (aria-expanded, matrix fetched on first expand only), U31 :87, U33 :106. E10: inventory-flows 22/22, including the new "E10: expanding a stock row … Adjust opens the dialog" (inventory-flows.spec.ts:170), and inventory-a11y-responsive 460/460. The E10 row is FAIL only because of procurement E-A3, which is on (ix).
- A12 MET. U32 receiving-layout.test.tsx :63 (no "Receive into"), :84 (Lines[1].ExpiresOn inline on line 2 with aria-invalid, and the live message). goods-receipt-form.test.tsx passes. E10 e2e coverage of receiving: procurement-flows E-A2 (:72, passing) posts through the one confirm dialog to a GRN after an inline aria-invalid expiry error. E-A3 passed on mobile-360 in my run. E11 is not run; see the BLOCKED row decision below.
- A13 MET. U34 money-and-admin.test.tsx :22/:42. U35 payment-flows.test.tsx :143: both Approve and Reject are absent on the own card, and a forced approve and a forced reject both return 400 ApproverMustDiffer. That matches Amended (i) as corrected; the source is components/billing/ApprovalsQueue.tsx:97, :132. U36: money-and-admin.test.tsx :56 asserts only the lines table, the count field and the Close day button. The variance pill and the confirm dialog are asserted by documents-ops.test.tsx U-D1/U-D2 :79 ("Short BDT 10.00" from the server, then Close day opens a dialog). The source CashUpScreen.tsx:51-58 derives Balanced/Over/Short from `moneySign(view.variance.amount)` only. E12 billing-functional E-B2/E-D1 PASS; the remaining E12 failures are on (ix).
- A14 MET. U37 admin-nav.test.tsx :40/:61, and U38/U39/U40 money-and-admin.test.tsx :77, :109, :140. E13: admin-a11y-responsive 234/234, admin-filters, admin-branch-calendar and staff-admin PASS; admin-functional E-B1 mobile is on (ix).
- A15 MET. E15 sweep:a11y staff: HEAD 139 pass with 0 serious/critical violations, against 138 at baseline (the extra route is /staff/customers, also clean). D1/D2 idle-lock axe now pass. The remaining a11y-spec failures are billing-a11y :86 (dialog contrast) and ordering-a11y :133 (a customer checkout route). Both are on (ix) and pre-existing.
- A16 MET. The U41 test no-colour-literals.test.ts :29, with a pattern self-check at :44, passes. I re-ran the §17 step 5 rg myself on HEAD (`rg -n "#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|-\[#" "app/(staff)" "app/(auth)/staff" components`): no hits.
- A17 MET. ARCHITECTURE run 2 found 157/157 in scope. CODE_REVIEW scoped 4680214 at 6/6 under Amended (i). I re-derived the union of files touched by the 12 HO-P4 code commits (156 paths) and filtered it for §14 paths. The only hits are covered by the §1 Amended row:
  - HearthLogo.tsx: 2026-10-25.
  - mocks/handlers/areas/accounts.ts: (ii), (v).
  - mocks/handlers/billing/{staff,store}.ts: (i) corrected.
  - tests/e2e/fixtures.ts, notifications-log/-templates: (v).
  - accounts-a11y-responsive.spec.ts: (viii); I checked the d8f07b6 diff and it adds one wait plus a comment, nothing else.
  - docs/handover: append-only §1.
  Nothing touched src/, backend tests/, deploy/, web/lib/**, web/package*.json, configs, globals.css or components/auth/**.
- A18 MET. TEST G1 tsc, G2 lint and G4 build pass; TEST run 2 re-ran tsc and lint at d8f07b6. G3 Vitest: 1852 pass, 13 load timeouts in 7 files, and those files pass 92/92 when re-run alone. test:e2e: the failures are exactly the (ix) set, plus load flakes that pass on a fresh server. (ix) explicitly extends E16, the full test:e2e run, beyond "timing-flaky files" to these recorded baseline failures. See the LOW finding on the Vitest timeouts.

BLOCKED ROWS: decision
- E11 and the other real-API specs. Not required for acceptance as written. §16 says the suite is run "with `npm run test:e2e` (MSW)" and qualifies E4/E11/E12 as "real-API run only (when enabled)". §17 step 5 and A18 list `npm run test:e2e` only, which runs the chromium and mobile-360 projects. playwright.config.ts adds the `real-api` project only when E2E_REAL_API=1 ("Manual only, opt-in"). S4's only edit to inventory-real-api.spec.ts (ed3028a, R-D1) is a selector change, from a reason radio to an aria-pressed reason button. MSW E-D1 and the new E10 case prove that same pattern. CODE_REVIEW compared that file. A12's substance is covered by U32 and procurement E-A2. Residual risk: the real-API specs have not run against this build. Run `npm run test:e2e:real-api` before release.
- R8 (re-audit of the rewritten tests). Covered by other evidence. CODE_REVIEW item 1 compared every rewritten spec and unit test with its parent: no skips, no loosened regex, four narrowings each with a stated replacement. I also listed every removed `expect` line across the HO-P4 test diffs (about 35) and checked several replacements:
  - "Track expiry" became "Track batches and expiry", still toBeDisabled.
  - The staff-admin hand-off text became "Account created. Share the password with New Cashier".
  - "Point of sale" became "Counter sale".
  - The E-B3 picker bounds are as CODE_REVIEW described.
  - The draft-slug 404 was replaced by a noindex + "Page not found" check under Amended (iv).
  - U35 is strictly stronger.
  No uncompensated weakening found.

SCOPE
- out-of-scope work found: none. Checked:
  - No sidebar count badges or polled shell queries in staff-shell.tsx or staff-nav-groups.ts (OQ-2).
  - No --warm token and no globals.css change (OQ-1).
  - No new dependency; web/package*.json is untouched.
  - No "Sample data" text and no data-theme on staff components.
  - Backend gaps are left out, per ARCHITECTURE run 1 "Verified compliant".
- files outside allowed scope: none unratified. Every §14 path touched is named in a §1 Amended entry, as listed under A17.

UNDECLARED DEVIATIONS
- none found.
- 5d9ffbc's edits to run-only specs and fixtures were a §20.3/§14 breach when made. ARCHITECTURE run 1 reported them, and the owner then ratified them in Amended (v). They were not hidden.

FINDINGS
- [LOW] docs/test-cases/TC-HO-P4-BACK-OFFICE.md U36 row. Its evidence (money-and-admin.test.tsx :56) does not assert the variance pill or the confirm dialog that U36 expects. The behaviour is asserted elsewhere: documents-ops.test.tsx U-D1/U-D2 :79, plus the source CashUpScreen.tsx:51-58. So A13 holds, but the sheet points at the weaker test.
- [LOW] Vitest load timeouts include two new HO-P4 files: tests/components/back-office-stock/receiving-layout.test.tsx and tests/components/back-office-overview/overview.test.tsx (the customer search case took 24.7 s). A18's exception names "known timing-flaky files recorded at baseline", and new files cannot be on such a list. Accepted on the HO-P3 ACCEPTANCE precedent (A17 there: "load timeouts pass alone and are reported by name"), and they pass alone. Suggest per-test timeouts on those cases.
- [LOW] The real-API specs (inventory-, billing-, reports-real-api, journey) have not been run against the HO-P4 build. They are not required by §17/A18 (opt-in project), but should run before release.
- [LOW] xct-operations :76: TEST run 1 recorded "baseline failed the mobile one" only. This gate showed baseline fails chromium too, at the same line 83. The (ix) entry is therefore accurate for both projects.

ENVIRONMENT NOTE
- Runs above: one dev server at a time on :3120, HEAD then the baseline worktree (.claude/worktrees/baseline-46929be) then HEAD. Afterwards I killed the server on :3120 and confirmed no chrome-headless-shell was running. `git status` shows only the pre-existing untracked .claude/worktrees/. Nothing was edited except this file, and nothing was committed.

SCOPE CHECK
- files in allowed scope: 156/156 HO-P4 code-commit paths (§13 or a ratified §1 Amended waiver)
- files outside allowed scope: none
- written by this gate: docs/gates/HO-P4-BACK-OFFICE-ACCEPTANCE.md only

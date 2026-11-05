# TC-P5-FOLLOWUP-LAYOUT — Seven LOW layout fixes (S4 F4/F5/F7, S2 order panels / money tiles / pick list, S3 F2)

Handover: none — scope from the launching agent's brief (see P5-FOLLOWUP-LAYOUT-ARCHITECTURE.md)
Commit(s) under test: e42c3a6..4e7dcce (web/)
Written: 2026-11-05  ·  Executed: 2026-11-05

> Statuses record what was **observed**. IDs assigned by me (no numbered handover sections).

## Summary

| | Count |
|---|---|
| Total | 18 cases + 5 regression rows |
| PASS | all (1 FAIL observed first, N1 at 1440 px, then fixed and re-run PASS) |
| FAIL | 0 outstanding |
| BLOCKED | 0 |
| NOT RUN | 0 |

**Production bug found and fixed (N1 / CODE_REVIEW LOW confirmed real).** At 1440 px the Receivables tile is 365 px wide, so a 2-column dl leaves 158 px per column, but the figure "৳58,000.00" (nowrap, 28 px bold) is 173 px. It overflowed its column by 15 px and overlapped the neighbouring "—" figure by 3 px. Fix: DashboardTile dl now uses `grid-cols-[repeat(auto-fit,minmax(min(100%,12rem),1fr))]` (a column is never narrower than 12 rem = 192 px, so a nowrap figure cannot cross into its sibling); the now-unused `@container` was dropped. Side effect (CODE_REVIEW LOW, "owner should eyeball"): most desktop tiles stack their figures in one column and are taller; see screenshots.

## Environment

Windows 11; web worktree at 4e7dcce + uncommitted work. next dev on :3121, NEXT_PUBLIC_USE_MOCKS=true (MSW), E2E_KEEP_ROUTES=1, workers=2. No real API, no database. Chromium and mobile-360 projects both run. The dev server was restarted once with `.next` cleared after a `.next` ENOENT race made MSW sign-in return 404 (environment, not product).

## Unit cases

| ID | Case | Expected | Status | Evidence |
|---|---|---|---|---|
| U1 | `tsc --noEmit` | clean | PASS | tsc --noEmit exit 0 (after fixing 4 strict-index errors in my own new test code) |
| U2 | `eslint` on touched files | clean | PASS | eslint on components/dashboard, fulfilment, customer, orders, staff-shop and the spec: exit 0 |
| U3 | Vitest, fulfilment + dashboard + customer + staff-shop + orders areas | all pass | PASS | vitest dashboard+fulfilment+customer+staff-shop+orders: 21 files / 218 tests pass (post-fix) |
| U4 | Full Vitest suite | all pass (implementer: 232) | PASS | Full run once: 16 tests in 9 files timed out under load (dev server compiling concurrently; inventory/pos/back-office-customers, none touched by the diff). Re-run of those 13 files alone: 149/149 pass. Treated as load flake, not a defect. |

## Integration cases (browser, MSW mocks, chromium + mobile-360)

| ID | Case | Expected | Status | Evidence |
|---|---|---|---|---|
| I1 | S4 F4 customer search field width >= 200, button >= 44 high, no page scroll | pass | PASS | p5-followup-layout-360 chromium + mobile-360, 66/66 in the combined run |
| I2 | S4 F5 customer profile facts: no word split | pass | PASS | same run |
| I3 | S4 F7 roster Cancel >= 44 px | pass | PASS | same run |
| I4 | S2 order panels keep words whole | pass | PASS | same run |
| I5 | S2 dashboard figures one line + inside tile at 360 and 1280 | pass | PASS | same run (post-fix) |
| I6 | S2 pick list Quantity/Orders visible at 360 | pass | PASS | same run |
| I7 | S3 F2 Product column >= 180 at 360; Status in view at 1280 | pass | PASS | same run |
| I8 | catalogue-stock-360, dashboard-pipeline-360, dashboard-home still pass | pass | PASS | catalogue-stock-360, dashboard-pipeline-360, dashboard-home in the 66/66 run |
| I9 | catalogue-stock-gate-s3 G9 (products bar open, no sideways scroll) repeat-each=5 on both projects | 10/10 | PASS | --repeat-each=5, both projects, 10/10 pass (2.9 min). Earlier flake not reproduced; the test makes ~10 cold route loads in one 240 s test, so a cold-compile/load flake is the likely cause. No product code involved. |

## New cases closing gate notes

| ID | Gate note | Case | Status | Evidence |
|---|---|---|---|---|
| N1 | ARCH/CODE_REVIEW LOW TileFigure | Dashboard figures (incl. rider-cash) inside tile AND not overlapping sibling figure at 360, 768, 1024, 1280, 1440 | PASS | Written; FAILED first at 1440 px on both projects (real bug, see below); PASS at all 5 widths x 2 projects after fix |
| N2 | ARCH LOW PickList print | `emulateMedia print` at A4-ish width (794 px): Expires column header + cells displayed | PASS | 794 px, print media: Expires header visible, td display table-cell, text non-empty, inline copy hidden |
| N3 | CODE_REVIEW LOW PickList | At 360 the inline "Expires …" text is visible and the Expires column is hidden | PASS | 360 px: "Expires …" text visible, Expires columnheader hidden |
| N4 | CODE_REVIEW LOW CustomerBrowsePanel | Search field at 360 is single-input height (not grown vertically) | PASS | field height in (30,56] px at 360 |
| N5 | CODE_REVIEW LOW layout | Screenshots dashboard 768/1024/1440, pick list 1280 saved to docs/gates/screenshots/p5-followup-layout/ | PASS | Screenshots written; dashboard-1440.png viewed. Files: dashboard-768/1024/1440.png, pick-list-1280.png |

## Regression cases from earlier gates

| ID | Gate | Finding | Case | Status | Evidence |
|---|---|---|---|---|---|
| R1 | CODE_REVIEW | whitespace-nowrap figure could spill into sibling column | N1 | PASS | via the case named |
| R2 | ARCH | print hides Expires | N2 | PASS | via the case named |
| R3 | CODE_REVIEW | F4 only checks width | N4 | PASS | via the case named |
| R4 | CODE_REVIEW | mobile inline Expires not asserted | N3 | PASS | via the case named |
| R5 | CODE_REVIEW | -m-3 vs px-2.5 (fixed in HEAD) | I7 + G9 | PASS | via the case named |

## Acceptance-criteria coverage

| Criterion | Covered by | Status |
|---|---|---|
| S4 F4 | I1, N4 | PASS |
| S4 F5 | I2 | PASS |
| S4 F7 | I3 | PASS |
| S2 order panels | I4 | PASS |
| S2 money tiles | I5, N1 | PASS |
| S2 pick list | I6, N2, N3 | PASS |
| S3 F2 products table | I7, I9 | PASS |

## Cases I could not run

None.

## Gaps left deliberately

Real API not exercised (MSW mocks only). Pixel-level visual review of screenshots is for the acceptance gate.

# TC-HO-P2-E2E — Playwright e2e after HO-P2 catalogue and theme

Handover: docs/handover/HO-P2-CATALOGUE-AND-THEME.md (no e2e section; case IDs assigned by me)
Commit(s) under test: 601fc30, 46929be (branch feat/phase2-catalogue-theme)
Written: 2026-10-24  ·  Executed: (see rows)

> Statuses record what was observed. The handover has no enumerated e2e cases and its acceptance list
> names no e2e criterion, so rows are one per run/project plus one per HO-P2-touched spec; IDs are mine.

## Summary
(filled at end)

## Environment
Filled at end.

## Integration cases

| ID | Case | Expected | Status | Evidence |
|---|---|---|---|---|
| E1 | `npm run test:e2e` project chromium, MSW, whole suite | all pass | NOT RUN | |
| E2 | same, project mobile-360 | all pass | NOT RUN | |
| E3 | shop-catalogue.spec: 11 organic categories, certifications filter, "Producer" label | pass | NOT RUN | |
| E4 | shop-product.spec: renamed slugs (date-palm-gur, garam-masala-blend, ...) | pass | NOT RUN | |
| E5 | shop-staff.spec: staff catalogue with certifications, producer | pass | NOT RUN | |
| E6 | shop-portal.spec / shop-a11y-responsive.spec under new theme (contrast, 360 overflow) | pass | NOT RUN | |
| E7 | ordering-* specs using renamed mock products | pass | NOT RUN | |
| E8 | `npm run test:e2e:real-api` against local Postgres (not amargram_dev) | pass | NOT RUN | |
| E9 | `npm run test:e2e:journey` against seeded real API | pass | NOT RUN | |

## Regression cases from earlier gates
n/a (this is a post-implementation run, not a gate re-audit).

## Acceptance-criteria coverage
HO-P2 §4 criteria 1-6 are backend/typecheck/grep checks; none is an e2e criterion. Gap noted.

## Cases I could not run
(filled at end)

## Gaps left deliberately
(filled at end)

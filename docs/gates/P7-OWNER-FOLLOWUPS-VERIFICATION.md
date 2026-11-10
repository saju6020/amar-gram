# P7 owner follow-ups: verification sheet (cases written before any run)

Branch `fix/p7-int` (= feat/phase2-catalogue-theme + fix/p7-invoice-mixed-it + fix/p7-storefront-mock), worktree `.claude/worktrees/p7-int`. Written 2026-11-10; Executed: see Status. Statuses record what was observed. IDs assigned by the tester from the task brief. Nothing pushed.

## Changes under test

- Item 1: `billing-real-api` E-A1 and `journey-real-api` step 1 made to work at 360 (invoice lines found by label whatever the layout; Producer and category filters reached through `withFilters`, the Filters sheet at 360).
- Item 6: `acceptPendingPolicies` moved to `web/tests/e2e/shop-helpers.ts`; the copies in `subscriptions-customer-real-api` and `journey-real-api` (`acceptPoliciesIfAsked`) removed.
- Item 3: real-API verification on fresh DBs `amargram_p7clean` (e2e) and `amargram_p7clean_it` (integration), both dropped at the end.

## Cases

| ID | Case | Expected | Status | Evidence |
|---|---|---|---|---|
| S1 | Create amargram_p7clean, migrate, seed, API on 5141 reports it | GET /api/dev/database names amargram_p7clean | NOT RUN | |
| S2 | seed-e2e-real-api.mjs on fresh DB | completes, seed files written | NOT RUN | |
| C1 | npm run test:contract against the API | shop products row (owner item 13) and cash-ups row PASS; all rows pass | NOT RUN | |
| E1 | real-api-verification (real-api project; chromium n/a) on real-api | all cases pass (or skip by design) | NOT RUN | |
| E2 | portal-real-api on chromium | all cases pass (or skip by design) | NOT RUN | |
| E3 | portal-real-api on mobile-360 | all cases pass (or skip by design) | NOT RUN | |
| E4 | xct-real-api on chromium | all cases pass (or skip by design) | NOT RUN | |
| E5 | xct-real-api on mobile-360 | all cases pass (or skip by design) | NOT RUN | |
| E6 | reports-real-api on chromium | all cases pass (or skip by design) | NOT RUN | |
| E7 | reports-real-api on mobile-360 | all cases pass (or skip by design) | NOT RUN | |
| E8 | billing-real-api (incl. E-A1 at 360) on chromium | all cases pass (or skip by design) | NOT RUN | |
| E9 | billing-real-api (incl. E-A1 at 360) on mobile-360 | all cases pass (or skip by design) | NOT RUN | |
| E10 | inventory-real-api on chromium | all cases pass (or skip by design) | NOT RUN | |
| E11 | inventory-real-api on mobile-360 | all cases pass (or skip by design) | NOT RUN | |
| E12 | journey-real-api (incl. step 1 at 360) on chromium | all cases pass (or skip by design) | NOT RUN | |
| E13 | journey-real-api (incl. step 1 at 360) on mobile-360 | all cases pass (or skip by design) | NOT RUN | |
| E14 | subscriptions-customer-real-api (shared policy helper) on chromium | all cases pass (or skip by design) | NOT RUN | |
| E15 | subscriptions-customer-real-api (shared policy helper) on mobile-360 | all cases pass (or skip by design) | NOT RUN | |
| E16 | subscriptions-staff-real-api on chromium | all cases pass (or skip by design) | NOT RUN | |
| E17 | subscriptions-staff-real-api on mobile-360 | all cases pass (or skip by design) | NOT RUN | |
| H1 | `npx tsc --noEmit` in web | no errors | NOT RUN | |
| H2 | Customer registration + policy accept (subscriptions-customer-real-api) and journey step 4 use the shared helper | pass on both projects | NOT RUN | (covered by E-rows) |
| I1 | Full IntegrationTests project on amargram_p7clean_it | all pass, or each failure classified | NOT RUN | |
| I2 | If I1 has failures: same failing names on feat/phase2-catalogue-theme (separate worktree/build) | same set fails, so unrelated to this branch | NOT RUN | |
| X1 | Drop amargram_p7clean and amargram_p7clean_it; amargram_dev untouched; every process started is killed; ports free | confirmed | NOT RUN | |

## Summary

(filled at the end)

## Environment

(filled at the end)

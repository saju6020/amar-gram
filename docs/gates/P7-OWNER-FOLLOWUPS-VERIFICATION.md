# P7 owner follow-ups: verification sheet

Branch `fix/p7-int` (= feat/phase2-catalogue-theme + fix/p7-invoice-mixed-it + fix/p7-storefront-mock), worktree `.claude/worktrees/p7-int`. Cases written 2026-11-10 before any run (commit `1b4414f` carried the first version of this sheet with every row NOT RUN); executed 2026-11-10. Statuses record what was observed. IDs assigned by the tester from the task brief. Nothing pushed.

## Changes under test

- Item 1 (360): `billing-real-api` E-A1 finds the invoice lines by label (`getByLabel('Invoice lines')`: a table on desktop, a list of cards at 360); `journey-real-api` step 1 reaches the Producer and category filters through `withFilters` (the Filters sheet at 360). No product code changed; no 360 product bug found. Three more desktop-only or timing-fragile spots appeared once the first two let the serial chains run further, and were fixed the same way: billing E-D4 (`Accounting export runs` table), journey 5c (`Dhaka` cell), and journey step 1's progress-bar probe (see Findings).
- Item 6: `acceptPendingPolicies` now lives in `web/tests/e2e/shop-helpers.ts` (dependency-free helper module); `subscriptions-customer-real-api` and `journey-real-api` (`acceptPoliciesIfAsked`) use it. The shared helper is the API-driven one (asks `GET /api/customers/me/policy-acceptances/pending`: none pending means return, otherwise the dialog must appear and each Accept must close). The journey copy was the lenient "if a dialog is visible" one; the journey calls it where the seeded customer has nothing pending, which passes the same way.

## Environment

Windows, Postgres 17 on localhost:5432. Databases created by this run: `amargram_p7clean` (e2e), `amargram_p7clean_it` (integration), `amargram_p7clean_base` (baseline integration run on feat/phase2-catalogue-theme, detached worktree `p7-base`). All three dropped at the end; `amargram_dev` untouched (it is the only `amargram*` database left). API Release build of this worktree on 5141, `next dev` on 3137 (`NEXT_PUBLIC_USE_MOCKS=false`, `E2E_KEEP_ROUTES=1`), Playwright `--workers=1`. Seeded with `seed-dev-db.mjs` and `seed-e2e-real-api.mjs` unmodified. Fixtures made for the subscription staff spec: 5 more products set subscribable by SQL, four subscriptions created for customer@amargram.test through the API, two set Suspended/UnpaidCycles by SQL (one fixture set per project, since the restart and cancel cases consume them).

## Cases

| ID | Case | Expected | Status | Evidence |
|---|---|---|---|---|
| S1 | Create amargram_p7clean, migrate, seed, API on 5141 | `/api/dev/database` names it | PASS | "seed-dev: all 16 checks passed"; `{"database":"amargram_p7clean"}` |
| S2 | seed-e2e-real-api.mjs on the fresh DB | completes, seed files written | PASS | "done", bil-seed.json and rpt-seed.json written |
| C1 | `npm run test:contract` | all rows pass incl. shop products (owner item 13) and cash-ups | PASS | 72 passed, 0 failed (was 71/1 in P6) |
| H1 | `npx tsc --noEmit` in web | no errors | PASS | no output |
| E1 | real-api-verification (real-api project) | 3 pass | PASS | 3 passed after warming the routes. First run: register and reset failed with 30 s `page.goto` timeouts on cold `/portal/account/profile` and `/forgot-password` (dev compile, routes not warmed); staff sign-in passed (the accepted cold-start race did not occur) |
| E2 | portal-real-api chromium | pass | PASS | 2 of 2 |
| E3 | portal-real-api mobile-360 | pass | PASS | 2 of 2 (twice) |
| E4 | xct-real-api chromium | pass, 2 offline cases skip by design | PASS | 8 passed, 2 skipped in the full run; E-C3/E-C4 failed once in the full run (`never deleted by a run` not found in 5 s), passed alone (3.7 s): the same flake as P6 |
| E5 | xct-real-api mobile-360 | pass | PASS | 9 passed, 2 skipped (by design) |
| E6 | reports-real-api chromium | pass | PASS | 7 of 7 |
| E7 | reports-real-api mobile-360 | pass | PASS | 7 of 7 in the full run; E-C failed once in an earlier 360 run (`Margin` text not found, page showed "No results", 39 s), then passed alone and in two further full runs: intermittent, cause not isolated |
| E8 | billing-real-api chromium | pass | PASS | 14 of 14 (full run, and again after the E-D4 change) |
| E9 | billing-real-api mobile-360 (E-A1 fixed) | pass | PASS | 14 of 14. E-A1 passes (was FAIL in P6); E-D4 failed on the same table-versus-list cause and was fixed (`getByLabel('Accounting export runs')`) |
| E10 | inventory-real-api chromium | pass | PASS | 12 of 12 |
| E11 | inventory-real-api mobile-360 | pass | PASS | 12 of 12 |
| E12 | journey-real-api chromium | pass | PASS | 12 of 12 (twice, the second after the step 1 changes) |
| E13 | journey-real-api mobile-360 (step 1 fixed) | pass | PASS | 12 of 12 in the final run; step 1 also 3 of 3 at 360 and 3 of 3 on chromium with `--repeat-each=3` |
| E14 | subscriptions-customer-real-api chromium | pass | PASS | 2 of 2 (twice) |
| E15 | subscriptions-customer-real-api mobile-360 | pass | PASS | 2 of 2 (twice) |
| E16 | subscriptions-staff-real-api chromium | 5 pass with fixtures | PASS | 5 of 5 (fixture set B) |
| E17 | subscriptions-staff-real-api mobile-360 | 5 pass with fixtures | PASS | 5 of 5 (fixture set A) |
| I1 | Full IntegrationTests project on amargram_p7clean_it (migrated with `dotnet ef database update`) | all pass or each failure classified | FAIL | 1380 passed, 5 failed, 4 skipped, total 1389 (20 m 54 s). Failures: I2 to I6 |
| I2 | FilesEndpointTests.When_the_command_save_fails_the_object_is_deleted_again_no_orphan | pass | FAIL | Fails on this branch and on baseline. Cause: the test walks the on-disk `LocalStoreRoot/ProductImage` tree and requires a DB row for every file; the folder is shared by every run and database, so files left by other runs or other databases have no row here. Isolation defect in the test |
| I3 | BillingTestGateDatabaseTests.XI_9_NoCardLikeNumber_IsStoredInAnyTextColumnOfTheDatabase | pass | FAIL | Fails here; passed on baseline. Cause: `OrderingPosEndpointTests.NewBarcode()` makes a random 13-digit EAN; about 1 in 10 also passes the Luhn check, and the audit rows of those order lines (`OrderLine.Barcode`, `Sku.Barcode`) are then flagged as card-like. A random test-data flake; the branch's only integration-test change is in SubscriptionsGenerationEndpointTests. Failed again when re-run alone on the same database (the offending rows are already stored) |
| I4 | BillingLogCaptureEndpointTests.I_X1_NoCardNumber_... | pass | FAIL | Fails here ("A card-like number was logged: 089-..."); passed on baseline and passed re-run alone on this branch. Same random-barcode Luhn flake as I3 |
| I5 | ReportingScheduleEndpointTests.I_G5_RemovingTheRecipientsRole... | pass | FAIL | Fails here and on baseline ("The condition did not hold after 600 delivery passes"); passes re-run alone on this branch. Order or shared-state dependent |
| I6 | AdminGlobalSettingsLiveEffectEndpointTests.ChangeGlobalSetting_AuditsADataChangeRowWithBeforeAndAfterValues | pass | FAIL | Fails here and on baseline; passes re-run alone on this branch (3 s). Order or shared-state dependent |
| I7 | The same suite on feat/phase2-catalogue-theme (detached worktree, fresh `amargram_p7clean_base`) | same kind of failures, so unrelated | PASS | 1376 passed, 7 failed, 4 skipped, total 1387 (15 m 19 s). Failed: XI_6, Files orphan, I_G5, T_I7 (ReportingTestGate), AdminGlobalSettings audit row, TransientFailures_FollowBackoffTable_ThenExhaustToUndeliverable, SearchByRecipientDestinationTemplateStatus. Three of this branch's five fail there too (I2, I5, I6) and the baseline has four more of the same order-dependent kind; XI_9 and I_X1 passed there (random). The 2 extra tests in the total here are the new SubscriptionsGenerationEndpointTests cases |
| I8 | Re-run of the five failing tests alone on this branch, same database | pass | FAIL | 4 passed (Files orphan, I_X1, I_G5, AdminGlobalSettings), XI_9 failed again |
| X1 | Drop the three databases; kill processes; ports free | confirmed | PASS | `amargram_p7clean`, `_it`, `_base` dropped (only `amargram_dev` remains); API (5141) and next dev (3137) stopped, ports not listening; no node, dotnet, chrome or testhost process of this run left; baseline worktree removed; build server shut down |

## Findings

- Both owner-named specs now pass at 360; no product defect at 360 was found. Billing and journey, once past those first failures, hit three more places written for desktop or timing, fixed in test code only.
- The progress-bar probe in journey step 1 was fragile on every project, not only at 360: it queried the DOM from a MutationObserver callback (misses a bar inserted and removed in one task) and clicked as soon as the network was idle, which can be before the bar's click listener has hydrated (observed: no bar on a normal client navigation in most tries once routes were warm). Now it reads the mutation records and retries the click with a growing wait. A minor product observation, not changed: a very fast click on a freshly loaded storefront page can navigate without the top progress bar, because the bar's listener attaches after the page's own links work.
- Integration failures are not caused by this branch: see I2 to I8. Product code untouched.

## Cases I could not run

None. Two xct offline cases skip by design (need a production build).

## Gaps left deliberately

| Gap | Why not covered | Suggested owner |
|---|---|---|
| Integration tests that share one database and one local file store are order dependent (I2, I5, I6, plus XI_6, T_I7 and two notification cases on baseline) | not product code; reported, not changed | test owner |
| `NewBarcode()` random EANs flake XI_9 and I_X1 (about 10 % per barcode) | test data; could use a fixed non-Luhn barcode | test owner |
| reports-real-api E-C `Margin` intermittent at 360 (once in four runs) | not reproduced after; page showed an empty result | reports owner |
| xct E-C3/E-C4 flake after the long preceding run on chromium | passes alone | xct owner |

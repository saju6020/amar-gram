# P8: integration suite isolation

Branch `fix/p8-it-isolation` (from feat/phase2-catalogue-theme 21bba59). Goal: `tests/AmarGram.IntegrationTests` deterministic on a fresh and on a reused database. Test code and test infrastructure only, plus two small product fixes (below). Nothing pushed.

Two causes sit under almost every flake: (1) the suite runs classes in parallel against one database, one file store and one notification queue; (2) the notification worker's delivery pass takes only the oldest 50 rows of the whole database, and the worker is off in tests, so other areas' requests pile up.

## Root cause and fix per test

| Test | Root cause | Fix |
|---|---|---|
| XI_9, I_X1 (card-like numbers) | `OrderingPosEndpointTests.NewBarcode()` made random EAN-13s; about 1 in 10 also pass Luhn | `NewBarcode()` redraws until the valid EAN-13 fails Luhn (still unique and check-digit valid) |
| XI_9 (second form) | A culture-formatted instant in an audit value (`11/11/2026 05:26:42 PM +00:00`) is a 16-digit run that passes Luhn 1 time in 10 | Added to XI_9's noise filter |
| I_X1 (second form) | GUID and timestamp digit runs in captured logs | I_X1 blanks ids and instants first, as XI_9 and the trace sweep already did |
| Files orphan | Walked the shared on-disk `ProductImage` tree and required a DB row for every file (other runs and databases leave files) | Snapshot the files before the failing upload; judge only files created during it |
| I_G5, I_G6 (600 delivery passes) | `ReportingSchedules` collection was not serial; other classes' hosts ran delivery passes and took or sent the schedule's requests through their own sender and clock | Collection is now `DisableParallelization` (runs alone, after the parallel phase) |
| ChangeGlobalSetting_Audits... | An effective value that is only the definition default is not stored in the global row, so the audit "before" snapshot lacks it (depends on whether an earlier test stored it) | Test stores the current value first, then changes it |
| I_A3 (branch count 584 vs 585) | Counted all of `admin.branch`; other classes create branches | Counts only the row the write source inserts (code and name 'X') |
| I_D13 (pending policies 1, expected 0) | Global requires-acceptance policies created by other classes are pending for every customer | The 5 classes that create such policies join the serial global-settings collection |
| TheStaffList_ShowsTheStatus | (a) rows found by scanning pages of identically named "Test Staff" with `ORDER BY FullName` only; (b) the lockout is 5 s after failure 3, so on a loaded machine the real clock can expire it before the list is read | (a) unique names + `search=`; product: `ThenBy(Id)` tie-break in `GetStaffAccountsQueryHandler`. (b) the lock steps run on a host with a frozen `FakeTimeProvider` |
| XI_6 (too few tables held a row) | Designed to run on a populated database; on a fresh one it can run before billing data exists | Test seeds a customer, invoice, payment, credit note and refund first |
| SearchByRecipientDestinationTemplateStatus | Template-only query paged by the shared database; its row can fall off the first page | Query also filters by recipientId |
| TransientFailures_FollowBackoffTable | Single delivery pass; backlog from other areas longer than the 50 batch, so its notification does not exist yet | `NotificationsIntegrationTestBase` drains the backlog once per class (bounded, stops when a pass makes no progress) |
| I_E11 catalogue p95 (500 ms budget, 572 ms observed) | Wall-clock budget measured while parallel classes load the same database; fresh database has no planner statistics | Class joins the serial collection; `ANALYZE` before measuring |
| T_I7 (ReportingTestGate) | Same family as I_G5 (same serial collection fix). Did not fail in any run after the change | Covered by the collection change |
| I_G3 (concurrent runners) | Product race, about 25 percent failure rate alone: both runners advance the same slot; the loser's `DbUpdateConcurrencyException` fell into the runner's generic catch, which recorded a Failed run, and the stale tracked schedule made that save throw too | **Product fix** in `ScheduledReportRunner.AdvanceAsync`: a concurrency conflict on advance is benign (logged, not a failure). 16 of 16 passes afterwards |

## Product code changes

- `src/Read/.../GetStaffAccountsQueryHandler.cs`: `.ThenBy(s => s.Id)`. Paging by a non-unique name was non-deterministic.
- `src/Api/.../Background/ScheduledReportRunner.cs`: `AdvanceAsync` swallows `DbUpdateConcurrencyException` (another runner already advanced the slot; the next cycle re-advances if anything else changed the schedule).

## Run totals (all `dotnet test tests/AmarGram.IntegrationTests`, Postgres 17 localhost)

Progression (each run on the code as it then stood): baseline-with-fixes run 1 (fresh): 6 failed of 1389; run A (fresh): 2 failed; B (fresh): 1 failed (I_E11); C (fresh): 3 failed; D (fresh): 1 failed (I_X1); E (fresh): 0; F (reused): 1 failed (I_G3, product race); G (fresh): 0.

Final code (commit 5424aa0 and the doc commit on top; nothing else changed):

| Run | Database | Result |
|---|---|---|
| H | fresh | 1385 passed, 0 failed, 4 skipped, total 1389 (12 m 55 s) |
| I | reused (same database as H) | 1385 passed, 0 failed, 4 skipped, total 1389 (7 m 51 s) |
| J | fresh | 1385 passed, 0 failed, 4 skipped, total 1389 (12 m 19 s) |

Other projects on the final code: Domain.Tests 1810 passed, Application.Tests 582 passed, Infrastructure.Tests 182 passed, 0 failed.

The 4 skips are the existing skipped tests (unchanged).

## Remaining risk

Tests that share one database stay statistically exposed to unseen interactions; the serial collection `AdministrationGlobalSettings` now holds more classes (it runs after the parallel phase, so the suite is slightly slower to finish its tail). `amargram_p8_it` and `amargram_p8_it2` were dropped at the end; `amargram_dev` was never touched.

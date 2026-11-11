GATE: CODE_REVIEW
HANDOVER: P8-IT-ISOLATION
COMMITS: b7d864e c71e4ff 6a66a73 38b3225 17040c5 5424aa0 8b8a27f (21bba59..8b8a27f)
DATE: 2026-11-11
STATUS: PASS

FINDINGS
- [MEDIUM] src/Api/AmarGram.Api/Background/ScheduledReportRunner.cs:267-278 — The DbUpdateConcurrencyException catch is scoped to the single AdvanceReportScheduleCommand dispatch, which is tight enough: only the advance save is inside it, and the handler (ReportScheduleCommandHandlers.cs AdvanceReportScheduleCommandHandler) is idempotent per slot. The tracked-entity concern is benign here: ReportingWorkCycle.cs:47 creates one scope per schedule and both callers (line 140, FailAsync line 255) return straight after, so no later save reuses the poisoned context. The catch does swallow a conflict caused by a non-benign concurrent edit (admin edits or cancels the schedule); the advance is then lost until the next cycle, which the comment justifies (the slot's run is already recorded, so the next cycle only re-advances). Fix: none required; add a short note that the scope must not be reused after AdvanceAsync, since the safety depends on that.
- [MEDIUM] tests/AmarGram.IntegrationTests/Endpoints/ReportingScheduleEndpointTests.cs:160 — I_G3 is the only coverage of the new catch and it is timing-dependent (the race occurs in roughly 1 run in 4 before the fix). It proves "one run, one file, one email" (a Failed run record would make Assert.Single(runs) fail), but no test forces the conflict. Fix: add a deterministic test that has one scope advance the slot first, then calls the runner for the same slot (or a unit test with a dispatcher stub that throws DbUpdateConcurrencyException), and asserts no Failed run and Created == false.
- [LOW] tests/AmarGram.IntegrationTests/Endpoints/XctErasureEndpointTests.cs:21 — The doc comment still says the class is serialised with the other retention classes (XctRetention), but it moved to AdministrationGlobalSettings. The overlap is still excluded (xUnit v2 runs DisableParallelization collections after the parallel phase), but the comment is now false and XctRetentionWorkerTests.cs:24 says the same about the erasure tests. Fix: update both comments.
- [LOW] tests/AmarGram.IntegrationTests/Endpoints/NotificationLogAndInboxEndpointTests.cs:69 — The "byTemplate" check now also filters by recipientId, so it no longer proves the template-only filter works on its own. The record justifies this as the price of avoiding the shared 50-row page; the template filter stays covered only by the combination. Fix: optional, assert the template filter alone in a unit-level query test.
- [LOW] tests/AmarGram.IntegrationTests/Endpoints/FilesEndpointTests.cs:186 — The orphan check now judges only files created during the failing upload, which is weaker by design. An in-flight upload from another class's parallel run could still appear in that window without a committed DB row. Fix: if it ever flakes, run the class in a serial collection.
- [LOW] tests/AmarGram.IntegrationTests/NotificationsIntegrationTestBase.cs:34-62 — The drain is bounded (400 passes, stops on zero or on no progress), serialised by a static semaphore, and runs once per class. It cannot hang. It does not hide product bugs: stuck rows end the drain and the tests then fail visibly. One caveat: it counts with DateTimeOffset.UtcNow while the factory may use a different clock, which at worst ends the drain early. Fix: use the factory TimeProvider for the count.
- [LOW] tests/AmarGram.IntegrationTests/Endpoints/AdminBranchCardsAndStaffListEndpointTests.cs:~236 — HttpClients created by FrozenClient() are not disposed. Cosmetic, test-only.

CHECKED, NO ISSUE
- GetStaffAccountsQueryHandler `.ThenBy(s => s.Id)`: still AsNoTracking and a projection; a correct deterministic tie-break.
- NewBarcode: the loop terminates (about 90 percent per draw), the check digit is computed before the Luhn test so the barcode stays a valid EAN-13, and uniqueness comes from 10^10 random values. PassesLuhn is a correct implementation.
- ReportingSchedules CollectionDefinition (DisableParallelization = true) is declared once; all five schedule classes use the same name constant. AdministrationGlobalSettings additions (Placement, CheckoutQuote, XctErasure x2, CataloguePerformance, plus the cross-area denial class) reference the existing definition.
- FakeTimeProvider host in the staff-status test freezes the lockout correctly; the assertions are unchanged.
- XI_6 seeding creates a customer, invoice, payment, credit note and refund before the probe; the assertion is unchanged.
- No convention violations (.ai/) in the product diff: no new service, no controller change, no superseded-architecture types.

SCOPE CHECK
- files in allowed scope: 20/20 (tests, test infrastructure, two small product fixes, one record)
- files outside allowed scope: none

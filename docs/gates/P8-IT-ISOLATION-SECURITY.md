GATE: SECURITY
HANDOVER: P8-IT-ISOLATION
COMMITS: b7d864e c71e4ff 6a66a73 38b3225 17040c5 5424aa0 8b8a27f (range 21bba59..8b8a27f)
DATE: 2026-11-11
STATUS: PASS

Verdict: no exploitable issue and no production security regression. The two product changes are
safe. The loosened card-number sweeps can still go blind to some real card numbers (findings below).
Those are gaps in the test backstop, not in the product. Every write path still refuses a card number
through `CardNumberGuard`, and the guard has its own unit tests in `BillingTestGateProbeTests` and
`BillingRulesTests`. So the findings do not block, but they should be fixed.

Method: I read the diff. The integration suite was not run (the caller ran it green 3 times). I checked
the Noise regexes by running the same patterns in Python (both engines treat these constructs the
same way) against hand-built card-number cases.

FINDINGS
- [MEDIUM] tests/AmarGram.IntegrationTests/Endpoints/BillingLogCaptureEndpointTests.cs:21 (used at :101) — I_X1 now blanks
  `Noise()` matches before it looks for card numbers. Noise includes `880\d{10}` with no boundary on either side. On its own it
  blanks any unbroken 13-digit stretch that starts with "880", even when that stretch sits inside a card number. Nothing next to the
  number is needed. Proof: `4880123456789012` passes Luhn, and Noise turns it into `4 12`, so a log line containing it is NOT
  flagged. Roughly 0.3% of random 16-digit card numbers, and every card with a 4880.../5880... style prefix, become invisible
  to this guard. I_X1 did not blank anything before this branch, so for I_X1 the gap is new in this branch. The same Noise
  (and so the same gap) was already in XI_9 at BillingTestGateDatabaseTests.cs:170 and in BillingTestGateTraceEndpointTests.cs:69.
  Fix: drop `880\d{10}` from Noise. `CardNumberGuard` already excludes Bangladeshi mobile numbers through
  `^8801[3-9][0-9]{8}$`, which is anchored to the whole window. If it has to stay, anchor it:
  `(?<![0-9])8801[3-9]\d{8}(?![0-9])`.
- [MEDIUM] BillingLogCaptureEndpointTests.cs:21 / BillingTestGateDatabaseTests.cs:170 — no negative self-test. Nothing checks that
  the "Noise then guard" pipeline these two sweeps use still flags a real card number. The guard's own probe tests do not cover
  the Noise step, and Noise is where the false negatives come from. Fix: move the Noise regex into one shared test helper (it is
  copied three times and the copies have already drifted; the trace copy has an extra `\b1\d{12}\b`). Add a fast unit test asserting
  that Noise+guard still flags at least: `4111111111111111`, `4111 1111 1111 1111`, `4880123456789012`,
  `note 4111111111111111 at 11/11/2026 10:00:00 AM`, `2026-11-11T10:00:00Z 4111-1111-1111-1111`,
  `4111111111111111 3f2504e0-4f89-11d3-9a0c-0305e82c3301`, and the same with the instant and the card number in the other order.
  (I checked all of these by hand except `4880...`, and they are still flagged; the self-test would keep them that way.)
- [LOW] BillingTestGateDatabaseTests.cs:170 and BillingLogCaptureEndpointTests.cs:21 — the date and ID alternatives have no
  boundaries, so a card number glued to them with no separator is partly eaten and drops below 13 digits or fails Luhn:
  `4111111111111111/1/2026 10:00:00` -> `41111111111111 ` (the new US-date alternative takes the last 2 digits; missed);
  `2026-11-11T10:00:00.4111111111111111Z` -> blank (the unbounded `(\.\d+)?` swallows the whole card number; missed);
  `4111111111111111deadbeef` -> blank (`[0-9a-fA-F]{24,}`; missed). When the card number and the instant/GUID are separated by a
  space, or by a dash before an ISO date, the card number survives and is flagged. These masks need a card number pasted directly
  against a timestamp or a hex ID, which no current writer produces, hence LOW. In XI_9 only the US-date alternative is new in
  this branch; for I_X1 all of them are new. Fix: add `(?<![0-9A-Za-z])` / `(?![0-9A-Za-z])` around each alternative and limit the
  fraction to `(\.\d{1,7})?`.
- [INFO] src/Api/AmarGram.Api/Background/ScheduledReportRunner.cs:267-277 — swallowing `DbUpdateConcurrencyException` in AdvanceAsync
  is benign. `RecordRunCompleted` is idempotent per slot (`LastRunDueOn >= dueOn` returns early). AdvanceAsync is called only after
  the run has been recorded, or after the Failed run has been recorded on the max-attempts path. Each schedule gets its own DI scope
  (ReportingWorkCycle.cs:47) and the manual endpoint gets a request scope, so the stale tracked entity cannot poison another
  schedule's save. If the conflict came from an admin edit, the edit wins, and the next pass sees the slot already recorded
  (Created=false, no second delivery) and advances again. No data is lost. The catch handles only that one exception type, and any
  other exception still leads to a Failed run record. The log line has only the schedule Guid and the slot instant: no PII and no
  exception message.
- [INFO] src/Read/AmarGram.Read/QueryHandlers/Account/GetStaffAccountsQueryHandler.cs:28 — `ThenBy(s => s.Id)` only makes the paging
  order stable. The filters and authorization are unchanged, and nothing new is exposed.
- [INFO] Test-only infrastructure stays in tests/AmarGram.IntegrationTests and does not leak into production DI or builds:
  - The FakeTimeProvider override uses ConfigureTestServices on a derived factory (AdminBranchCardsAndStaffListEndpointTests.cs:241).
  - The backlog drain is in NotificationsIntegrationTestBase.cs:36.
  - The `ANALYZE` runs against the test database only (ShopCataloguePerformanceTests.cs:62; constant SQL, no input).
  - No csproj, Program or module registration changed. The lockout test still asserts `Locked` (now under a frozen clock), so it was not weakened.
  - XI_9 now seeds its own billing rows, which strengthens the sweep's coverage.

SCOPE CHECK
- files in allowed scope: 20/20 (2 product files with small changes, 17 integration-test files, 1 gate doc)
- files outside allowed scope: none

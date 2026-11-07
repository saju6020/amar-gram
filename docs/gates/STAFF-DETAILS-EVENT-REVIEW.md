GATE: SECURITY + CODE_REVIEW
HANDOVER: STAFF-DETAILS-EVENT (fix for HO-ACC-001 section 11.5 / section 1 amendment)
COMMITS: 84472a0, 0f74140 (range 86db19d..0f74140, branch fix/staff-details-event)
DATE: 2026-11-07
STATUS: PASS

FINDINGS
- [LOW] src/Domain/AmarGram.Domain/Events/Account/StaffAccountDetailsChangedEvent.cs:5-7 -- the summary says the
  before/after values are "recorded by the DataChange audit row written in the same transaction". That is true only
  of the interceptor's generic row (Action "StaffAccountDetailsChangedEvent", JSON snapshot). The named
  "StaffAccountDetailsChanged" row is written by UpdateStaffAccountDetailsCommandHandler in a second SaveChanges
  after the staff change has committed. Fix: say which row is meant, e.g. "...by the interceptor's DataChange row
  (same transaction) and the named StaffAccountDetailsChanged row the command handler writes after commit".
- [LOW] tests/AmarGram.IntegrationTests/Endpoints/StaffEndpointTests.cs:183-189 -- the named row's Action, ActorUserId,
  Category and the exact BeforeValue/AfterValue text are asserted, but Reason ("ChangedByAdministrator"), EntityType
  ("StaffAccount"), and IpAddress/CorrelationId are not. If any of those regressed, the test would still pass.
  Fix: add Assert.Equal("ChangedByAdministrator", audit.Reason) and Assert.Equal("StaffAccount", audit.EntityType).

No security findings. What was checked:
- Equivalence with 86db19d: same Action, EntityType, Reason, Category (DataChange), actor
  (command.UserContext.UserId == event.UserContext.UserId, since the event's UserContext was dto.UserContext ==
  command.UserContext), CorrelationId, the same Describe() before/after format, the same IClientIpAccessor, and the same
  TimeProvider.GetUtcNow(). Timing: both write after the staff SaveChangesAsync. The old handler was invoked by
  EfAggregateRootRepository.CommitAsync after SaveChangesAsync; the new code writes right after UpdateAsync returns.
  Both use the same scoped DbContext. Before/after values are identical: before is read from the aggregate before
  UpdateDetails (= old Previous*), and after is read from the aggregate after it (= dto values = old New*; FullName is
  the same trimmed string).
- No-op: the aggregate returns early with no event. The handler skips the row when before == after. Because the
  MobileNumber/EmailAddress value objects cannot contain "; " or "-", the string comparison matches field equality.
  The integration test re-PUTs identical data and then uses SingleAsync on both the named row and the interceptor
  row, so a duplicate or a no-op row would fail it.
- Duplicates: the old handler and its DI registration are both removed. No remaining references
  (grep: AuditStaffAccountDetailsChangedHandler, Previous*/New* properties). The second SaveChanges does not trigger
  an extra interceptor row: staff is Unchanged by then, and AuditEntryAggregate is in AuditCaptureExclusions.
- Failure mode: unchanged. Before and after the change, an audit-save failure happens after the staff row (and its
  atomic interceptor DataChange row) has committed, and the exception propagates (500). The before/after values are
  therefore never lost, because the interceptor row is in the same transaction. Writing the audit row after commit in
  the handler matches existing direct writers (RecallCommandHandlers.cs:185-193, OperationsAudit.cs:21-25).
- PII: the event now carries only ids, booleans, UserContext and CorrelationId. The handler logs only StaffAccountId
  and CorrelationId. No exception messages include values. The audit table still holds the values, which is what the
  owner's section 1 amendment requires. The interceptor row is unchanged.
- Authorization: unchanged. [RequireAction(StaffAccounts.UpdateDetails)] plus the in-handler ActionRoles re-check;
  ActionRoles.Accounts.cs:28 is Administrator only. The non-administrator 403 test still passes.
- Tests run: Domain 1806/1806 passed (including EveryAccountEventType_HasNoDisallowedFreeTextStringProperty);
  Application 575/575 passed; IntegrationTests StaffEndpointTests 16/16 passed against amargram_staffevent.

SCOPE CHECK
- files in allowed scope: 7/7 (AccountsModule DI line, command handler, deleted event handler, aggregate, event,
  domain test, integration test)
- files outside allowed scope: none

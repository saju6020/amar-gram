# People back office (HO-P4 BG-19 .. BG-23)

## Status: Complete (backend). Web wiring (lib/api, mocks, screens) not started -- `web/` untouched.

## What it does
Customers: a paged, searchable staff list, a profile summary, staff notes and tags, and a staff-started password reset. Billing: the
till is counted per source. Administration: outlet-card details on the branch list, branches and status on the staff list, and a
single roster-grid cell command. Approved by the owner 2026-10-25.

## Key aggregates / components
- `CustomerStaffRecordAggregate` (Account, id = customer id, 1:1): notes (append-only) + tags (`Labels`). Personal data: cleared on anonymisation
  (`ClearCustomerStaffRecordOnAnonymisedHandler`, `AccountPersonalDataEraser`), events carry ids/counts only, excluded from DataChange audit
  (`AuditCaptureExclusions`), BusinessEvent audit by id (`CustomerNoteAdded`, `CustomerTagsChanged`).
- Staff-initiated reset = `RequestCustomerPasswordResetCommandHandler` -> same `PasswordResetTokenAggregate` + dispatcher + confirm step as self-service;
  `PasswordResetRequestedEvent.InitiatedByStaffId` -> audit action `PasswordResetRequestedByStaff`, actor = the staff member.
- `CashUpAggregate.SourceCounts` / `ExpectedSources` (jsonb), `CashUpSources` + `CashUpCalculator.CalculateSources`: sources = the till and each staff
  collector of COD; courier-held cash is not a source. Overall `CountedCash` = sum of the source counts (server-computed).
- `BranchAggregate.Type` (`BranchType` Outlet/Warehouse, default Outlet); `AdminBranchCardDetails` (today's hours via `IBranchCalendar`, active zones, staff count).
- `StaffAccountStatusRules.Derive` (Active / NotSetUp / Locked); no Disabled state exists in the aggregate.
- Roster cell: `SetRosterShiftCommandHandler` -> two deterministic-id `RosterExceptionAggregate` rows (`RosterCellIds`): whole-day cut + ExtraShift
  (Morning 08:00-14:00, Evening 14:00-20:00 in `StaffRosterRules`). `StaffAvailability.EffectiveSlots` now applies cuts before extras (order-independent).
  `GetRosterCellsQueryHandler` + `RosterShiftCells.Classify` read the effective shift back (Morning/Evening/Off/Custom).

## Key files
- src/Domain/AmarGram.Domain/Aggregates/Account/CustomerStaffRecordAggregate.cs, Aggregates/Billing/CashUpAggregate.cs, Aggregates/Administration/{BranchAggregate,RosterExceptionAggregate}.cs
- src/Domain/AmarGram.Domain/DomainServices/{CashUpCalculator,StaffAvailability,RosterShiftCells}.cs, ValueObjects/CashUpSources.cs
- src/Application/AmarGram.Application/CommandHandlers/Account/{CustomerStaffRecordCommandHandlers,RequestCustomerPasswordResetCommandHandler}.cs
- src/Application/AmarGram.Application/CommandHandlers/Administration/SetRosterShiftCommandHandler.cs, CommandHandlers/Billing/CashUpCommandHandlers.cs
- src/Read/AmarGram.Read/QueryHandlers/Account/{BrowseCustomersQueryHandler,GetStaffCustomerQueryHandler,GetStaffAccountsQueryHandler}.cs
- src/Read/AmarGram.Read/QueryHandlers/Administration/{AdminBranchCardDetails,BranchQueryHandlers,GetRosterCellsQueryHandler}.cs
- src/Api/AmarGram.Api/Controllers/{StaffCustomersController,StaffCashUpController,AdminBranchesController,AdminRostersController}.cs
- Migrations: `InitialAmarGram` regenerated (`customer_staff_record`, `customer_staff_note`, `branch.type`, `cash_up.source_counts/expected_sources`);
  `InitialAmarGramSql` seed row for MAIN gains `type` = Outlet.

## Decisions made
- Browse is a new route (`GET /api/staff/customers/browse`); the exact mobile/email lookup keeps its array response. Lists active customers only.
- Actions: `Customers.AddNote`, `Customers.SetTags`, `Customers.RequestPasswordReset` (Reception + Administrator); reading notes needs `Customers.View`.
- Manual roster exceptions on a cell's date are left alone; the cell read reports `Custom` when one is present.
- Notes/tags of a merged duplicate are not moved to the survivor (not requested).

## Remaining work
- Web: lib/api clients, mocks, screens (11.2.8-11.2.9, 11.6.3, 11.6.7-11.6.9).
- Personal-data export (`GetPersonalDataExportQuery`) does not include staff notes (internal notes are not shown to the customer); decide if access requests must.
- A per-customer cooldown on staff-started resets (currently only the host rate limits apply).

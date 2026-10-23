# HO-P1 — Retire the clinic code, rename to AmarGram, fresh baseline migration

Owner decisions, 2026-10-24:
- Clean first, then UI.
- Fresh baseline migration.
- Lightweight process: this handover, then implementation, then build/test/lint verification and one code review.
- Rename `CatEcommerce` → `AmarGram` in this phase.

## 1. Goal

The codebase holds only the general e-commerce product described in SRS v3.0. The clinic areas
(CAT, APT, EMR, PHM, SRG, BRD) are gone from code, database, API and web. Nothing that remains
refers to cats, clinic, vets, prescriptions, surgery, boarding or vaccinations.

## 2. Remove entirely

**Backend.** Remove these modules from `src/` and `tests/`:
- Cat profiles, vaccination
- Clinic (appointments and waitlist)
- Visit (consultation and medical records, clinical history, diagnostics, consents, note templates)
- Prescription (pharmacy, dispensing, formulary, controlled drugs, diet authorisation)
- Surgery
- Boarding (stays, daycare, care tasks, incidents, media)

For each module that means removing:
- Domain aggregates, entities, domain services and events
- Application commands, handlers and event handlers
- Read queries, handlers and view models
- Infrastructure folders and EF configurations
- API controllers, contracts and `*Module.cs` registrations
- Shared constants and enums
- Tests

**Web.** Remove these from `web/`:
- Routes, nav areas, components, `lib/api` clients, mocks and tests for cats, appointments/booking/front desk, visits/consultation, diagnostics, consents, pharmacy/prescriptions/formulary/controlled drugs/diet authorisations, surgery/anaesthesia/recovery, and boarding/daycare.
- The admin sub-nav entries for clinical services, diagnosis codes, lab analytes, note templates, formulary and rooms.

## 3. Decouple the generic modules (keep the module, drop the clinic hook)

| Where | Change |
|---|---|
| Cart, order, charge, stock ledger and reservation lines | Remove `CatId` |
| Product | Remove `PrescriptionRequired`, `PrescriptionLineGuard`, `IDietAuthorisationGate` and its fakes, and every SHP/ORD/SUB use of them. Remove life-stage and pet-food-only fields (`FoodDetails.LifeStage`, cat-age recommendations). Keep generic food details: ingredients, storage, shelf life. |
| `BusinessLine` | Remove `Clinic` and `Boarding`. Reports that split by line split by order channel instead (online / counter / subscription) where that data exists; otherwise report a single line. |
| `ChargeSourceKind` | Keep only `Order`, `Manual` (and any other non-clinic kind) |
| `ItemKind` | Drop `Medicine`, `BoardingNight` and other clinic kinds |
| `MovementKind` | Drop `Dispense`, `ClinicalUse` and `BoardingUse` |
| Billing | Remove Phase J sources (visit, dispense, surgery) and boarding deposits/charges. Keep orders, payments, credit notes, cash-up, reconciliation and export. |
| Reporting | Remove clinic, boarding and cat report builders, sources, dashboard tiles and reporting SQL views (`rv_clinic_*`, `rv_cat_*`, `rv_care_reminder_*`, boarding views) |
| Notifications | Remove clinic templates (appointment.*, care.*, pharmacy.*, visit.*, waitlist.*, boarding, surgery), `CareReminderSweep` and `CatCareLink`. Rename the `ClinicName` template variable to `OutletName` (fallback "Amar Gram"). |
| Accounts | Remove cat reassignment on merge and its audit. Remove species and breed from the personal-data export. |
| Portal | Remove the Cats, Appointments, Prescriptions, Visits and Stays sections |
| Security | Remove cat-owner scoping (`GetCatOwnerQuery` in `OwnerScope`) and the clinic `ActionRoles` partials. Remove roles used only by clinic actions; reassign any generic action they guarded to an existing generic role. |
| Administration | Remove clinic services and prices, rooms, and vet-leave appointment flags. Keep branches (outlets/warehouses), rosters, leave, settings, content and tax. |
| File storage | Remove purposes `LabResult`, `ClinicalPhoto`, `BoardingMedia` and `BoardingBelongings` |
| Cross-cutting | Remove clinic, cat and boarding retention classes, purge sources and erasers. Offline mode keeps only what still has a non-clinic use. |
| Documents | Remove the cat medical-history PDF renderer |

## 4. Rename

`CatEcommerce` → `AmarGram` everywhere:
- Solution, project folders and files, namespaces
- `CatEcommerceDbContext` → `AmarGramDbContext`
- Connection-string name `AmarGram`; databases `amargram_dev` and `amargram_test_*`
- Roles in `deploy/database/roles.sql`: `amargram_migrator`, `amargram_app`, `amargram_backup_reporter`
- `CATECOMMERCE_TEST_DB` → `AMARGRAM_TEST_DB`
- Temp-folder names in `FileStorageOptions`
- The namespace prefix check in `NulByteRejectionFilter.cs`
- In `deploy/backup/`, rename the pgbackrest stanza, paths and image names (`purrcare` → `amargram`)

## 5. Fresh baseline migration

Delete every migration and the model snapshot, then generate one `InitialAmarGram` migration from
the cleaned model.

**Carry forward every non-clinic raw SQL** the old migrations applied. Audit each `migrationBuilder.Sql(...)`:
- billing and audit immutability triggers
- retention guards on kept tables
- `inventory.v_sellable_stock` and other inventory views
- reporting views for kept reports
- the delivery tax-class seed
- schemas, extensions and functions

Add that SQL to the baseline (or to a second, clearly named `InitialAmarGramSql` migration), so a fresh database behaves like the old one minus the clinic.

## 6. Acceptance

1. `dotnet build AmarGram.sln` passes with 0 errors.
2. The Domain, Application and Infrastructure test projects pass.
   - The one pre-existing failure, `EventPersonalDataReflectionTests` for `StaffAccountDetailsChangedEvent`, may remain only if it is untouched by this phase. Fixing it is welcome.
3. `dotnet ef database update` builds a fresh `amargram_dev` from the baseline, and the integration tests pass against a fresh `amargram_test_p1` database.
4. In `web/`, `npm run lint`, `npm run typecheck` and `npm test` pass. Any remaining flaky timeouts are reported, not hidden.
5. A case-insensitive grep over `src tests web --include=*.cs,*.ts,*.tsx,*.sql,*.json` returns only justified hits for:
   `\bcats?\b|CatId|kitten|feline|veterinar|clinic|appointment|boarding|surgery|prescription|pharmacy|vaccin|dispens`
   Words like "category" and "catalogue" are fine.
6. `docs/handover/README.md` gets an amendment row saying the clinic code is removed.

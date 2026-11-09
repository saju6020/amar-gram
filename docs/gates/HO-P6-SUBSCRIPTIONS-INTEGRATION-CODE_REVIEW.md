GATE: CODE_REVIEW
HANDOVER: HO-P6-SUBSCRIPTIONS (integration part 2)
COMMITS: 3d2b436..810751c (f0ae577, 5d38de8, 504f3f4, b7cecc3, 810751c); glanced 7d9254f..3d2b436
DATE: 2026-11-09
STATUS: PASS

FINDINGS
- [LOW] web/tests/e2e/billing-real-api.spec.ts:372 and web/tests/e2e/subscriptions-customer-real-api.spec.ts:51 — the accept-pending-policies loop is written twice (one inline, one as `acceptPendingPolicies`). Behaviour is the same and both assert the dialog appears when the API lists pending policies, so nothing is weakened; a shared e2e helper would stop them drifting.
- [LOW] web/tests/contract/mock-vs-real.contract.test.ts:124,137 — the dictionary rule is limited to `$.open.byKind`, and when one side has no entries the values go to `unverified` (reported, not failed). That is consistent with how empty arrays are handled, and key names are the only thing no longer compared. Future dictionary-typed view models need an entry added by hand.
- [LOW] web/mocks/handlers/shop/staff.ts:100-126 — for a non-boolean `isSubscribable` the BytePositionInLine is computed for string/number tokens and "first byte + 1" for objects, arrays and bare literals. The real API's value was only seen for a string, so the other branches are inferred. The comment says as much; nothing to fix.

CHECKS
- Mock vs server: `SetSubscribable` is idempotent and calls `UpdateVersion()` only on a change (ProductAggregate.Subscription.cs:14-20). The mock's `write` adds 1 and the flag-change branch adds 1 more, and does nothing for the same value or none, so a flip is +2. `OrderLineViewModel.ImagePath` and `OrderFulfilmentViewModel.RiderNote` (both `string? = null`) and `CatalogueResult.TotalItemCount` exist as cited. `OpenAlertSummaryViewModel.ByKind` is `IReadOnlyDictionary<string,int>`.
- No test weakened. The 404 spec went from `text === ''` to an exact ProblemDetails match plus a string `traceId`. Privacy acceptance asserts that the dialog is visible when the API lists pending policies, that each Accept lowers the count, and that the dialog ends hidden. It only skips when the API's list is empty, so nothing is tolerated. The contract dictionary rule still compares the values' shape, and a mismatch is a failure.
- Targeted Vitest back-office-subscriptions/mock-refusals.test.ts: 19 of 19 pass (includes the two new cases).
- Amended rows (n)-(s) each match their diff. (n): comment only in staff/page.tsx. (o): the three parts are in staff.ts and mock-refusals.test.ts. (p): the customer and staff 404 mocks plus the customer spec. (q): the 360 locator in the staff spec. (r): billing spec E-F1. (s): customer.ts, catalogue.ts, the contract test, and the one-card-per-product gap left out of KNOWN_DRIFT and named as an owner item.
- `lib/api/client.ts:371` reads no 404 body, as (p) says.
- No cat/pet/vet/clinic/PurrCare wording in the changed files or gate docs.

SCOPE CHECK
- files in allowed scope: all changed files are covered by Amended rows (n)-(s)
- files outside allowed scope: none

GATE: SECURITY
HANDOVER: HO-P6-SUBSCRIPTIONS (slice S0, frontend contract)
COMMITS: 21b0ad1, 3cbdeb3, 6c63e0f, 13111cc, 1b0b7d8, 6864a40, b3e47fd, 43ed835, bdb9759 (range 86db19d..bdb9759)
DATE: 2026-11-07
STATUS: PASS

FINDINGS
- none

Checked:
- Request construction (web/lib/api/subscriptions.ts:286-380, web/lib/api/staff-subscriptions.ts:152-232):
  the base paths are constants. Every id path segment (subscription id, customerId) goes through
  `encodeURIComponent`. Every query is built with `URLSearchParams`, so the free-text `q` filter cannot
  inject parameters or path. No URL, host or origin comes from data. `subscriptionsCsvPath` returns a
  same-origin relative path built the same way.
- Credentials/CSRF: every call goes through the existing `apiFetch` (lib/api/client.ts, unchanged in
  this range). There is no direct `fetch` and no hand-set credentials or headers. Request bodies carry
  only the documented fields. Reinstate and cancel spell out an explicit field list rather than
  spreading caller input.
- Error mapper (web/lib/subscriptions/errors.ts): only the server's `errorMessage` is shown, which
  matches the existing convention in lib/api/errors.ts. `errorCode` is used only to look up a fallback
  sentence and is never rendered. The plain `{ error }` 400 body is never rendered; it maps to a
  generic sentence, and the `Array.isArray` guard stops it crashing `describeApiError`. 404, 409 and
  403 map to fixed sentences. No response text, ids or PII are interpolated or logged.
- Roles (staff-subscriptions.ts:26-42) match src/Shared/AmarGram.Shared/Common/Constants/
  ActionRoles.Subscriptions.cs:12-14 exactly: View = Reception, Inventory, ShopManager, Accountant,
  Administrator; Manage = ShopManager, Administrator; Export = ShopManager, Accountant, Administrator.
  The string values match StaffRoles.cs `nameof` constants. They are labelled presentation-only, and
  the server's 403 has the last word.
- Browser storage: lib/subscriptions/* and the two API clients never touch local or session storage.
  The new mock store persists to `sessionStorage` (`__amargram_subscriptions_mock_db__v1`), like the
  other mock stores. The accounts key bump (`__amargram_accounts_mock_db_p6__`) and the seeded address
  book are mock-only data with fictional addresses, names and mobiles (01712000002..6, existing test
  number style). No token, password or card is added.
- MSW gating: lib/dev/mock-worker.ts (unchanged) imports `@/mocks/browser` only when
  NODE_ENV=development and NEXT_PUBLIC_USE_MOCKS=true. No app, lib or components file imports
  `mocks/` directly. `window.__subscriptionsMock` is installed only when `NODE_ENV !== 'production'`,
  inside the mock module, which never reaches a production bundle. The customer, staff and touchpoint
  handler arrays are empty in S0. Object-level ownership checks in the mock handlers are therefore out
  of scope here and fall to S1/S2.
- No secrets, keys or tokens in the diff. web/package.json and the lockfile are unchanged, so there are
  no new dependencies. There is no dangerouslySetInnerHTML, innerHTML, eval or new Function in the new
  code.

Non-security note (no action required by this gate): seeded address ids such as
`5a0000000-0000-0000-0000-000000000001` have a 9-character first group, so they are not RFC 4122 UUIDs.
That is harmless inside the mock, but a later slice that validates ids as GUIDs client-side would refuse them.

SCOPE CHECK
- files in allowed scope: 32/32 (S0 API clients, lib/subscriptions/*, mock store/seeds/schedule/control,
  mock key bumps required by Amended (a)-(c), unit tests, decisions/handover/gate docs)
- files outside allowed scope: none

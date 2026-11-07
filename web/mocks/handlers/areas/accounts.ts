import { http, HttpResponse, type HttpHandler } from 'msw';

/**
 * Accounts & Identity MSW request handlers — every endpoint in HO-ACC-001 §12.4, derived from
 * that contract as verified against the real implementation in `src/` (controllers, query
 * handlers, `RateLimitPolicies`, `SessionAuthenticationMiddleware`) — never invented (§5.1,
 * §20.2). An in-memory store backs every handler so a register/sign-in/edit flow behaves like the
 * real API across a test run; `resetAccountsMockData()` restores the seeded fixtures.
 *
 * Session cookies are real `Set-Cookie` response headers, and every guarded endpoint reads the
 * real `Cookie` request header — this works correctly in a genuine browser (Playwright, `npm run
 * dev`), where the cookie jar is real. Vitest's jsdom environment has no such cookie jar (`fetch`
 * there is Node's `undici`, which does not implement one), so component tests that need "signed
 * in" behaviour override the specific endpoint with `server.use(...)` for that test rather than
 * performing a full sign-in round trip and relying on the cookie surviving to the next request.
 *
 * Rate limiting (`429`) and CAPTCHA-invalid responses are not modelled as genuine sliding windows
 * — a handful of reserved trigger values (documented next to each) produce them deterministically,
 * which is what a test needs; nothing here claims to reproduce `RateLimitPolicies`' actual windows.
 */

// -------------------------------------------------------------------------------------------
// Fixture identifiers
// -------------------------------------------------------------------------------------------

export const accountsFixtureIds = {
  // Registration duplicates (U-B6/U-B7 need both a with- and a without-email dup-mobile fixture).
  dupMobileNoEmail: '01711111111',
  dupMobileWithEmail: '01722222222',
  dupMobileWithEmailAddress: 'existing-with-mobile@example.com',
  dupEmailOnly: 'existing-email-only@example.com',

  // Reserved trigger values, never real accounts.
  triggerCaptchaFail: 'WRONG',
  triggerBreachedPassword: 'breached-password-1',
  triggerShortPassword: 'short', // shorter than 10 chars — also fails client zod, kept for server-side
  trigger429: '01700000429',
  trigger429Email: 'trigger-429@example.com',
  trigger500: 'trigger-500@example.com',

  // A signed-up, sign-in-ready customer (also the profile/addresses/preferences fixture).
  customerId: 'c0000000-0000-0000-0000-000000000001',
  customerMobile: '01799999999',
  customerEmail: 'signed-in-customer@example.com',
  customerPassword: 'Password123!',

  // A second customer used only as "another active customer's primary mobile" for
  // AdditionalPhoneNumberMatchesAnotherCustomer (HO-ACC-001 §1 Amended (18)(g)).
  otherCustomerMobile: '01788888888',

  // Staff.
  adminStaffId: 's0000000-0000-0000-0000-000000000001',
  adminIdentifier: 'admin@amargram.test',
  adminPassword: 'AdminPass123!',
  // A non-admin staff member with the Reception role (key names kept for existing callers).
  stockStaffId: 's0000000-0000-0000-0000-000000000002',
  stockIdentifier: 'stock@amargram.test',
  stockPassword: 'StockPass123!',
  noPasswordStaffId: 's0000000-0000-0000-0000-000000000003',
  // A non-admin staff member with the Inventory role: no NotificationLog.View (notifications E-E2).
  inventoryStaffId: 's0000000-0000-0000-0000-000000000004',
  inventoryIdentifier: 'inventory@amargram.test',
  inventoryPassword: 'InventoryPass123!',

  // Walk-in / duplicates.
  walkInDuplicateMobile: '01755555555', // an existing customer's PRIMARY — refuses (201 elsewhere)
  walkInAdditionalOnlyMobile: '01766666666', // only an ADDITIONAL number elsewhere — 201 succeeds

  duplicateGroupCustomerA: 'd0000000-0000-0000-0000-00000000000a',
  duplicateGroupCustomerB: 'd0000000-0000-0000-0000-00000000000b',

  mergeAlreadyMergedId: 'd0000000-0000-0000-0000-00000000000c',
  mergeNotDuplicatesId: 'd0000000-0000-0000-0000-00000000000d',
  merge5xxId: 'd0000000-0000-0000-0000-00000000000e',
} as const;

// -------------------------------------------------------------------------------------------
// Store shapes
// -------------------------------------------------------------------------------------------

interface StoredCustomer {
  id: string;
  fullName: string;
  mobileNumber: string | null;
  emailAddress: string | null;
  additionalPhoneNumbers: string[];
  /** MEDIUM/LOW gate item 12 (first pass) — `hashPassword()`'s output, NEVER the plaintext
   *  password; see that function's own comment. `null` still means "no password set". */
  password: string | null;
  canEditEmail: boolean;
  registeredOn: string;
  registrationChannel: 'SelfService' | 'Reception';
  status: 'Active' | 'Merged' | 'Anonymised';
  mergedIntoCustomerId: string | null;
  addresses: Array<{
    id: string;
    label: string;
    line1: string;
    line2: string | null;
    city: string;
    district: string;
    postalCode: string | null;
    deliveryInstructions: string | null;
    isDefault: boolean;
  }>;
  preferences: Array<{
    channel: string;
    category: string;
    isGranted: boolean;
    isEditable: boolean;
    isAlwaysOn: boolean;
  }>;
  /** HO-NTF-002 §11.2 — the channel chosen for important messages; absent/null until chosen. */
  preferredChannel?: 'Sms' | 'Email' | null;
  // HO-P5 BG-19 -- what staff keep about a customer. The server computes `orderCount` and `lifetimeSpend` from orders and
  // payments (StaffCustomerViewModel.cs:3-13); this store has neither, so they are seeded figures (the mock's role).
  /** District of the default delivery address; `null` when there is none. */
  area?: string | null;
  orderCount?: number;
  lifetimeSpendCents?: number;
  /** In the order staff entered them. */
  tags?: string[];
  /** Oldest first as stored; the read sorts newest first. */
  notes?: StoredCustomerNote[];
}

interface StoredCustomerNote {
  id: string;
  text: string;
  authorStaffId: string;
  createdOn: string;
}

interface StoredStaffAccount {
  id: string;
  fullName: string;
  mobileNumber: string | null;
  emailAddress: string | null;
  /** MEDIUM/LOW gate item 12 (first pass) — `hashPassword()`'s output, NEVER the plaintext
   *  password; see that function's own comment. `null` still means "no password set". */
  password: string | null;
  roleIds: string[];
  /** HO-P5 BG-22 -- a sign-in lockout still running at the read makes the status `Locked`
   *  (Shared/Helpers/StaffAccountStatusRules.cs:5-16). Set only through `setMockStaffLockedUntil`. */
  lockedUntil?: string | null;
}

/**
 * MEDIUM/LOW gate item 12 (first pass) — this mock used to store every seeded/registered/reset
 * password as plaintext directly in `StoredCustomer`/`StoredStaffAccount`, which
 * `persistMockState()` then serialised, as-is, into `sessionStorage` (`canPersist`'s own doc
 * comment already explains why that persistence exists at all) — inspectable via devtools, and a
 * genuine NFR-SEC-4/A26 violation ("No token, password, answer or draft in browser storage") for
 * this mock's own state, however deliberately unrelated to the real backend's actual hashing.
 * Deliberately NOT a real cryptographic digest — this is a browser-only mock with no server secret
 * to protect, and `SubtleCrypto.digest` is async, which every comparison call site below would then
 * need to become async for no real benefit here. Good enough that the stored value is never
 * recoverable to the original password by inspection (a same-input-same-output digest, not a
 * reversible encoding like `btoa`), which is the actual property this gate item asks for.
 */
function hashPassword(password: string): string {
  let hash = 0;
  for (let index = 0; index < password.length; index += 1) {
    hash = (hash * 31 + password.charCodeAt(index)) | 0;
  }
  return `mock-hash:${hash}`;
}

/** `stored` is always `hashPassword()`'s own output (or `null`, meaning "no password set") —
 *  never call this with a raw, unhashed value on the `stored` side. `candidate` is the plaintext a
 *  request body just supplied, hashed here for the comparison and never itself stored. Preserves
 *  the one pre-existing edge case a bare `!==` comparison relied on: no password set (`stored ===
 *  null`) matches only an absent `candidate` (`null`/`undefined`), the same as `undefined !==
 *  null` being `false` used to. */
function passwordMatches(stored: string | null, candidate: string | null | undefined): boolean {
  if (stored === null) return candidate === null || candidate === undefined;
  return candidate != null && stored === hashPassword(candidate);
}

const MAX_ADDRESSES = 10;
const now = () => new Date();
const iso = (d: Date) => d.toISOString();

function seedPreferences() {
  return [
    {
      channel: 'SMS',
      category: 'Orders',
      isGranted: true,
      isEditable: false,
      isAlwaysOn: true,
    },
    {
      channel: 'Email',
      category: 'Orders',
      isGranted: true,
      isEditable: false,
      isAlwaysOn: true,
    },
    {
      channel: 'SMS',
      category: 'Marketing',
      isGranted: false,
      isEditable: true,
      isAlwaysOn: false,
    },
    {
      channel: 'Email',
      category: 'Marketing',
      isGranted: false,
      isEditable: true,
      isAlwaysOn: false,
    },
  ];
}

function seedCustomers(): Map<string, StoredCustomer> {
  const customers = new Map<string, StoredCustomer>();

  customers.set(accountsFixtureIds.customerId, {
    id: accountsFixtureIds.customerId,
    fullName: 'Sam Rahman',
    mobileNumber: accountsFixtureIds.customerMobile,
    emailAddress: accountsFixtureIds.customerEmail,
    additionalPhoneNumbers: [],
    password: hashPassword(accountsFixtureIds.customerPassword),
    canEditEmail: true,
    registeredOn: iso(now()),
    registrationChannel: 'SelfService',
    status: 'Active',
    mergedIntoCustomerId: null,
    addresses: [],
    preferences: seedPreferences(),
    area: 'Dhanmondi',
    orderCount: 3,
    lifetimeSpendCents: 425_000,
    tags: ['Regular'],
    notes: [
      {
        id: 'n0000000-0000-0000-0000-000000000001',
        text: 'Prefers delivery after 5pm. Call the guard at the gate.',
        authorStaffId: accountsFixtureIds.stockStaffId,
        createdOn: '2026-10-20T09:15:00.000Z',
      },
    ],
  });

  const dupMobileNoEmailId = crypto.randomUUID();
  customers.set(dupMobileNoEmailId, {
    id: dupMobileNoEmailId,
    fullName: 'Existing Customer',
    mobileNumber: accountsFixtureIds.dupMobileNoEmail,
    emailAddress: null,
    additionalPhoneNumbers: [],
    password: hashPassword('x'),
    canEditEmail: true,
    registeredOn: iso(now()),
    registrationChannel: 'SelfService',
    status: 'Active',
    mergedIntoCustomerId: null,
    addresses: [],
    preferences: seedPreferences(),
  });

  const dupMobileWithEmailId = crypto.randomUUID();
  customers.set(dupMobileWithEmailId, {
    id: dupMobileWithEmailId,
    fullName: 'Existing Customer With Email',
    mobileNumber: accountsFixtureIds.dupMobileWithEmail,
    emailAddress: accountsFixtureIds.dupMobileWithEmailAddress,
    additionalPhoneNumbers: [],
    password: hashPassword('x'),
    canEditEmail: true,
    registeredOn: iso(now()),
    registrationChannel: 'SelfService',
    status: 'Active',
    mergedIntoCustomerId: null,
    addresses: [],
    preferences: seedPreferences(),
  });

  const dupEmailOnlyId = crypto.randomUUID();
  customers.set(dupEmailOnlyId, {
    id: dupEmailOnlyId,
    fullName: 'Email Only Customer',
    mobileNumber: null,
    emailAddress: accountsFixtureIds.dupEmailOnly,
    additionalPhoneNumbers: [],
    password: hashPassword('x'),
    canEditEmail: true,
    registeredOn: iso(now()),
    registrationChannel: 'SelfService',
    status: 'Active',
    mergedIntoCustomerId: null,
    addresses: [],
    preferences: seedPreferences(),
  });

  const otherActiveCustomerId = crypto.randomUUID();
  customers.set(otherActiveCustomerId, {
    id: otherActiveCustomerId,
    fullName: 'Another Active Customer',
    mobileNumber: accountsFixtureIds.otherCustomerMobile,
    emailAddress: null,
    additionalPhoneNumbers: [],
    password: hashPassword('x'),
    canEditEmail: true,
    registeredOn: iso(now()),
    registrationChannel: 'SelfService',
    status: 'Active',
    mergedIntoCustomerId: null,
    addresses: [],
    preferences: seedPreferences(),
  });

  // Walk-in duplicate fixtures: one hit only as a PRIMARY number, one only as an ADDITIONAL number
  // (HO-ACC-001 §1 Amended (16)/(18)(g) — only a primary-number match refuses a walk-in).
  const walkInPrimaryMatchId = crypto.randomUUID();
  customers.set(walkInPrimaryMatchId, {
    id: walkInPrimaryMatchId,
    fullName: 'Walk-in Primary Match',
    mobileNumber: accountsFixtureIds.walkInDuplicateMobile,
    emailAddress: null,
    additionalPhoneNumbers: [],
    password: null,
    canEditEmail: true,
    registeredOn: iso(now()),
    registrationChannel: 'Reception',
    status: 'Active',
    mergedIntoCustomerId: null,
    addresses: [],
    preferences: seedPreferences(),
  });
  const additionalOnlyMatchId = crypto.randomUUID();
  customers.set(additionalOnlyMatchId, {
    id: additionalOnlyMatchId,
    fullName: 'Additional-Only Match',
    mobileNumber: '01711100000',
    emailAddress: null,
    additionalPhoneNumbers: [accountsFixtureIds.walkInAdditionalOnlyMobile],
    password: hashPassword('x'),
    canEditEmail: true,
    registeredOn: iso(now()),
    registrationChannel: 'SelfService',
    status: 'Active',
    mergedIntoCustomerId: null,
    addresses: [],
    preferences: seedPreferences(),
  });

  // Duplicates report fixture: two members sharing a mobile number.
  customers.set(accountsFixtureIds.duplicateGroupCustomerA, {
    id: accountsFixtureIds.duplicateGroupCustomerA,
    fullName: 'Duplicate Alpha',
    mobileNumber: '01733333333',
    emailAddress: 'alpha@example.com',
    additionalPhoneNumbers: [],
    password: hashPassword('x'),
    canEditEmail: true,
    registeredOn: iso(now()),
    registrationChannel: 'SelfService',
    status: 'Active',
    mergedIntoCustomerId: null,
    addresses: [],
    preferences: seedPreferences(),
  });
  customers.set(accountsFixtureIds.duplicateGroupCustomerB, {
    id: accountsFixtureIds.duplicateGroupCustomerB,
    fullName: 'Duplicate Beta',
    mobileNumber: '01733333333',
    emailAddress: 'beta@example.com',
    additionalPhoneNumbers: [],
    password: hashPassword('x'),
    canEditEmail: true,
    registeredOn: iso(now()),
    registrationChannel: 'Reception',
    status: 'Active',
    mergedIntoCustomerId: null,
    addresses: [],
    preferences: seedPreferences(),
  });

  // Merge-outcome fixtures.
  customers.set(accountsFixtureIds.mergeAlreadyMergedId, {
    id: accountsFixtureIds.mergeAlreadyMergedId,
    fullName: 'Already Merged',
    mobileNumber: null,
    emailAddress: null,
    additionalPhoneNumbers: [],
    password: null,
    canEditEmail: true,
    registeredOn: iso(now()),
    registrationChannel: 'SelfService',
    status: 'Merged',
    mergedIntoCustomerId: accountsFixtureIds.duplicateGroupCustomerA,
    addresses: [],
    preferences: seedPreferences(),
  });
  customers.set(accountsFixtureIds.mergeNotDuplicatesId, {
    id: accountsFixtureIds.mergeNotDuplicatesId,
    fullName: 'Not A Duplicate',
    mobileNumber: null,
    emailAddress: 'unrelated@example.com',
    additionalPhoneNumbers: [],
    password: hashPassword('x'),
    canEditEmail: true,
    registeredOn: iso(now()),
    registrationChannel: 'SelfService',
    status: 'Active',
    mergedIntoCustomerId: null,
    addresses: [],
    preferences: seedPreferences(),
  });
  customers.set(accountsFixtureIds.merge5xxId, {
    id: accountsFixtureIds.merge5xxId,
    fullName: 'Always 500s On Merge',
    mobileNumber: null,
    emailAddress: 'merge-500@example.com',
    additionalPhoneNumbers: [],
    password: hashPassword('x'),
    canEditEmail: true,
    registeredOn: iso(now()),
    registrationChannel: 'SelfService',
    status: 'Active',
    mergedIntoCustomerId: null,
    addresses: [],
    preferences: seedPreferences(),
  });

  return customers;
}

function seedStaffAccounts(): Map<string, StoredStaffAccount> {
  const staff = new Map<string, StoredStaffAccount>();
  staff.set(accountsFixtureIds.adminStaffId, {
    id: accountsFixtureIds.adminStaffId,
    fullName: 'Ada Administrator',
    mobileNumber: null,
    emailAddress: accountsFixtureIds.adminIdentifier,
    password: hashPassword(accountsFixtureIds.adminPassword),
    roleIds: ['Administrator'],
  });
  staff.set(accountsFixtureIds.stockStaffId, {
    id: accountsFixtureIds.stockStaffId,
    fullName: 'Nadia Karim',
    mobileNumber: null,
    emailAddress: accountsFixtureIds.stockIdentifier,
    password: hashPassword(accountsFixtureIds.stockPassword),
    // Stock.View without receiving or procurement (tests/e2e/fixtures.ts `secondStaff`). Inventory can receive and
    // view procurement, so it does not fit here; Reception keeps the documented contract
    // (HO-P4 Amended, E-X3).
    roleIds: ['Reception'],
  });
  staff.set(accountsFixtureIds.noPasswordStaffId, {
    id: accountsFixtureIds.noPasswordStaffId,
    fullName: 'New Hire, No Password Yet',
    mobileNumber: '01788800000',
    emailAddress: null,
    password: null,
    roleIds: ['Reception'],
  });
  staff.set(accountsFixtureIds.inventoryStaffId, {
    id: accountsFixtureIds.inventoryStaffId,
    fullName: 'Rafiq Hossain',
    mobileNumber: null,
    emailAddress: accountsFixtureIds.inventoryIdentifier,
    password: hashPassword(accountsFixtureIds.inventoryPassword),
    // Reception can read the message log (ActionRoles.Notifications.cs), so the 403 case needs another role.
    roleIds: ['Inventory'],
  });
  return staff;
}

interface CustomerSessionRecord {
  customerId: string;
  expiresOn: string;
  csrfToken: string;
}
interface StaffSessionRecord {
  staffAccountId: string;
  issuedOn: string;
  lastActivityOn: string;
  absoluteExpiresOn: string;
  csrfToken: string;
  idleTimeoutMinutes: number;
  /** Test-only escape hatch: force the next status/activity read to report idle-expired,
   *  regardless of elapsed wall-clock time — see `forceStaffSessionIdleExpired`. */
  forcedIdleExpired: boolean;
}

/**
 * A genuine browser (Playwright's e2e-against-MSW run, or `npm run dev`) does a full document
 * reload on every `page.goto()`/`page.reload()` — even to a same-origin URL — which re-executes
 * this whole module from scratch (see the earlier doc comment on where MSW handler code actually
 * runs). Without persisting SOMETHING across that reload, "sign in, then navigate to another
 * page" would look signed-out again on the very next request, even though the real `pc_session`
 * cookie survived the reload just fine — only this mock's in-memory Maps did not. `sessionStorage`
 * is this mock's own stand-in for the real API's Postgres-backed session/customer tables,
 * scoped to the tab exactly like the real cookies are scoped to the browser; it is not additional
 * exposure of anything not already sitting in this mock's own (already non-HttpOnly, of
 * necessity — see `setBrowserCookie`) cookies. Gated on `'serviceWorker' in navigator`, which
 * jsdom (Vitest's environment) never provides, so `npm run test`'s component tests are completely
 * unaffected — they keep the simple, always-fresh in-memory behaviour they already had.
 */
const canPersist =
  typeof window !== 'undefined' && typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
// HO-P5: bumped when customers gained tags and notes and staff accounts gained a lockout, so an older tab's saved state is not read.
const PERSIST_KEY = '__amargram_accounts_mock_db_p5__';

function persistMockState(): void {
  if (!canPersist) return;
  try {
    window.sessionStorage.setItem(
      PERSIST_KEY,
      JSON.stringify({
        customers: [...customers.entries()],
        staffAccounts: [...staffAccounts.entries()],
        customerSessions: [...customerSessions.entries()],
        staffSessions: [...staffSessions.entries()],
      }),
    );
  } catch {
    // Best-effort — a quota error or private-mode restriction never breaks the mock response.
  }
}

function loadPersistedMockState(): {
  customers: Array<[string, StoredCustomer]>;
  staffAccounts: Array<[string, StoredStaffAccount]>;
  customerSessions: Array<[string, CustomerSessionRecord]>;
  staffSessions: Array<[string, StaffSessionRecord]>;
} | null {
  if (!canPersist) return null;
  try {
    const raw = window.sessionStorage.getItem(PERSIST_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

const persisted = loadPersistedMockState();

let customers = new Map(persisted?.customers ?? seedCustomers());
let staffAccounts = new Map(persisted?.staffAccounts ?? seedStaffAccounts());
const customerSessions = new Map<string, CustomerSessionRecord>(persisted?.customerSessions ?? []);
const staffSessions = new Map<string, StaffSessionRecord>(persisted?.staffSessions ?? []);
/** The mocked captcha shows its fixed answer, ABCDE, so a person trying the register page in mocked mode can read
 *  and type it (it used to be a 1x1 pixel, which rendered as a blank box). */
const MOCK_CAPTCHA_IMAGE = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="70" viewBox="0 0 200 70">' +
    '<rect width="200" height="70" fill="#f3ead6"/>' +
    '<path d="M8 50 C 50 20, 90 60, 192 22" stroke="#b9a37a" stroke-width="2" fill="none"/>' +
    '<path d="M8 22 C 60 55, 120 10, 192 48" stroke="#c9b48a" stroke-width="1.5" fill="none"/>' +
    '<text x="100" y="47" text-anchor="middle" font-family="monospace" font-size="34" font-weight="700" ' +
    'letter-spacing="8" fill="#2b2a24">ABCDE</text>' +
    '</svg>',
)}`;
const consumedCaptchas = new Map<string, string>(); // captchaId -> answer, removed on first use — never persisted (short-lived by design)

/** Restores every seeded fixture and clears all sessions — call from a test's `beforeEach`. */
export function resetAccountsMockData(): void {
  customers = seedCustomers();
  staffAccounts = seedStaffAccounts();
  customerSessions.clear();
  staffSessions.clear();
  consumedCaptchas.clear();
  if (canPersist) window.sessionStorage.removeItem(PERSIST_KEY);
}

/** HO-P5 Amended (as): the BG-19 summary fields `StaffCustomerViewModel.cs:11-13` always sends, for the operations
 *  mock's anonymised read-back (an erased customer keeps its record date and its order figures; its area, tags and
 *  notes are personal data and read back empty). `null` for an unknown id. */
export function erasedStaffCustomerSummary(customerId: string): {
  customerSince: string;
  area: null;
  orderCount: number;
  lifetimeSpend: { amount: string; currencyCode: 'BDT' };
  tags: string[];
  noteCount: number;
} | null {
  const customer = customers.get(customerId);
  if (!customer) return null;
  return {
    customerSince: customer.registeredOn,
    area: null,
    orderCount: customer.orderCount ?? 0,
    lifetimeSpend: { amount: centsText(customer.lifetimeSpendCents ?? 0), currencyCode: 'BDT' },
    tags: [],
    noteCount: 0,
  };
}

/** Test-only: forces the given staff token's next session read to report `session_idle_timeout`
 *  (U-G2/U-G4) without needing to fast-forward real or faked wall-clock time through every layer
 *  this mock would otherwise need to model. */
export function forceStaffSessionIdleExpired(token: string): void {
  const session = staffSessions.get(token);
  if (session) session.forcedIdleExpired = true;
}

/**
 * Real-browser-only test hook (ARCH gate HIGH 1, first pass) — this module's own code runs in the
 * page's JS realm in browser MSW mode (this file's own top-of-file comment), so a Playwright e2e
 * spec cannot `import` `forceStaffSessionIdleExpired` directly the way `resetAccountsMockData` is
 * imported into component tests (those run in Node/jsdom against the SAME module instance; a
 * Playwright test runs in a separate Node process against a browser tab that loaded this module
 * independently). Exposed on `window`, mirroring `app/providers.tsx`'s own `window.__mswReady`
 * pattern, purely so `tests/e2e/idle-lock.spec.ts` can force a real focus-triggered idle-timeout
 * without waiting out a real 30-minute window. Guarded the same way `canPersist` is (never defined
 * outside a real browser), so it does not exist in Vitest's jsdom.
 */
if (typeof window !== 'undefined') {
  (
    window as unknown as { __forceStaffIdleExpired?: (token: string) => void }
  ).__forceStaffIdleExpired = forceStaffSessionIdleExpired;
}

// -------------------------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------------------------

/**
 * Reads a cookie this mock itself set. `document.cookie`, not `request.headers.get('cookie')` —
 * a real browser's `fetch()` (unlike Node's `undici`, which Vitest's `msw/node` sits on top of)
 * treats `Cookie` as a forbidden header name and never exposes it on ANY script-visible `Request`
 * object, including the one a Service-Worker-based MSW handler receives — this is true even for
 * a same-origin request, and is unrelated to the separate cross-origin/SameSite cookie question
 * documented elsewhere in this file. `setBrowserCookie`'s own doc comment already establishes
 * `document.cookie` as this mock's actual, real source of truth for what got set; reads have to
 * agree with that same source rather than a header that real Chromium silently empties out, or
 * every authenticated request past the very first one — the one whose response can still seed a
 * mutation's own React Query cache directly — would 401 in a genuine browser (Playwright's e2e
 * run, or `npm run dev`) while still passing in Vitest's jsdom+`msw/node` component tests, which
 * is exactly the failure this fixes: `document` is defined in jsdom too, so this same code path is
 * exercised there as well, reading back exactly what `setBrowserCookie` already wrote to it.
 */
function getCookie(request: Request, name: string): string | undefined {
  const jar = typeof document !== 'undefined' ? document.cookie : '';
  const fromDocument = jar.split(/;\s*/).find((p) => p.startsWith(`${name}=`));
  if (fromDocument) return decodeURIComponent(fromDocument.slice(name.length + 1));

  const header = request.headers.get('cookie');
  if (!header) return undefined;
  const match = header.split(/;\s*/).find((p) => p.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : undefined;
}

/**
 * A genuine browser (`npm run dev` with `NEXT_PUBLIC_USE_MOCKS=true`, and Playwright's e2e run
 * against MSW) intercepts `fetch` via `mockServiceWorker.js`, but MSW's handler CODE — everything
 * in this file — actually runs in the page's own main-thread JS, not inside the Service Worker
 * itself (the SW script is a thin, generic relay; see MSW's architecture docs). Two consequences:
 *  - `document` exists here in that mode, so a direct `document.cookie` write works and IS sent by
 *    the real browser on the next `fetch` (cookie attachment happens in the browser's normal HTTP
 *    stack, upstream of the Service Worker's interception).
 *  - The `Set-Cookie` RESPONSE header on a Service-Worker-synthesised `Response`, by contrast, is
 *    silently ignored by the browser's cookie jar — a documented Fetch/Service-Worker security
 *    restriction, not an MSW bug. The `Set-Cookie` headers below are therefore returned for
 *    parity with the real API's wire shape (and so a real-browser network panel looks right), but
 *    the `document.cookie` write is what actually establishes the session for this mock.
 *  - Vitest's jsdom environment has `document` too, but its `fetch` (Node's `undici`) has no
 *    cookie jar linked to it at all, so a jsdom component test still cannot rely on this for a
 *    real cross-request round trip — see this file's top-of-file doc comment.
 */
function setBrowserCookie(name: string, value: string, expiresOn: string): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; expires=${new Date(expiresOn).toUTCString()}`;
}

function expireBrowserCookie(name: string): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

function sessionCookieHeaders(name: string, token: string, expiresOn: string): [string, string][] {
  setBrowserCookie(name, token, expiresOn);
  return [['Set-Cookie', `${name}=${token}; Path=/; Expires=${new Date(expiresOn).toUTCString()}`]];
}

function csrfCookieHeader(token: string, expiresOn: string): [string, string] {
  setBrowserCookie('pc_csrf', token, expiresOn);
  return ['Set-Cookie', `pc_csrf=${token}; Path=/; Expires=${new Date(expiresOn).toUTCString()}`];
}

function expireCookieHeader(name: string): [string, string] {
  expireBrowserCookie(name);
  return ['Set-Cookie', `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT`];
}

function validationError(
  propertyName: string,
  errorCode: string,
  errorMessage: string,
  resourceName = '',
) {
  return HttpResponse.json(
    { isValid: false, errors: [{ propertyName, errorCode, errorMessage, resourceName }] },
    { status: 400 },
  );
}

/**
 * Coordinator heads-up (2026-09-26): an integrator branch about to merge caps `pageSize` at 100
 * and `pageNumber` at 1,000,000 on `GET /api/staff-accounts` and `GET
 * /api/staff/customers/duplicates`, `400` otherwise. Mirrors the exact wire shape of this file's
 * own `validationError` helper for consistency; the real `errorCode`/`propertyName` values are not
 * yet visible from this worktree (the branch has not merged) and should be checked against the
 * real contract once it does — this is deliberately unauthoritative until then, not invented in
 * place of the real contract, only wired to unblock the frontend limits below in the meantime.
 */
function validatePagingParams(pageNumber: number, pageSize: number) {
  if (pageSize > 100) {
    return validationError('PageSize', 'PageSizeTooLarge', 'pageSize must be 100 or less.');
  }
  if (pageNumber > 1_000_000) {
    return validationError(
      'PageNumber',
      'PageNumberTooLarge',
      'pageNumber must be 1,000,000 or less.',
    );
  }
  return null;
}

function unauthorized(body: { error: string; message?: string; idleTimeoutMinutes?: number }) {
  return HttpResponse.json(body, { status: 401, headers: { 'Cache-Control': 'no-store' } });
}

function tooManyRequests(retryAfterSeconds: number) {
  return HttpResponse.json(
    {
      isValid: false,
      errors: [
        {
          propertyName: 'Request',
          errorCode: 'TooManyRequests',
          errorMessage: 'Too many requests. Try again later.',
          resourceName: 'RateLimit',
        },
      ],
    },
    {
      status: 429,
      headers: { 'Retry-After': String(retryAfterSeconds), 'Cache-Control': 'no-store' },
    },
  );
}

function findCustomerByIdentifier(identifier: string): StoredCustomer | undefined {
  return [...customers.values()].find(
    (c) => c.mobileNumber === identifier || c.emailAddress === identifier,
  );
}

/** HO-NTF-002 §11.2 — the channels the account has an identifier for. */
function availablePreferredChannels(customer: StoredCustomer): Array<'Sms' | 'Email'> {
  const channels: Array<'Sms' | 'Email'> = [];
  if (customer.mobileNumber) channels.push('Sms');
  if (customer.emailAddress) channels.push('Email');
  return channels;
}

function preferencesBody(customer: StoredCustomer) {
  const available = availablePreferredChannels(customer);
  return {
    cells: customer.preferences,
    preferredChannel: customer.preferredChannel ?? null,
    effectivePreferredChannel: customer.preferredChannel ?? available[0] ?? null,
    availablePreferredChannels: available,
  };
}

/**
 * HO-NTF-002 mock hooks (additive, read-only for the rest of this file). The notifications mock
 * (`mocks/handlers/notifications/**`) needs two facts this module owns: which roles a staff cookie
 * carries (so `NotificationLog.*` can answer 403 for an inventory clerk, E-E2) and a way to flip the seeded
 * customer's marketing consent when an unsubscribe link is used (E-D1). Returns `null` when the
 * request carries no staff session at all, which the notifications mock treats as "not modelled".
 */
export function getStaffRoleIdsForRequest(request: Request): string[] | null {
  const resolved = requireStaffSession(request);
  return resolved ? resolved.staff.roleIds : null;
}

/** HO-P5 BG-23: the roles of a staff account by id, for the roster mock's `StaffNotRosterable` check; `null` when there is no such account. */
export function getMockStaffRoleIds(staffAccountId: string): string[] | null {
  return staffAccounts.get(staffAccountId)?.roleIds ?? null;
}

/** Turns marketing consent off for `channel` ('Email' | 'Sms'). Returns whether it WAS on. */
export function revokeMarketingConsent(customerId: string, channel: 'Email' | 'Sms'): boolean {
  const customer = customers.get(customerId);
  const cell = customer?.preferences.find(
    (p) => p.category === 'Marketing' && p.channel.toLowerCase() === channel.toLowerCase(),
  );
  if (!customer || !cell) return false;
  const wasGranted = cell.isGranted;
  cell.isGranted = false;
  persistMockState();
  return wasGranted;
}

/** The inverse, so a test or e2e spec can set the starting state (marketing email ON). */
export function grantMarketingConsent(customerId: string, channel: 'Email' | 'Sms'): void {
  const cell = customers
    .get(customerId)
    ?.preferences.find(
      (p) => p.category === 'Marketing' && p.channel.toLowerCase() === channel.toLowerCase(),
    );
  if (cell) {
    cell.isGranted = true;
    persistMockState();
  }
}

function requireCustomerSession(request: Request): StoredCustomer | null {
  const token = getCookie(request, 'pc_session');
  const session = token ? customerSessions.get(token) : undefined;
  if (!session) return null;
  return customers.get(session.customerId) ?? null;
}

function requireStaffSession(
  request: Request,
): { staff: StoredStaffAccount; session: StaffSessionRecord; token: string } | null {
  const token = getCookie(request, 'pc_staff_session');
  if (!token) return null;
  const session = staffSessions.get(token);
  if (!session) return null;
  const staff = staffAccounts.get(session.staffAccountId);
  if (!staff) return null;
  return { staff, session, token };
}

function isIdleExpired(session: StaffSessionRecord): boolean {
  if (session.forcedIdleExpired) return true;
  const elapsedMs = Date.now() - new Date(session.lastActivityOn).getTime();
  return elapsedMs > session.idleTimeoutMinutes * 60_000;
}

/**
 * ARCH gate HIGH (second pass) — the real API ends the staff session on the FIRST idle-timeout
 * detection (`SessionAuthenticationMiddleware`'s `EndForIdleTimeout` + `cookieWriter.
 * ExpireStaffSession`) and expires `pc_staff_session`; every LATER call then finds no session at
 * all and reports `session_invalid`, never `session_idle_timeout` again. This mock used to leave
 * the session (and `forcedIdleExpired`) in place forever, so every later call kept reporting
 * `session_idle_timeout` — masking the real gap this gate found (`IdleLock`/`StaffSessionGuard`
 * never actually had to handle `session_invalid` while locked, because the mock never sent it).
 * Deleting the session here, on this same first-detection response, and expiring the cookie on it,
 * makes every one of the three call sites below match production exactly: this one 401 is
 * `session_idle_timeout`; every subsequent one is `session_invalid`.
 */
function endStaffSessionForIdleTimeout(token: string, idleTimeoutMinutes: number) {
  staffSessions.delete(token);
  persistMockState();
  return HttpResponse.json(
    { error: 'session_idle_timeout', idleTimeoutMinutes },
    {
      status: 401,
      headers: [['Cache-Control', 'no-store'], expireCookieHeader('pc_staff_session')],
    },
  );
}

function staffStatusBody(session: StaffSessionRecord, staff: StoredStaffAccount) {
  const idleExpiresOn = new Date(
    new Date(session.lastActivityOn).getTime() + session.idleTimeoutMinutes * 60_000,
  );
  return {
    staffAccountId: staff.id,
    fullName: staff.fullName,
    roleIds: staff.roleIds,
    issuedOn: session.issuedOn,
    lastActivityOn: session.lastActivityOn,
    idleExpiresOn: iso(idleExpiresOn),
    absoluteExpiresOn: session.absoluteExpiresOn,
    idleTimeoutMinutes: session.idleTimeoutMinutes,
    serverTime: iso(now()),
  };
}

/** HO-P5 BG-22 -- no password is NotSetUp, a lockout still running is Locked, otherwise Active
 *  (Shared/Helpers/StaffAccountStatusRules.cs:11-15). */
function staffAccountStatus(staff: StoredStaffAccount, asOfMs: number): 'Active' | 'NotSetUp' | 'Locked' {
  if (!staff.password) return 'NotSetUp';
  return staff.lockedUntil && asOfMs < new Date(staff.lockedUntil).getTime() ? 'Locked' : 'Active';
}

/** Test seam: puts a sign-in lockout on a staff account so the list reads `Locked` (the mock has no lockout of its own). */
export function setMockStaffLockedUntil(staffAccountId: string, lockedUntil: string | null): void {
  const staff = staffAccounts.get(staffAccountId);
  if (staff) {
    staff.lockedUntil = lockedUntil;
    persistMockState();
  }
}

export interface MockStaffBranch {
  id: string;
  name: string;
  isPrimary: boolean;
}

/**
 * HO-P5 BG-22 -- the assigned branches of a staff account, the primary first and then by name (empty with no explicit
 * assignment). The assignments live in `mocks/handlers/admin/branches.ts`, which imports this module, so it registers
 * itself here instead of this file importing it (a cycle).
 */
let staffBranchesProvider: (staffAccountId: string) => MockStaffBranch[] = () => [];
export function registerStaffBranchesProvider(provider: (staffAccountId: string) => MockStaffBranch[]): void {
  staffBranchesProvider = provider;
}

const ROLE_CATALOGUE = {
  roleIds: ['Administrator', 'Reception', 'Inventory'],
  capabilities: ['Manage staff accounts', 'Register customers', 'Merge duplicate customers'],
  cells: [
    {
      capability: 'Manage staff accounts',
      roleId: 'Administrator',
      access: 'Full',
      qualifier: null,
    },
    { capability: 'Manage staff accounts', roleId: 'Reception', access: 'None', qualifier: null },
    { capability: 'Manage staff accounts', roleId: 'Inventory', access: 'None', qualifier: null },
    { capability: 'Register customers', roleId: 'Administrator', access: 'Full', qualifier: null },
    { capability: 'Register customers', roleId: 'Reception', access: 'Full', qualifier: null },
    { capability: 'Register customers', roleId: 'Inventory', access: 'None', qualifier: null },
    {
      capability: 'Merge duplicate customers',
      roleId: 'Administrator',
      access: 'Full',
      qualifier: null,
    },
    {
      capability: 'Merge duplicate customers',
      roleId: 'Reception',
      access: 'None',
      qualifier: null,
    },
    {
      capability: 'Merge duplicate customers',
      roleId: 'Inventory',
      access: 'None',
      qualifier: null,
    },
  ],
};

const ACTION_ROLES: Record<string, string[]> = {
  'StaffAccounts.View': ['Administrator'],
  'StaffAccounts.Create': ['Administrator'],
  'StaffAccounts.ChangeRoles': ['Administrator'],
  'StaffAccounts.SetPassword': ['Administrator'],
  'StaffAccounts.UpdateDetails': ['Administrator'],
  'Customers.View': ['Reception', 'Administrator'],
  'Customers.RegisterWalkIn': ['Reception', 'Administrator'],
  'Customers.Merge': ['Administrator'],
  // HO-P5 BG-19 -- Shared/Constants/ActionRoles.Accounts.cs:33-35.
  'Customers.AddNote': ['Reception', 'Administrator'],
  'Customers.SetTags': ['Reception', 'Administrator'],
  'Customers.RequestPasswordReset': ['Reception', 'Administrator'],
};

function forbidden() {
  return HttpResponse.json(
    {
      errors: [
        {
          errorCode: 'ActionNotPermitted',
          errorMessage: 'You are not permitted to perform this action.',
        },
      ],
    },
    { status: 403 },
  );
}

function requireAction(
  request: Request,
  action: string,
): { staff: StoredStaffAccount; session: StaffSessionRecord } | Response {
  const resolved = requireStaffSession(request);
  if (!resolved) return unauthorized({ error: 'session_invalid' });
  if (isIdleExpired(resolved.session))
    return endStaffSessionForIdleTimeout(resolved.token, resolved.session.idleTimeoutMinutes);
  const allowedRoles = ACTION_ROLES[action] ?? [];
  const permitted = allowedRoles.some((r) => resolved.staff.roleIds.includes(r));
  return permitted ? resolved : forbidden();
}

/** Integer minor units as the server's money string ("4250.00"). */
function centsText(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}${Math.trunc(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

/** `IdentifierMasking.Mask` (Shared/Helpers/IdentifierMasking.cs:11-24): `s***@example.com`, or `***` and the last three
 *  characters of a number. This is what the staff-started reset reports instead of the raw destination. */
function maskIdentifier(identifier: string): string {
  const at = identifier.indexOf('@');
  if (at >= 0) return `${identifier.charAt(0)}***${identifier.slice(at)}`;
  return `***${identifier.length >= 3 ? identifier.slice(-3) : identifier}`;
}

/** `CustomerStaffRecordSupport.EnsureActiveCustomerAsync` (CustomerStaffRecordCommandHandlers.cs:108-125): a missing customer
 *  and a merged or anonymised one are each a 400 on `CustomerId`, not a 404. */
function staffRecordRefusal(customer: StoredCustomer | undefined) {
  if (!customer)
    return validationError('CustomerId', 'CustomerNotFound', 'This customer record was not found.', 'CustomerStaffRecordAggregate');
  if (customer.status !== 'Active')
    return validationError('CustomerId', 'AccountNotActive', 'This account is not active.', 'CustomerStaffRecordAggregate');
  return null;
}

// -------------------------------------------------------------------------------------------
// Handlers
// -------------------------------------------------------------------------------------------

export const accountsHandlers: HttpHandler[] = [
  // POST /api/captcha
  http.post('*/api/captcha', () => {
    const captchaId = crypto.randomUUID();
    consumedCaptchas.set(captchaId, 'ABCDE'); // fixed test answer; wrong answer is anything else
    return HttpResponse.json(
      {
        captchaId,
        imageDataUrl: MOCK_CAPTCHA_IMAGE,
        expiresInSeconds: 120,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }),

  // POST /api/customers — registration, C1
  http.post('*/api/customers', async ({ request }) => {
    const body = (await request.json()) as {
      fullName: string;
      mobileNumber?: string | null;
      emailAddress?: string | null;
      password: string;
      captchaId?: string | null;
      captchaAnswer?: string | null;
    };

    if (body.emailAddress === accountsFixtureIds.trigger429Email) return tooManyRequests(540);
    if (body.emailAddress === accountsFixtureIds.trigger500)
      return HttpResponse.json({ error: 'internal' }, { status: 500 });

    // CAPTCHA: consumed unconditionally on every submit that reaches here (ADR-029/ADR-FE-006).
    const expectedAnswer = body.captchaId ? consumedCaptchas.get(body.captchaId) : undefined;
    if (body.captchaId) consumedCaptchas.delete(body.captchaId);
    if (!body.captchaId || !body.captchaAnswer)
      return validationError(
        'CaptchaAnswer',
        'CaptchaRequired',
        'A security check answer is required.',
      );
    if (
      expectedAnswer === undefined ||
      body.captchaAnswer.trim().toUpperCase() !== expectedAnswer
    ) {
      return validationError(
        'CaptchaAnswer',
        'CaptchaInvalid',
        "The characters didn't match, or the code expired. Type the new code shown.",
      );
    }

    if (body.mobileNumber && findCustomerByIdentifier(body.mobileNumber)) {
      return validationError(
        'MobileNumber',
        'MobileNumberAlreadyRegistered',
        'This mobile number is already registered. You can log in, or reset your password.',
      );
    }
    if (body.emailAddress && findCustomerByIdentifier(body.emailAddress)) {
      return validationError(
        'EmailAddress',
        'EmailAddressAlreadyRegistered',
        'This email address is already registered. You can log in, or reset your password.',
      );
    }
    if (body.password === accountsFixtureIds.triggerBreachedPassword) {
      return validationError(
        'Password',
        'BreachedPassword',
        'This password has appeared in a data breach. Choose a different one.',
      );
    }
    if (body.password.length < 10) {
      return validationError(
        'Password',
        'PasswordTooShort',
        `Your password must be at least 10 characters (you entered ${body.password.length}).`,
      );
    }

    const id = crypto.randomUUID();
    customers.set(id, {
      id,
      fullName: body.fullName,
      mobileNumber: body.mobileNumber ?? null,
      emailAddress: body.emailAddress ?? null,
      additionalPhoneNumbers: [],
      password: hashPassword(body.password),
      canEditEmail: true,
      registeredOn: iso(now()),
      registrationChannel: 'SelfService',
      status: 'Active',
      mergedIntoCustomerId: null,
      addresses: [],
      preferences: seedPreferences(),
    });
    persistMockState();
    return HttpResponse.json({ customerId: id }, { status: 201 });
  }),

  // POST /api/auth/sign-in — C2
  http.post('*/api/auth/sign-in', async ({ request }) => {
    const body = (await request.json()) as { identifier: string; password: string };
    if (body.identifier === accountsFixtureIds.trigger429) return tooManyRequests(60);

    const customer = findCustomerByIdentifier(body.identifier);
    if (
      !customer ||
      !passwordMatches(customer.password, body.password) ||
      customer.status !== 'Active'
    ) {
      return unauthorized({
        error: 'invalid_credentials',
        message: 'The identifier or password is incorrect.',
      });
    }

    const token = crypto.randomUUID();
    const csrfToken = crypto.randomUUID();
    const expiresOn = iso(new Date(Date.now() + 168 * 60 * 60 * 1000));
    customerSessions.set(token, { customerId: customer.id, expiresOn, csrfToken });
    persistMockState();

    return HttpResponse.json(
      { customerId: customer.id, expiresOn },
      {
        headers: [
          ...sessionCookieHeaders('pc_session', token, expiresOn),
          csrfCookieHeader(csrfToken, expiresOn),
        ],
      },
    );
  }),

  // POST /api/auth/sign-out — C3
  http.post('*/api/auth/sign-out', ({ request }) => {
    const token = getCookie(request, 'pc_session');
    if (token) customerSessions.delete(token);
    persistMockState();
    return new HttpResponse(null, {
      status: 204,
      headers: [expireCookieHeader('pc_session'), expireCookieHeader('pc_csrf')],
    });
  }),

  // GET /api/auth/session — Q-C1
  http.get('*/api/auth/session', ({ request }) => {
    const token = getCookie(request, 'pc_session');
    const session = token ? customerSessions.get(token) : undefined;
    if (!session) return unauthorized({ error: 'session_invalid' });
    const customer = customers.get(session.customerId);
    if (!customer) return unauthorized({ error: 'session_invalid' });
    return HttpResponse.json({
      customerId: customer.id,
      fullName: customer.fullName,
      expiresOn: session.expiresOn,
      recordStatus: customer.password ? 'Complete' : 'Incomplete',
    });
  }),

  // POST /api/auth/password-reset/request and /api/staff/auth/password-reset/request — C4, R3
  http.post('*/api/auth/password-reset/request', () =>
    HttpResponse.json({
      message: "If an account matches, we've sent a link to reset the password.",
    }),
  ),
  http.post('*/api/staff/auth/password-reset/request', () =>
    HttpResponse.json({
      message: "If an account matches, we've sent a link to reset the password.",
    }),
  ),

  // POST /api/auth/password-reset/confirm — C5
  http.post('*/api/auth/password-reset/confirm', async ({ request }) => {
    const body = (await request.json()) as { token: string; newPassword: string };
    if (body.token === 'expired-token') {
      return validationError(
        'Token',
        'InvalidPasswordResetToken',
        'This link is invalid or has expired.',
      );
    }
    if (body.newPassword === accountsFixtureIds.triggerBreachedPassword) {
      return validationError(
        'NewPassword',
        'BreachedPassword',
        'This password has appeared in a data breach. Choose a different one.',
      );
    }
    if (body.newPassword.length < 10) {
      return validationError(
        'NewPassword',
        'PasswordTooShort',
        `Your password must be at least 10 characters (you entered ${body.newPassword.length}).`,
      );
    }
    if (body.token === 'valid-customer-token') {
      const customer = customers.get(accountsFixtureIds.customerId);
      if (customer) customer.password = hashPassword(body.newPassword);
    }
    persistMockState();
    return new HttpResponse(null, { status: 204 });
  }),

  // GET/PUT /api/customers/me — Q-C2/C6
  http.get('*/api/customers/me', ({ request }) => {
    const customer = requireCustomerSession(request);
    if (!customer) return unauthorized({ error: 'session_invalid' });
    return HttpResponse.json({
      fullName: customer.fullName,
      mobileNumber: customer.mobileNumber,
      emailAddress: customer.emailAddress,
      hasMobileNumber: !!customer.mobileNumber,
      hasEmailAddress: !!customer.emailAddress,
      canEditEmail: customer.canEditEmail,
      additionalPhoneNumbers: customer.additionalPhoneNumbers,
      registeredOn: customer.registeredOn,
    });
  }),

  http.put('*/api/customers/me', async ({ request }) => {
    const customer = requireCustomerSession(request);
    if (!customer) return unauthorized({ error: 'session_invalid' });

    const body = (await request.json()) as {
      fullName: string;
      emailAddress: string | null;
      additionalPhoneNumbers: string[];
      currentPassword?: string | null;
    };

    if (body.fullName === 'TRIGGER_429_PROFILE') return tooManyRequests(300);

    const emailChanging = (body.emailAddress ?? null) !== customer.emailAddress;
    if (emailChanging && !passwordMatches(customer.password, body.currentPassword)) {
      return validationError(
        'CurrentPassword',
        'ReauthenticationFailed',
        'That current password is incorrect.',
      );
    }

    const anotherPrimaryMatch = [...customers.values()].some(
      (c) =>
        c.id !== customer.id &&
        c.status === 'Active' &&
        body.additionalPhoneNumbers.includes(c.mobileNumber ?? ''),
    );
    if (anotherPrimaryMatch) {
      return validationError(
        'AdditionalPhoneNumbers',
        'AdditionalPhoneNumberMatchesAnotherCustomer',
        "That number is already someone else's primary mobile number.",
      );
    }
    if (body.additionalPhoneNumbers.length > 3) {
      return validationError(
        'AdditionalPhoneNumbers',
        'AdditionalPhoneNumberLimitExceeded',
        'No more than 3 additional phone numbers are allowed.',
      );
    }

    customer.fullName = body.fullName;
    customer.emailAddress = body.emailAddress;
    customer.additionalPhoneNumbers = body.additionalPhoneNumbers;
    persistMockState();
    return new HttpResponse(null, { status: 204 });
  }),

  // GET/POST /api/customers/me/addresses — Q-E1/C7
  http.get('*/api/customers/me/addresses', ({ request }) => {
    const customer = requireCustomerSession(request);
    if (!customer) return unauthorized({ error: 'session_invalid' });
    return HttpResponse.json({ addresses: customer.addresses, maxAddresses: MAX_ADDRESSES });
  }),

  http.post('*/api/customers/me/addresses', async ({ request }) => {
    const customer = requireCustomerSession(request);
    if (!customer) return unauthorized({ error: 'session_invalid' });
    if (customer.addresses.length >= MAX_ADDRESSES) {
      return validationError(
        'AddressId',
        'DeliveryAddressLimitExceeded',
        `You already have the maximum of ${MAX_ADDRESSES} addresses.`,
      );
    }
    const body = (await request.json()) as {
      label: string;
      line1: string;
      line2?: string | null;
      city: string;
      district: string;
      postalCode?: string | null;
      deliveryInstructions?: string | null;
    };
    const id = crypto.randomUUID();
    customer.addresses.push({
      id,
      label: body.label,
      line1: body.line1,
      line2: body.line2 ?? null,
      city: body.city,
      district: body.district,
      postalCode: body.postalCode ?? null,
      deliveryInstructions: body.deliveryInstructions ?? null,
      isDefault: customer.addresses.length === 0,
    });
    persistMockState();
    return HttpResponse.json({ addressId: id }, { status: 201 });
  }),

  http.put('*/api/customers/me/addresses/:addressId', async ({ request, params }) => {
    const customer = requireCustomerSession(request);
    if (!customer) return unauthorized({ error: 'session_invalid' });
    const address = customer.addresses.find((a) => a.id === params.addressId);
    if (!address) return new HttpResponse(null, { status: 404 });
    const body = (await request.json()) as {
      label: string;
      line1: string;
      line2?: string | null;
      city: string;
      district: string;
      postalCode?: string | null;
      deliveryInstructions?: string | null;
    };
    Object.assign(address, {
      ...body,
      line2: body.line2 ?? null,
      postalCode: body.postalCode ?? null,
      deliveryInstructions: body.deliveryInstructions ?? null,
    });
    persistMockState();
    return new HttpResponse(null, { status: 204 });
  }),

  http.delete('*/api/customers/me/addresses/:addressId', ({ request, params }) => {
    const customer = requireCustomerSession(request);
    if (!customer) return unauthorized({ error: 'session_invalid' });
    const address = customer.addresses.find((a) => a.id === params.addressId);
    if (!address) return new HttpResponse(null, { status: 404 });
    if (address.isDefault && customer.addresses.length > 1) {
      return validationError(
        'AddressId',
        'DefaultAddressCannotBeRemoved',
        'Set another address as default before removing this one.',
      );
    }
    customer.addresses = customer.addresses.filter((a) => a.id !== params.addressId);
    persistMockState();
    return new HttpResponse(null, { status: 204 });
  }),

  http.put('*/api/customers/me/addresses/:addressId/default', ({ request, params }) => {
    const customer = requireCustomerSession(request);
    if (!customer) return unauthorized({ error: 'session_invalid' });
    const target = customer.addresses.find((a) => a.id === params.addressId);
    if (!target) return new HttpResponse(null, { status: 404 });
    customer.addresses.forEach((a) => (a.isDefault = a.id === params.addressId));
    persistMockState();
    return new HttpResponse(null, { status: 204 });
  }),

  // GET/PUT /api/customers/me/notification-preferences — Q-E2/C8
  http.get('*/api/customers/me/notification-preferences', ({ request }) => {
    const customer = requireCustomerSession(request);
    if (!customer) return unauthorized({ error: 'session_invalid' });
    return HttpResponse.json(preferencesBody(customer));
  }),

  http.put('*/api/customers/me/notification-preferences', async ({ request }) => {
    const customer = requireCustomerSession(request);
    if (!customer) return unauthorized({ error: 'session_invalid' });
    const body = (await request.json()) as {
      changes: Array<{ channel: string; category: string; isGranted: boolean }>;
      preferredChannel?: string | null;
    };
    // HO-NTF-002 §11.2 / HO-NTF-001 §12.4 — validate the preferred channel before touching anything.
    if (body.preferredChannel) {
      if (body.preferredChannel !== 'Sms' && body.preferredChannel !== 'Email') {
        return validationError(
          'PreferredChannel',
          'InvalidPreferredChannel',
          'Choose text message or email.',
        );
      }
      if (!availablePreferredChannels(customer).includes(body.preferredChannel)) {
        return validationError(
          'PreferredChannel',
          'PreferredChannelHasNoDestination',
          body.preferredChannel === 'Email'
            ? 'Add an email address to your profile to choose email.'
            : 'Add a mobile number to your profile to choose text messages.',
        );
      }
    }
    for (const change of body.changes ?? []) {
      const cell = customer.preferences.find(
        (p) => p.channel === change.channel && p.category === change.category,
      );
      if (!cell) continue;
      if (cell.isAlwaysOn) {
        return validationError(
          'Changes',
          'NotificationPreferenceNotEditable',
          'This preference cannot be changed.',
        );
      }
      cell.isGranted = change.isGranted;
    }
    if (body.preferredChannel) customer.preferredChannel = body.preferredChannel as 'Sms' | 'Email';
    persistMockState();
    return new HttpResponse(null, { status: 204 });
  }),

  // POST /api/customers/me/personal-data-export — C17/Q-J1
  http.post('*/api/customers/me/personal-data-export', ({ request }) => {
    const customer = requireCustomerSession(request);
    if (!customer) return unauthorized({ error: 'session_invalid' });
    return HttpResponse.json(
      {
        schemaVersion: 1,
        exportedOn: iso(now()),
        profile: {
          fullName: customer.fullName,
          mobileNumber: customer.mobileNumber,
          emailAddress: customer.emailAddress,
          hasMobileNumber: !!customer.mobileNumber,
          hasEmailAddress: !!customer.emailAddress,
          canEditEmail: customer.canEditEmail,
          additionalPhoneNumbers: customer.additionalPhoneNumbers,
          registeredOn: customer.registeredOn,
        },
        addresses: customer.addresses,
        notificationPreferences: customer.preferences,
      },
      {
        headers: {
          'Cache-Control': 'no-store',
          'Content-Disposition': 'attachment; filename="amargram-my-data.json"',
        },
      },
    );
  }),

  // POST /api/customers/me/deletion — C18
  http.post('*/api/customers/me/deletion', async ({ request }) => {
    const customer = requireCustomerSession(request);
    if (!customer) return unauthorized({ error: 'session_invalid' });
    const body = (await request.json()) as { currentPassword: string };
    if (!passwordMatches(customer.password, body.currentPassword)) {
      return validationError(
        'CurrentPassword',
        'ReauthenticationFailed',
        'That current password is incorrect.',
      );
    }
    customer.status = 'Anonymised';
    customer.password = null;
    const token = getCookie(request, 'pc_session');
    if (token) customerSessions.delete(token);
    persistMockState();
    return new HttpResponse(null, {
      status: 204,
      headers: [expireCookieHeader('pc_session'), expireCookieHeader('pc_csrf')],
    });
  }),

  // GET /api/staff-roles — Q-F1
  http.get('*/api/staff-roles', ({ request }) => {
    const resolved = requireAction(request, 'StaffAccounts.View');
    if (resolved instanceof Response) return resolved;
    return HttpResponse.json(ROLE_CATALOGUE);
  }),

  // GET/POST /api/staff-accounts — Q-F2/C9
  http.get('*/api/staff-accounts', ({ request }) => {
    const resolved = requireAction(request, 'StaffAccounts.View');
    if (resolved instanceof Response) return resolved;
    const url = new URL(request.url);
    const search = url.searchParams.get('search');
    const roleId = url.searchParams.get('roleId');
    const pageNumber = Number(url.searchParams.get('pageNumber') ?? '1');
    const pageSize = Number(url.searchParams.get('pageSize') ?? '20');
    const pagingError = validatePagingParams(pageNumber, pageSize);
    if (pagingError) return pagingError;

    let rows = [...staffAccounts.values()];
    if (search) rows = rows.filter((s) => s.fullName.toLowerCase().includes(search.toLowerCase()));
    if (roleId) rows = rows.filter((s) => s.roleIds.includes(roleId));
    const totalCount = rows.length;
    const start = (pageNumber - 1) * pageSize;
    const asOf = Date.now();
    // HO-P5 BG-22 -- Read/QueryHandlers/Account/GetStaffAccountsQueryHandler.cs:36-47.
    const items = rows.slice(start, start + pageSize).map((s) => ({
      id: s.id,
      fullName: s.fullName,
      mobileNumber: s.mobileNumber,
      emailAddress: s.emailAddress,
      roleIds: s.roleIds,
      hasPassword: !!s.password,
      status: staffAccountStatus(s, asOf),
      branches: staffBranchesProvider(s.id),
    }));
    return HttpResponse.json({ items, pageNumber, pageSize, totalCount });
  }),

  http.get('*/api/staff-accounts/:staffAccountId', ({ request, params }) => {
    const resolved = requireAction(request, 'StaffAccounts.View');
    if (resolved instanceof Response) return resolved;
    const staff = staffAccounts.get(params.staffAccountId as string);
    if (!staff) return new HttpResponse(null, { status: 404 });
    return HttpResponse.json({
      id: staff.id,
      fullName: staff.fullName,
      mobileNumber: staff.mobileNumber,
      emailAddress: staff.emailAddress,
      roleIds: staff.roleIds,
      hasPassword: !!staff.password,
    });
  }),

  http.post('*/api/staff-accounts', async ({ request }) => {
    const resolved = requireAction(request, 'StaffAccounts.Create');
    if (resolved instanceof Response) return resolved;
    const body = (await request.json()) as {
      fullName: string;
      mobileNumber?: string | null;
      emailAddress?: string | null;
      roleIds: string[];
      password?: string | null;
    };
    if (body.roleIds.length === 0)
      return validationError('RoleIds', 'StaffRolesRequired', 'Select at least one role.');
    if (body.password != null && body.password.length < 10)
      return validationError(
        'Password',
        'PasswordTooShort',
        'Password must be at least 10 characters.',
      );
    const id = crypto.randomUUID();
    staffAccounts.set(id, {
      id,
      fullName: body.fullName,
      mobileNumber: body.mobileNumber ?? null,
      emailAddress: body.emailAddress ?? null,
      password: body.password ?? null,
      roleIds: body.roleIds,
    });
    persistMockState();
    return HttpResponse.json({ staffAccountId: id }, { status: 201 });
  }),

  // PUT /api/staff-accounts/{id} — owner, 2026-10-20: the administrator edits name, mobile and email.
  http.put('*/api/staff-accounts/:staffAccountId', async ({ request, params }) => {
    const resolved = requireAction(request, 'StaffAccounts.UpdateDetails');
    if (resolved instanceof Response) return resolved;
    const staff = staffAccounts.get(params.staffAccountId as string);
    if (!staff) return new HttpResponse(null, { status: 404 });
    const body = (await request.json()) as {
      fullName: string;
      mobileNumber?: string | null;
      emailAddress?: string | null;
    };
    const mobile = body.mobileNumber?.trim() || null;
    const email = body.emailAddress?.trim().toLowerCase() || null;
    if (!body.fullName?.trim())
      return validationError('FullName', 'NameRequired', 'A name is required.');
    if (!mobile && !email)
      return validationError(
        'MobileNumber',
        'IdentifierRequired',
        'At least one of a mobile number or email address is required.',
      );
    const others = [...staffAccounts.values()].filter((s) => s.id !== staff.id);
    if (mobile && others.some((s) => s.mobileNumber === mobile))
      return validationError(
        'MobileNumber',
        'MobileNumberAlreadyRegistered',
        'This mobile number is already registered to a staff account.',
      );
    if (email && others.some((s) => s.emailAddress?.toLowerCase() === email))
      return validationError(
        'EmailAddress',
        'EmailAddressAlreadyRegistered',
        'This email address is already registered to a staff account.',
      );
    staff.fullName = body.fullName.trim();
    staff.mobileNumber = mobile;
    staff.emailAddress = email;
    persistMockState();
    return new HttpResponse(null, { status: 204 });
  }),

  // PUT /api/staff-accounts/{id}/password — owner, 2026-10-19
  http.put('*/api/staff-accounts/:staffAccountId/password', async ({ request, params }) => {
    const resolved = requireAction(request, 'StaffAccounts.SetPassword');
    if (resolved instanceof Response) return resolved;
    const staff = staffAccounts.get(params.staffAccountId as string);
    if (!staff) return new HttpResponse(null, { status: 404 });
    const body = (await request.json()) as { password: string };
    if (!body.password || body.password.length < 10)
      return validationError(
        'NewPassword',
        'PasswordTooShort',
        'Password must be at least 10 characters.',
      );
    staff.password = body.password;
    persistMockState();
    return new HttpResponse(null, { status: 204 });
  }),

  http.put('*/api/staff-accounts/:staffAccountId/roles', async ({ request, params }) => {
    const resolved = requireAction(request, 'StaffAccounts.ChangeRoles');
    if (resolved instanceof Response) return resolved;
    const staff = staffAccounts.get(params.staffAccountId as string);
    if (!staff) return new HttpResponse(null, { status: 404 });
    const body = (await request.json()) as { roleIds: string[] };
    if (body.roleIds.length === 0)
      return validationError('RoleIds', 'StaffRolesRequired', 'Select at least one role.');

    const isLastAdmin =
      staff.roleIds.includes('Administrator') &&
      !body.roleIds.includes('Administrator') &&
      [...staffAccounts.values()].filter((s) => s.roleIds.includes('Administrator')).length <= 1;
    if (isLastAdmin) {
      return validationError(
        'RoleIds',
        'LastAdministratorCannotBeRemoved',
        'At least one administrator must remain.',
      );
    }
    staff.roleIds = body.roleIds;
    persistMockState();
    return new HttpResponse(null, { status: 204 });
  }),

  // POST /api/staff/auth/sign-in — C12
  http.post('*/api/staff/auth/sign-in', async ({ request }) => {
    const body = (await request.json()) as { identifier: string; password: string };
    if (body.identifier === accountsFixtureIds.trigger429) return tooManyRequests(60);

    const staff = [...staffAccounts.values()].find(
      (s) => s.mobileNumber === body.identifier || s.emailAddress === body.identifier,
    );
    if (!staff || !passwordMatches(staff.password, body.password)) {
      return unauthorized({
        error: 'invalid_credentials',
        message: 'The identifier or password is incorrect.',
      });
    }

    const token = crypto.randomUUID();
    const csrfToken = crypto.randomUUID();
    const issuedOn = iso(now());
    const absoluteExpiresOn = iso(new Date(Date.now() + 12 * 60 * 60 * 1000));
    staffSessions.set(token, {
      staffAccountId: staff.id,
      issuedOn,
      lastActivityOn: issuedOn,
      absoluteExpiresOn,
      csrfToken,
      idleTimeoutMinutes: 30,
      forcedIdleExpired: false,
    });
    persistMockState();

    return HttpResponse.json(
      { staffAccountId: staff.id, expiresOn: absoluteExpiresOn },
      {
        headers: [
          ...sessionCookieHeaders('pc_staff_session', token, absoluteExpiresOn),
          csrfCookieHeader(csrfToken, absoluteExpiresOn),
        ],
      },
    );
  }),

  // POST /api/staff/auth/sign-out — C13
  http.post('*/api/staff/auth/sign-out', ({ request }) => {
    const token = getCookie(request, 'pc_staff_session');
    if (token) staffSessions.delete(token);
    persistMockState();
    return new HttpResponse(null, {
      status: 204,
      headers: [expireCookieHeader('pc_staff_session'), expireCookieHeader('pc_csrf')],
    });
  }),

  // GET /api/staff/session — Q-G1 [PassiveSession]
  http.get('*/api/staff/session', ({ request }) => {
    const resolved = requireStaffSession(request);
    if (!resolved) return unauthorized({ error: 'session_invalid' });
    if (isIdleExpired(resolved.session))
      return endStaffSessionForIdleTimeout(resolved.token, resolved.session.idleTimeoutMinutes);
    return HttpResponse.json(staffStatusBody(resolved.session, resolved.staff), {
      headers: { 'Cache-Control': 'no-store' },
    });
  }),

  // POST /api/staff/session/activity
  http.post('*/api/staff/session/activity', ({ request }) => {
    const resolved = requireStaffSession(request);
    if (!resolved) return unauthorized({ error: 'session_invalid' });
    if (isIdleExpired(resolved.session))
      return endStaffSessionForIdleTimeout(resolved.token, resolved.session.idleTimeoutMinutes);
    resolved.session.lastActivityOn = iso(now());
    persistMockState();
    return HttpResponse.json(staffStatusBody(resolved.session, resolved.staff));
  }),

  // POST /api/staff/customers — C15, US-ACC-10
  http.post('*/api/staff/customers', async ({ request }) => {
    const resolved = requireAction(request, 'Customers.RegisterWalkIn');
    if (resolved instanceof Response) return resolved;
    const body = (await request.json()) as { fullName: string; mobileNumber: string };

    // Only a PRIMARY-number match refuses (HO-ACC-001 §1 Amended (16)) — an additional-number-only
    // hit succeeds (201).
    const primaryMatch = [...customers.values()].some(
      (c) => c.status === 'Active' && c.mobileNumber === body.mobileNumber,
    );
    if (primaryMatch) {
      return validationError(
        'MobileNumber',
        'MobileNumberAlreadyRegistered',
        'This mobile number is already registered. You can log in, or reset your password.',
      );
    }

    const id = crypto.randomUUID();
    customers.set(id, {
      id,
      fullName: body.fullName,
      mobileNumber: body.mobileNumber,
      emailAddress: null,
      additionalPhoneNumbers: [],
      password: null,
      canEditEmail: true,
      registeredOn: iso(now()),
      registrationChannel: 'Reception',
      status: 'Active',
      mergedIntoCustomerId: null,
      addresses: [],
      preferences: seedPreferences(),
    });
    persistMockState();
    return HttpResponse.json({ customerId: id }, { status: 201 });
  }),

  // GET /api/staff/customers?mobile=&email= — Q-H2
  http.get('*/api/staff/customers', ({ request }) => {
    const resolved = requireAction(request, 'Customers.View');
    if (resolved instanceof Response) return resolved;
    const url = new URL(request.url);
    const mobile = url.searchParams.get('mobile');
    const email = url.searchParams.get('email');
    if (!mobile && !email) return HttpResponse.json([]);

    const rows = [...customers.values()].filter(
      (c) =>
        (mobile && (c.mobileNumber === mobile || c.additionalPhoneNumbers.includes(mobile))) ||
        (email && c.emailAddress === email),
    );
    return HttpResponse.json(
      rows.slice(0, 10).map((c) => ({
        id: c.id,
        fullName: c.fullName,
        mobileNumber: c.mobileNumber,
        emailAddress: c.emailAddress,
        recordStatus: c.password ? 'Complete' : 'Incomplete',
        status: c.status,
        mobileMatchedOn: !mobile
          ? null
          : c.mobileNumber === mobile
            ? 'Primary'
            : c.additionalPhoneNumbers.includes(mobile)
              ? 'Additional'
              : null,
      })),
    );
  }),

  // GET /api/staff/customers/duplicates — Q-I1
  http.get('*/api/staff/customers/duplicates', ({ request }) => {
    const resolved = requireAction(request, 'Customers.Merge');
    if (resolved instanceof Response) return resolved;
    const url = new URL(request.url);
    const pageNumber = Number(url.searchParams.get('pageNumber') ?? '1');
    const pageSize = Number(url.searchParams.get('pageSize') ?? '20');
    const pagingError = validatePagingParams(pageNumber, pageSize);
    if (pagingError) return pagingError;
    const a = customers.get(accountsFixtureIds.duplicateGroupCustomerA)!;
    const b = customers.get(accountsFixtureIds.duplicateGroupCustomerB)!;
    // CR MEDIUM 2 (first-pass gate fix round, item 13) — recordStatus/registrationChannel per
    // member, matching GetDuplicateCustomerGroupsQueryHandler's own extension.
    const toMember = (c: StoredCustomer) => ({
      customerId: c.id,
      fullName: c.fullName,
      mobileNumber: c.mobileNumber,
      emailAddress: c.emailAddress,
      mobileMatchedOn: 'Primary' as const,
      recordStatus: c.password ? ('Complete' as const) : ('Incomplete' as const),
      registrationChannel: c.registrationChannel,
    });
    return HttpResponse.json({
      items: [{ members: [toMember(a), toMember(b)] }],
      pageNumber: 1,
      pageSize: 20,
      totalCount: 1,
    });
  }),

  // GET /api/staff/customers/browse — HO-P5 BG-19. Registered before `:customerId` so "browse" is not read as an id.
  // StaffCustomersController.cs:52-74; BrowseCustomersQueryHandler.cs:17-71.
  http.get('*/api/staff/customers/browse', ({ request }) => {
    const resolved = requireAction(request, 'Customers.View');
    if (resolved instanceof Response) return resolved;
    const url = new URL(request.url);
    const search = url.searchParams.get('search');
    const tag = url.searchParams.get('tag');
    const sort = url.searchParams.get('sort');
    const pageNumberText = url.searchParams.get('pageNumber');
    const pageSizeText = url.searchParams.get('pageSize');
    const requestedPage = pageNumberText === null ? undefined : Number(pageNumberText);
    const requestedSize = pageSizeText === null ? undefined : Number(pageSizeText);
    // The same four refusals, in the controller's order, with its `{ error }` body (a bare 400, not a ValidationResponse).
    if (requestedPage !== undefined && requestedPage > 1_000_000)
      return HttpResponse.json({ error: 'pageNumber cannot exceed 1000000.' }, { status: 400 });
    if (requestedSize !== undefined && requestedSize > 100)
      return HttpResponse.json({ error: 'pageSize cannot exceed 100.' }, { status: 400 });
    if (sort !== null && sort !== 'recent' && sort !== 'name')
      return HttpResponse.json({ error: "sort must be 'recent' or 'name'." }, { status: 400 });
    if ((search !== null && search.length > 100) || (tag !== null && tag.length > 100))
      return HttpResponse.json({ error: 'search and tag cannot exceed 100 characters.' }, { status: 400 });

    const pageNumber = requestedPage && requestedPage > 0 ? requestedPage : 1;
    const pageSize = requestedSize && requestedSize > 0 ? requestedSize : 20;

    // Only active customers: a merged or anonymised record is not one staff browse to.
    let rows = [...customers.values()].filter((c) => c.status === 'Active');
    const term = search?.trim();
    if (term) {
      const lower = term.toLowerCase();
      const digits = term.replace(/\D/g, '');
      // A mobile matches only for a phone-like term ("01711 000", "+880-17…") with three or more digits, so a name with
      // digits in it does not hit random mobiles.
      const phoneLike = /^[\d +-]+$/.test(term) && digits.length >= 3;
      rows = rows.filter(
        (c) =>
          c.fullName.toLowerCase().includes(lower) ||
          (c.emailAddress ?? '').toLowerCase().includes(lower) ||
          (phoneLike && (c.mobileNumber ?? '').includes(digits)),
      );
    }
    const wantedTag = tag?.trim();
    if (wantedTag) rows = rows.filter((c) => (c.tags ?? []).includes(wantedTag));

    rows.sort(
      sort === 'name'
        ? (a, b) => a.fullName.localeCompare(b.fullName) || a.id.localeCompare(b.id)
        : (a, b) => b.registeredOn.localeCompare(a.registeredOn) || a.id.localeCompare(b.id),
    );
    const start = (pageNumber - 1) * pageSize;
    const items = rows.slice(start, start + pageSize).map((c) => ({
      id: c.id,
      fullName: c.fullName,
      mobileNumber: c.mobileNumber,
      emailAddress: c.emailAddress,
      recordStatus: c.password ? 'Complete' : 'Incomplete',
      status: c.status,
      customerSince: c.registeredOn,
      area: c.area ?? null,
      tags: c.tags ?? [],
    }));
    return HttpResponse.json({ items, pageNumber, pageSize, totalCount: rows.length });
  }),

  // GET /api/staff/customers/{id} — Q-H1 (+ HO-P5 BG-19 summary: StaffCustomerViewModel.cs:11-13)
  http.get('*/api/staff/customers/:customerId', ({ request, params }) => {
    const resolved = requireAction(request, 'Customers.View');
    if (resolved instanceof Response) return resolved;
    const customer = customers.get(params.customerId as string);
    if (!customer) return new HttpResponse(null, { status: 404 });
    return HttpResponse.json({
      id: customer.id,
      fullName: customer.fullName,
      mobileNumber: customer.mobileNumber,
      emailAddress: customer.emailAddress,
      recordStatus: customer.password ? 'Complete' : 'Incomplete',
      registrationChannel: customer.registrationChannel,
      status: customer.status,
      mergedIntoCustomerId: customer.mergedIntoCustomerId,
      customerSince: customer.registeredOn,
      area: customer.area ?? null,
      orderCount: customer.orderCount ?? 0,
      lifetimeSpend: { amount: centsText(customer.lifetimeSpendCents ?? 0), currencyCode: 'BDT' },
      tags: customer.tags ?? [],
      noteCount: (customer.notes ?? []).length,
    });
  }),

  // GET /api/staff/customers/{id}/notes — newest first; an unknown customer reads as an empty list (200),
  // as GetCustomerNotesQueryHandler.cs:66-86 does.
  http.get('*/api/staff/customers/:customerId/notes', ({ request, params }) => {
    const resolved = requireAction(request, 'Customers.View');
    if (resolved instanceof Response) return resolved;
    const notes = [...(customers.get(params.customerId as string)?.notes ?? [])]
      .sort((a, b) => b.createdOn.localeCompare(a.createdOn) || a.id.localeCompare(b.id))
      .map((n) => ({
        id: n.id,
        text: n.text,
        authorStaffId: n.authorStaffId,
        authorName: staffAccounts.get(n.authorStaffId)?.fullName ?? null,
        createdOn: n.createdOn,
      }));
    return HttpResponse.json(notes);
  }),

  // POST /api/staff/customers/{id}/notes — 201 { noteId }. Order: the command validator (shape), then the active-customer
  // check, then the aggregate (trim, 1-1000, 200 per customer): AddCustomerNoteCommandValidator,
  // CustomerStaffRecordCommandHandlers.cs:14-62, CustomerStaffRecordAggregate.cs:35-53.
  http.post('*/api/staff/customers/:customerId/notes', async ({ request, params }) => {
    const resolved = requireAction(request, 'Customers.AddNote');
    if (resolved instanceof Response) return resolved;
    const body = (await request.json().catch(() => ({}))) as { text?: string | null };
    const text = body.text ?? '';
    if (text.trim() === '')
      return validationError('Text', 'NotEmptyValidator', "'Text' must not be empty.", 'AddCustomerNoteCommand');
    if (text.length > 2000)
      return validationError(
        'Text',
        'MaximumLengthValidator',
        `The length of 'Text' must be 2000 characters or fewer. You entered ${text.length} characters.`,
        'AddCustomerNoteCommand',
      );
    const customer = customers.get(params.customerId as string);
    const refusal = staffRecordRefusal(customer);
    if (refusal) return refusal;
    const trimmed = text.trim();
    if (trimmed.length > 1000)
      return validationError('Text', 'InvalidCustomerNote', 'A note must be between 1 and 1000 characters.', 'CustomerStaffRecordAggregate');
    const notes = customer!.notes ?? (customer!.notes = []);
    if (notes.length >= 200)
      return validationError('Text', 'CustomerNoteLimitExceeded', 'No more than 200 notes are kept on one customer.', 'CustomerStaffRecordAggregate');
    const noteId = crypto.randomUUID();
    notes.push({ id: noteId, text: trimmed, authorStaffId: resolved.staff.id, createdOn: iso(now()) });
    persistMockState();
    return HttpResponse.json({ noteId }, { status: 201 });
  }),

  // PUT /api/staff/customers/{id}/tags — 200 { tags } as stored: trimmed, de-duplicated without regard to case keeping the first
  // spelling. CustomerStaffRecordAggregate.cs:55-86; SetCustomerTagsCommandValidator.
  http.put('*/api/staff/customers/:customerId/tags', async ({ request, params }) => {
    const resolved = requireAction(request, 'Customers.SetTags');
    if (resolved instanceof Response) return resolved;
    const body = (await request.json().catch(() => ({}))) as { tags?: Array<string | null> | null };
    const requested = body.tags ?? [];
    if (requested.length > 50)
      return validationError('Tags', 'PredicateValidator', 'has too many tags.', 'SetCustomerTagsCommand');
    const customer = customers.get(params.customerId as string);
    const refusal = staffRecordRefusal(customer);
    if (refusal) return refusal;
    const cleaned: string[] = [];
    for (const raw of requested) {
      const tag = (raw ?? '').trim();
      if (tag === '' || tag.length > 30 || /[\u0000-\u001f\u007f-\u009f]/.test(tag))
        return validationError('Tags', 'InvalidCustomerTag', 'A tag must be between 1 and 30 characters.', 'CustomerStaffRecordAggregate');
      if (!cleaned.some((t) => t.toLowerCase() === tag.toLowerCase())) cleaned.push(tag);
    }
    if (cleaned.length > 10)
      return validationError('Tags', 'CustomerTagLimitExceeded', 'No more than 10 tags are allowed on one customer.', 'CustomerStaffRecordAggregate');
    customer!.tags = cleaned;
    persistMockState();
    return HttpResponse.json({ tags: cleaned });
  }),

  // POST /api/staff/customers/{id}/password-reset — { channel, maskedDestination, expiresOn }, never the token. The
  // customer's own mobile if they have one, else their email; the destination is masked as IdentifierMasking.Mask does.
  // RequestCustomerPasswordResetCommandHandler.cs:34-80 (token lifetime 15 minutes: AccountOptions.cs:26).
  http.post('*/api/staff/customers/:customerId/password-reset', ({ request, params }) => {
    const resolved = requireAction(request, 'Customers.RequestPasswordReset');
    if (resolved instanceof Response) return resolved;
    const customer = customers.get(params.customerId as string);
    const refusal = staffRecordRefusal(customer);
    if (refusal) return refusal;
    const destination = customer!.mobileNumber ?? customer!.emailAddress;
    if (!destination)
      return validationError(
        'CustomerId',
        'NoResetChannel',
        'This customer has no mobile number or email address to send a reset to.',
        'CustomerStaffRecordAggregate',
      );
    return HttpResponse.json({
      channel: customer!.mobileNumber ? 'Mobile' : 'Email',
      maskedDestination: maskIdentifier(destination),
      expiresOn: iso(new Date(now().getTime() + 15 * 60_000)),
    });
  }),

  // POST /api/staff/customers/{duplicateId}/merge — C16
  http.post('*/api/staff/customers/:duplicateId/merge', async ({ request, params }) => {
    const resolved = requireAction(request, 'Customers.Merge');
    if (resolved instanceof Response) return resolved;
    const duplicateId = params.duplicateId as string;

    if (duplicateId === accountsFixtureIds.merge5xxId) {
      return HttpResponse.json({ error: 'internal' }, { status: 500 });
    }

    const body = (await request.json()) as { survivingCustomerId: string; reason: string };
    const duplicate = customers.get(duplicateId);
    const survivor = customers.get(body.survivingCustomerId);
    if (!duplicate || !survivor) return new HttpResponse(null, { status: 404 });

    if (duplicateId === body.survivingCustomerId) {
      return validationError(
        'SurvivingCustomerId',
        'CannotMergeCustomerIntoItself',
        'A record cannot be merged into itself.',
      );
    }
    if (duplicate.status === 'Merged') {
      return validationError(
        'DuplicateCustomerId',
        'CustomerAlreadyMerged',
        'This record has already been merged.',
      );
    }
    if (duplicateId === accountsFixtureIds.mergeNotDuplicatesId) {
      return validationError(
        'SurvivingCustomerId',
        'CustomersNotDuplicates',
        'These records do not share an identifier and cannot be merged.',
      );
    }

    const alreadyApplied = duplicate.mergedIntoCustomerId === body.survivingCustomerId;
    duplicate.status = 'Merged';
    duplicate.mergedIntoCustomerId = body.survivingCustomerId;
    persistMockState();

    return HttpResponse.json({
      survivingCustomerId: body.survivingCustomerId,
      isReapplication: alreadyApplied,
    });
  }),
];

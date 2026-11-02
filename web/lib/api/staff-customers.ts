import { apiFetch } from './client';
import type { Money } from '@/lib/format/money';
import type { PagedResult } from './types';

/**
 * Staff-facing customer registration, lookup, duplicates and merge — HO-ACC-002 §8.2's
 * `lib/api/staff-customers.ts` (US-ACC-10/11). Shapes verified against
 * `StaffCustomersController.cs` and `src/Read/.../ViewModels/{StaffCustomer,
 * DuplicateCustomerGroup}ViewModel.cs`. `mobileMatchedOn` is HO-ACC-001 §1 Amended (2026-09-25
 * SECURITY gate fix) — "Primary" / "Additional" / `null`, see each field's doc comment.
 */

const MAX_PAGE_SIZE = 100;
const MAX_PAGE_NUMBER = 1_000_000;

// -------------------------------------------------------------------------------------------
// Walk-in registration — C15, US-ACC-10
// -------------------------------------------------------------------------------------------

export interface RegisterWalkInCustomerRequest {
  fullName: string;
  mobileNumber: string;
}

export async function registerWalkInCustomer(
  request: RegisterWalkInCustomerRequest,
): Promise<{ customerId: string }> {
  return apiFetch<{ customerId: string }>('/api/staff/customers', {
    method: 'POST',
    body: request,
  });
}

// -------------------------------------------------------------------------------------------
// Lookup / detail — Q-H1/Q-H2
// -------------------------------------------------------------------------------------------

/** `"Primary"` is a genuine shared primary number; `"Additional"` is only an unverified claim on
 *  someone else's number (never verified — HO-ACC-001 §1 Amended); `null` = no mobile search term,
 *  or matched by email only. */
export type MobileMatchedOn = 'Primary' | 'Additional' | null;

export interface StaffCustomerSummary {
  id: string;
  fullName: string;
  mobileNumber: string | null;
  emailAddress: string | null;
  recordStatus: 'Complete' | 'Incomplete';
  status: 'Active' | 'Merged' | 'Anonymised';
  mobileMatchedOn: MobileMatchedOn;
}

export interface FindCustomersParams {
  mobile?: string;
  email?: string;
}

export async function findCustomers(params: FindCustomersParams): Promise<StaffCustomerSummary[]> {
  const query = new URLSearchParams();
  if (params.mobile) query.set('mobile', params.mobile);
  if (params.email) query.set('email', params.email);
  return apiFetch<StaffCustomerSummary[]>(`/api/staff/customers?${query.toString()}`);
}

/** The fresh single-customer read (Q-H1, MergeReview's own source, ADR-FE-011). */
export interface StaffCustomer {
  id: string;
  fullName: string;
  mobileNumber: string | null;
  emailAddress: string | null;
  recordStatus: 'Complete' | 'Incomplete';
  registrationChannel: 'SelfService' | 'Reception';
  status: 'Active' | 'Merged' | 'Anonymised';
  mergedIntoCustomerId: string | null;
  // HO-P5 BG-19 -- the profile summary (Read/ViewModels/StaffCustomerViewModel.cs:11-13).
  /** When the record was created (ISO instant). */
  customerSince: string;
  /** District of the default delivery address; `null` when there is none. */
  area: string | null;
  /** Orders that are not cancelled (a server count). */
  orderCount: number;
  /** Paid minus refunded on those orders, a server figure shown as sent (never summed here). */
  lifetimeSpend: Money;
  tags: string[];
  noteCount: number;
}

export async function getStaffCustomer(customerId: string): Promise<StaffCustomer> {
  return apiFetch<StaffCustomer>(`/api/staff/customers/${encodeURIComponent(customerId)}`);
}

// -------------------------------------------------------------------------------------------
// Browse — HO-P5 BG-19, US-ACC-10
// -------------------------------------------------------------------------------------------

/** One row of the browsable list (Read/ViewModels/StaffCustomerViewModel.cs:21-23). */
export interface StaffCustomerListItem {
  id: string;
  fullName: string;
  mobileNumber: string | null;
  emailAddress: string | null;
  recordStatus: 'Complete' | 'Incomplete';
  status: 'Active' | 'Merged' | 'Anonymised';
  customerSince: string;
  area: string | null;
  tags: string[];
}

/** `recent` (default, newest first) or `name` -- StaffCustomersController.cs:61 (`CustomerListSorts`). */
export type CustomerListSort = 'recent' | 'name';

export interface BrowseCustomersParams {
  /** Name, email (a term with `@`) or mobile (a phone-like term with 3+ digits); at most 100 characters. */
  search?: string;
  /** One tag; at most 100 characters. */
  tag?: string;
  sort?: CustomerListSort;
  pageNumber?: number;
  pageSize?: number;
}

/** The server's caps: `PagingRules.MaxPageSize` 100 and `MaxPageNumber` 1,000,000 -> 400 above
 *  (StaffCustomersController.cs:58-59). Clamped here for the same reason as `getDuplicateCustomerGroups`. */
export async function browseCustomers(
  params: BrowseCustomersParams = {},
): Promise<PagedResult<StaffCustomerListItem>> {
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.tag) query.set('tag', params.tag);
  if (params.sort) query.set('sort', params.sort);
  if (params.pageNumber) query.set('pageNumber', String(Math.min(params.pageNumber, MAX_PAGE_NUMBER)));
  if (params.pageSize) query.set('pageSize', String(Math.min(params.pageSize, MAX_PAGE_SIZE)));
  const text = query.toString();
  return apiFetch<PagedResult<StaffCustomerListItem>>(
    `/api/staff/customers/browse${text ? `?${text}` : ''}`,
  );
}

// -------------------------------------------------------------------------------------------
// Notes, tags and the staff-started password reset — HO-P5 BG-19, US-ACC-10/11
// -------------------------------------------------------------------------------------------

/** Limits of the staff-only record (Shared/Constants/CustomerStaffRecordRules.cs:6-9). */
export const CUSTOMER_NOTE_MAX_LENGTH = 1000;
export const CUSTOMER_MAX_NOTES = 200;
export const CUSTOMER_MAX_TAGS = 10;
export const CUSTOMER_TAG_MAX_LENGTH = 30;

/** The roles that may add notes, set tags and start a password reset -- `Customers.AddNote`, `.SetTags` and
 *  `.RequestPasswordReset` (Shared/Constants/ActionRoles.Accounts.cs:33-35). Presentation only: it hides a control from a
 *  role that would be refused; the server still decides (403). */
export const CUSTOMER_STAFF_RECORD_ROLES: readonly string[] = ['Reception', 'Administrator'];

/** A staff note, newest first (Read/ViewModels/StaffCustomerViewModel.cs:36). */
export interface CustomerNote {
  id: string;
  text: string;
  authorStaffId: string;
  /** The author's name as it is now; `null` when the account is gone. */
  authorName: string | null;
  createdOn: string;
}

export async function getCustomerNotes(customerId: string): Promise<CustomerNote[]> {
  return apiFetch<CustomerNote[]>(`/api/staff/customers/${encodeURIComponent(customerId)}/notes`);
}

/** 201 `{ noteId }` (StaffCustomersController.cs:119-129). */
export async function addCustomerNote(customerId: string, text: string): Promise<{ noteId: string }> {
  return apiFetch<{ noteId: string }>(`/api/staff/customers/${encodeURIComponent(customerId)}/notes`, {
    method: 'POST',
    body: { text },
  });
}

/** Replaces the whole set; the response is the set as stored -- trimmed, de-duplicated without regard
 *  to case (StaffCustomersController.cs:135-146, CustomerStaffRecordAggregate.cs:58-77). */
export async function setCustomerTags(customerId: string, tags: string[]): Promise<{ tags: string[] }> {
  return apiFetch<{ tags: string[] }>(`/api/staff/customers/${encodeURIComponent(customerId)}/tags`, {
    method: 'PUT',
    body: { tags },
  });
}

/** `{ channel, maskedDestination, expiresOn }` -- never the token (StaffCustomersController.cs:148-161,
 *  RequestCustomerPasswordResetCommandHandler.cs:76-80). `channel` is the customer's own: `Mobile` when
 *  they have one, otherwise `Email`. */
export interface CustomerPasswordResetResult {
  channel: 'Mobile' | 'Email';
  maskedDestination: string;
  expiresOn: string;
}

export async function requestCustomerPasswordReset(
  customerId: string,
): Promise<CustomerPasswordResetResult> {
  return apiFetch<CustomerPasswordResetResult>(
    `/api/staff/customers/${encodeURIComponent(customerId)}/password-reset`,
    { method: 'POST' },
  );
}

// -------------------------------------------------------------------------------------------
// Duplicates — Q-I1, US-ACC-11
// -------------------------------------------------------------------------------------------

/** CR MEDIUM 2 (first-pass gate fix round, item 13) — `recordStatus`/`registrationChannel` are
 *  new; §11.12's prose always asked for them per member, but the real API (Q-I1) didn't carry them
 *  before this fix (a §20.7 contract gap this round closes, not a client-side addition — see the
 *  matching Amended row in HO-ACC-001 §1). */
export interface DuplicateCustomerMember {
  customerId: string;
  fullName: string;
  mobileNumber: string | null;
  emailAddress: string | null;
  mobileMatchedOn: MobileMatchedOn;
  recordStatus: 'Complete' | 'Incomplete';
  registrationChannel: 'SelfService' | 'Reception';
}

export interface DuplicateCustomerGroup {
  members: DuplicateCustomerMember[];
}

export interface GetDuplicateGroupsParams {
  pageNumber?: number;
  pageSize?: number;
}

// Coordinator heads-up (2026-09-26): an integrator branch about to merge caps `pageSize` at 100
// and `pageNumber` at 1,000,000 on this endpoint too (400 otherwise). No caller here passes either
// today (`DuplicateGroupList.tsx`'s own `DUPLICATE_GROUPS_PAGE_SIZE` is 20), but clamping
// defensively at the one call site every request goes through means a future caller can never
// accidentally send an oversized value.
export async function getDuplicateCustomerGroups(
  params: GetDuplicateGroupsParams = {},
): Promise<PagedResult<DuplicateCustomerGroup>> {
  const query = new URLSearchParams();
  query.set('pageNumber', String(Math.min(params.pageNumber ?? 1, MAX_PAGE_NUMBER)));
  query.set('pageSize', String(Math.min(params.pageSize ?? 20, MAX_PAGE_SIZE)));
  return apiFetch<PagedResult<DuplicateCustomerGroup>>(
    `/api/staff/customers/duplicates?${query.toString()}`,
  );
}

// -------------------------------------------------------------------------------------------
// Merge — C16, US-ACC-11, ADR-FE-011
// -------------------------------------------------------------------------------------------

export interface MergeCustomerRequest {
  survivingCustomerId: string;
  reason: string;
}

export interface MergeCustomerResult {
  survivingCustomerId: string;
  isReapplication: boolean;
}

export async function mergeCustomer(
  duplicateCustomerId: string,
  request: MergeCustomerRequest,
): Promise<MergeCustomerResult> {
  return apiFetch<MergeCustomerResult>(
    `/api/staff/customers/${encodeURIComponent(duplicateCustomerId)}/merge`,
    { method: 'POST', body: request },
  );
}

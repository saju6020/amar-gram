import { apiFetch } from './client';

/**
 * `lib/api/admin-branches.ts` — HO-ADM-002 §8.2. Branches, opening hours, closures, staff
 * branch assignment and the active-branch feed (HO-ADM-001 §12.4).
 */

export type DayOfWeekName =
  'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';

export const DAYS_OF_WEEK: DayOfWeekName[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

export interface OpeningInterval {
  dayOfWeek: DayOfWeekName;
  opens: string; // "HH:mm"
  closes: string; // "HH:mm"
}

export interface PublicBranch {
  id: string;
  name: string;
  /** As `BranchSummaryViewModel` sends them (ADM backlog A-APT1). */
  addressLine: string | null;
  phoneNumber: string | null;
  email: string | null;
  timeZoneId: string;
  weeklyHours: OpeningInterval[];
}

/** HO-P5 BG-21 -- what a branch is; descriptive only, no rule differs by type yet
 *  (Shared/Enums/BranchType.cs:3-9). */
export type BranchType = 'Outlet' | 'Warehouse';

export const BRANCH_TYPES: BranchType[] = ['Outlet', 'Warehouse'];

/** Branch-local today, closures applied; `summary` is "HH:mm-HH:mm" per interval joined by ", ", or "Closed"
 *  (Read/ViewModels/AdministrationBranchViewModels.cs:25-26). */
export interface BranchTodayHours {
  date: string; // "yyyy-MM-dd"
  isOpenToday: boolean;
  summary: string;
  intervals: OpeningInterval[];
}

/** The part of a branch every caller reads: enough to name it and pick it (the staff branch-assignment panel takes this). */
export interface BranchSummary {
  id: string;
  code: string;
  name: string;
  timeZoneId: string;
  isActive: boolean;
}

/**
 * `AdminBranchViewModel` (Read/ViewModels/AdministrationBranchViewModels.cs:10-21): the list and the single read send
 * the same shape. HO-P5 BG-21 adds `type`, `todayHours`, `deliveryAreas` (names of the branch's active delivery zones, in
 * priority order) and `activeStaffCount` (staff accounts assigned to the branch). Kept apart from `BranchSummary` so the
 * screens that only need a branch's name do not have to carry the card figures.
 */
export interface AdminBranch extends BranchSummary {
  addressLine: string | null;
  phoneNumber: string | null;
  email: string | null;
  weeklyHours: OpeningInterval[];
  type: BranchType;
  todayHours: BranchTodayHours;
  deliveryAreas: string[];
  activeStaffCount: number;
}

export type BranchDetail = AdminBranch;

export async function getPublicBranches(): Promise<PublicBranch[]> {
  return apiFetch<PublicBranch[]>('/api/branches');
}

export async function getAdminBranches(): Promise<AdminBranch[]> {
  return apiFetch<AdminBranch[]>('/api/admin/branches');
}

export async function getAdminBranch(branchId: string): Promise<BranchDetail> {
  return apiFetch<BranchDetail>(`/api/admin/branches/${encodeURIComponent(branchId)}`);
}

export interface CreateBranchRequest {
  code: string;
  name: string;
  timeZoneId: string;
  addressLine?: string | null;
  phoneNumber?: string | null;
  email?: string | null;
  /** "Outlet" or "Warehouse"; absent means Outlet (Api/Contracts/Administration/BranchRequests.cs:11-12). */
  type?: BranchType;
}

export async function createBranch(request: CreateBranchRequest): Promise<{ branchId: string }> {
  return apiFetch<{ branchId: string }>('/api/admin/branches', { method: 'POST', body: request });
}

export interface UpdateBranchDetailsRequest {
  name: string;
  timeZoneId: string;
  addressLine?: string | null;
  phoneNumber?: string | null;
  email?: string | null;
  /** "Outlet" or "Warehouse"; absent leaves the type unchanged (BranchRequests.cs:22-23). */
  type?: BranchType;
}

export async function updateBranchDetails(
  branchId: string,
  request: UpdateBranchDetailsRequest,
): Promise<void> {
  await apiFetch<void>(`/api/admin/branches/${encodeURIComponent(branchId)}`, {
    method: 'PUT',
    body: request,
  });
}

export async function setBranchWeeklyHours(
  branchId: string,
  intervals: OpeningInterval[],
): Promise<void> {
  await apiFetch<void>(`/api/admin/branches/${encodeURIComponent(branchId)}/hours`, {
    method: 'PUT',
    body: { intervals },
  });
}

export async function setBranchActivation(branchId: string, isActive: boolean): Promise<void> {
  await apiFetch<void>(`/api/admin/branches/${encodeURIComponent(branchId)}/activation`, {
    method: 'PUT',
    body: { isActive },
  });
}

export type ClosureKind = 'PublicHoliday' | 'Closure';

export interface BranchClosure {
  id: string;
  branchId: string;
  startsOn: string; // "yyyy-MM-dd"
  endsOn: string;
  kind: ClosureKind;
  reason: string;
  partialFrom: string | null;
  partialTo: string | null;
  isCancelled: boolean;
}

export async function getBranchClosures(
  branchId: string,
  params: { from?: string; to?: string } = {},
): Promise<BranchClosure[]> {
  const query = new URLSearchParams();
  if (params.from) query.set('from', params.from);
  if (params.to) query.set('to', params.to);
  const qs = query.toString();
  return apiFetch<BranchClosure[]>(
    `/api/admin/branches/${encodeURIComponent(branchId)}/closures${qs ? `?${qs}` : ''}`,
  );
}

export interface CreateBranchClosureRequest {
  startsOn: string;
  endsOn: string;
  kind: ClosureKind;
  reason: string;
  partialFrom?: string | null;
  partialTo?: string | null;
}

export async function createBranchClosure(
  branchId: string,
  request: CreateBranchClosureRequest,
): Promise<{ closureId: string }> {
  return apiFetch<{ closureId: string }>(
    `/api/admin/branches/${encodeURIComponent(branchId)}/closures`,
    { method: 'POST', body: request },
  );
}

export async function cancelBranchClosure(branchId: string, closureId: string): Promise<void> {
  await apiFetch<void>(
    `/api/admin/branches/${encodeURIComponent(branchId)}/closures/${encodeURIComponent(closureId)}`,
    { method: 'DELETE' },
  );
}

export interface BranchCalendarInterval {
  start: string; // instant
  end: string;
}

export async function getBranchCalendar(
  branchId: string,
  from: string,
  to: string,
): Promise<BranchCalendarInterval[]> {
  const query = new URLSearchParams({ from, to });
  return apiFetch<BranchCalendarInterval[]>(
    `/api/admin/branches/${encodeURIComponent(branchId)}/calendar?${query.toString()}`,
  );
}

export interface StaffBranchAssignment {
  staffAccountId: string;
  branchIds: string[];
  primaryBranchId: string | null;
}

export async function getStaffBranchAssignment(
  staffAccountId: string,
): Promise<StaffBranchAssignment> {
  return apiFetch<StaffBranchAssignment>(
    `/api/admin/staff/${encodeURIComponent(staffAccountId)}/branches`,
  );
}

export interface AssignStaffBranchesRequest {
  branchIds: string[];
  primaryBranchId: string;
}

export async function assignStaffBranches(
  staffAccountId: string,
  request: AssignStaffBranchesRequest,
): Promise<void> {
  await apiFetch<void>(`/api/admin/staff/${encodeURIComponent(staffAccountId)}/branches`, {
    method: 'PUT',
    body: request,
  });
}

/** `ActiveBranchRefusal` from CONTRACTS.md #20 — `BranchNotAssigned` (a stale `X-Branch-Id`) or
 *  `BranchAssignmentRequired` (no assignment, more than one active branch exists). `null` means
 *  the active branch resolved without trouble. */
export type ActiveBranchRefusal = 'BranchNotAssigned' | 'BranchAssignmentRequired' | null;

export interface MyBranches {
  branchIds: string[];
  primaryBranchId: string | null;
  activeBranchId: string | null;
  activeBranchRefusal: ActiveBranchRefusal;
}

export async function getMyBranches(): Promise<MyBranches> {
  return apiFetch<MyBranches>('/api/staff/branches/mine');
}

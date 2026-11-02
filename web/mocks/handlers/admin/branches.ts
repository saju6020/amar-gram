import { http, HttpResponse, type HttpHandler } from 'msw';
import { registerStaffBranchesProvider } from '../areas/accounts';
import { db as orderingDb } from '../ordering/store';
import {
  administrationFixtureIds,
  validationError,
  notFound,
  noContent,
  loadPersisted,
  savePersisted,
  clearPersisted,
  zonedTimeToUtcIso,
} from './fixtures';

// HO-P5: bumped when a branch gained a `type`, so an older tab's saved branches (without one) are not read.
const PERSIST_KEY = '__purrcare_admin_branches_mock_db_p5__';

/** `mocks/handlers/admin/branches.ts` — HO-ADM-002 §12, HO-ADM-001 §12.4. Branches, opening
 *  hours, closures, staff branch assignment and the active-branch feed. Two branches in
 *  different zones (Asia/Dhaka, Europe/London) so zone rendering is exercised (§12). */

interface OpeningInterval {
  dayOfWeek: string;
  opens: string;
  closes: string;
}

interface Branch {
  id: string;
  code: string;
  name: string;
  timeZoneId: string;
  addressLine: string | null;
  phoneNumber: string | null;
  email: string | null;
  isActive: boolean;
  weeklyHours: OpeningInterval[];
  /** HO-P5 BG-21 -- Outlet or Warehouse; descriptive only (Shared/Enums/BranchType.cs). */
  type: 'Outlet' | 'Warehouse';
}

interface Closure {
  id: string;
  branchId: string;
  startsOn: string;
  endsOn: string;
  kind: 'PublicHoliday' | 'Closure';
  reason: string;
  partialFrom: string | null;
  partialTo: string | null;
  isCancelled: boolean;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Date-string arithmetic at UTC noon, never via the browser's zone (HO-ADM-002-FU1 §12.2 (e)). */
function dayNumber(dateIso: string): number {
  return Math.floor(new Date(`${dateIso}T12:00:00Z`).getTime() / 86_400_000);
}
function dateOfDayNumber(day: number): string {
  return new Date(day * 86_400_000 + 43_200_000).toISOString().slice(0, 10);
}
function toMinutes(time: string): number {
  const [h = '0', m = '0'] = time.split(':');
  return Number(h) * 60 + Number(m);
}
function fromMinutes(total: number): string {
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** The branch-local date (yyyy-MM-dd) of an instant in an IANA zone. */
function localDateOf(instantMs: number, timeZoneId: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timeZoneId, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date(instantMs),
  );
}

/**
 * The open intervals of one branch-local date as minutes since midnight, closures applied: a whole-day closure leaves none, a
 * part-day one cuts its window out. The calendar read and today's hours on the outlet card both use it, as the server's
 * `IBranchCalendar.OpenIntervalsAsync` is behind both (AdminBranchCardDetails.cs:52-68).
 */
function openMinutesOn(branch: Branch, dateStr: string, branchClosures: Closure[]): Array<[number, number]> {
  const onDate = branchClosures.filter((c) => dateStr >= c.startsOn && dateStr <= c.endsOn);
  if (onDate.some((c) => !c.partialFrom)) return [];
  const dayName = DAY_NAMES[new Date(`${dateStr}T12:00:00Z`).getUTCDay()];
  let open: Array<[number, number]> = branch.weeklyHours
    .filter((h) => h.dayOfWeek === dayName)
    .map((h) => [toMinutes(h.opens), toMinutes(h.closes)]);
  for (const c of onDate) {
    const cutFrom = toMinutes(c.partialFrom as string);
    const cutTo = toMinutes(c.partialTo as string);
    open = open.flatMap(([a, b]): Array<[number, number]> => {
      if (cutTo <= a || cutFrom >= b) return [[a, b]];
      const kept: Array<[number, number]> = [];
      if (a < cutFrom) kept.push([a, cutFrom]);
      if (cutTo < b) kept.push([cutTo, b]);
      return kept;
    });
  }
  return open;
}

function seedBranches(): Map<string, Branch> {
  const main: Branch = {
    id: administrationFixtureIds.mainBranchId,
    code: 'MAIN',
    name: 'Dhanmondi outlet',
    timeZoneId: 'Asia/Dhaka',
    addressLine: '12 Gulshan Avenue, Dhaka',
    phoneNumber: '+880212345678',
    email: 'main@purrcare.test',
    isActive: true,
    type: 'Outlet',
    weeklyHours: [
      { dayOfWeek: 'Monday', opens: '09:00', closes: '13:00' },
      { dayOfWeek: 'Monday', opens: '14:00', closes: '18:00' },
      { dayOfWeek: 'Tuesday', opens: '09:00', closes: '13:00' },
      { dayOfWeek: 'Tuesday', opens: '14:00', closes: '18:00' },
      { dayOfWeek: 'Wednesday', opens: '09:00', closes: '13:00' },
      { dayOfWeek: 'Wednesday', opens: '14:00', closes: '18:00' },
      { dayOfWeek: 'Thursday', opens: '09:00', closes: '13:00' },
      { dayOfWeek: 'Thursday', opens: '14:00', closes: '18:00' },
      { dayOfWeek: 'Friday', opens: '09:00', closes: '13:00' },
      { dayOfWeek: 'Saturday', opens: '10:00', closes: '14:00' },
    ],
  };
  const london: Branch = {
    id: administrationFixtureIds.londonBranchId,
    code: 'LDN',
    name: 'London outlet',
    timeZoneId: 'Europe/London',
    addressLine: '5 Baker Street, London',
    phoneNumber: '+442071234567',
    email: 'london@purrcare.test',
    isActive: true,
    type: 'Outlet',
    weeklyHours: [
      { dayOfWeek: 'Monday', opens: '08:00', closes: '17:00' },
      { dayOfWeek: 'Tuesday', opens: '08:00', closes: '17:00' },
      { dayOfWeek: 'Wednesday', opens: '08:00', closes: '17:00' },
      { dayOfWeek: 'Thursday', opens: '08:00', closes: '17:00' },
      { dayOfWeek: 'Friday', opens: '08:00', closes: '17:00' },
    ],
  };
  return new Map([
    [main.id, main],
    [london.id, london],
  ]);
}

function seedClosures(): Map<string, Closure> {
  const holiday: Closure = {
    id: administrationFixtureIds.closurePublicHolidayId,
    branchId: administrationFixtureIds.mainBranchId,
    startsOn: '2027-01-01',
    endsOn: '2027-01-01',
    kind: 'PublicHoliday',
    reason: "New Year's Day",
    partialFrom: null,
    partialTo: null,
    isCancelled: false,
  };
  const halfDay: Closure = {
    id: administrationFixtureIds.closureHalfDayId,
    branchId: administrationFixtureIds.mainBranchId,
    startsOn: '2027-02-15',
    endsOn: '2027-02-15',
    kind: 'Closure',
    reason: 'Staff training (half day)',
    partialFrom: '13:00',
    partialTo: '18:00',
    isCancelled: false,
  };
  return new Map([
    [holiday.id, holiday],
    [halfDay.id, halfDay],
  ]);
}

type StaffBranchAssignment = { branchIds: string[]; primaryBranchId: string };

function seedStaffBranchAssignments(): Map<string, StaffBranchAssignment> {
  return new Map([
    [
      administrationFixtureIds.rosterStaffId,
      {
        branchIds: [administrationFixtureIds.mainBranchId],
        primaryBranchId: administrationFixtureIds.mainBranchId,
      },
    ],
    [
      administrationFixtureIds.adminStaffId,
      {
        branchIds: [administrationFixtureIds.mainBranchId, administrationFixtureIds.londonBranchId],
        primaryBranchId: administrationFixtureIds.mainBranchId,
      },
    ],
  ]);
}

interface PersistedShape {
  branches: Array<[string, Branch]>;
  closures: Array<[string, Closure]>;
  staffBranchAssignments: Array<[string, StaffBranchAssignment]>;
}
const persisted = loadPersisted<PersistedShape>(PERSIST_KEY);

let branches = persisted ? new Map(persisted.branches) : seedBranches();
let closures = persisted ? new Map(persisted.closures) : seedClosures();
let staffBranchAssignments = persisted
  ? new Map(persisted.staffBranchAssignments)
  : seedStaffBranchAssignments();

function persist(): void {
  savePersisted(PERSIST_KEY, {
    branches: [...branches.entries()],
    closures: [...closures.entries()],
    staffBranchAssignments: [...staffBranchAssignments.entries()],
  });
}

export function resetAdminBranchesMockData(): void {
  branches = seedBranches();
  closures = seedClosures();
  staffBranchAssignments = seedStaffBranchAssignments();
  clearPersisted(PERSIST_KEY);
}

/** Read-only accessor for other `mocks/handlers/admin/*.ts` files (rosters.ts's availability
 *  computation needs the branch's zone and weekly hours) — within this handover's own module
 *  boundary, unlike the cross-area `accounts.ts` cookie problem this file's own doc comment
 *  explains. */
export function getBranchSnapshot(branchId: string): Branch | undefined {
  return branches.get(branchId);
}

/** HO-P5 BG-22 -- the branches a staff account is assigned to, the primary first and then by name; registered with the
 *  accounts mock so the staff list can show them without that file importing this one. */
registerStaffBranchesProvider((staffAccountId) => {
  const assignment = staffBranchAssignments.get(staffAccountId);
  if (!assignment) return [];
  return assignment.branchIds
    .flatMap((id) => {
      const branch = branches.get(id);
      return branch ? [{ id, name: branch.name, isPrimary: id === assignment.primaryBranchId }] : [];
    })
    .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.name.localeCompare(b.name));
});

/**
 * ADR-046's sole-branch rule as the roster commands use it (RosterCommandHandlers.cs:75-86): a staff member is assignable
 * to a branch when they are assigned to it explicitly, or when no other active branch exists.
 */
export function isStaffAssignedToBranch(staffAccountId: string, branchId: string): boolean {
  if (staffBranchAssignments.get(staffAccountId)?.branchIds.includes(branchId)) return true;
  return ![...branches.values()].some((b) => b.isActive && b.id !== branchId);
}

export function getBranchClosures(branchId: string): Closure[] {
  return [...closures.values()].filter((c) => c.branchId === branchId && !c.isCancelled);
}

/**
 * `AdminBranchViewModel` (AdministrationBranchViewModels.cs:10-21), the shape of the list and of the single read. HO-P5 BG-21:
 * `todayHours` is the branch-local today with closures applied ("HH:mm-HH:mm" per interval joined by ", ", or "Closed"),
 * `deliveryAreas` the names of the branch's active delivery zones in priority order (read from the ordering mock's zones), and
 * `activeStaffCount` the staff accounts assigned to the branch (AdminBranchCardDetails.cs:20-50).
 */
function adminBranchView(b: Branch) {
  const date = localDateOf(Date.now(), b.timeZoneId);
  const intervals = openMinutesOn(b, date, getBranchClosures(b.id)).sort((x, y) => x[0] - y[0]).map(([a, c]) => ({
    dayOfWeek: DAY_NAMES[new Date(`${date}T12:00:00Z`).getUTCDay()] ?? 'Monday',
    opens: fromMinutes(a),
    closes: fromMinutes(c),
  }));
  const areas = orderingDb.zones
    .filter((z) => z.isActive && z.branchId === b.id)
    .sort((x, y) => x.priority - y.priority || x.name.localeCompare(y.name))
    .map((z) => z.name);
  return {
    id: b.id,
    code: b.code,
    name: b.name,
    timeZoneId: b.timeZoneId,
    addressLine: b.addressLine,
    phoneNumber: b.phoneNumber,
    email: b.email,
    isActive: b.isActive,
    weeklyHours: b.weeklyHours,
    type: b.type,
    todayHours: {
      date,
      isOpenToday: intervals.length > 0,
      summary: intervals.length === 0 ? 'Closed' : intervals.map((i) => `${i.opens}-${i.closes}`).join(', '),
      intervals,
    },
    deliveryAreas: [...new Set(areas)],
    activeStaffCount: [...staffBranchAssignments.values()].filter((a) => a.branchIds.includes(b.id)).length,
  };
}

/** `type` is optional on the wire; blank is valid, a name is matched without regard to case, anything else is refused with
 *  the validator's own wording (`MustBeValidEnumeration`, BranchCommandValidators.cs:19,31 / ValidationRuleExtensions.cs:48-50). */
function parseBranchType(raw: unknown): { ok: true; value: Branch['type'] | null } | { ok: false } {
  if (raw === undefined || raw === null || (typeof raw === 'string' && raw.trim() === '')) return { ok: true, value: null };
  if (typeof raw !== 'string') return { ok: false };
  const found = (['Outlet', 'Warehouse'] as const).find((t) => t.toLowerCase() === raw.toLowerCase());
  return found ? { ok: true, value: found } : { ok: false };
}

export const adminBranchesHandlers: HttpHandler[] = [
  http.get('*/api/branches', () => {
    const list = [...branches.values()]
      .filter((b) => b.isActive)
      .map((b) => ({
        id: b.id,
        name: b.name,
        addressLine: b.addressLine,
        phoneNumber: b.phoneNumber,
        email: b.email,
        timeZoneId: b.timeZoneId,
        weeklyHours: b.weeklyHours,
      }));
    return HttpResponse.json(list);
  }),

  http.get('*/api/admin/branches', () =>
    HttpResponse.json(
      [...branches.values()].sort((a, b) => a.name.localeCompare(b.name)).map(adminBranchView),
    ),
  ),

  http.get('*/api/admin/branches/:branchId', ({ params }) => {
    const branch = branches.get(params.branchId as string);
    if (!branch) return notFound();
    return HttpResponse.json(adminBranchView(branch));
  }),

  http.post('*/api/admin/branches', async ({ request }) => {
    const body = (await request.json()) as {
      code: string;
      name: string;
      timeZoneId: string;
      addressLine?: string | null;
      phoneNumber?: string | null;
      email?: string | null;
      type?: string | null;
    };
    if (!body.code?.trim()) return validationError('Code', 'RequiredField', 'Enter a code.');
    const type = parseBranchType(body.type);
    if (!type.ok)
      return validationError('Type', 'PredicateValidator', 'is not a recognised BranchType.', 'CreateBranchCommand');
    if ([...branches.values()].some((b) => b.code === body.code)) {
      return validationError(
        'Code',
        'BranchCodeAlreadyExists',
        'A branch with this code already exists.',
      );
    }
    const id = crypto.randomUUID();
    branches.set(id, {
      id,
      code: body.code,
      name: body.name,
      timeZoneId: body.timeZoneId,
      addressLine: body.addressLine ?? null,
      phoneNumber: body.phoneNumber ?? null,
      email: body.email ?? null,
      isActive: true,
      weeklyHours: [],
      // Absent means Outlet (BranchRequests.cs:11-12).
      type: type.value ?? 'Outlet',
    });
    persist();
    return HttpResponse.json({ branchId: id }, { status: 201 });
  }),

  http.put('*/api/admin/branches/:branchId', async ({ request, params }) => {
    const branch = branches.get(params.branchId as string);
    if (!branch) return notFound();
    const body = (await request.json()) as Partial<Omit<Branch, 'type'>> & { type?: string | null };
    const type = parseBranchType(body.type);
    if (!type.ok)
      return validationError('Type', 'PredicateValidator', 'is not a recognised BranchType.', 'UpdateBranchDetailsCommand');
    Object.assign(branch, {
      name: body.name,
      timeZoneId: body.timeZoneId,
      addressLine: body.addressLine ?? null,
      phoneNumber: body.phoneNumber ?? null,
      email: body.email ?? null,
      // Absent leaves the type unchanged (BranchRequests.cs:22-23).
      type: type.value ?? branch.type,
    });
    persist();
    return noContent();
  }),

  http.put('*/api/admin/branches/:branchId/hours', async ({ request, params }) => {
    const branch = branches.get(params.branchId as string);
    if (!branch) return notFound();
    const body = (await request.json()) as { intervals: OpeningInterval[] };
    for (const day of new Set(body.intervals.map((i) => i.dayOfWeek))) {
      const dayIntervals = body.intervals.filter((i) => i.dayOfWeek === day);
      if (dayIntervals.length > 3) {
        return validationError(
          'Intervals',
          'InvalidOpeningInterval',
          'At most 3 intervals are allowed per day.',
        );
      }
    }
    branch.weeklyHours = body.intervals;
    persist();
    return noContent();
  }),

  http.put('*/api/admin/branches/:branchId/activation', async ({ request, params }) => {
    const branch = branches.get(params.branchId as string);
    if (!branch) return notFound();
    const body = (await request.json()) as { isActive: boolean };
    if (!body.isActive) {
      const otherActive = [...branches.values()].filter((b) => b.id !== branch.id && b.isActive);
      if (otherActive.length === 0) {
        return validationError(
          'IsActive',
          'LastActiveBranchCannotBeDeactivated',
          'At least one branch must stay active.',
        );
      }
    }
    branch.isActive = body.isActive;
    persist();
    return noContent();
  }),

  http.get('*/api/admin/branches/:branchId/closures', ({ params, request }) => {
    // HO-ADM-002-FU1 §12.2 — overlap filter as `GetBranchClosuresQueryHandler`: keep a closure
    // when `endsOn >= from` and `startsOn <= to`; cancelled closures are still returned.
    const url = new URL(request.url);
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const list = [...closures.values()].filter(
      (c) =>
        c.branchId === params.branchId && (!from || c.endsOn >= from) && (!to || c.startsOn <= to),
    );
    return HttpResponse.json(list);
  }),

  http.post('*/api/admin/branches/:branchId/closures', async ({ request, params }) => {
    const body = (await request.json()) as Omit<Closure, 'id' | 'branchId' | 'isCancelled'>;
    if (body.endsOn < body.startsOn) {
      return validationError(
        'EndsOn',
        'InvalidClosure',
        'End date must be on or after the start date.',
      );
    }
    const id = crypto.randomUUID();
    closures.set(id, { ...body, id, branchId: params.branchId as string, isCancelled: false });
    persist();
    return HttpResponse.json({ closureId: id }, { status: 201 });
  }),

  http.delete('*/api/admin/branches/:branchId/closures/:closureId', ({ params }) => {
    const closure = closures.get(params.closureId as string);
    if (!closure) return notFound();
    if (closure.startsOn < '2026-01-01') {
      return validationError(
        'ClosureId',
        'PastClosureCannotBeCancelled',
        'A past closure cannot be cancelled.',
      );
    }
    closure.isCancelled = true;
    persist();
    return noContent();
  }),

  http.get('*/api/admin/branches/:branchId/calendar', ({ params, request }) => {
    // HO-ADM-002-FU1 §12.2 — returns what the real `BranchCalendar.OpenIntervals` returns: an
    // unknown branch is `200 []`, a range over 62 days is `400`, and the open intervals are real
    // instants (branch wall-clock converted with the branch's own zone), part-day closures
    // subtracted, sorted and merged.
    const url = new URL(request.url);
    const from = url.searchParams.get('from') ?? '2027-01-01';
    const to = url.searchParams.get('to') ?? from;
    if (dayNumber(to) - dayNumber(from) > 62) {
      return HttpResponse.json({ error: 'The range cannot exceed 62 days.' }, { status: 400 });
    }
    const branch = branches.get(params.branchId as string);
    if (!branch) return HttpResponse.json([]);
    const branchClosures = [...closures.values()].filter(
      (c) => c.branchId === branch.id && !c.isCancelled,
    );
    const intervals: Array<{ start: string; end: string }> = [];
    for (let day = dayNumber(from); day <= dayNumber(to); day += 1) {
      const dateStr = dateOfDayNumber(day);
      for (const [a, b] of openMinutesOn(branch, dateStr, branchClosures)) {
        intervals.push({
          start: zonedTimeToUtcIso(dateStr, fromMinutes(a), branch.timeZoneId),
          end: zonedTimeToUtcIso(dateStr, fromMinutes(b), branch.timeZoneId),
        });
      }
    }
    intervals.sort((x, y) => x.start.localeCompare(y.start));
    const merged: Array<{ start: string; end: string }> = [];
    for (const interval of intervals) {
      const last = merged[merged.length - 1];
      if (last && interval.start <= last.end) {
        if (interval.end > last.end) last.end = interval.end;
      } else {
        merged.push({ ...interval });
      }
    }
    return HttpResponse.json(merged);
  }),

  http.get('*/api/admin/staff/:staffAccountId/branches', ({ params }) => {
    const assignment = staffBranchAssignments.get(params.staffAccountId as string) ?? {
      branchIds: [],
      primaryBranchId: null,
    };
    return HttpResponse.json({ staffAccountId: params.staffAccountId, ...assignment });
  }),

  http.put('*/api/admin/staff/:staffAccountId/branches', async ({ request, params }) => {
    const body = (await request.json()) as { branchIds: string[]; primaryBranchId: string };
    if (body.branchIds.length === 0)
      return validationError('BranchIds', 'RequiredField', 'Select at least one branch.');
    staffBranchAssignments.set(params.staffAccountId as string, body);
    persist();
    return noContent();
  }),

  http.get('*/api/staff/branches/mine', () => {
    // No real session resolution across module boundaries (this file's own doc comment) — the
    // administrator fixture's own assignment is returned unconditionally; e2e specs that need a
    // different signed-in staff member's branches override this endpoint with `server.use(...)`.
    const assignment = staffBranchAssignments.get(administrationFixtureIds.adminStaffId) ?? {
      branchIds: [administrationFixtureIds.mainBranchId],
      primaryBranchId: administrationFixtureIds.mainBranchId,
    };
    return HttpResponse.json({
      branchIds: assignment.branchIds,
      primaryBranchId: assignment.primaryBranchId,
      activeBranchId: assignment.primaryBranchId,
      activeBranchRefusal: null,
    });
  }),
];

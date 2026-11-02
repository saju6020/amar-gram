import { http, HttpResponse, type HttpHandler } from 'msw';
import {
  administrationFixtureIds,
  validationError,
  notFound,
  noContent,
  zonedTimeToUtcIso,
  loadPersisted,
  savePersisted,
  clearPersisted,
} from './fixtures';
import { getMockStaffRoleIds } from '../areas/accounts';
import { getBranchSnapshot, getBranchClosures, isStaffAssignedToBranch } from './branches';
import { getApprovedLeaveForStaff } from './leave';

const PERSIST_KEY = '__purrcare_admin_rosters_mock_db__';

/** `mocks/handlers/admin/rosters.ts` — HO-ADM-002 §12, HO-ADM-001 §8.4/§8.5/§12.4. Weekly
 *  patterns (current + a scheduled next), roster exceptions, and the availability calculation. */

interface ShiftSlot {
  dayOfWeek: string;
  starts: string;
  ends: string;
}

interface StaffRoster {
  staffAccountId: string;
  branchId: string;
  currentPattern: ShiftSlot[];
  nextPattern: ShiftSlot[] | null;
  nextPatternEffectiveFrom: string | null;
}

interface RosterException {
  id: string;
  staffAccountId: string;
  branchId: string;
  date: string;
  kind: 'ExtraShift' | 'ShiftCancelled';
  starts: string;
  ends: string;
  reason: string;
}

const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

function rosterKey(staffAccountId: string, branchId: string) {
  return `${staffAccountId}::${branchId}`;
}

function seedRosters(): Map<string, StaffRoster> {
  const roster: StaffRoster = {
    staffAccountId: administrationFixtureIds.rosterStaffId,
    branchId: administrationFixtureIds.mainBranchId,
    currentPattern: [
      {
        dayOfWeek: 'Monday',
        starts: '09:00',
        ends: '17:00',
      },
      {
        dayOfWeek: 'Tuesday',
        starts: '09:00',
        ends: '17:00',
      },
      {
        dayOfWeek: 'Wednesday',
        starts: '09:00',
        ends: '17:00',
      },
    ],
    // A scheduled next pattern (§12's own fixture requirement) — effective a year out so it never
    // promotes itself during a test run.
    nextPattern: [
      {
        dayOfWeek: 'Monday',
        starts: '10:00',
        ends: '18:00',
      },
      {
        dayOfWeek: 'Tuesday',
        starts: '10:00',
        ends: '18:00',
      },
    ],
    nextPatternEffectiveFrom: '2028-01-04',
  };
  return new Map([[rosterKey(roster.staffAccountId, roster.branchId), roster]]);
}

function seedExceptions(): Map<string, RosterException> {
  const extra: RosterException = {
    id: 'e0000000-0000-0000-0000-00000000a001',
    staffAccountId: administrationFixtureIds.rosterStaffId,
    branchId: administrationFixtureIds.mainBranchId,
    date: '2027-01-06', // a Wednesday with no base pattern slot beyond the seeded ones
    kind: 'ExtraShift',
    starts: '09:00',
    ends: '12:00',
    reason: 'Cover for colleague',
  };
  const cancelled: RosterException = {
    id: 'e0000000-0000-0000-0000-00000000a002',
    staffAccountId: administrationFixtureIds.rosterStaffId,
    branchId: administrationFixtureIds.mainBranchId,
    date: '2027-01-04', // a seeded Monday shift
    kind: 'ShiftCancelled',
    starts: '09:00',
    ends: '17:00',
    reason: 'Sick on the day',
  };
  return new Map([
    [extra.id, extra],
    [cancelled.id, cancelled],
  ]);
}

interface PersistedShape {
  rosters: Array<[string, StaffRoster]>;
  exceptions: Array<[string, RosterException]>;
}
const persisted = loadPersisted<PersistedShape>(PERSIST_KEY);

let rosters = persisted ? new Map(persisted.rosters) : seedRosters();
let exceptions = persisted ? new Map(persisted.exceptions) : seedExceptions();

function persist(): void {
  savePersisted(PERSIST_KEY, {
    rosters: [...rosters.entries()],
    exceptions: [...exceptions.entries()],
  });
}

export function resetAdminRostersMockData(): void {
  rosters = seedRosters();
  exceptions = seedExceptions();
  clearPersisted(PERSIST_KEY);
}

// -------------------------------------------------------------------------------------------
// HO-P5 BG-23 -- roster cells. A cell is stored as roster exceptions with deterministic ids so a second click re-sets the
// same rows instead of stacking new ones: a whole-day cut (kept for every value) plus one extra shift for Morning/Evening
// (removed for Off). SetRosterShiftCommandHandler.cs:30-104; the presets are StaffRosterRules.cs:14-17.
// -------------------------------------------------------------------------------------------

const MORNING = { starts: '08:00', ends: '14:00' };
const EVENING = { starts: '14:00', ends: '20:00' };
const DAY = { starts: '00:00', ends: '23:59' };
/** `LeaveRules.MaxAvailabilityRangeDays` (LeaveRules.cs:10): `to` may be at most this many days after `from`. */
const MAX_CELL_RANGE_DAYS = 31;
const ROSTERABLE_ROLES = ['Reception'];

type Slot = { starts: string; ends: string };

function cellExceptionId(staffAccountId: string, branchId: string, date: string, part: 'base' | 'shift') {
  return `cell:${part}:${staffAccountId}:${branchId}:${date}`;
}

function dayNumberOf(date: string): number {
  return Math.floor(new Date(`${date}T00:00:00Z`).getTime() / 86_400_000);
}

/** The branch-local date (yyyy-MM-dd) of now in the branch's zone. */
function branchToday(timeZoneId: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timeZoneId, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function subtractSlot(slot: Slot, cut: Slot): Slot[] {
  const overlapStart = slot.starts > cut.starts ? slot.starts : cut.starts;
  const overlapEnd = slot.ends < cut.ends ? slot.ends : cut.ends;
  if (overlapStart >= overlapEnd) return [slot];
  const kept: Slot[] = [];
  if (slot.starts < overlapStart) kept.push({ starts: slot.starts, ends: overlapStart });
  if (overlapEnd < slot.ends) kept.push({ starts: overlapEnd, ends: slot.ends });
  return kept;
}

/** `StaffAvailability.EffectiveSlots` (StaffAvailability.cs:72-94): the pattern in force, minus the cuts, plus the extras. */
function effectiveSlots(roster: StaffRoster, date: string): Slot[] {
  const dayName = WEEKDAY_NAMES[new Date(`${date}T12:00:00Z`).getUTCDay()];
  const pattern =
    roster.nextPattern && roster.nextPatternEffectiveFrom && roster.nextPatternEffectiveFrom <= date
      ? roster.nextPattern
      : roster.currentPattern;
  let slots: Slot[] = pattern.filter((s) => s.dayOfWeek === dayName).map((s) => ({ starts: s.starts, ends: s.ends }));
  const active = [...exceptions.values()].filter(
    (e) => e.staffAccountId === roster.staffAccountId && e.branchId === roster.branchId && e.date === date,
  );
  for (const cut of active.filter((e) => e.kind === 'ShiftCancelled')) {
    slots = slots.flatMap((slot) => subtractSlot(slot, { starts: cut.starts, ends: cut.ends }));
  }
  for (const extra of active.filter((e) => e.kind === 'ExtraShift')) slots.push({ starts: extra.starts, ends: extra.ends });
  return slots;
}

/** `RosterShiftCells.Classify` (RosterShiftCells.cs:14-26): none is Off, exactly a preset is that preset, anything else Custom. */
function cellOf(roster: StaffRoster, date: string) {
  const slots = effectiveSlots(roster, date)
    .filter((s) => s.starts < s.ends)
    .sort((a, b) => a.starts.localeCompare(b.starts));
  let shift: 'Morning' | 'Evening' | 'Off' | 'Custom' = 'Custom';
  if (slots.length === 0) shift = 'Off';
  else if (slots.length === 1 && slots[0]!.starts === MORNING.starts && slots[0]!.ends === MORNING.ends) shift = 'Morning';
  else if (slots.length === 1 && slots[0]!.starts === EVENING.starts && slots[0]!.ends === EVENING.ends) shift = 'Evening';
  return { staffAccountId: roster.staffAccountId, branchId: roster.branchId, date, shift, slots };
}

function computeAvailability(
  branchId: string,
  staffAccountId: string,
  from: string,
  to: string,
  restrictToOpeningHours: boolean,
) {
  const branch = getBranchSnapshot(branchId);
  const roster = rosters.get(rosterKey(staffAccountId, branchId));
  if (!branch || !roster) return [];

  const branchClosures = getBranchClosures(branchId);
  const approvedLeave = getApprovedLeaveForStaff(staffAccountId, from, to);
  const dayExceptions = [...exceptions.values()].filter(
    (e) =>
      e.staffAccountId === staffAccountId &&
      e.branchId === branchId &&
      e.date >= from &&
      e.date <= to,
  );

  const results: Array<{
    staffAccountId: string;
    branchId: string;
    start: string;
    end: string;
    outsideOpeningHours: boolean;
  }> = [];

  let cursor = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (cursor <= end) {
    const dateStr = cursor.toISOString().slice(0, 10);
    const dayName = WEEKDAY_NAMES[cursor.getUTCDay()] ?? 'Monday';
    cursor = new Date(cursor.getTime() + 86_400_000);

    if (approvedLeave.some((l) => dateStr >= l.startsOn && dateStr <= l.endsOn)) continue; // rule 5

    const closedAllDay = branchClosures.some(
      (c) => dateStr >= c.startsOn && dateStr <= c.endsOn && !c.partialFrom,
    );
    if (closedAllDay) continue; // rule 2

    const pattern =
      roster.nextPattern &&
      roster.nextPatternEffectiveFrom &&
      dateStr >= roster.nextPatternEffectiveFrom
        ? roster.nextPattern
        : roster.currentPattern;

    let slots = pattern
      .filter((s) => s.dayOfWeek === dayName)
      .map((s) => ({ starts: s.starts, ends: s.ends }));

    const todaysExceptions = dayExceptions.filter((e) => e.date === dateStr);
    if (todaysExceptions.some((e) => e.kind === 'ShiftCancelled')) slots = []; // rule 4, simplified
    for (const extra of todaysExceptions.filter((e) => e.kind === 'ExtraShift')) {
      slots.push({ starts: extra.starts, ends: extra.ends });
    }

    const openIntervals = branch.weeklyHours.filter((h) => h.dayOfWeek === dayName);
    for (const slot of slots) {
      const isOutside = !openIntervals.some((o) => slot.starts >= o.opens && slot.ends <= o.closes);
      if (restrictToOpeningHours && isOutside) continue; // rule 6
      results.push({
        staffAccountId,
        branchId,
        start: zonedTimeToUtcIso(dateStr, slot.starts, branch.timeZoneId),
        end: zonedTimeToUtcIso(dateStr, slot.ends, branch.timeZoneId),
        outsideOpeningHours: isOutside,
      });
    }
  }
  return results;
}

export const adminRostersHandlers: HttpHandler[] = [
  http.get('*/api/admin/branches/:branchId/rosters', ({ params }) => {
    const list = [...rosters.values()].filter((r) => r.branchId === params.branchId);
    return HttpResponse.json(list);
  }),

  http.put(
    '*/api/admin/branches/:branchId/rosters/:staffAccountId/pattern',
    async ({ request, params }) => {
      const body = (await request.json()) as { slots: ShiftSlot[]; effectiveFrom?: string | null };
      for (const day of new Set(body.slots.map((s) => s.dayOfWeek))) {
        if (body.slots.filter((s) => s.dayOfWeek === day).length > 3) {
          return validationError(
            'Slots',
            'InvalidShiftSlot',
            'At most 3 shifts are allowed per day.',
          );
        }
      }
      const key = rosterKey(params.staffAccountId as string, params.branchId as string);
      const existing = rosters.get(key) ?? {
        staffAccountId: params.staffAccountId as string,
        branchId: params.branchId as string,
        currentPattern: [],
        nextPattern: null,
        nextPatternEffectiveFrom: null,
      };
      if (body.effectiveFrom) {
        existing.nextPattern = body.slots;
        existing.nextPatternEffectiveFrom = body.effectiveFrom;
      } else {
        existing.currentPattern = body.slots;
      }
      rosters.set(key, existing);
      persist();
      return noContent();
    },
  ),

  http.delete(
    '*/api/admin/branches/:branchId/rosters/:staffAccountId/next-pattern',
    ({ params }) => {
      const key = rosterKey(params.staffAccountId as string, params.branchId as string);
      const roster = rosters.get(key);
      if (!roster) return notFound();
      roster.nextPattern = null;
      roster.nextPatternEffectiveFrom = null;
      persist();
      return noContent();
    },
  ),

  // GET …/roster-cells?from=&to=&staffAccountId= -- AdminRostersController.cs:70-86. Leave and opening hours are not applied.
  http.get('*/api/admin/branches/:branchId/roster-cells', ({ params, request }) => {
    const url = new URL(request.url);
    const from = url.searchParams.get('from') ?? '';
    const to = url.searchParams.get('to') ?? '';
    const only = url.searchParams.get('staffAccountId');
    const valid = /^\d{4}-\d{2}-\d{2}$/;
    if (!valid.test(from) || !valid.test(to))
      return HttpResponse.json({ title: 'One or more validation errors occurred.', status: 400 }, { status: 400 });
    if (to < from) return HttpResponse.json({ error: "'to' cannot be before 'from'." }, { status: 400 });
    if (dayNumberOf(to) - dayNumberOf(from) > MAX_CELL_RANGE_DAYS)
      return HttpResponse.json({ error: `The range cannot exceed ${MAX_CELL_RANGE_DAYS} days.` }, { status: 400 });
    const cells: ReturnType<typeof cellOf>[] = [];
    const branchRosters = [...rosters.values()]
      .filter((r) => r.branchId === params.branchId && (!only || r.staffAccountId === only))
      .sort((a, b) => a.staffAccountId.localeCompare(b.staffAccountId));
    for (const roster of branchRosters) {
      for (let day = dayNumberOf(from); day <= dayNumberOf(to); day += 1) {
        cells.push(cellOf(roster, new Date(day * 86_400_000).toISOString().slice(0, 10)));
      }
    }
    return HttpResponse.json(cells);
  }),

  // PUT …/rosters/{staffAccountId}/shifts/{date} { shift } -- 200 with the cell as it now reads (AdminRostersController.cs:49-68).
  // Refusals in the server's order: the validator (RosterCommandValidators.cs:40-51), then StaffNotRosterable, BranchNotFound,
  // BranchNotAssigned and ShiftDateInPast from the handler (SetRosterShiftCommandHandler.cs:34-52).
  http.put('*/api/admin/branches/:branchId/rosters/:staffAccountId/shifts/:date', async ({ request, params }) => {
    const date = params.date as string;
    const branchId = params.branchId as string;
    const staffAccountId = params.staffAccountId as string;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
      return HttpResponse.json({ title: 'One or more validation errors occurred.', status: 400 }, { status: 400 });
    const body = (await request.json().catch(() => ({}))) as { shift?: string | null };
    const raw = body.shift ?? '';
    const problems: Array<{ propertyName: string; errorCode: string; errorMessage: string; resourceName: string }> = [];
    if (Number(date.slice(0, 4)) < 2000)
      problems.push({ propertyName: 'Date', errorCode: 'PredicateValidator', errorMessage: 'is not a valid date.', resourceName: 'SetRosterShiftCommand' });
    if (raw.trim() === '')
      problems.push({ propertyName: 'Shift', errorCode: 'NotEmptyValidator', errorMessage: "'Shift' must not be empty.", resourceName: 'SetRosterShiftCommand' });
    const named = (['Morning', 'Evening', 'Off', 'Custom'] as const).find((n) => n.toLowerCase() === raw.toLowerCase());
    if (raw.trim() !== '' && !named)
      problems.push({ propertyName: 'Shift', errorCode: 'PredicateValidator', errorMessage: 'is not a recognised RosterShift.', resourceName: 'SetRosterShiftCommand' });
    if (named === 'Custom')
      problems.push({ propertyName: 'Shift', errorCode: 'PredicateValidator', errorMessage: 'must be Morning, Evening or Off.', resourceName: 'SetRosterShiftCommand' });
    if (problems.length > 0) return HttpResponse.json({ errors: problems, isValid: false }, { status: 400 });
    const shift = named as 'Morning' | 'Evening' | 'Off';

    const roles = getMockStaffRoleIds(staffAccountId);
    if (!roles || !roles.some((r) => ROSTERABLE_ROLES.includes(r)))
      return validationError('StaffAccountId', 'StaffNotRosterable', 'This staff member does not hold a rosterable role.');
    const branch = getBranchSnapshot(branchId);
    if (!branch) return validationError('BranchId', 'BranchNotFound', 'Branch not found.');
    if (!isStaffAssignedToBranch(staffAccountId, branchId))
      return validationError('branchId', 'BranchNotAssigned', 'This staff member is not assigned to this branch.');
    if (date < branchToday(branch.timeZoneId))
      return validationError('Date', 'ShiftDateInPast', "A past day's shift cannot be changed.");

    const key = rosterKey(staffAccountId, branchId);
    let roster = rosters.get(key);
    if (!roster) {
      roster = { staffAccountId, branchId, currentPattern: [], nextPattern: null, nextPatternEffectiveFrom: null };
      rosters.set(key, roster);
    }
    const baseId = cellExceptionId(staffAccountId, branchId, date, 'base');
    const shiftId = cellExceptionId(staffAccountId, branchId, date, 'shift');
    exceptions.set(baseId, { id: baseId, staffAccountId, branchId, date, kind: 'ShiftCancelled', ...DAY, reason: 'Roster cell: day cleared' });
    if (shift === 'Off') {
      exceptions.delete(shiftId);
    } else {
      const hours = shift === 'Morning' ? MORNING : EVENING;
      exceptions.set(shiftId, { id: shiftId, staffAccountId, branchId, date, kind: 'ExtraShift', ...hours, reason: `Roster cell: ${shift}` });
    }
    persist();
    return HttpResponse.json(cellOf(roster, date));
  }),

  http.get('*/api/admin/branches/:branchId/roster-exceptions', ({ params, request }) => {
    const url = new URL(request.url);
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    let list = [...exceptions.values()].filter((e) => e.branchId === params.branchId);
    if (from) list = list.filter((e) => e.date >= from);
    if (to) list = list.filter((e) => e.date <= to);
    return HttpResponse.json(list);
  }),

  http.post('*/api/admin/branches/:branchId/roster-exceptions', async ({ request, params }) => {
    const body = (await request.json()) as Omit<RosterException, 'id' | 'branchId'>;
    if (body.ends <= body.starts)
      return validationError('Ends', 'InvalidShiftSlot', 'End time must be after start time.');
    const id = crypto.randomUUID();
    exceptions.set(id, { ...body, id, branchId: params.branchId as string });
    persist();
    return HttpResponse.json({ rosterExceptionId: id }, { status: 201 });
  }),

  http.delete('*/api/admin/branches/:branchId/roster-exceptions/:id', ({ params }) => {
    if (!exceptions.has(params.id as string)) return notFound();
    exceptions.delete(params.id as string);
    persist();
    return noContent();
  }),

  http.get('*/api/admin/branches/:branchId/availability', ({ params, request }) => {
    const url = new URL(request.url);
    const from = url.searchParams.get('from') ?? '2027-01-01';
    const to = url.searchParams.get('to') ?? from;
    const staffAccountId = url.searchParams.get('staffAccountId');
    const restrictToOpeningHours = url.searchParams.get('restrictToOpeningHours') === 'true';
    const branchId = params.branchId as string;

    const staffIds = staffAccountId
      ? [staffAccountId]
      : [...rosters.values()].filter((r) => r.branchId === branchId).map((r) => r.staffAccountId);

    const all = staffIds.flatMap((id) =>
      computeAvailability(branchId, id, from, to, restrictToOpeningHours),
    );
    return HttpResponse.json(all);
  }),
];

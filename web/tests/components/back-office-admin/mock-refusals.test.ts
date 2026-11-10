import { beforeEach, describe, expect, it } from 'vitest';
import { apiFetch, ApiError, ApiValidationError } from '@/lib/api/client';
import { closeCashUp, getCashUp, recordCashCount } from '@/lib/api/billing-cashup';
import {
  createBranch,
  createBranchClosure,
  getAdminBranch,
  getAdminBranches,
  updateBranchDetails,
} from '@/lib/api/admin-branches';
import { getRosterCells, getRosterExceptions, setRosterShift } from '@/lib/api/admin-rosters';
import { addDaysIso, todayInZone } from '@/lib/format/time';
import { resetBillingMockData } from '../../../mocks/handlers/billing';
import { resetAdminBranchesMockData } from '../../../mocks/handlers/admin/branches';
import { resetAdminRostersMockData } from '../../../mocks/handlers/admin/rosters';
import { administrationFixtureIds as ids } from '../../../mocks/handlers/admin/fixtures';
import { accountsFixtureIds, resetAccountsMockData } from '../../../mocks/handlers/areas/accounts';

/**
 * HO-P5 S4 — U47 (§15) for the billing and administration mocks: one case per refusal this slice added to the per-source
 * cash-up count, the outlet type and the roster cells, so the mocks answer as the real server does. Each `describe` names
 * the server file and line it mirrors.
 */
beforeEach(() => {
  resetBillingMockData();
  resetAdminBranchesMockData();
  resetAdminRostersMockData();
  resetAccountsMockData();
});

async function failureOf(run: () => Promise<unknown>): Promise<unknown> {
  try {
    await run();
  } catch (error) {
    return error;
  }
  throw new Error('expected the request to be refused');
}

async function violationsOf(run: () => Promise<unknown>) {
  const error = await failureOf(run);
  expect(error).toBeInstanceOf(ApiValidationError);
  return (error as ApiValidationError).response.errors;
}

async function violationOf(run: () => Promise<unknown>) {
  return (await violationsOf(run))[0]!;
}

async function statusOf(run: () => Promise<unknown>): Promise<number> {
  const error = await failureOf(run);
  expect(error).toBeInstanceOf(ApiError);
  return (error as ApiError).status;
}

const TODAY = todayInZone('Asia/Dhaka');
// The seed gives the day two days ago a staff collector beside the till; today has the till alone.
const SRC_DAY = addDaysIso(TODAY, -2);

describe('PUT …/cash-ups/{date}/count with counts[] — StaffCashUpController.cs:33-52, CashUpAggregate.cs:56-108', () => {
  async function sourceKeys() {
    return (await getCashUp(SRC_DAY)).sources!.map((s) => s.key);
  }

  it('lists the till first and the staff collector (the seeded day two days ago), expected cash summing to the day\'s expected cash; uncounted is null, not zero, while open', async () => {
    const read = await getCashUp(SRC_DAY);
    const sources = read.sources!;
    expect(sources.map((s) => [s.key, s.label])).toEqual([
      ['till', 'Till'],
      [`staff:${'s0000000-0000-0000-0000-0000000000b1'}`, 'Rezwan Ahmed'],
    ]);
    expect(sources.every((s) => s.counted === null && s.variance === null)).toBe(true);
    expect(sources[1]!.expected.amount).toBe('1200.00');
  });

  it('sends sourceKey on every line, as CashUpLineViewModel does: null for the till, the staff key for the collector (CashUpRows.SourceOf)', async () => {
    const lines = (await getCashUp(SRC_DAY)).lines;
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.every((l) => 'sourceKey' in l)).toBe(true);
    const staffLine = lines.find((l) => l.collector === 'Staff');
    expect(staffLine?.sourceKey).toBe('staff:s0000000-0000-0000-0000-0000000000b1');
    expect(lines.filter((l) => l !== staffLine).every((l) => l.sourceKey === null)).toBe(true);
  });

  it('sets the total to the server\'s sum of the sources, with each source\'s variance counted minus expected (signed)', async () => {
    const [till, staff] = await sourceKeys();
    const before = await getCashUp(SRC_DAY);
    const tillExpected = before.sources![0]!.expected.amount;
    const view = await recordCashCount(SRC_DAY, {
      counts: [
        { sourceKey: till!, countedCash: '1000.50' },
        { sourceKey: staff!, countedCash: '1100.00' },
      ],
    });
    expect(view.counted?.amount).toBe('2100.50');
    const [tillRow, staffRow] = view.sources!;
    expect(tillRow!.counted?.amount).toBe('1000.50');
    expect(staffRow!.variance?.amount).toBe('-100.00');
    // Till variance = counted - expected: 1000.50 - expected, as the server computes it.
    const expectedCents = Math.round(Number(tillExpected) * 100);
    expect(tillRow!.variance?.amount).toBe(((100050 - expectedCents) / 100).toFixed(2));
    // A recount replaces the earlier count.
    const again = await recordCashCount(SRC_DAY, { counts: [{ sourceKey: till!, countedCash: '0' }] });
    expect(again.counted?.amount).toBe('0.00');
    expect(again.sources![1]!.counted).toBeNull();
  });

  it('a total-only count clears the per-source counts', async () => {
    const [till] = await sourceKeys();
    await recordCashCount(SRC_DAY, { counts: [{ sourceKey: till!, countedCash: '5' }] });
    const view = await recordCashCount(SRC_DAY, { countedCash: '99' });
    expect(view.counted?.amount).toBe('99.00');
    expect(view.sources!.every((s) => s.counted === null)).toBe(true);
  });

  it('refuses a repeated source (DuplicateCashUpSource) and a source the day does not have (UnknownCashUpSource), both on counts', async () => {
    const [till] = await sourceKeys();
    expect(
      await violationOf(() =>
        recordCashCount(SRC_DAY, {
          counts: [
            { sourceKey: till!, countedCash: '1' },
            { sourceKey: till!, countedCash: '2' },
          ],
        }),
      ),
    ).toMatchObject({ errorCode: 'DuplicateCashUpSource', propertyName: 'counts' });
    expect(
      await violationOf(() => recordCashCount(SRC_DAY, { counts: [{ sourceKey: 'staff:nobody', countedCash: '1' }] })),
    ).toMatchObject({ errorCode: 'UnknownCashUpSource', propertyName: 'counts' });
    // Nothing was written.
    expect((await getCashUp(SRC_DAY)).counted).toBeNull();
  });

  it('refuses more than 50 entries, a blank or over-long key, and a negative or three-decimal amount (shape rules, reported together)', async () => {
    const tooMany = Array.from({ length: 51 }, (_, n) => ({ sourceKey: `k${n}`, countedCash: '1' }));
    expect(await violationOf(() => recordCashCount(SRC_DAY, { counts: tooMany }))).toMatchObject({
      errorCode: 'PredicateValidator',
      propertyName: 'Counts',
    });
    const shape = await violationsOf(() =>
      recordCashCount(SRC_DAY, {
        counts: [
          { sourceKey: '   ', countedCash: '1' },
          { sourceKey: 'x'.repeat(61), countedCash: '1' },
          { sourceKey: 'till', countedCash: '-5' },
          { sourceKey: 'till2', countedCash: '1.234' },
        ],
      }),
    );
    expect(shape.map((v) => [v.propertyName, v.errorCode])).toEqual([
      ['Counts[0].SourceKey', 'NotEmptyValidator'],
      ['Counts[1].SourceKey', 'MaximumLengthValidator'],
      ['Counts[2].CountedCash', 'PredicateValidator'],
      ['Counts[3].CountedCash', 'PredicateValidator'],
    ]);
  });

  it('refuses a future day (CashUpDateInFuture on BusinessDate)', async () => {
    const tomorrow = addDaysIso(TODAY, 1);
    expect(
      await violationOf(() => recordCashCount(tomorrow, { counts: [{ sourceKey: 'till', countedCash: '1' }] })),
    ).toMatchObject({ errorCode: 'CashUpDateInFuture', propertyName: 'BusinessDate' });
  });

  it('refuses a per-source total above the maximum amount (InvalidAmount on countedCash), though each amount alone is within it', async () => {
    const [till, staff] = await sourceKeys();
    expect(
      await violationOf(() =>
        recordCashCount(SRC_DAY, {
          counts: [
            { sourceKey: till!, countedCash: '9999999999.99' },
            { sourceKey: staff!, countedCash: '9999999999.99' },
          ],
        }),
      ),
    ).toMatchObject({ errorCode: 'InvalidAmount', propertyName: 'countedCash' });
    expect((await getCashUp(SRC_DAY)).counted).toBeNull();
  });

  it('refuses in the aggregate\'s order: a closed day is CashUpClosed on Status before the date or a card number in the explanation, on the total-only path too', async () => {
    const [till] = await sourceKeys();
    await recordCashCount(SRC_DAY, { counts: [{ sourceKey: till!, countedCash: '0' }], explanation: 'Courier cash banked early.' });
    await closeCashUp(SRC_DAY, (await getCashUp(SRC_DAY)).version);
    expect(await violationOf(() => recordCashCount(SRC_DAY, { countedCash: '5' }))).toMatchObject({
      errorCode: 'CashUpClosed',
      propertyName: 'Status',
    });
    expect(
      await violationOf(() => recordCashCount(SRC_DAY, { countedCash: '5', explanation: '4111 1111 1111 1111' })),
    ).toMatchObject({ errorCode: 'CashUpClosed', propertyName: 'Status' });
    // On an open day the card number is refused (after the checks above it).
    const open = addDaysIso(TODAY, -3);
    expect(await violationOf(() => recordCashCount(open, { countedCash: '5', explanation: '4111 1111 1111 1111' }))).toMatchObject({
      errorCode: 'ReferenceLooksLikeCardNumber',
    });
    // A future day is refused before a card number is looked at.
    expect(
      await violationOf(() => recordCashCount(addDaysIso(TODAY, 1), { countedCash: '5', explanation: '4111 1111 1111 1111' })),
    ).toMatchObject({ errorCode: 'CashUpDateInFuture' });
  });

  it('freezes the sources at close: a source left out reads as counted nothing (a variance), and a closed day refuses a recount (CashUpClosed on Status)', async () => {
    const [till, staff] = await sourceKeys();
    await recordCashCount(SRC_DAY, {
      counts: [{ sourceKey: till!, countedCash: '1' }],
      explanation: 'The courier cash was banked early.',
    });
    const open = await getCashUp(SRC_DAY);
    await closeCashUp(SRC_DAY, open.version);
    const closed = await getCashUp(SRC_DAY);
    expect(closed.status).toBe('Closed');
    expect(closed.sources!.find((s) => s.key === staff)!.counted?.amount).toBe('0.00');
    expect(closed.sources!.find((s) => s.key === staff)!.variance?.amount).toBe('-1200.00');
    expect(
      await violationOf(() => recordCashCount(SRC_DAY, { counts: [{ sourceKey: till!, countedCash: '2' }] })),
    ).toMatchObject({ errorCode: 'CashUpClosed', propertyName: 'Status' });
  });
});

describe('Outlet cards and type — AdministrationBranchViewModels.cs:10-26, BranchRequests.cs:3-24, BranchCommandValidators.cs:19,31', () => {
  it('the list and the single read send type, today\'s hours, delivery areas (from the active zones) and the staff count', async () => {
    const list = await getAdminBranches();
    const main = list.find((b) => b.id === ids.mainBranchId)!;
    expect(main.type).toBe('Outlet');
    expect(main.deliveryAreas).toEqual(['Dhaka City']);
    // Two staff are assigned to the main outlet in the seed, one to London.
    expect(main.activeStaffCount).toBe(2);
    expect(list.find((b) => b.id === ids.londonBranchId)!.activeStaffCount).toBe(1);
    expect(list.find((b) => b.id === ids.londonBranchId)!.deliveryAreas).toEqual([]);
    expect(main.todayHours.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(main.todayHours.summary === 'Closed' ? main.todayHours.isOpenToday === false : main.todayHours.isOpenToday).toBe(true);
    expect(await getAdminBranch(ids.mainBranchId)).toMatchObject({ id: ids.mainBranchId, type: 'Outlet', activeStaffCount: 2 });
  });

  it('reads "Closed" the day a whole-day closure covers today', async () => {
    const before = await getAdminBranch(ids.mainBranchId);
    await createBranchClosure(ids.mainBranchId, { startsOn: before.todayHours.date, endsOn: before.todayHours.date, kind: 'Closure', reason: 'Stocktake' });
    const after = await getAdminBranch(ids.mainBranchId);
    expect(after.todayHours).toMatchObject({ isOpenToday: false, summary: 'Closed', intervals: [] });
  });

  it('create: an absent type is Outlet, a name is matched without regard to case, and an unknown one is refused on Type', async () => {
    const base = { name: 'Depot', timeZoneId: 'Asia/Dhaka' };
    const a = await createBranch({ ...base, code: 'DEP1' });
    expect((await getAdminBranch(a.branchId)).type).toBe('Outlet');
    const b = await createBranch({ ...base, code: 'DEP2', type: 'warehouse' as 'Warehouse' });
    expect((await getAdminBranch(b.branchId)).type).toBe('Warehouse');
    expect(await violationOf(() => createBranch({ ...base, code: 'DEP3', type: 'Depot' as 'Outlet' }))).toMatchObject({
      errorCode: 'PredicateValidator',
      propertyName: 'Type',
      errorMessage: 'is not a recognised BranchType.',
    });
    expect((await getAdminBranches()).some((x) => x.code === 'DEP3')).toBe(false);
  });

  it('update: an absent type leaves it unchanged, a present one changes it, an unknown one is refused', async () => {
    await updateBranchDetails(ids.mainBranchId, { name: 'Dhanmondi outlet', timeZoneId: 'Asia/Dhaka', type: 'Warehouse' });
    expect((await getAdminBranch(ids.mainBranchId)).type).toBe('Warehouse');
    await updateBranchDetails(ids.mainBranchId, { name: 'Dhanmondi outlet', timeZoneId: 'Asia/Dhaka' });
    expect((await getAdminBranch(ids.mainBranchId)).type).toBe('Warehouse');
    expect(
      await violationOf(() => updateBranchDetails(ids.mainBranchId, { name: 'X', timeZoneId: 'Asia/Dhaka', type: 'Shop' as 'Outlet' })),
    ).toMatchObject({ errorCode: 'PredicateValidator', propertyName: 'Type' });
    expect((await getAdminBranch(ids.mainBranchId)).type).toBe('Warehouse');
  });
});

describe('Roster cells — AdminRostersController.cs:49-86, SetRosterShiftCommandHandler.cs:30-104, RosterShiftCells.cs', () => {
  const nadia = ids.rosterStaffId;
  const future = addDaysIso(TODAY, 3);

  it('reads every day of the range for each rostered person: Custom for the weekly pattern\'s own hours, Off where there is none', async () => {
    const cells = await getRosterCells(ids.mainBranchId, { from: '2027-01-04', to: '2027-01-10' });
    // Monday to Sunday 2027-01-04..10: the seeded pattern has 09:00-17:00 Monday to Wednesday.
    expect(cells.map((c) => c.shift)).toEqual(['Off', 'Custom', 'Custom', 'Off', 'Off', 'Off', 'Off']);
    expect(cells[1]).toMatchObject({ staffAccountId: nadia, slots: [{ starts: '09:00', ends: '17:00' }] });
    // 2027-01-04's seeded "Sick on the day" cancellation removes that Monday's shift; 2027-01-06 adds an extra 09:00-12:00.
    expect(cells[2]).toMatchObject({ shift: 'Custom' });
  });

  it('refuses a reversed range and one over 31 days with a bare 400, and returns just the one person asked for', async () => {
    expect(await statusOf(() => getRosterCells(ids.mainBranchId, { from: '2027-01-10', to: '2027-01-04' }))).toBe(400);
    expect(await statusOf(() => getRosterCells(ids.mainBranchId, { from: '2027-01-01', to: '2027-02-02' }))).toBe(400);
    await expect(getRosterCells(ids.mainBranchId, { from: '2027-01-01', to: '2027-02-01' })).resolves.toHaveLength(32);
    expect(await getRosterCells(ids.mainBranchId, { from: '2027-01-01', to: '2027-01-02', staffAccountId: 'nobody' })).toEqual([]);
  });

  it('a click sets Morning (08:00-14:00), Evening (14:00-20:00) or Off, replaces the day, and stacks nothing on a second click', async () => {
    const morning = await setRosterShift(ids.mainBranchId, nadia, future, 'Morning');
    expect(morning).toMatchObject({ staffAccountId: nadia, date: future, shift: 'Morning', slots: [{ starts: '08:00', ends: '14:00' }] });
    const evening = await setRosterShift(ids.mainBranchId, nadia, future, 'Evening');
    expect(evening).toMatchObject({ shift: 'Evening', slots: [{ starts: '14:00', ends: '20:00' }] });
    const off = await setRosterShift(ids.mainBranchId, nadia, future, 'Off');
    expect(off).toMatchObject({ shift: 'Off', slots: [] });
    // Two exceptions at most are kept for the day (the cut and the extra), however many clicks.
    const stored = (await getRosterExceptions(ids.mainBranchId, { from: future, to: future })).filter((e) => e.staffAccountId === nadia);
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ kind: 'ShiftCancelled' });
    // The read agrees with the answer.
    expect((await getRosterCells(ids.mainBranchId, { from: future, to: future, staffAccountId: nadia }))[0]).toMatchObject({ shift: 'Off' });
  });

  it('a click on a pattern day (Custom) replaces its hours with the chosen preset', async () => {
    // The Monday of the seeded pattern, a date in the future for today's clock: find the next Monday.
    let monday = future;
    while (new Date(`${monday}T12:00:00Z`).getUTCDay() !== 1) monday = addDaysIso(monday, 1);
    const before = (await getRosterCells(ids.mainBranchId, { from: monday, to: monday, staffAccountId: nadia }))[0]!;
    expect(before.shift).toBe('Custom');
    const after = await setRosterShift(ids.mainBranchId, nadia, monday, 'Morning');
    expect(after).toMatchObject({ shift: 'Morning', slots: [{ starts: '08:00', ends: '14:00' }] });
  });

  it('refuses a past day (ShiftDateInPast on Date), a person without a rosterable role or no account (StaffNotRosterable on StaffAccountId), and an unassigned outlet (BranchNotAssigned)', async () => {
    expect(await violationOf(() => setRosterShift(ids.mainBranchId, nadia, addDaysIso(TODAY, -1), 'Morning'))).toMatchObject({
      errorCode: 'ShiftDateInPast',
      propertyName: 'Date',
    });
    // Today is not past.
    await expect(setRosterShift(ids.mainBranchId, nadia, TODAY, 'Off')).resolves.toMatchObject({ shift: 'Off' });
    expect(await violationOf(() => setRosterShift(ids.mainBranchId, accountsFixtureIds.adminStaffId, future, 'Morning'))).toMatchObject({
      errorCode: 'StaffNotRosterable',
      propertyName: 'StaffAccountId',
    });
    expect(await violationOf(() => setRosterShift(ids.mainBranchId, 's0000000-0000-0000-0000-00000000dead', future, 'Morning'))).toMatchObject({
      errorCode: 'StaffNotRosterable',
    });
    // Nadia is assigned to the main outlet only, and London is another active outlet.
    expect(await violationOf(() => setRosterShift(ids.londonBranchId, nadia, future, 'Morning'))).toMatchObject({
      errorCode: 'BranchNotAssigned',
    });
    expect(await violationOf(() => setRosterShift('b0000000-0000-0000-0000-0000000dead0', nadia, future, 'Morning'))).toMatchObject({
      errorCode: 'BranchNotFound',
      propertyName: 'BranchId',
    });
  });

  it('refuses a shift that is blank, unknown or Custom (the validator), with the validator\'s own wording', async () => {
    const put = (shift: unknown) =>
      apiFetch(`/api/admin/branches/${ids.mainBranchId}/rosters/${nadia}/shifts/${future}`, { method: 'PUT', body: { shift } });
    expect(await violationOf(() => put(''))).toMatchObject({ errorCode: 'NotEmptyValidator', propertyName: 'Shift' });
    expect(await violationOf(() => put('Night'))).toMatchObject({
      errorCode: 'PredicateValidator',
      propertyName: 'Shift',
      errorMessage: 'is not a recognised RosterShift.',
    });
    expect(await violationOf(() => put('Custom'))).toMatchObject({
      errorCode: 'PredicateValidator',
      errorMessage: 'must be Morning, Evening or Off.',
    });
    // A shift named in another case is accepted, as the server's case-insensitive match does.
    await expect(put('evening')).resolves.toMatchObject({ shift: 'Evening' });
  });
});

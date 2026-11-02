import { Suspense } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { administrationFixtureIds } from '@/mocks/handlers/admin';
import { RosterWeekView, type RosterDayCell } from '@/components/roster/RosterWeekView';
import { describeShiftError, nextRosterShift } from '@/components/roster/shiftCycle';
import { ApiValidationError } from '@/lib/api/client';
import { addDaysIso, todayInZone } from '@/lib/format/time';
import { getWeekDates, todayIso } from '@/lib/format/week';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/staff/admin/branches',
  useSearchParams: () => new URLSearchParams(),
}));

import BranchRosterPage from '@/app/(staff)/staff/admin/branches/[branchId]/roster/page';

function resolvedParams<T>(value: T): Promise<T> {
  return Object.assign(Promise.resolve(value), { status: 'fulfilled', value }) as Promise<T>;
}

const WEEK = ['2027-01-04', '2027-01-05', '2027-01-06', '2027-01-07', '2027-01-08', '2027-01-09', '2027-01-10'];
const ROWS = [
  { staffAccountId: 's1', staffFullName: 'Nadia Karim' },
  { staffAccountId: 's2', staffFullName: 'Ada Administrator' },
];

describe('nextRosterShift — HO-P5 U45, ADR-FE-192', () => {
  it('cycles Morning → Evening → Off → Morning; a Custom day is replaced by Morning', () => {
    expect(nextRosterShift('Morning')).toBe('Evening');
    expect(nextRosterShift('Evening')).toBe('Off');
    expect(nextRosterShift('Off')).toBe('Morning');
    expect(nextRosterShift('Custom')).toBe('Morning');
  });

  it('maps the server\'s roster refusals to plain language, and never shows the code', () => {
    const refusal = (errorCode: string) =>
      new ApiValidationError({ isValid: false, errors: [{ propertyName: 'x', errorCode, errorMessage: 'server wording', resourceName: '' }] });
    expect(describeShiftError(refusal('ShiftDateInPast'))).toBe("That day has passed, so its shift can't be changed.");
    expect(describeShiftError(refusal('StaffNotRosterable'))).toBe("This person's role can't be rostered, so their shifts can't be set here.");
    expect(describeShiftError(refusal('BranchNotAssigned'))).toMatch(/not assigned to this outlet/);
    expect(describeShiftError(refusal('SomethingElse'))).toBe('server wording');
  });
});

describe('RosterWeekView shift cells — U45 (HO-P5 §11.5.8, BG-23)', () => {
  const cellFor = (staffAccountId: string, date: string): RosterDayCell => ({
    intervals: [],
    isOnLeave: staffAccountId === 's1' && date === WEEK[4],
    exceptionLabels: [],
    shift: {
      shift: date === WEEK[0] ? 'Custom' : date === WEEK[1] ? 'Evening' : date === WEEK[2] ? 'Off' : 'Morning',
      times: date === WEEK[2] ? '' : date === WEEK[1] ? '14:00–20:00' : date === WEEK[0] ? '09:00–17:00' : '08:00–14:00',
      // Ada cannot be rostered, and the first day is already past.
      editable: staffAccountId === 's1' && date !== WEEK[3],
    },
  });

  function show(onCycle = vi.fn()) {
    render(
      <RosterWeekView
        weekDates={WEEK}
        rows={ROWS}
        cellFor={cellFor}
        onPrevWeek={vi.fn()}
        onNextWeek={vi.fn()}
        onThisWeek={vi.fn()}
        isLoading={false}
        isError={false}
        onRetry={vi.fn()}
        onCycle={onCycle}
        announcement="Nadia Karim, Tuesday 5 Jan: Evening"
      />,
    );
    return onCycle;
  }

  it('an editable cell is a button whose name says the person, the day and the current shift, then "Change shift"', () => {
    show();
    const buttons = screen.getAllByRole('button', { name: /Change shift/ }).map((b) => b.getAttribute('aria-label'));
    expect(buttons).toContain('Nadia Karim, Tuesday 5 Jan: Evening, 14:00–20:00. Change shift');
    expect(buttons).toContain('Nadia Karim, Wednesday 6 Jan: Off. Change shift');
    expect(buttons).toContain('Nadia Karim, Monday 4 Jan: Custom, 09:00–17:00. Change shift');
  });

  it('a click reports the person, the day and the shift it holds now; the page decides what follows', async () => {
    const onCycle = show();
    await userEvent.click(screen.getAllByRole('button', { name: /^Nadia Karim, Tuesday 5 Jan: Evening/ })[0]!);
    expect(onCycle).toHaveBeenCalledWith('s1', '2027-01-05', 'Evening');
  });

  it('a non-rosterable row and a past day are text, not buttons, and still say their shift', () => {
    show();
    const table = screen.getByRole('table');
    const ada = within(table).getByRole('rowheader', { name: 'Ada Administrator' }).closest('tr')!;
    expect(within(ada).queryAllByRole('button')).toHaveLength(0);
    expect(within(ada).getAllByText('Morning').length).toBeGreaterThan(0);
    const nadia = within(table).getByRole('rowheader', { name: 'Nadia Karim' }).closest('tr')!;
    // Thursday 7 Jan (index 3) is past: no button for it in Nadia's row.
    expect(within(nadia).getAllByRole('button')).toHaveLength(6);
  });

  it('shows leave as text beside the shift, lists the shift names without hours, and announces a change politely', () => {
    show();
    expect(screen.getAllByText('On leave').length).toBeGreaterThan(0);
    const legend = screen.getByText(/Select a day to change the shift/);
    expect(legend.textContent).toMatch(/Morning.*Evening.*Off/);
    expect(legend.textContent).not.toMatch(/\d{1,2}[:–-]\d{2}|8–|2–/);
    const live = screen.getByText('Nadia Karim, Tuesday 5 Jan: Evening', { selector: 'p' });
    expect(live).toHaveAttribute('role', 'status');
    expect(live).toHaveAttribute('aria-live', 'polite');
  });

  it('keeps saying "Outside opening hours" in words for a rostered shift the availability read flags (HO-ADM-002 §11.4)', () => {
    render(
      <RosterWeekView
        weekDates={WEEK}
        rows={ROWS.slice(0, 1)}
        cellFor={() => ({
          intervals: [],
          isOnLeave: false,
          exceptionLabels: [],
          shift: { shift: 'Evening', times: '14:00–20:00', editable: true, outsideOpeningHours: true },
        })}
        onPrevWeek={vi.fn()}
        onNextWeek={vi.fn()}
        onThisWeek={vi.fn()}
        isLoading={false}
        isError={false}
        onRetry={vi.fn()}
        onCycle={vi.fn()}
      />,
    );
    expect(screen.getAllByText('Outside opening hours').length).toBeGreaterThan(0);
  });

  it('without onCycle the grid is read-only text, as before (HO-P4)', () => {
    render(
      <RosterWeekView
        weekDates={WEEK}
        rows={ROWS}
        cellFor={cellFor}
        onPrevWeek={vi.fn()}
        onNextWeek={vi.fn()}
        onThisWeek={vi.fn()}
        isLoading={false}
        isError={false}
        onRetry={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: /Change shift/ })).not.toBeInTheDocument();
  });
});

describe('Branch roster page — cells, one PUT per click (U45)', () => {
  const STAFF = {
    items: [
      { id: 'staff-n', fullName: 'Nadia Karim', mobileNumber: null, emailAddress: null, roleIds: ['Reception'], hasPassword: true, status: 'Active', branches: [] },
      { id: 'staff-a', fullName: 'Ada Administrator', mobileNumber: null, emailAddress: null, roleIds: ['Administrator'], hasPassword: true, status: 'Active', branches: [] },
    ],
    pageNumber: 1,
    pageSize: 100,
    totalCount: 2,
  };
  const ROSTERS = ['staff-n', 'staff-a'].map((staffAccountId) => ({
    staffAccountId,
    branchId: administrationFixtureIds.mainBranchId,
    currentPattern: [],
    nextPattern: null,
    nextPatternEffectiveFrom: null,
  }));

  function setup(shiftOf: (date: string) => 'Morning' | 'Evening' | 'Off' | 'Custom') {
    const puts: Array<{ staff: string; date: string; body: unknown }> = [];
    const slotsOf = (shift: string) =>
      shift === 'Morning' ? [{ starts: '08:00', ends: '14:00' }] : shift === 'Evening' ? [{ starts: '14:00', ends: '20:00' }] : shift === 'Custom' ? [{ starts: '09:00', ends: '17:00' }] : [];
    server.use(
      http.get('*/api/staff-accounts', () => HttpResponse.json(STAFF)),
      http.get('*/api/admin/branches/:branchId/rosters', () => HttpResponse.json(ROSTERS)),
      http.get('*/api/admin/branches/:branchId/roster-cells', ({ request }) => {
        const url = new URL(request.url);
        const cells: unknown[] = [];
        for (let day = url.searchParams.get('from')!; day <= url.searchParams.get('to')!; day = addDaysIso(day, 1)) {
          for (const staffAccountId of ['staff-n', 'staff-a']) {
            const shift = shiftOf(day);
            cells.push({ staffAccountId, branchId: administrationFixtureIds.mainBranchId, date: day, shift, slots: slotsOf(shift) });
          }
        }
        return HttpResponse.json(cells);
      }),
    );
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <Suspense fallback={<p>suspended</p>}>
          <BranchRosterPage params={resolvedParams({ branchId: administrationFixtureIds.mainBranchId })} />
        </Suspense>
      </QueryClientProvider>,
    );
    return puts;
  }

  function recordPuts(puts: Array<{ staff: string; date: string; body: unknown }>, respond: (date: string, shift: string) => Response | undefined) {
    server.use(
      http.put('*/api/admin/branches/:branchId/rosters/:staffAccountId/shifts/:date', async ({ request, params }) => {
        const body = (await request.json()) as { shift: string };
        puts.push({ staff: params.staffAccountId as string, date: params.date as string, body });
        const refused = respond(params.date as string, body.shift);
        if (refused) return refused;
        return HttpResponse.json({
          staffAccountId: params.staffAccountId,
          branchId: administrationFixtureIds.mainBranchId,
          date: params.date,
          shift: body.shift,
          slots: body.shift === 'Evening' ? [{ starts: '14:00', ends: '20:00' }] : body.shift === 'Off' ? [] : [{ starts: '08:00', ends: '14:00' }],
        });
      }),
    );
  }

  const today = () => todayInZone('Asia/Dhaka');

  it('one click sends one PUT with the next shift, the cell shows the server\'s answer, and the change is announced', async () => {
    const puts: Array<{ staff: string; date: string; body: unknown }> = [];
    setup(() => 'Morning');
    recordPuts(puts, () => undefined);
    const user = userEvent.setup();
    const button = (await screen.findAllByRole('button', { name: new RegExp(`^Nadia Karim, .*: Morning, 08:00–14:00\\. Change shift$`) }))[0]!;
    await user.click(button);

    await waitFor(() => expect(puts).toHaveLength(1));
    expect(puts[0]).toMatchObject({ staff: 'staff-n', body: { shift: 'Evening' } });
    expect(puts[0]!.date >= today()).toBe(true);
    // The cell is replaced by the response, and the live region says what happened.
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: new RegExp(`^Nadia Karim, .*: Evening, 14:00–20:00\\. Change shift$`) }).length).toBeGreaterThan(0),
    );
    expect(screen.getByText(/^Nadia Karim, .*: Evening$/, { selector: 'p[role="status"]' })).toBeInTheDocument();
  });

  it('only the person who can be rostered has buttons (Ada has none), and only for days from today on', async () => {
    setup(() => 'Morning');
    await screen.findAllByRole('button', { name: /Change shift/ });
    expect(screen.queryAllByRole('button', { name: /^Ada Administrator/ })).toHaveLength(0);
    // Both the table and the day list are mounted, so each editable day has two buttons.
    const upcoming = getWeekDates(todayIso()).filter((day) => day >= todayInZone('Asia/Dhaka')).length;
    expect(screen.getAllByRole('button', { name: /^Nadia Karim.*Change shift$/ })).toHaveLength(upcoming * 2);
  });

  it('a week that is wholly past has no buttons at all, but still says each shift', async () => {
    setup(() => 'Morning');
    const user = userEvent.setup();
    await screen.findAllByRole('button', { name: /Change shift/ });
    await user.click(screen.getAllByRole('button', { name: 'Previous week' })[0]!);
    await waitFor(() => expect(screen.queryAllByRole('button', { name: /Change shift/ })).toHaveLength(0));
    expect((await screen.findAllByText('Morning')).length).toBeGreaterThan(0);
  });

  it('cancelling a roster exception (a "Roster cell" one included) refetches the cells, so the grid shows the new shift', async () => {
    let current: 'Morning' | 'Off' = 'Morning';
    server.use(
      http.get('*/api/admin/branches/:branchId/roster-exceptions', () =>
        HttpResponse.json([
          {
            id: 'ex-1',
            staffAccountId: 'staff-n',
            branchId: administrationFixtureIds.mainBranchId,
            date: todayInZone('Asia/Dhaka'),
            kind: 'ExtraShift',
            starts: '08:00',
            ends: '14:00',
            reason: 'Roster cell: Morning',
          },
        ]),
      ),
      http.delete('*/api/admin/branches/:branchId/roster-exceptions/:id', () => {
        current = 'Off';
        return new HttpResponse(null, { status: 204 });
      }),
    );
    // The page renders as soon as it is set up, so the exception list must already be answering.
    setup(() => current);
    const user = userEvent.setup();
    await screen.findAllByRole('button', { name: /^Nadia Karim, .*: Morning, 08:00–14:00\. Change shift$/ });
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel exception' }));
    await waitFor(() => expect(screen.getAllByRole('button', { name: /^Nadia Karim, .*: Off\. Change shift$/ }).length).toBeGreaterThan(0));
    expect(screen.queryAllByRole('button', { name: /^Nadia Karim, .*: Morning/ })).toHaveLength(0);
  });

  it('a Custom day asks before replacing its hours; Cancel sends nothing and Replace sends Morning', async () => {
    const puts: Array<{ staff: string; date: string; body: unknown }> = [];
    setup(() => 'Custom');
    recordPuts(puts, () => undefined);
    const user = userEvent.setup();
    await user.click((await screen.findAllByRole('button', { name: /^Nadia Karim, .*: Custom, 09:00–17:00\. Change shift$/ }))[0]!);

    const dialog = await screen.findByRole('dialog', { name: "Replace this day's hours?" });
    expect(dialog).toHaveTextContent('Nadia Karim has their own hours on');
    expect(dialog).toHaveTextContent('replaces them with the Morning shift');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(puts).toHaveLength(0);

    await user.click((await screen.findAllByRole('button', { name: /^Nadia Karim, .*: Custom, 09:00–17:00\. Change shift$/ }))[0]!);
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Replace hours' }));
    await waitFor(() => expect(puts).toHaveLength(1));
    expect(puts[0]!.body).toEqual({ shift: 'Morning' });
  });

  it.each([
    ['ShiftDateInPast', "That day has passed, so its shift can't be changed."],
    ['StaffNotRosterable', "This person's role can't be rostered, so their shifts can't be set here."],
  ])('%s is shown in plain language and the cell keeps its shift', async (code, message) => {
    const puts: Array<{ staff: string; date: string; body: unknown }> = [];
    setup(() => 'Morning');
    recordPuts(puts, () =>
      HttpResponse.json(
        { isValid: false, errors: [{ propertyName: 'Date', errorCode: code, errorMessage: 'server wording', resourceName: 'Administration' }] },
        { status: 400 },
      ),
    );
    const user = userEvent.setup();
    const clicked = (await screen.findAllByRole('button', { name: /^Nadia Karim, .*: Morning, 08:00–14:00\. Change shift$/ }))[0]!;
    const label = clicked.getAttribute('aria-label')!;
    await user.click(clicked);
    expect(await screen.findByText(message)).toBeInTheDocument();
    // That very cell (the same person and day) still holds the shift it had.
    expect(screen.getAllByRole('button', { name: label }).length).toBeGreaterThan(0);
  });
});

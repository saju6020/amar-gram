import { StatusPill } from '@/components/back-office/StatusPill';
import { TONE_SURFACE, type BackOfficeTone } from '@/components/back-office/tone';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/common/LoadingState';
import { ErrorState } from '@/components/common/ErrorState';
import { EmptyState } from '@/components/common/EmptyState';
import type { RosterShiftName } from '@/lib/api/admin-rosters';
import { formatDateOnly } from '@/lib/format/time';
import { cn } from '@/lib/utils';

/**
 * `components/roster/RosterWeekView.tsx` — ⭐ HO-ADM-002 §11.4, ADR-FE-017 (renumbered — see that
 * ADR's note), UI-1/UI-6. A real `<table>` with row/column headers on desktop; below 768 px a list
 * grouped by day (never a horizontally scrolling grid — both are always mounted, CSS toggled the
 * same way `StaffShell`'s nav does, so neither depends on JS having run to pick the right one).
 * Leave, exceptions ("Extra"/"Cancelled") and "Outside opening hours" are shown as **text**, never
 * colour alone (U-D2).
 *
 * HO-P5 §11.5.8 (BG-23), ADR-FE-192: when a cell carries the server's `shift`, it is shown as that shift's name with its
 * slot times, and — for a day that is not past and a person who can be rostered — as a button that asks the page to
 * cycle it. The button's name says the person, the day and the current shift ("Nadia, Tuesday 4 Nov: Morning. Change
 * shift"); `announcement` is read out politely after a change. Past days and people who cannot be rostered are text.
 */
export interface RosterInterval {
  label: string; // "09:00–13:00 (Asia/Dhaka)"
  outsideOpeningHours: boolean;
}

/** The server's reading of a roster-grid cell (`GET …/roster-cells`). */
export interface RosterShiftInfo {
  shift: RosterShiftName;
  /** The day's slots in branch-local time, e.g. "08:00–14:00"; empty for Off. */
  times: string;
  /** False for a past day or a person who cannot be rostered: then the cell is text, not a button. */
  editable: boolean;
  /** A change to this cell is in flight. */
  pending?: boolean;
  /** The availability read says this shift falls outside the branch's opening hours (HO-ADM-002 §11.4): shown as words. */
  outsideOpeningHours?: boolean;
}

export interface RosterDayCell {
  intervals: RosterInterval[];
  isOnLeave: boolean;
  exceptionLabels: string[]; // "Extra shift" / "Shift cancelled"
  /** Present when the cell comes from the roster-cells read; it then replaces `intervals` and `exceptionLabels`. */
  shift?: RosterShiftInfo;
}

export interface RosterRow {
  staffAccountId: string;
  staffFullName: string;
}

export interface RosterWeekViewProps {
  weekDates: string[]; // 7 "yyyy-MM-dd", Monday first
  rows: RosterRow[];
  cellFor: (staffAccountId: string, date: string) => RosterDayCell;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onThisWeek: () => void;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  /** A click on an editable shift cell. The page decides what follows (a `Custom` day is confirmed first). */
  onCycle?: (staffAccountId: string, date: string, current: RosterShiftName) => void;
  /** Read out politely after a change, e.g. "Nadia Karim, Tuesday 4 Nov: Evening". */
  announcement?: string;
  /** A refused change, in plain language. */
  shiftError?: string | null;
}

const SHIFT_TONE: Record<RosterShiftName, BackOfficeTone> = {
  Morning: 'success',
  Evening: 'warning',
  Off: 'neutral',
  Custom: 'neutral',
};

/** "Tuesday 4 Nov" -- the day in words, for a button name and the announcement. */
export function weekdayLabel(date: string): string {
  return new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' })
    .format(new Date(`${date}T00:00:00Z`))
    .replace(',', '');
}

function ShiftCell({
  info,
  staffName,
  date,
  onCycle,
}: {
  info: RosterShiftInfo;
  staffName: string;
  date: string;
  onCycle?: () => void;
}) {
  const body = (
    <>
      <span>{info.shift}</span>
      {info.times && <span className="font-normal">{info.times}</span>}
    </>
  );
  const look = cn(
    'flex min-h-11 w-full flex-col items-start justify-center gap-0.5 rounded-lg px-3 py-1 text-left text-xs font-semibold',
    TONE_SURFACE[SHIFT_TONE[info.shift]],
  );
  if (!info.editable || !onCycle) {
    return <p className={cn(look, 'm-0')}>{body}</p>;
  }
  return (
    <button
      type="button"
      onClick={onCycle}
      disabled={info.pending}
      aria-busy={info.pending || undefined}
      aria-label={`${staffName}, ${weekdayLabel(date)}: ${info.shift}${info.times ? `, ${info.times}` : ''}. Change shift`}
      className={cn(
        look,
        'cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-60',
      )}
    >
      {body}
    </button>
  );
}

/** A shift is a pill with its times as text; leave, exceptions and "outside opening hours" are words too. */
function CellContents({
  cell,
  staffName,
  date,
  onCycle,
}: {
  cell: RosterDayCell;
  staffName: string;
  date: string;
  onCycle?: () => void;
}) {
  if (cell.shift) {
    return (
      <div className="flex flex-col items-start gap-1">
        <ShiftCell info={cell.shift} staffName={staffName} date={date} onCycle={onCycle} />
        {cell.shift.outsideOpeningHours && (
          <span className="block text-xs font-semibold text-warning-ink">Outside opening hours</span>
        )}
        {cell.isOnLeave && <StatusPill tone="neutral">On leave</StatusPill>}
      </div>
    );
  }
  if (cell.isOnLeave) {
    return <StatusPill tone="neutral">On leave</StatusPill>;
  }
  if (cell.intervals.length === 0 && cell.exceptionLabels.length === 0) {
    return <p className="text-xs text-ink-faint">—</p>;
  }
  return (
    <div className="flex flex-col items-start gap-1">
      {cell.intervals.map((interval, index) => (
        <div key={index} className="flex flex-col items-start gap-0.5">
          <StatusPill tone={interval.outsideOpeningHours ? 'warning' : 'success'}>
            {interval.label}
          </StatusPill>
          {interval.outsideOpeningHours && (
            <span className="block text-xs font-semibold text-warning-ink">
              Outside opening hours
            </span>
          )}
        </div>
      ))}
      {cell.exceptionLabels.map((label, index) => (
        <StatusPill key={index} tone="warning">
          {label}
        </StatusPill>
      ))}
    </div>
  );
}

export function RosterWeekView({
  weekDates,
  rows,
  cellFor,
  onPrevWeek,
  onNextWeek,
  onThisWeek,
  isLoading,
  isError,
  onRetry,
  onCycle,
  announcement,
  shiftError,
}: RosterWeekViewProps) {
  const firstDate = weekDates[0];
  const lastDate = weekDates[6];
  const cycle = (row: RosterRow, date: string) => {
    const info = cellFor(row.staffAccountId, date).shift;
    return onCycle && info ? () => onCycle(row.staffAccountId, date, info.shift) : undefined;
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-ink">
          {firstDate && formatDateOnly(firstDate)} – {lastDate && formatDateOnly(lastDate)}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={onPrevWeek}>
            Previous week
          </Button>
          <Button variant="secondary" size="sm" onClick={onThisWeek}>
            This week
          </Button>
          <Button variant="secondary" size="sm" onClick={onNextWeek}>
            Next week
          </Button>
        </div>
      </div>

      {onCycle && (
        <>
          {/* The legend names the shifts only; each cell shows the server's own times (OQ-15). */}
          <p className="m-0 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
            Select a day to change the shift:
            <StatusPill tone="success">Morning</StatusPill>
            <StatusPill tone="warning">Evening</StatusPill>
            <StatusPill tone="neutral">Off</StatusPill>
            <span>then back to Morning. “Custom” days are set by the weekly pattern.</span>
          </p>
          <p role="status" aria-live="polite" className="sr-only">
            {announcement}
          </p>
          {shiftError && (
            <p role="alert" className="m-0 text-sm font-semibold text-danger-ink">
              {shiftError}
            </p>
          )}
        </>
      )}

      {isLoading ? (
        <LoadingState variant="table" rows={5} />
      ) : isError ? (
        <ErrorState onRetry={onRetry} />
      ) : rows.length === 0 ? (
        <EmptyState title="No staff rostered at this branch" />
      ) : (
        <>
          {/* Desktop / tablet: a real table, row headers (staff) and column headers (days). */}
          <div
            role="region"
            aria-label="Roster (scrolls horizontally)"
            tabIndex={0}
            className="hidden overflow-x-auto rounded-2xl border border-border bg-surface md:block"
          >
            <table className="w-full min-w-[820px] border-collapse text-sm">
              <caption className="sr-only">Weekly roster</caption>
              <thead>
                <tr>
                  <th
                    scope="col"
                    className="p-3 text-left text-[13px] font-semibold text-ink-muted"
                  >
                    Staff
                  </th>
                  {weekDates.map((date) => (
                    <th
                      key={date}
                      scope="col"
                      className="p-3 text-left text-[13px] font-semibold text-ink-muted"
                    >
                      {formatDateOnly(date)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.staffAccountId}>
                    <th
                      scope="row"
                      className="border-t border-surface-sunken p-3 text-left text-sm font-semibold text-ink"
                    >
                      {row.staffFullName}
                    </th>
                    {weekDates.map((date) => (
                      <td key={date} className="border-t border-surface-sunken p-2 align-top">
                        <CellContents
                          cell={cellFor(row.staffAccountId, date)}
                          staffName={row.staffFullName}
                          date={date}
                          onCycle={cycle(row, date)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Below 768px: a list grouped by day — never a horizontally scrolling grid (UI-1). */}
          <div className="flex flex-col gap-5 md:hidden">
            {weekDates.map((date) => (
              <section key={date} aria-label={formatDateOnly(date)}>
                <h3 className="mb-2 text-sm font-semibold text-ink">{formatDateOnly(date)}</h3>
                <ul className="flex flex-col gap-2">
                  {rows.map((row) => (
                    <li
                      key={row.staffAccountId}
                      className="rounded-2xl border border-border bg-surface p-3"
                    >
                      <p className="text-sm font-semibold text-ink">{row.staffFullName}</p>
                      <CellContents
                        cell={cellFor(row.staffAccountId, date)}
                        staffName={row.staffFullName}
                        date={date}
                        onCycle={cycle(row, date)}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

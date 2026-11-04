'use client';

import { use, useMemo, useState } from 'react';
import { useAdminBranch } from '@/lib/hooks/useAdminBranches';
import {
  useBranchRosters,
  useAvailability,
  useRosterCells,
  useRosterExceptions,
  useSetRosterPattern,
  useSetRosterShift,
  useCancelScheduledRosterPattern,
  useCreateRosterException,
  useCancelRosterException,
} from '@/lib/hooks/useAdminRosters';
import { useAdminLeaveRequests } from '@/lib/hooks/useLeave';
import { useStaffAccounts } from '@/lib/hooks/useStaffAdmin';
import { Panel } from '@/components/back-office/Panel';
import { RosterWeekView, weekdayLabel, type RosterDayCell } from '@/components/roster/RosterWeekView';
import { describeShiftError, nextRosterShift } from '@/components/roster/shiftCycle';
import { RosterPatternEditor } from '@/components/roster/RosterPatternEditor';
import { RosterExceptionForm } from '@/components/roster/RosterExceptionForm';
import { LoadingState } from '@/components/common/LoadingState';
import { AccessRefusedState } from '@/components/admin/AccessRefusedState';
import { ApiForbiddenError } from '@/lib/api/client';
import { ROSTERABLE_ROLE_IDS, type RosterShiftName } from '@/lib/api/admin-rosters';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { getWeekDates, shiftWeek, todayIso } from '@/lib/format/week';
import { localDateOf, todayInZone } from '@/lib/format/time';

/** `/staff/admin/branches/[branchId]/roster` — US-ADM-03. Week view (OQ-1: defaults to this
 *  week), pattern editor per staff member, and roster exceptions. HO-P5 §11.5.8 (BG-23, ADR-FE-192): the grid reads
 *  `.../roster-cells` for the shown week and each cell is a button — one `PUT` per click cycles Morning → Evening → Off →
 *  Morning, a `Custom` day is confirmed first, and the cell is replaced by the server's answer. Past days and people whose
 *  role cannot be rostered are not buttons. */
export default function BranchRosterPage({ params }: { params: Promise<{ branchId: string }> }) {
  const { branchId } = use(params);
  const { data: branch } = useAdminBranch(branchId);
  const rosters = useBranchRosters(branchId);
  const staffAccounts = useStaffAccounts({ pageSize: 100 });

  const [anchor, setAnchor] = useState(todayIso());
  const weekDates = useMemo(() => getWeekDates(anchor), [anchor]);
  const from = weekDates[0] ?? anchor;
  const to = weekDates[6] ?? anchor;

  const cells = useRosterCells(branchId, { from, to });
  // Not the grid's own data (the cells are what was rostered), but the one thing it cannot say: that a rostered shift falls
  // outside the opening hours (unrestricted, so those shifts show too — HO-ADM-001 §8.5 rule 6).
  const availability = useAvailability(branchId, { from, to, restrictToOpeningHours: false });
  const setShift = useSetRosterShift(branchId);
  const exceptions = useRosterExceptions(branchId, { from, to });
  const leave = useAdminLeaveRequests({ status: 'Approved', from, to, pageSize: 100 });

  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [pendingCancelException, setPendingCancelException] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [shiftError, setShiftError] = useState<string | null>(null);
  const [confirmCustom, setConfirmCustom] = useState<{ staffAccountId: string; date: string } | null>(null);

  const setPatternMutation = useSetRosterPattern(branchId, selectedStaffId ?? '');
  const cancelPatternMutation = useCancelScheduledRosterPattern(branchId, selectedStaffId ?? '');
  const createExceptionMutation = useCreateRosterException(branchId);
  const cancelExceptionMutation = useCancelRosterException(branchId);

  const nameById = new Map((staffAccounts.data?.items ?? []).map((s) => [s.id, s.fullName]));
  // Presentation only: the roles that can hold a roster (`StaffRosterRules`); the server still refuses with `StaffNotRosterable`.
  const rosterableIds = new Set(
    (staffAccounts.data?.items ?? [])
      .filter((s) => s.roleIds.some((role) => ROSTERABLE_ROLE_IDS.includes(role)))
      .map((s) => s.id),
  );
  const rows = (rosters.data ?? []).map((r) => ({
    staffAccountId: r.staffAccountId,
    staffFullName: nameById.get(r.staffAccountId) ?? r.staffAccountId,
  }));
  const selectedRoster = (rosters.data ?? []).find((r) => r.staffAccountId === selectedStaffId);
  // Owner, 2026-10-22: anyone can be given a FIRST pattern here -- the list used to offer only staff who already had a
  // roster, so with none yet nobody could be rostered and no shifts could be planned. The API refuses a staff
  // member not assigned to this branch, and the editor shows that message.
  const rosteredIds = new Set(rows.map((r) => r.staffAccountId));
  const patternOptions = [
    ...rows,
    ...(staffAccounts.data?.items ?? [])
      .filter((s) => !rosteredIds.has(s.id))
      .map((s) => ({ staffAccountId: s.id, staffFullName: `${s.fullName} (no shifts yet)` })),
  ];

  function cellFor(staffAccountId: string, date: string): RosterDayCell {
    const zone = branch?.timeZoneId ?? 'UTC';
    const onLeave = (leave.data?.items ?? []).some(
      (l) => l.staffAccountId === staffAccountId && date >= l.startsOn && date <= l.endsOn,
    );
    const cell = (cells.data ?? []).find((c) => c.staffAccountId === staffAccountId && c.date === date);
    const outsideOpeningHours = (availability.data ?? []).some(
      (a) => a.staffAccountId === staffAccountId && a.outsideOpeningHours && localDateOf(a.start, zone) === date,
    );
    const pending =
      setShift.isPending &&
      setShift.variables?.staffAccountId === staffAccountId &&
      setShift.variables.date === date;
    return {
      intervals: [],
      isOnLeave: onLeave,
      exceptionLabels: [],
      shift: cell && {
        shift: cell.shift,
        times: cell.slots.map((slot) => `${slot.starts}–${slot.ends}`).join(', '),
        // Today or later in the branch's own day, and a person who can be rostered.
        editable: rosterableIds.has(staffAccountId) && date >= todayInZone(zone),
        pending,
        outsideOpeningHours,
      },
    };
  }

  async function changeShift(staffAccountId: string, date: string, current: RosterShiftName) {
    // A Custom day carries hours of its own (the weekly pattern, or an exception): ask before replacing them.
    if (current === 'Custom') {
      setConfirmCustom({ staffAccountId, date });
      return;
    }
    await applyShift(staffAccountId, date, nextRosterShift(current));
  }

  async function applyShift(staffAccountId: string, date: string, shift: ReturnType<typeof nextRosterShift>) {
    setShiftError(null);
    try {
      const cell = await setShift.mutateAsync({ staffAccountId, date, shift });
      setAnnouncement(`${nameById.get(staffAccountId) ?? 'Staff member'}, ${weekdayLabel(date)}: ${cell.shift}`);
    } catch (error) {
      setShiftError(describeShiftError(error));
    }
  }

  // §18 A3: Rosters.View excludes Accountant and ShopManager, who can still reach the branch
  // pages (Branches.View covers all staff) — a rosters/availability/exceptions 403 is a
  // permission refusal, not a generic load failure.
  const refusal = [rosters, cells, availability, exceptions]
    .map((query) => query.error)
    .find((error) => error instanceof ApiForbiddenError);
  if (refusal) return <AccessRefusedState error={refusal} />;

  if (!branch) return <LoadingState rows={6} />;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-ink">Roster</h2>
        <p className="mt-1 text-sm text-ink-muted">
          {branch.name} · times shown in {branch.timeZoneId}.
        </p>
      </div>

      <RosterWeekView
        weekDates={weekDates}
        rows={rows}
        cellFor={cellFor}
        onPrevWeek={() => setAnchor((a) => shiftWeek(a, -1))}
        onNextWeek={() => setAnchor((a) => shiftWeek(a, 1))}
        onThisWeek={() => setAnchor(todayIso())}
        isLoading={rosters.isLoading || cells.isLoading}
        isError={rosters.isError || cells.isError}
        onRetry={() => {
          void rosters.refetch();
          void cells.refetch();
        }}
        onCycle={changeShift}
        announcement={announcement}
        shiftError={shiftError}
      />

      <Panel title="Shift patterns">
       <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="pattern-staff" className="text-sm font-semibold text-ink">
            Staff member
          </label>
          <select
            id="pattern-staff"
            value={selectedStaffId ?? ''}
            onChange={(e) => setSelectedStaffId(e.target.value || null)}
            className="w-fit max-w-full rounded-[var(--radius-sm)] border border-border-strong bg-surface px-3 py-2 text-sm text-ink"
          >
            <option value="">Choose…</option>
            {patternOptions.map((r) => (
              <option key={r.staffAccountId} value={r.staffAccountId}>
                {r.staffFullName}
              </option>
            ))}
          </select>
        </div>

        {selectedStaffId && (
          <RosterPatternEditor
            key={selectedStaffId}
            staffFullName={nameById.get(selectedStaffId) ?? selectedStaffId}
            timeZoneId={branch.timeZoneId}
            currentPattern={selectedRoster?.currentPattern ?? []}
            nextPattern={selectedRoster?.nextPattern ?? null}
            nextPatternEffectiveFrom={selectedRoster?.nextPatternEffectiveFrom ?? null}
            isPending={setPatternMutation.isPending || cancelPatternMutation.isPending}
            onSetPattern={(slots, effectiveFrom) =>
              setPatternMutation.mutateAsync({ slots, effectiveFrom })
            }
            onCancelScheduled={() => cancelPatternMutation.mutateAsync()}
          />
        )}
       </div>
      </Panel>

      <Panel title="Roster exceptions">
       <div className="flex flex-col gap-3">
        <RosterExceptionForm
          timeZoneId={branch.timeZoneId}
          staffOptions={rows}
          isPending={createExceptionMutation.isPending}
          onCreate={(request) => createExceptionMutation.mutateAsync(request)}
        />
        <ul className="flex flex-col gap-2">
          {(exceptions.data ?? []).map((exception) => (
            <li
              key={exception.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-md)] border border-surface-sunken bg-surface-page p-3 text-sm"
            >
              <span>
                {nameById.get(exception.staffAccountId) ?? exception.staffAccountId} ·{' '}
                {exception.date} ·{' '}
                {exception.kind === 'ExtraShift' ? 'Extra shift' : 'Shift cancelled'} (
                {exception.starts}–{exception.ends})
              </span>
              <button
                type="button"
                className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-danger-ink underline"
                onClick={() => setPendingCancelException(exception.id)}
              >
                Cancel
              </button>
            </li>
          ))}
        </ul>
       </div>
      </Panel>

      <ConfirmDialog
        open={!!confirmCustom}
        onOpenChange={(open) => !open && setConfirmCustom(null)}
        title="Replace this day's hours?"
        consequence={
          confirmCustom
            ? `${nameById.get(confirmCustom.staffAccountId) ?? 'This person'} has their own hours on ${weekdayLabel(confirmCustom.date)}. Setting a shift replaces them with the Morning shift for that day.`
            : ''
        }
        confirmLabel="Replace hours"
        variant="destructive"
        onConfirm={async () => {
          if (confirmCustom) await applyShift(confirmCustom.staffAccountId, confirmCustom.date, 'Morning');
          setConfirmCustom(null);
        }}
      />

      <ConfirmDialog
        open={!!pendingCancelException}
        onOpenChange={(open) => !open && setPendingCancelException(null)}
        title="Cancel this exception?"
        consequence="This roster exception will be removed."
        confirmLabel="Cancel exception"
        variant="destructive"
        onConfirm={async () => {
          if (pendingCancelException)
            await cancelExceptionMutation.mutateAsync(pendingCancelException);
          setPendingCancelException(null);
        }}
      />
    </div>
  );
}

'use client';

import { BarChart3 } from 'lucide-react';
import { Panel } from '@/components/back-office/Panel';
import { ReportErrorView } from '@/components/reports/ReportErrorView';
import { useReportCatalogue } from '@/lib/hooks/useReports';

/**
 * `/staff/reports` — HO-RPT-002 §11.3, HO-P4 §11.2.6, US-RPT-01. The layout draws the heading and
 * the report list; this page is the right-hand "Choose a report" panel, shown from 1024 px up (below
 * that the list is the whole screen). The server returns only the reports the caller may open
 * (ADR-FE-137); a `403` (a role with no reports) renders `PermissionDeniedState` here, in place of
 * the whole two-column screen.
 */
export default function ReportsPage() {
  const catalogue = useReportCatalogue();

  if (catalogue.isError) {
    return (
      <div className="flex flex-col gap-5">
        <h1 className="font-display text-[30px] font-bold text-ink">Reports</h1>
        <ReportErrorView error={catalogue.error} onRetry={() => void catalogue.refetch()} />
      </div>
    );
  }

  return (
    <div className="hidden lg:block">
      <Panel aria-label="Report">
        <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
          <BarChart3 size={28} aria-hidden="true" className="text-ink-faint" />
          <p className="font-display text-lg font-semibold text-ink">Choose a report</p>
          <p className="max-w-sm text-sm text-ink-muted">
            Pick a report from the list to see its figures. You can change the dates and the
            branch, then export it.
          </p>
        </div>
      </Panel>
    </div>
  );
}

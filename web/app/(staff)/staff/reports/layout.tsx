'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { PageHeader } from '@/components/back-office/PageHeader';
import { Panel } from '@/components/back-office/Panel';
import { LoadingState } from '@/components/common/LoadingState';
import { ReportCatalogue } from '@/components/reports/ReportCatalogue';
import { useReportCatalogue } from '@/lib/hooks/useReports';
import { cn } from '@/lib/utils';

const REPORTS_ROOT = '/staff/reports';

/**
 * `/staff/reports/**` — HO-P4 §11.2.6, US-RPT-01…04. The Reports screen's two columns: the report
 * list (a nav, grouped by the catalogue's own categories) on the left and the page — the "Choose a
 * report" panel or the viewer — on the right. From 1024 px up both show; below it `/staff/reports`
 * is the list alone and a report is the viewer alone (it carries an "All reports" link back). When
 * the catalogue fails (a `403` for a role with no reports, say) the page renders its own error and
 * the list column is dropped.
 */
export default function ReportsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const catalogue = useReportCatalogue();

  const onIndex = pathname === REPORTS_ROOT || pathname === `${REPORTS_ROOT}/`;
  const currentKey = onIndex
    ? undefined
    : decodeURIComponent(pathname.slice(REPORTS_ROOT.length + 1).split('/')[0] ?? '');

  if (catalogue.isError) {
    return <div className="flex flex-col gap-5">{children}</div>;
  }

  return (
    <div className="flex flex-col gap-5">
      {onIndex && (
        <PageHeader
          title="Reports"
          description="Every report filters by date range and branch, and exports to CSV or PDF."
        />
      )}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <aside
          className={cn(
            'min-w-0 lg:sticky lg:top-4 lg:block lg:w-80 lg:flex-none',
            onIndex ? 'block' : 'hidden',
          )}
        >
          <Panel aria-label="Reports">
            {catalogue.isPending ? (
              <LoadingState variant="card" rows={6} label="Loading reports…" />
            ) : (
              <ReportCatalogue reports={catalogue.data ?? []} currentKey={currentKey} />
            )}
          </Panel>
        </aside>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

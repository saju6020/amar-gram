'use client';

import { PageHeader } from '@/components/back-office/PageHeader';
import { LoadingState } from '@/components/common/LoadingState';
import { DashboardAttention } from '@/components/back-office-overview/DashboardAttention';
import { DashboardLatestOrders } from '@/components/back-office-overview/DashboardLatestOrders';
import { DashboardPipeline } from '@/components/back-office-overview/DashboardPipeline';
import { DashboardSalesChart } from '@/components/dashboard/DashboardSalesChart';
import { DashboardView } from '@/components/dashboard/DashboardView';
import { ReportErrorView } from '@/components/reports/ReportErrorView';
import { firstNameOf } from '@/lib/hooks/useCustomerFirstName';
import { useStaffSession } from '@/lib/hooks/useSession';
import { useDashboard } from '@/lib/hooks/useReports';

/**
 * `/staff` — HO-RPT-002 §11.2, HO-P4 §11.2, US-RPT-05, ADR-FE-130. The staff home: today's figures
 * for the signed-in role at the active branch, polled on the payload's `refreshSeconds` while the
 * tab is visible (ADR-FE-135), then (HO-P5 S2) the 14-day sales chart (BG-1) and the orders-in-progress
 * pipeline (BG-2), then "Needs attention" and "Latest orders". Cash on delivery with riders (BG-5) is one
 * of the server's tiles and needs no component. The active-branch picker is in the staff shell's
 * sidebar. A `403` renders `PermissionDeniedState`; the nav entry is presentation only. Subscriptions
 * due tomorrow and suspended subscriptions (BG-15) are rows in `DashboardAttention` (HO-P6 S3, §11.4.4).
 */
export default function StaffHomePage() {
  const dashboard = useDashboard();
  const session = useStaffSession();

  // Keep showing the last good tiles when a background refresh fails (ADR-FE-135) — an error banner
  // must not replace the page under an open dialog.
  if (dashboard.data) {
    return (
      <DashboardView
        dashboard={dashboard.data}
        updatedAt={dashboard.dataUpdatedAt}
        refreshFailed={dashboard.isRefetchError}
        greetingName={firstNameOf(session.data?.fullName)}
        panels={
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <DashboardSalesChart />
              <DashboardPipeline />
            </div>
            <div className="grid grid-cols-1 items-start gap-4 2xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
              <DashboardAttention />
              <DashboardLatestOrders />
            </div>
          </div>
        }
      />
    );
  }

  if (dashboard.isPending) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="Today" />
        <LoadingState variant="card" rows={5} label="Loading today's figures…" />
      </div>
    );
  }

  if (dashboard.isError) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="Today" />
        <ReportErrorView error={dashboard.error} onRetry={() => void dashboard.refetch()} />
      </div>
    );
  }

  return null;
}

'use client';

import { use } from 'react';
import { usePathname } from 'next/navigation';
import { PageHeader } from '@/components/back-office/PageHeader';
import { UnderlineTabs } from '@/components/back-office/UnderlineTabs';
import { useAdminBranch } from '@/lib/hooks/useAdminBranches';
import { LoadingState } from '@/components/common/LoadingState';
import { ErrorState } from '@/components/common/ErrorState';
import { PermissionDeniedState } from '@/components/admin/PermissionDeniedState';
import { ApiForbiddenError, ApiNotFoundError } from '@/lib/api/client';

const TABS = [
  { segment: '', label: 'Details' },
  { segment: 'hours', label: 'Opening hours' },
  { segment: 'closures', label: 'Closures' },
  { segment: 'calendar', label: 'Calendar' },
  { segment: 'roster', label: 'Roster' },
];

/** `/staff/admin/branches/[branchId]` — HO-ADM-002 §8.1. Tabs: Details · Opening hours ·
 *  Closures · Calendar · Roster. */
export default function BranchDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ branchId: string }>;
}) {
  const { branchId } = use(params);
  const { data: branch, isLoading, isError, error, refetch } = useAdminBranch(branchId);
  const pathname = usePathname();
  const basePath = `/staff/admin/branches/${branchId}`;

  if (error instanceof ApiForbiddenError) return <PermissionDeniedState />;
  if (error instanceof ApiNotFoundError) {
    return <ErrorState title="Branch not found" description="This branch may have been removed." />;
  }
  if (isLoading) return <LoadingState rows={5} label="Loading branch…" />;
  if (isError && !branch) {
    return (
      <ErrorState description="We couldn't load this branch just now." onRetry={() => refetch()} />
    );
  }
  if (!branch) return null;

  const currentTab = TABS.find(
    (tab) => (tab.segment ? `${basePath}/${tab.segment}` : basePath) === pathname,
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={branch.name} description={`${branch.code} · ${branch.timeZoneId}`} />

      <UnderlineTabs
        mode="link"
        label="Branch sections"
        value={currentTab ? currentTab.segment || 'details' : undefined}
        items={TABS.map((tab) => ({
          key: tab.segment || 'details',
          label: tab.label,
          href: tab.segment ? `${basePath}/${tab.segment}` : basePath,
        }))}
      />

      {children}
    </div>
  );
}

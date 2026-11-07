'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { AccessRefusedState } from '@/components/admin/AccessRefusedState';
import { PageHeader } from '@/components/back-office/PageHeader';
import { ErrorState } from '@/components/common/ErrorState';
import { LoadingState } from '@/components/common/LoadingState';
import { ApiForbiddenError, ApiNotFoundError } from '@/lib/api/client';
import { useStaffSubscription } from '@/lib/hooks/useStaffSubscriptions';
import { SUBSCRIPTION_NOT_FOUND_MESSAGE } from '@/lib/subscriptions/errors';
import { formatCycleDate } from '@/lib/subscriptions/dates';
import { suspensionReasonLabel } from '@/lib/subscriptions/labels';
import { isGuid } from '@/lib/validation/guid';
import { CycleHistory } from './CycleHistory';
import { CustomerPanel, SchedulePanel, TermsPanel } from './DetailPanels';
import { EstimatePanel, RecordsPanel } from './DetailPanelsMore';
import { StaffActions } from './StaffActions';
import { SubscriptionStatusPill } from './SubscriptionStatusPill';
import { productLine } from './SubscriptionRowCells';
import { SUSPENDED_NO_ORDERS } from '@/lib/subscriptions/copy';

const BACK_LINK =
  'inline-flex min-h-11 w-fit items-center gap-1 text-sm font-semibold text-accent-ink no-underline hover:underline';

function NotFound() {
  return (
    <div className="flex flex-col gap-3">
      <p role="alert" className="text-[15px] font-semibold text-ink">
        {SUBSCRIPTION_NOT_FOUND_MESSAGE}
      </p>
      <Link href="/staff/subscriptions" className={BACK_LINK}>
        <ChevronLeft size={14} aria-hidden="true" />
        All subscriptions
      </Link>
    </div>
  );
}

/**
 * HO-P6 S2 (§11.3.5, US-SUB-05 adapted, US-SUB-06). The staff detail: read-only panels for everyone with `Subscriptions.View`,
 * and the two actions the server allows for those who can manage. A write re-reads this page's data (ADR-FE-194), and its
 * outcome is announced in a status region until the next action.
 */
export function StaffSubscriptionDetailScreen({ subscriptionId }: { subscriptionId: string }) {
  const valid = isGuid(subscriptionId);
  const query = useStaffSubscription(subscriptionId, valid);
  const [notice, setNotice] = useState('');

  if (!valid || query.error instanceof ApiNotFoundError) return <NotFound />;
  if (query.error instanceof ApiForbiddenError) return <AccessRefusedState error={query.error} />;
  if (query.isLoading) return <LoadingState rows={6} label="Loading subscription…" />;
  if (query.isError || !query.data) return <ErrorState onRetry={() => void query.refetch()} />;

  const s = query.data;
  return (
    <div className="flex flex-col gap-5">
      <Link href="/staff/subscriptions" className={BACK_LINK}>
        <ChevronLeft size={14} aria-hidden="true" />
        All subscriptions
      </Link>
      <PageHeader
        title={productLine(s.product)}
        description={`${s.customer.name} · first delivery ${formatCycleDate(s.startedOn)}`}
        actions={<SubscriptionStatusPill status={s.status} suspensionReason={s.suspensionReason} showReason />}
      />
      <div role="status" aria-live="polite" className="empty:hidden rounded-[var(--radius-md)] border border-border bg-surface-sunken p-3 text-sm font-semibold text-ink">
        {notice}
      </div>
      {s.status === 'Suspended' && (
        <p className="rounded-[var(--radius-md)] border border-border bg-warning-bg p-4 text-sm text-warning-ink">
          <span className="font-semibold">Suspended{s.suspensionReason ? `: ${suspensionReasonLabel(s.suspensionReason)}` : ''}.</span>{' '}
          {SUSPENDED_NO_ORDERS}
        </p>
      )}
      <StaffActions subscription={s} onDone={setNotice} />
      <div className="grid gap-5 lg:grid-cols-2">
        <SchedulePanel subscription={s} />
        <TermsPanel subscription={s} />
        <CustomerPanel customer={s.customer} />
        <RecordsPanel subscription={s} />
        <EstimatePanel estimate={s.estimate} />
      </div>
      <CycleHistory subscriptionId={s.id} cycles={s.cycles} zone={s.commerceTimeZoneId} />
    </div>
  );
}

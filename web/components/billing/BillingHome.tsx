'use client';

import Link from 'next/link';
import { ClipboardCheck, FileText, HandCoins } from 'lucide-react';
import { addDaysIso, formatDateOnly, todayInZone } from '@/lib/format/time';
import { useActiveBranchZone } from '@/lib/hooks/billing/useActiveBranchZone';
import { useApprovals, useInvoices, usePayments, useUncapturedSources } from '@/lib/hooks/billing/useBillingQueries';
import { useCaptureSource } from '@/lib/hooks/billing/useBillingMutations';
import { useStaffSession } from '@/lib/hooks/useSession';
import { KpiTile } from '@/components/back-office/KpiTile';
import { Panel } from '@/components/back-office/Panel';
import { Amount } from './Amount';
import { BillingCustomerSearch } from './BillingCustomerSearch';
import { PageHeader } from './PageHeader';
import { PaymentStatusPill } from './StatusPill';
import { UncapturedSourcesCard } from './UncapturedSourcesCard';

/**
 * `components/billing/BillingHome.tsx` — HO-BIL-002 §11.1. The Billing overview: customer search, then
 * cards for *Pending approvals* (approvers only — hidden otherwise; the server still decides),
 * *Drafts*, *Uncaptured charges* (with **Capture**) and *Today's payments* at the active branch.
 */
const APPROVER_ROLES = ['Administrator', 'Accountant'];

export function BillingHome() {
  const { zone } = useActiveBranchZone();
  const today = todayInZone(zone);
  const { data: session } = useStaffSession();
  const isApprover = (session?.roleIds ?? []).some((role) => APPROVER_ROLES.includes(role));

  const approvals = useApprovals(isApprover);
  const drafts = useInvoices({ status: 'Draft', pageSize: 8 });
  const todays = usePayments({ from: today, to: today, pageSize: 8 });
  const uncaptured = useUncapturedSources(addDaysIso(today, -30), today);
  const capture = useCaptureSource();

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Billing" description="Charges, invoices, payments and the day’s close." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isApprover && (
          <KpiTile
            label="Pending approvals"
            value={approvals.isLoading ? '…' : approvals.isError ? '—' : approvals.data?.length ?? 0}
            href="/staff/billing/approvals"
            tone={approvals.data?.length ? 'warning' : 'neutral'}
            note={approvals.data?.length ? 'Needs a second person' : undefined}
          />
        )}
        <KpiTile label="Drafts" value={drafts.isLoading ? '…' : drafts.isError ? '—' : drafts.data?.totalCount ?? 0} href="/staff/billing/invoices?status=Draft" />
        <KpiTile label="Payments today" value={todays.isLoading ? '…' : todays.isError ? '—' : todays.data?.totalCount ?? 0} href="/staff/billing/payments" />
      </div>
      <Panel title="Find a customer">
        <BillingCustomerSearch />
      </Panel>
      <div className="grid min-w-0 gap-5 lg:grid-cols-2">
        {isApprover && (
          <Panel title="Approvals queue">
           <div className="flex flex-col gap-3">
            <p className="text-sm text-ink-muted">Large payments wait for a second person.</p>
            <p className="text-sm text-ink">
              {approvals.isLoading
                ? 'Loading…'
                : approvals.isError
                  ? 'We couldn’t load the queue.'
                  : approvals.data?.length
                    ? `${approvals.data.length} waiting for approval.`
                    : 'Nothing is waiting.'}
            </p>
            <Link href="/staff/billing/approvals" className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-accent-ink hover:underline">
              <ClipboardCheck size={14} aria-hidden="true" />
              Open the approvals queue
            </Link>
           </div>
          </Panel>
        )}
        <Panel title="Draft invoices">
         <div className="flex flex-col gap-3">
          <p className="text-sm text-ink-muted">Invoices saved but not issued.</p>
          {drafts.isLoading ? (
            <p role="status" className="text-sm text-ink-muted">Loading…</p>
          ) : drafts.isError ? (
            <p role="alert" className="text-sm text-danger-ink">We couldn’t load the drafts.</p>
          ) : (drafts.data?.items.length ?? 0) === 0 ? (
            <p className="text-sm text-ink-muted">No drafts.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {drafts.data?.items.map((d) => (
                <li key={d.invoiceId}>
                  <Link href={`/staff/billing/invoices/${d.invoiceId}`} className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-sm)] border border-border p-2 text-sm no-underline hover:bg-surface-sunken">
                    <span className="flex items-center gap-2 font-semibold text-ink">
                      <FileText size={14} aria-hidden="true" />
                      Draft for {d.customerName}
                    </span>
                    <Amount money={d.total} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
         </div>
        </Panel>
        <UncapturedSourcesCard
          sources={uncaptured.data}
          zone={zone}
          isLoading={uncaptured.isLoading}
          isError={uncaptured.isError}
          onRetry={() => void uncaptured.refetch()}
          onCapture={(source) => capture.mutateAsync({ sourceKind: source.sourceKind, sourceId: source.sourceId })}
        />
        <Panel title="Today’s payments">
         <div className="flex flex-col gap-3">
          <p className="text-sm text-ink-muted">{formatDateOnly(today)}</p>
          {todays.isLoading ? (
            <p role="status" className="text-sm text-ink-muted">Loading…</p>
          ) : todays.isError ? (
            <p role="alert" className="text-sm text-danger-ink">We couldn’t load today’s payments.</p>
          ) : (todays.data?.items.length ?? 0) === 0 ? (
            <p className="text-sm text-ink-muted">No payments recorded today.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {todays.data?.items.map((p) => (
                <li key={p.paymentId}>
                  <Link href={`/staff/billing/payments/${p.paymentId}`} className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-sm)] border border-border p-2 text-sm no-underline hover:bg-surface-sunken">
                    <span className="flex flex-wrap items-center gap-2 text-ink">
                      <HandCoins size={14} aria-hidden="true" />
                      <span className="font-semibold">{p.receiptNumber ?? 'Awaiting approval'}</span>
                      <span className="text-ink-muted">{p.customerName}</span>
                      <PaymentStatusPill status={p.status} />
                    </span>
                    <Amount money={p.amount} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link href="/staff/billing/payments" className="w-fit text-sm font-semibold text-accent-ink hover:underline">
            All payments
          </Link>
         </div>
        </Panel>
      </div>
    </div>
  );
}

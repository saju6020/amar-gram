'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { ErrorState } from '@/components/common/ErrorState';
import { LoadingState } from '@/components/common/LoadingState';
import { HearthEmpty } from '@/components/hearth/HearthEmpty';
import { buttonVariants } from '@/components/ui/button';
import { ApiNotFoundError } from '@/lib/api/client';
import type { SubscriptionAction } from '@/lib/api/subscriptions';
import { useMySubscription, useOutletContacts } from '@/lib/hooks/useSubscriptions';
import { subscribedAlert } from '@/lib/subscriptions/copy';
import { SUBSCRIPTION_NOT_FOUND_MESSAGE } from '@/lib/subscriptions/errors';
import { CancelDialog } from './CancelDialog';
import { ChangeTermsDialog } from './ChangeTermsDialog';
import { CycleHistory } from './CycleHistory';
import {
  EstimatePanel,
  NextDeliveryPanel,
  PendingChangesPanel,
  SuspensionBanner,
  TermsPanel,
} from './DetailPanels';
import { PauseDialog } from './PauseDialog';
import { ProductThumb } from './ProductThumb';
import { ResumeDialog } from './ResumeDialog';
import { SkipDialog } from './SkipDialog';
import { SkipLinkHandler } from './SkipLinkHandler';
import { SubscriptionActions } from './SubscriptionActions';
import { SubscriptionStatusBadge } from './SubscriptionStatusBadge';
import { WithdrawDialog } from './WithdrawDialog';

type Dialog = 'change' | 'skip' | 'pause' | 'resume' | 'cancel' | 'withdraw' | null;

/**
 * `/portal/subscriptions/[subscriptionId]` — HO-P6 §11.2.5, US-SUB-01 to 03 and 06. The panels render from the server's
 * view: the next delivery and cut-off, any suspension, scheduled changes, the terms, the estimate (as sent), the action
 * buttons (only `allowedActions`) and the history. Every action is confirmed in a dialog and answered with the server's
 * sentence in a `role="status"` region, which stays until the next action. Nothing here adds days, compares a date with
 * today or computes a price (ADR-FE-110, ADR-FE-113). A 404, which is also someone else's subscription, says so and links back.
 */
export function SubscriptionDetail({ id }: { id: string }) {
  const query = useMySubscription(id);
  const outlets = useOutletContacts();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [skipDate, setSkipDate] = useState<string | null>(null);
  const [focusAddress, setFocusAddress] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  // "?subscribed=1" comes from the Subscribe form; it is read once and removed from the address.
  const [justSubscribed] = useState(() => params.get('subscribed') === '1');
  const subscription = query.data;

  useEffect(() => {
    if (params.get('subscribed') === '1') router.replace(pathname, { scroll: false });
  }, [params, pathname, router]);

  const openSkip = useCallback((cycleOn: string) => {
    setSkipDate(cycleOn);
    setDialog('skip');
  }, []);

  function onAction(action: SubscriptionAction) {
    if (!subscription) return;
    setFocusAddress(false);
    if (action === 'Skip') {
      if (subscription.skippableCycleOn) openSkip(subscription.skippableCycleOn);
      return;
    }
    const next: Record<Exclude<SubscriptionAction, 'Skip'>, Dialog> = {
      ChangeTerms: 'change',
      Pause: 'pause',
      Resume: 'resume',
      Cancel: 'cancel',
      WithdrawPending: 'withdraw',
    };
    setDialog(next[action]);
  }

  const close = (next: boolean) => {
    if (!next) setDialog(null);
  };
  const shown =
    message ?? (justSubscribed && subscription?.nextDeliveryOn ? subscribedAlert(subscription.nextDeliveryOn) : null);

  if (query.isPending) return <LoadingState rows={8} label="Loading your subscription…" />;
  if (query.error instanceof ApiNotFoundError) {
    return (
      <HearthEmpty
        title={SUBSCRIPTION_NOT_FOUND_MESSAGE}
        action={
          <Link href="/portal/subscriptions" className={buttonVariants({ variant: 'pill', size: 'pillMd' })}>
            Back to my subscriptions
          </Link>
        }
      />
    );
  }
  if (query.isError || !subscription) return <ErrorState onRetry={() => void query.refetch()} />;

  const product = subscription.product;
  const dialogProps = { subscription, open: false, onOpenChange: close, onDone: setMessage };

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/portal/subscriptions"
        className="inline-flex min-h-11 w-fit items-center gap-1.5 text-sm font-semibold text-accent-ink"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        My subscriptions
      </Link>

      <header className="flex items-center gap-4">
        <ProductThumb imageUrl={product.imageUrl} className="size-20" />
        <div className="flex min-w-0 flex-col items-start gap-2">
          <h1 className="m-0 font-display text-[28px] font-bold leading-tight text-ink [overflow-wrap:anywhere] md:text-[34px]">
            {product.variantLabel ? `${product.productName} · ${product.variantLabel}` : product.productName}
          </h1>
          <SubscriptionStatusBadge status={subscription.status} />
        </div>
      </header>

      {/* The last answer from the server (or the welcome after subscribing), announced politely and kept until the next action. */}
      <div role="status" aria-live="polite" className={shown ? 'rounded-2xl border-[1.5px] border-leaf/20 bg-leaf-soft px-[18px] py-3.5 text-sm font-semibold text-leaf-ink' : undefined}>
        {shown}
      </div>

      <SkipLinkHandler subscription={subscription} onSkip={openSkip} />
      <SuspensionBanner subscription={subscription} outlets={outlets.data} />

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <NextDeliveryPanel subscription={subscription} />
        <PendingChangesPanel subscription={subscription} />
        <TermsPanel
          subscription={subscription}
          onChooseAddress={
            subscription.allowedActions.includes('ChangeTerms')
              ? () => {
                  setFocusAddress(true);
                  setDialog('change');
                }
              : undefined
          }
        />
        <EstimatePanel subscription={subscription} />
      </div>

      <SubscriptionActions subscription={subscription} onAction={onAction} />

      <CycleHistory
        subscriptionId={subscription.id}
        cycles={subscription.cycles}
        zone={subscription.commerceTimeZoneId}
      />

      <ChangeTermsDialog {...dialogProps} open={dialog === 'change'} focusAddress={focusAddress} />
      {skipDate && <SkipDialog {...dialogProps} open={dialog === 'skip'} cycleOn={skipDate} />}
      <PauseDialog {...dialogProps} open={dialog === 'pause'} />
      <ResumeDialog {...dialogProps} open={dialog === 'resume'} />
      <CancelDialog {...dialogProps} open={dialog === 'cancel'} />
      <WithdrawDialog {...dialogProps} open={dialog === 'withdraw'} />
    </div>
  );
}

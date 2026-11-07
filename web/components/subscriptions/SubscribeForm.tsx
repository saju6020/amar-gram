'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ErrorState } from '@/components/common/ErrorState';
import { LoadingState } from '@/components/common/LoadingState';
import { GreetingHeader } from '@/components/hearth/GreetingHeader';
import { HearthEmpty } from '@/components/hearth/HearthEmpty';
import { buttonVariants } from '@/components/ui/button';
import { ApiNotFoundError } from '@/lib/api/client';
import { useSubscriptionOptions } from '@/lib/hooks/useSubscriptions';
import { ALREADY_SUBSCRIBED_TEXT, SUBSCRIBE_NOT_OFFERED_TITLE, SUBSCRIBE_PAGE_INTRO } from '@/lib/subscriptions/copy';
import { PRODUCT_NOT_FOUND_MESSAGE } from '@/lib/subscriptions/errors';
import { SubscribeFormBody } from './SubscribeFormBody';

const SHOP_LINK = (
  <Link href="/shop" className={buttonVariants({ variant: 'pill', size: 'pillMd' })}>
    Back to the shop
  </Link>
);

/**
 * `/portal/subscriptions/new/[skuId]` — HO-P6 §11.2.3. Reads the options for the SKU (C1) and shows one of: the form,
 * the server's reason when the product is not offered, a link to the subscription that already exists, or "We couldn't
 * find that product." Nothing is offered that the server would refuse.
 */
export function SubscribeForm({ skuId }: { skuId: string }) {
  const query = useSubscriptionOptions(skuId);
  // After a 201 the options re-read says "already subscribed"; the form stays until the page has navigated.
  const [created, setCreated] = useState(false);
  const options = query.data;

  return (
    <div className="flex flex-col gap-6">
      <GreetingHeader title="Subscribe">
        {SUBSCRIBE_PAGE_INTRO}
      </GreetingHeader>

      {query.isPending ? (
        <LoadingState rows={6} label="Loading the subscription form…" />
      ) : query.error instanceof ApiNotFoundError ? (
        <HearthEmpty title={PRODUCT_NOT_FOUND_MESSAGE} action={SHOP_LINK} />
      ) : query.isError || !options ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : options.existingSubscriptionId && !created ? (
        <HearthEmpty
          title={`${ALREADY_SUBSCRIBED_TEXT}.`}
          description={`${options.sku.productName}${options.sku.variantLabel ? `, ${options.sku.variantLabel}` : ''}`}
          action={
            <Link
              href={`/portal/subscriptions/${encodeURIComponent(options.existingSubscriptionId)}`}
              className={buttonVariants({ variant: 'pill', size: 'pillMd' })}
            >
              Manage your subscription
            </Link>
          }
        />
      ) : !options.subscribable ? (
        <HearthEmpty
          title={SUBSCRIBE_NOT_OFFERED_TITLE}
          description={options.notSubscribableReason ?? undefined}
          action={SHOP_LINK}
        />
      ) : (
        <SubscribeFormBody
          options={options}
          skuId={skuId}
          onCreated={() => setCreated(true)}
          onRefreshOptions={() => void query.refetch()}
        />
      )}
    </div>
  );
}

'use client';

import { Suspense, use } from 'react';
import { SubscriptionDetail } from '@/components/subscriptions/SubscriptionDetail';

/**
 * `/portal/subscriptions/[subscriptionId]` — HO-P6 §11.2.5: the subscription, its actions and history. The reminder's
 * `?skip=yyyy-MM-dd` link opens a confirmation here and never acts on its own (ADR-FE-111).
 */
export default function SubscriptionPage({ params }: { params: Promise<{ subscriptionId: string }> }) {
  const { subscriptionId } = use(params);
  return (
    <Suspense fallback={null}>
      <SubscriptionDetail id={subscriptionId} />
    </Suspense>
  );
}

'use client';

import { use } from 'react';
import { SubscribeForm } from '@/components/subscriptions/SubscribeForm';

/**
 * `/portal/subscriptions/new/[skuId]` — HO-P6 §11.2.3: subscribe to one SKU. The SKU is a path segment (ADR-FE-109), so it
 * survives the sign-in round trip with nothing else to carry.
 */
export default function SubscribePage({ params }: { params: Promise<{ skuId: string }> }) {
  const { skuId } = use(params);
  return <SubscribeForm skuId={skuId} />;
}

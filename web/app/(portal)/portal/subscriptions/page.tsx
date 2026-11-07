'use client';

import { Suspense } from 'react';
import { MySubscriptionsList } from '@/components/subscriptions/MySubscriptionsList';

/** `/portal/subscriptions` — HO-P6 §11.2.4: my subscriptions (Current | Cancelled, paged). The notification links land here. */
export default function MySubscriptionsPage() {
  return (
    <Suspense fallback={null}>
      <MySubscriptionsList />
    </Suspense>
  );
}

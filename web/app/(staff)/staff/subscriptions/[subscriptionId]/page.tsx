'use client';

import { use } from 'react';
import { StaffSubscriptionDetailScreen } from '@/components/staff-subscriptions/StaffSubscriptionDetailScreen';

// US-SUB-05 (adapted), US-SUB-06, HO-P6 S2 (§11.3.5). `new`/`unpaid` are static siblings; an id is a GUID.
export default function StaffSubscriptionDetailPage({
  params,
}: {
  params: Promise<{ subscriptionId: string }>;
}) {
  const { subscriptionId } = use(params);
  return <StaffSubscriptionDetailScreen subscriptionId={subscriptionId} />;
}

import { Suspense } from 'react';
import { StaffSubscriptionsList } from '@/components/staff-subscriptions/StaffSubscriptionsList';

// US-SUB-06, HO-P6 S2 (§11.3.3). The list reads its filters from the address (`useSearchParams`), so it sits in Suspense.
export default function StaffSubscriptionsPage() {
  return (
    <Suspense fallback={null}>
      <StaffSubscriptionsList />
    </Suspense>
  );
}

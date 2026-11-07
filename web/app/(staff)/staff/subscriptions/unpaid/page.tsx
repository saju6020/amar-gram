import { Suspense } from 'react';
import { UnpaidSubscriptionsScreen } from '@/components/staff-subscriptions/UnpaidSubscriptionsScreen';

// US-SUB-06 AC2, HO-P6 S2 (§11.3.4). `?page=` is read with `useSearchParams`, so the screen sits in Suspense.
export default function StaffUnpaidSubscriptionsPage() {
  return (
    <Suspense fallback={null}>
      <UnpaidSubscriptionsScreen />
    </Suspense>
  );
}

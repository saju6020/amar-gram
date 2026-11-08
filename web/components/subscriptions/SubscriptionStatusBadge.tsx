import { CircleCheck, OctagonAlert, PauseCircle, XCircle, type LucideIcon } from 'lucide-react';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import type { SubscriptionStatus } from '@/lib/api/subscriptions';
import { subscriptionStatusLabel } from '@/lib/subscriptions/labels';

/**
 * A subscription's status as a word with an icon, never colour alone (UI-6): Active, Paused, Suspended, Cancelled.
 * An unknown value reads "Unknown" (labels.ts), never the raw code.
 */
const SPECS: Record<SubscriptionStatus, { variant: NonNullable<BadgeProps['variant']>; icon: LucideIcon }> = {
  Active: { variant: 'success', icon: CircleCheck },
  Paused: { variant: 'neutral', icon: PauseCircle },
  Suspended: { variant: 'warning', icon: OctagonAlert },
  Cancelled: { variant: 'neutral', icon: XCircle },
};

export function SubscriptionStatusBadge({ status }: { status: string }) {
  const spec = SPECS[status as SubscriptionStatus] ?? { variant: 'neutral' as const, icon: OctagonAlert };
  const Icon = spec.icon;
  return (
    <Badge variant={spec.variant} icon={<Icon size={12} aria-hidden="true" />}>
      {subscriptionStatusLabel(status)}
    </Badge>
  );
}

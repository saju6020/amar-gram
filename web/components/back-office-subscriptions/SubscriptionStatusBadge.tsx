import type { ReactNode } from 'react';
import { CircleCheck, CirclePause, CircleX, TriangleAlert } from 'lucide-react';
import { StatusPill } from '@/components/back-office/StatusPill';
import type { BackOfficeTone } from '@/components/back-office/tone';
import { subscriptionStatusLabel } from '@/lib/subscriptions/labels';

const ICON_SIZE = 12;

const LOOK: Record<string, { tone: BackOfficeTone; icon: ReactNode }> = {
  Active: { tone: 'success', icon: <CircleCheck size={ICON_SIZE} /> },
  Paused: { tone: 'neutral', icon: <CirclePause size={ICON_SIZE} /> },
  Suspended: { tone: 'warning', icon: <TriangleAlert size={ICON_SIZE} /> },
  Cancelled: { tone: 'neutral', icon: <CircleX size={ICON_SIZE} /> },
};

/** HO-P6 S3. A subscription's status as a word with an icon, never colour alone (UI-6). An unknown status reads "Unknown". */
export function SubscriptionStatusBadge({ status }: { status: string }) {
  const look = LOOK[status] ?? { tone: 'neutral' as const, icon: null };
  return (
    <StatusPill tone={look.tone} icon={look.icon}>
      {subscriptionStatusLabel(status)}
    </StatusPill>
  );
}

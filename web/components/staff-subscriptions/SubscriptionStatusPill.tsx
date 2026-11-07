import type { ReactNode } from 'react';
import { CircleCheck, CirclePause, CircleX, TriangleAlert } from 'lucide-react';
import { StatusPill } from '@/components/back-office/StatusPill';
import type { BackOfficeTone } from '@/components/back-office/tone';
import { subscriptionStatusLabel, suspensionReasonLabel } from '@/lib/subscriptions/labels';

const ICON_SIZE = 12;

const LOOK: Record<string, { tone: BackOfficeTone; icon: ReactNode }> = {
  Active: { tone: 'success', icon: <CircleCheck size={ICON_SIZE} /> },
  Paused: { tone: 'neutral', icon: <CirclePause size={ICON_SIZE} /> },
  Suspended: { tone: 'warning', icon: <TriangleAlert size={ICON_SIZE} /> },
  Cancelled: { tone: 'neutral', icon: <CircleX size={ICON_SIZE} /> },
};

/**
 * HO-P6 S2 (§11.3.3). The status is a word with an icon, never colour alone (UI-6). A suspension names its reason on a
 * second line when `showReason` is set.
 */
export function SubscriptionStatusPill({
  status,
  suspensionReason,
  showReason = false,
}: {
  status: string;
  suspensionReason?: string | null;
  showReason?: boolean;
}) {
  const look = LOOK[status] ?? { tone: 'neutral' as const, icon: null };
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <StatusPill tone={look.tone} icon={look.icon}>
        {subscriptionStatusLabel(status)}
      </StatusPill>
      {showReason && suspensionReason && (
        <span className="text-xs text-ink-muted">{suspensionReasonLabel(suspensionReason)}</span>
      )}
    </span>
  );
}

import { Button } from '@/components/ui/button';
import type { SubscriptionAction, SubscriptionView } from '@/lib/api/subscriptions';
import { subscriptionActionLabel } from '@/lib/subscriptions/labels';

/**
 * The action buttons (HO-P6 §11.2.5, ADR-FE-110): exactly the server's `allowedActions`, in its order, each named by
 * `labels.ts` ("Skip the delivery on Tue 20 Oct" names `skippableCycleOn`). Nothing is added or filtered by status.
 */
export function SubscriptionActions({
  subscription,
  onAction,
}: {
  subscription: SubscriptionView;
  onAction: (action: SubscriptionAction) => void;
}) {
  const actions = subscription.allowedActions;
  if (actions.length === 0) return null;
  return (
    <div role="group" aria-label="What you can do" className="flex flex-wrap gap-3">
      {actions.map((action) => (
        <Button
          key={action}
          variant={action === 'Cancel' ? 'pillSecondary' : 'pill'}
          size="pillMd"
          onClick={() => onAction(action)}
        >
          {subscriptionActionLabel(action, subscription.skippableCycleOn)}
        </Button>
      ))}
    </div>
  );
}

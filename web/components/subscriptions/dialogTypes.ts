import type { SubscriptionView } from '@/lib/api/subscriptions';

/** What every customer action dialog receives (HO-P6 §11.2.6). `onDone` gets the server's own sentence for the status region. */
export interface ActionDialogProps {
  subscription: SubscriptionView;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: (message: string) => void;
}

'use client';

import { useState } from 'react';
import { PermissionDeniedState } from '@/components/admin/PermissionDeniedState';
import { Button } from '@/components/ui/button';
import type { StaffSubscriptionDetail } from '@/lib/api/staff-subscriptions';
import { useStaffSession } from '@/lib/hooks/useSession';
import { useCanManageSubscriptions } from '@/lib/hooks/useStaffSubscriptions';
import { STAFF_ACTIONS_ROLE_NOTE } from '@/lib/subscriptions/copy';
import { staffSubscriptionActionLabel } from '@/lib/subscriptions/labels';
import { ReinstateDialog, StaffCancelDialog } from './StaffSubscriptionDialogs';

/**
 * HO-P6 S2 (§11.3.5, ADR-FE-110). The staff actions. A button appears only when the server lists the action in
 * `allowedStaffActions` AND the role holds `Subscriptions.Manage`; any other role is told who can act. A 403 from the
 * server (a role changed while the page was open) replaces the actions with `PermissionDeniedState`, in place, not a toast.
 */
export function StaffActions({
  subscription,
  onDone,
}: {
  subscription: StaffSubscriptionDetail;
  onDone: (message: string) => void;
}) {
  const canManage = useCanManageSubscriptions();
  const session = useStaffSession();
  const [dialog, setDialog] = useState<'reinstate' | 'cancel' | null>(null);
  const [denied, setDenied] = useState(false);

  if (denied) return <PermissionDeniedState />;
  // Nothing to offer or explain: no allowed action, or who may act is not known yet (no flash of the role note).
  if (subscription.allowedStaffActions.length === 0 || session.isPending) return null;
  if (!canManage) return <p className="max-w-md text-sm text-ink-muted">{STAFF_ACTIONS_ROLE_NOTE}</p>;
  const can = (action: string) => subscription.allowedStaffActions.includes(action as 'Reinstate' | 'Cancel');
  const shared = { subscription, onDone, onForbidden: () => setDenied(true) };
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {can('Reinstate') && (
          <Button className="min-h-11" onClick={() => setDialog('reinstate')}>
            {staffSubscriptionActionLabel('Reinstate')}
          </Button>
        )}
        {can('Cancel') && (
          <Button variant="secondary" className="min-h-11" onClick={() => setDialog('cancel')}>
            {staffSubscriptionActionLabel('Cancel')}
          </Button>
        )}
      </div>
      <ReinstateDialog {...shared} open={dialog === 'reinstate'} onOpenChange={(open) => setDialog(open ? 'reinstate' : null)} />
      <StaffCancelDialog {...shared} open={dialog === 'cancel'} onOpenChange={(open) => setDialog(open ? 'cancel' : null)} />
    </>
  );
}

'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/back-office/PageHeader';
import { StatusPill } from '@/components/back-office/StatusPill';
import { AccessRefusedState } from '@/components/admin/AccessRefusedState';
import { type Column, ResponsiveTable } from '@/components/billing/ResponsiveTable';
import { StaffOrdersTabs } from '@/components/orders/StaffOrdersTabs';
import { Button } from '@/components/ui/button';
import { ApiForbiddenError } from '@/lib/api/client';
import { RIDER_MANAGE_ROLES, type Rider } from '@/lib/api/staff-orders';
import { useStaffSession } from '@/lib/hooks/useSession';
import { useRiders } from '@/lib/hooks/useStaffOrders';
import { RiderDialog } from './RiderDialog';

/**
 * `components/fulfilment/RidersPage.tsx` — HO-P5 §11.3.10 (BG-5, OQ-9, US-ORD-11). The branch's in-house riders:
 * name, mobile number and whether each is active, with "Add rider" and "Edit". The registry is deliberately
 * small and has no nav item; it is linked from the dispatch dialog and the pick list. Reading is
 * `Orders.Fulfil` and writing is `Riders.Manage`: the buttons follow the signed-in roles as a hint only (a
 * session whose roles are unknown still shows them), and the server's `403` has the last word — a refused
 * list is the permission-denied state, a refused save is the permission message in the dialog.
 */
export function RidersPage() {
  const riders = useRiders(false);
  const session = useStaffSession();
  const [editing, setEditing] = useState<Rider | 'new' | null>(null);

  const roles = session.data?.roleIds ?? [];
  const canManage = roles.length === 0 || roles.some((role) => RIDER_MANAGE_ROLES.includes(role));

  if (riders.error instanceof ApiForbiddenError) return <AccessRefusedState error={riders.error} />;

  const columns: Array<Column<Rider>> = [
    { id: 'name', header: 'Name', primary: true, sortValue: (r) => r.name, cell: (r) => r.name },
    { id: 'mobile', header: 'Mobile', nowrap: true, cell: (r) => r.mobileNumber ?? '—' },
    {
      id: 'status',
      header: 'Status',
      nowrap: true,
      cell: (r) => <StatusPill tone={r.isActive ? 'success' : 'neutral'}>{r.isActive ? 'Active' : 'Not active'}</StatusPill>,
    },
    ...(canManage
      ? [
          {
            id: 'actions',
            header: 'Actions',
            nowrap: true,
            cell: (r: Rider) => (
              <Button variant="secondary" size="sm" onClick={() => setEditing(r)}>
                Edit<span className="sr-only"> {r.name}</span>
              </Button>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Riders"
        description="The people you can choose when you dispatch a delivery order."
        actions={
          canManage ? (
            <Button onClick={() => setEditing('new')}>
              <Plus size={16} aria-hidden="true" />
              Add rider
            </Button>
          ) : undefined
        }
      />
      <StaffOrdersTabs />
      <ResponsiveTable
        caption="Riders"
        columns={columns}
        rows={riders.data}
        getRowId={(r) => r.id}
        isLoading={riders.isLoading}
        isError={riders.isError}
        onRetry={() => void riders.refetch()}
        emptyState={{ title: 'No riders set up.', description: canManage ? 'Add a rider so delivery orders can be sent with them.' : 'Ask a shop manager to add one.' }}
      />
      <RiderDialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)} rider={editing === 'new' ? null : editing} />
    </div>
  );
}

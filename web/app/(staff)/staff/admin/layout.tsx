'use client';

import { PageHeader } from '@/components/back-office/PageHeader';
import { AdminNav } from '@/components/admin/AdminNav';
import { useActiveBranchId } from '@/lib/hooks/useActiveBranch';
import { useStaffSession } from '@/lib/hooks/useSession';

/**
 * `app/(staff)/staff/admin/layout.tsx` — HO-ADM-002 §8.1, ADR-FE-014; HO-P4 §11.6.6. A route-based
 * section under `(staff)/staff/admin/`, with its own tabs rather than a modal stack — every admin
 * resource is a deep-linkable route, and each page loads only its own data. The section heading is
 * a level-2 heading: each page below owns the single `<h1>` that the admin specs rely on. The
 * Roster tab opens the active branch's roster (OQ-7).
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useStaffSession();
  const activeBranchId = useActiveBranchId();

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Administration" headingLevel={2} />
      <AdminNav
        roleIds={session?.roleIds ?? []}
        rosterHref={activeBranchId ? `/staff/admin/branches/${activeBranchId}/roster` : undefined}
      />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

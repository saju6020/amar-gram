'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CircleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useOverdueRestoreBanner } from '@/lib/hooks/useOperations';
import { useStaffSession } from '@/lib/hooks/useSession';

const BACKUP_HREF = '/staff/admin/operations/backup';

/**
 * `components/operations/OverdueRestoreBanner.tsx` — HO-XCT-002 §11.5. When a signed-in
 * Administrator loads any admin route and the quarterly restore test is overdue, a banner links to
 * the backup page (HO-XCT-001 OQ-11 says no notification; this is the visible substitute).
 * Dismissible for the session. Role check is presentation only; the server decides (a `403` shows
 * nothing).
 */
export function OverdueRestoreBanner() {
  const pathname = usePathname();
  const session = useStaffSession();
  const onAdminRoute = pathname.startsWith('/staff/admin');
  // The backup pages already show the overdue state in full (RestoreTestDueCard); a banner linking to the page you are on only pushes it down.
  const onBackupRoute = pathname.startsWith(BACKUP_HREF);
  const isAdministrator = (session.data?.roleIds ?? []).includes('Administrator');
  const { overdue, dismissed, dismiss } = useOverdueRestoreBanner(onAdminRoute && isAdministrator);

  if (!onAdminRoute || onBackupRoute || !isAdministrator || !overdue || dismissed) return null;
  return (
    <div
      role="status"
      className="mb-4 flex flex-wrap items-center gap-3 rounded-[var(--radius-md)] border-2 border-danger-ink bg-danger-bg p-3 text-sm text-danger-ink"
    >
      <CircleAlert size={18} className="flex-none" aria-hidden="true" />
      <p className="min-w-[200px] flex-1">
        <strong>The restore test is overdue.</strong> Backups are only proven when a restore works.
      </p>
      <Link href={BACKUP_HREF} className="font-semibold underline">
        Open backup &amp; restore
      </Link>
      <Button variant="secondary" size="sm" onClick={dismiss}>
        Dismiss for now
      </Button>
    </div>
  );
}

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OverdueRestoreBanner } from '@/components/operations/OverdueRestoreBanner';

let pathname = '/staff/admin/branches';
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));
vi.mock('@/lib/hooks/useSession', () => ({
  useStaffSession: () => ({ data: { roleIds: ['Administrator'] } }),
}));
vi.mock('@/lib/hooks/useOperations', () => ({
  useOverdueRestoreBanner: () => ({ overdue: true, dismissed: false, dismiss: vi.fn() }),
}));

beforeEach(() => {
  pathname = '/staff/admin/branches';
});

describe('the overdue restore test banner', () => {
  it('shows on an admin route', () => {
    render(<OverdueRestoreBanner />);
    expect(screen.getByText('The restore test is overdue.')).toBeInTheDocument();
  });

  it('is hidden on the backup page, which shows the overdue state itself, and on its sub-paths', () => {
    pathname = '/staff/admin/operations/backup';
    const { unmount } = render(<OverdueRestoreBanner />);
    expect(screen.queryByText('The restore test is overdue.')).not.toBeInTheDocument();
    unmount();
    pathname = '/staff/admin/operations/backup/some-test-id';
    render(<OverdueRestoreBanner />);
    expect(screen.queryByText('The restore test is overdue.')).not.toBeInTheDocument();
  });

  it('still shows on a sibling operations page whose path only starts with the same letters', () => {
    pathname = '/staff/admin/operations/backup-history';
    render(<OverdueRestoreBanner />);
    expect(screen.getByText('The restore test is overdue.')).toBeInTheDocument();
  });
});

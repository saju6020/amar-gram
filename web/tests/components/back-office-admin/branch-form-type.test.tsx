import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BranchDetailsForm } from '@/components/branches/BranchDetailsForm';
import { ApiValidationError } from '@/lib/api/client';
import type { ValidationResponse } from '@/lib/api/types';
import type { AdminBranch } from '@/lib/api/admin-branches';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/staff/admin/branches/new',
  useSearchParams: () => new URLSearchParams(),
}));

const WAREHOUSE: AdminBranch = {
  id: 'b2',
  code: 'CTG',
  name: 'Chattogram warehouse',
  timeZoneId: 'Asia/Dhaka',
  isActive: true,
  addressLine: null,
  phoneNumber: null,
  email: null,
  weeklyHours: [],
  type: 'Warehouse',
  todayHours: { date: '2026-11-03', isOpenToday: false, summary: 'Closed', intervals: [] },
  deliveryAreas: [],
  activeStaffCount: 4,
};

// HO-P5 §11.5.6 / U43 (BG-21): the create and edit forms gain a "Type" select (Outlet, Warehouse).
describe('BranchDetailsForm — the Type select (U43)', () => {
  it('create: offers Outlet and Warehouse, defaults to Outlet, and sends the chosen type', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<BranchDetailsForm onSave={onSave} isPending={false} />);
    const select = screen.getByLabelText('Type');
    expect(Array.from((select as HTMLSelectElement).options).map((o) => o.value)).toEqual(['Outlet', 'Warehouse']);
    expect(select).toHaveValue('Outlet');

    await userEvent.type(screen.getByLabelText('Code'), 'DEP1');
    await userEvent.type(screen.getByLabelText('Name'), 'Depot');
    await userEvent.selectOptions(select, 'Warehouse');
    await userEvent.click(screen.getByRole('button', { name: 'Create branch' }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls[0]![0]).toMatchObject({ code: 'DEP1', name: 'Depot', type: 'Warehouse' });
  });

  it('edit: starts at the branch\'s own type and saves a change of it', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<BranchDetailsForm branch={WAREHOUSE} onSave={onSave} isPending={false} />);
    const select = screen.getByLabelText('Type');
    expect(select).toHaveValue('Warehouse');
    await userEvent.selectOptions(select, 'Outlet');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls[0]![0]).toMatchObject({ name: 'Chattogram warehouse', type: 'Outlet' });
  });

  it('a server refusal of the type is shown under the field', async () => {
    const body: ValidationResponse = {
      isValid: false,
      errors: [{ propertyName: 'Type', errorCode: 'PredicateValidator', errorMessage: 'is not a recognised BranchType.', resourceName: 'UpdateBranchDetailsCommand' }],
    };
    const onSave = vi.fn().mockRejectedValue(new ApiValidationError(body));
    render(<BranchDetailsForm branch={WAREHOUSE} onSave={onSave} isPending={false} />);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('is not a recognised BranchType.')).toBeInTheDocument();
  });
});

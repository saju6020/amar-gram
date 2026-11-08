import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CustomerProfile } from '@/components/customer/CustomerProfile';
import type { StaffCustomer } from '@/lib/api/staff-customers';

const customer = {
  id: 'c1',
  fullName: 'Nusrat Jahan',
  mobileNumber: '01711000001',
  emailAddress: null,
  recordStatus: 'Complete',
  status: 'Active',
  customerSince: '2026-03-14T09:30:00Z',
  area: null,
  tags: [],
  registrationChannel: 'Reception',
  mergedIntoCustomerId: null,
  orderCount: 0,
  lifetimeSpend: { amount: '0.00', currencyCode: 'BDT' },
  noteCount: 0,
} as unknown as StaffCustomer;

const props = { customer, ordersPanel: <p>orders body</p>, billingPanel: <p>billing body</p> };

describe('CustomerProfile -- effective tab (CODE_REVIEW LOW 4)', () => {
  it('when the selected Subscriptions tab loses its panel, Orders shows as selected and its panel renders', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <CustomerProfile {...props} subscriptionsPanel={<p>subs body</p>} subscriptionsCount={2} />,
    );
    await user.click(screen.getByRole('tab', { name: 'Subscriptions (2)' }));
    expect(screen.getByText('subs body')).toBeInTheDocument();

    rerender(<CustomerProfile {...props} />);
    expect(screen.queryByRole('tab', { name: /Subscriptions/ })).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Orders' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('orders body')).toBeInTheDocument();
    expect(screen.queryByText('subs body')).not.toBeInTheDocument();
  });
});

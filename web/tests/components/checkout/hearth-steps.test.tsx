import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { PillSteps } from '@/components/hearth/PillSteps';
import { FreeDeliveryProgress } from '@/components/hearth/FreeDeliveryProgress';

describe('PillSteps', () => {
  const steps = [
    { label: 'Delivery', status: 'done' as const },
    { label: 'Delivery time', status: 'skipped' as const },
    { label: 'Payment', status: 'current' as const },
    { label: 'Review', status: 'todo' as const },
  ];

  it('keeps the step number and state in each accessible name', () => {
    render(<PillSteps steps={steps} />);
    const list = screen.getByRole('list', { name: 'Checkout steps' });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(4);
    expect(items[0]!).toHaveTextContent('Step 1, done: Delivery');
    expect(items[1]!).toHaveTextContent('Step 2, skipped: Delivery time');
    expect(items[2]!).toHaveTextContent('Step 3, current step: Payment');
    expect(items[3]!).toHaveTextContent('Step 4, not started: Review');
  });

  it('marks only the current step with aria-current', () => {
    render(<PillSteps steps={steps} />);
    const current = screen.getAllByRole('listitem').filter((li) => li.hasAttribute('aria-current'));
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent('Payment');
    expect(current[0]).toHaveTextContent('You are here');
  });

  it('shows a tick, not the number, on a done step, and hides the dot from screen readers', () => {
    render(<PillSteps steps={steps} />);
    const first = screen.getAllByRole('listitem')[0]!;
    expect(first.querySelector('[aria-hidden="true"] svg')).not.toBeNull();
  });
});

describe('FreeDeliveryProgress', () => {
  it('renders nothing without a threshold', () => {
    const { container } = render(<FreeDeliveryProgress />);
    expect(container).toBeEmptyDOMElement();
    const nullish = render(<FreeDeliveryProgress remaining={null} percent={50} />);
    expect(nullish.container).toBeEmptyDOMElement();
  });

  it('shows the server-given amount and an accessible progress bar', () => {
    render(<FreeDeliveryProgress remaining="৳250.00" percent={96} />);
    expect(screen.getByText('Add ৳250.00 more')).toBeInTheDocument();
    const bar = screen.getByRole('progressbar', { name: 'Progress to free delivery' });
    expect(bar).toHaveAttribute('aria-valuenow', '96');
  });

  it('draws no bar when there is no percentage', () => {
    render(<FreeDeliveryProgress remaining="৳250.00" />);
    expect(screen.getByText('Add ৳250.00 more')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('clamps the bar to 0-100', () => {
    render(<FreeDeliveryProgress remaining="৳1.00" percent={140} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  });
});

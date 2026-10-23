import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import Link from 'next/link';
import { EmptyState, EmptyWarmIllustration } from '@/components/common/EmptyState';

describe('EmptyState', () => {
  it('says what to do next, not just "No data"', () => {
    render(
      <EmptyState
        title="No customers registered yet."
        description="Register your first walk-in customer to start keeping their orders in one place."
        // next/link, not a bare <a> — /staff/customers/new is a real route, so the
        // no-html-link-for-pages rule (correctly) flags a plain anchor pointed at it.
        action={<Link href="/staff/customers/new">Register a customer</Link>}
      />,
    );

    expect(screen.getByText('No customers registered yet.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Register a customer' })).toBeInTheDocument();
    expect(screen.queryByText(/^no data$/i)).not.toBeInTheDocument();
  });

  it('is announced as a live region so screen readers hear it replace a loading/list state', () => {
    render(<EmptyState title="Nothing here yet." />);
    expect(screen.getByRole('status')).toHaveTextContent('Nothing here yet.');
  });

  it('defaults to a neutral icon, never the warm customer illustration, unless told otherwise', () => {
    const { container, rerender } = render(<EmptyState title="No results." />);
    expect(container.querySelector('svg path[d^="M19 23"]')).not.toBeInTheDocument();

    rerender(<EmptyState title="No orders yet." icon={<EmptyWarmIllustration />} />);
    expect(container.querySelector('svg path[d^="M19 23"]')).toBeInTheDocument();
  });

  it('renders no icon at all when icon is explicitly null', () => {
    const { container } = render(<EmptyState title="No results." icon={null} />);
    expect(container.querySelector('svg')).not.toBeInTheDocument();
  });
});

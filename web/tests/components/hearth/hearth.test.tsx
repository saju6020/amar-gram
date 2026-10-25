import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { OrderTracker } from '@/components/hearth/OrderTracker';
import { HearthLogo } from '@/components/hearth/HearthLogo';

describe('OrderTracker', () => {
  const steps = [
    { label: 'Placed', status: 'done' as const },
    { label: 'Confirmed', status: 'done' as const },
    { label: 'Packing', status: 'current' as const, caption: 'Today, 10:30' },
    { label: 'Dispatched', status: 'future' as const },
    { label: 'Delivered', status: 'future' as const },
  ];

  it('renders every step from data with its state in words', () => {
    render(<OrderTracker steps={steps} />);
    const items = within(screen.getByRole('list', { name: 'Order progress' })).getAllByRole(
      'listitem',
    );
    expect(items).toHaveLength(5);
    expect(items[0]!).toHaveTextContent('Placed (done)');
    expect(items[2]!).toHaveTextContent('Packing (current)');
    expect(items[2]!).toHaveTextContent('Today, 10:30');
    expect(items[4]!).toHaveTextContent('Delivered (not yet)');
  });

  it('flags only the current node and draws future nodes dashed', () => {
    render(<OrderTracker steps={steps} />);
    const items = screen.getAllByRole('listitem');
    expect(items.filter((li) => li.hasAttribute('aria-current'))).toEqual([items[2]]);
    expect(items[3]!.querySelector('span')?.className).toContain('border-dashed');
  });
});

describe('HearthLogo', () => {
  it('reads Amar Gram Shop and links to the shop by default', () => {
    render(<HearthLogo />);
    const link = screen.getByRole('link', { name: 'Amar Gram Shop' });
    expect(link).toHaveAttribute('href', '/shop');
    // Logo A · badge (owner, 2026-10-18): the badge is decoration, hidden from assistive tech.
    expect(link.querySelector('[aria-hidden="true"].bg-leaf')).not.toBeNull();
  });

  // Owner, 2026-10-19: the shop's badge logo is the one logo everywhere; the portal variant only links home.
  it('the portal variant is the same badge logo, linking home', () => {
    render(<HearthLogo variant="portal" />);
    const link = screen.getByRole('link', { name: 'Amar Gram Shop' });
    expect(link).toHaveAttribute('href', '/');
    expect(link.querySelector('[aria-hidden="true"].bg-leaf')).not.toBeNull();
  });
});

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OriginGrid } from '@/components/shop/OriginGrid';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => '/shop/products',
  useSearchParams: () => new URLSearchParams(),
}));

describe('OriginGrid — HO-SHP-002 §11.4, US-SHP-05 AC1', () => {
  it('U-C1: a flagless origin shows a globe, the name as text, the count and the notes excerpt', () => {
    const notes = `**Careful** sourcing. ${'word '.repeat(60)}`;
    const { container } = render(
      <OriginGrid
        origins={[
          { code: 'TH', name: 'Thailand', sourcingNotes: notes, productCount: 9, isFeatured: true },
          { code: 'BR', name: 'Brazil', sourcingNotes: null, productCount: 1, isFeatured: false },
        ]}
      />,
    );
    expect(screen.getByRole('heading', { level: 2, name: 'Thailand' })).toBeInTheDocument();
    expect(screen.getByText('9 products')).toBeInTheDocument();
    expect(screen.getByText('1 product')).toBeInTheDocument();
    expect(screen.getByText('No sourcing notes yet.')).toBeInTheDocument();
    // The excerpt is plain text, 160 characters at most.
    const excerpt = screen.getByText(/^Careful sourcing\./);
    expect(excerpt.textContent!.length).toBeLessThanOrEqual(161);
    expect(excerpt.innerHTML).not.toContain('**');
    // Flags are decorative: alt="" for Thailand; Brazil has no flag file, so it is the globe icon.
    const flags = container.querySelectorAll('img');
    expect(flags).toHaveLength(1);
    expect(flags[0]).toHaveAttribute('alt', '');
    expect(container.querySelectorAll('svg[aria-hidden="true"]').length).toBeGreaterThanOrEqual(1);
  });
});

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PillTabs } from '@/components/back-office/PillTabs';
import { UnderlineTabs } from '@/components/back-office/UnderlineTabs';
import type { CountedTabItem } from '@/components/back-office/tab-parts';

/** HO-P5 Amended (z): an optional `countLabel` makes a counted tab read "Packed, 1 order"; other tabs are unchanged. */
describe('tab count label', () => {
  const items: CountedTabItem[] = [
    { key: 'packed', label: 'Packed', count: 1, countLabel: 'order' },
    { key: 'packing', label: 'Being packed', count: 3, countLabel: 'order' },
    { key: 'plain', label: 'Plain', count: 5 },
    { key: 'none', label: 'None' },
  ];

  it.each([
    ['state PillTabs', <PillTabs key="a" mode="state" label="L" items={items} value="packed" />, 'tab'],
    ['link UnderlineTabs', <UnderlineTabs key="b" mode="link" label="L" items={items.map((i) => ({ ...i, href: '/x' }))} value="packed" />, 'link'],
  ] as const)('%s names a counted tab with its noun, singular or plural', (_n, ui, role) => {
    render(ui);
    expect(screen.getByRole(role, { name: 'Packed, 1 order' })).toBeInTheDocument();
    expect(screen.getByRole(role, { name: 'Being packed, 3 orders' })).toBeInTheDocument();
  });

  it('leaves a tab without countLabel exactly as before', () => {
    render(<PillTabs mode="state" label="L" items={items} />);
    const plain = screen.getByRole('tab', { name: /^Plain/ });
    expect(plain.textContent).toBe('Plain5');
    expect(plain.querySelector('.sr-only')).toBeNull();
    expect(screen.getByRole('tab', { name: 'None' }).textContent).toBe('None');
  });

  it('keeps the visible count as the only visible number', () => {
    render(<PillTabs mode="state" label="L" items={items} />);
    expect(screen.getByRole('tab', { name: 'Packed, 1 order' }).querySelector('[aria-hidden="true"]')).toHaveTextContent('1');
  });
});

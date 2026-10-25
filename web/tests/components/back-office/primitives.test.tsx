import { describe, expect, it, vi } from 'vitest';
import { createRef, useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PillTabs } from '@/components/back-office/PillTabs';
import { UnderlineTabs } from '@/components/back-office/UnderlineTabs';
import { StatusPill } from '@/components/back-office/StatusPill';
import { KpiTile } from '@/components/back-office/KpiTile';
import { AttentionRow } from '@/components/back-office/AttentionRow';
import { TableFrame } from '@/components/back-office/TableFrame';
import { PageHeader } from '@/components/back-office/PageHeader';
import { Panel } from '@/components/back-office/Panel';
import { SearchField } from '@/components/back-office/SearchField';
import { SplitView } from '@/components/back-office/SplitView';
import { ActionLink } from '@/components/back-office/ActionLink';

const items = [
  { key: 'all', label: 'All', href: '/o' },
  { key: 'packing', label: 'Packing', count: 3, href: '/o?s=packing' },
  { key: 'sent', label: 'Dispatched', href: '/o?s=sent' },
];

describe.each([
  ['PillTabs', PillTabs],
  ['UnderlineTabs', UnderlineTabs],
])('%s', (_name, Tabs) => {
  it('U7: mode="state" is a tablist with aria-selected, keyboard operable, count only when given', async () => {
    const user = userEvent.setup();
    function Harness() {
      const [value, setValue] = useState('all');
      return (
        <Tabs label="Order status" items={items} value={value} onChange={setValue} mode="state" />
      );
    }
    render(<Harness />);
    const list = screen.getByRole('tablist', { name: 'Order status' });
    const tabs = within(list).getAllByRole('tab');
    expect(tabs).toHaveLength(3);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
    expect(tabs[1]).toHaveTextContent('Packing3');
    expect(tabs[0]).not.toHaveTextContent(/\d/);

    await user.tab();
    expect(tabs[0]).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(tabs[1]).toHaveFocus();
    expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{End}');
    expect(tabs[2]).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{Home}');
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    await user.click(tabs[2]!);
    expect(tabs[2]).toHaveAttribute('aria-selected', 'true');
  });

  it('U8: mode="link" is a nav of links with aria-current and never role=tab', () => {
    render(<Tabs label="Sections" items={items} value="packing" mode="link" />);
    const nav = screen.getByRole('navigation', { name: 'Sections' });
    expect(within(nav).getAllByRole('link')).toHaveLength(3);
    expect(within(nav).getByRole('link', { name: /Packing/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).getByRole('link', { name: 'All' })).not.toHaveAttribute('aria-current');
    expect(within(nav).getByRole('link', { name: 'All' })).toHaveAttribute('href', '/o');
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });
});

describe('PillTabs styling', () => {
  it('the selected pill is the banana-leaf pill', () => {
    render(<PillTabs label="x" items={items} value="all" mode="link" />);
    expect(screen.getByRole('link', { name: 'All' })).toHaveClass('bg-leaf-ink', 'text-leaf-soft');
  });
});

describe('U9 — StatusPill, KpiTile, AttentionRow', () => {
  it('StatusPill always renders its text; the icon is aria-hidden; no inline colour', () => {
    const { container } = render(
      <StatusPill tone="warning" icon={<svg data-testid="i" />}>
        Low stock
      </StatusPill>,
    );
    expect(screen.getByText('Low stock')).toBeInTheDocument();
    expect(screen.getByTestId('i').closest('[aria-hidden="true"]')).not.toBeNull();
    expect(container.querySelector('[style]')).toBeNull();
    expect(screen.getByText('Low stock')).toHaveClass('bg-warning-bg', 'text-warning-ink');
  });

  it.each([
    ['neutral', 'bg-surface-sunken'],
    ['success', 'bg-leaf-soft'],
    ['warning', 'bg-warning-bg'],
    ['danger', 'bg-danger-bg'],
  ] as const)('StatusPill tone %s uses a token fill', (tone, cls) => {
    render(<StatusPill tone={tone}>{tone}</StatusPill>);
    expect(screen.getByText(tone)).toHaveClass(cls);
  });

  it('KpiTile shows label (as a heading), the pre-formatted value and note; links when href given', () => {
    const { container, rerender } = render(
      <KpiTile label="Payments today" value="Tk 1,200.00" note="3 pending" tone="success" />,
    );
    expect(screen.getByRole('heading', { level: 2, name: 'Payments today' })).toBeInTheDocument();
    expect(screen.getByText('Tk 1,200.00')).toBeInTheDocument();
    expect(screen.getByText('3 pending')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(container.querySelector('[style]')).toBeNull();

    rerender(<KpiTile label="Orders" value="12" href="/staff/orders" headingLevel={3} />);
    expect(screen.getByRole('link')).toHaveAttribute('href', '/staff/orders');
    expect(screen.getByRole('heading', { level: 3, name: 'Orders' })).toBeInTheDocument();
  });

  it('AttentionRow is a link whose text carries the meaning; icon aria-hidden', () => {
    const { container } = render(
      <AttentionRow
        tone="danger"
        icon={<svg data-testid="icon" />}
        text="Batches expiring this week"
        count={4}
        href="/staff/inventory/alerts"
      />,
    );
    const link = screen.getByRole('link', { name: /Batches expiring this week/ });
    expect(link).toHaveAttribute('href', '/staff/inventory/alerts');
    expect(link).toHaveTextContent('4');
    expect(screen.getByTestId('icon').closest('[aria-hidden="true"]')).not.toBeNull();
    expect(container.querySelector('[style]')).toBeNull();
  });
});

describe('U10 — TableFrame', () => {
  it('is a focusable, named scroll region', () => {
    render(
      <TableFrame label="Batches (scrolls horizontally)" minWidth={640}>
        <table>
          <tbody>
            <tr>
              <td>x</td>
            </tr>
          </tbody>
        </table>
      </TableFrame>,
    );
    const region = screen.getByRole('region', { name: 'Batches (scrolls horizontally)' });
    expect(region).toHaveAttribute('tabindex', '0');
    expect(region).toHaveClass('overflow-x-auto');
    region.focus();
    expect(region).toHaveFocus();
  });
});

describe('PageHeader', () => {
  it('renders an h1 by default, with eyebrow, description and actions', () => {
    render(
      <PageHeader
        title="Orders"
        eyebrow="Good morning, Rahima"
        description="Everything to pack."
        actions={<button type="button">New</button>}
      />,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Orders' })).toBeInTheDocument();
    expect(screen.getByText('Good morning, Rahima')).toBeInTheDocument();
    expect(screen.getByText('Everything to pack.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New' })).toBeInTheDocument();
  });

  it('headingLevel 2 renders an h2, and headingRef reaches the heading and makes it focusable', () => {
    const ref = createRef<HTMLHeadingElement>();
    render(<PageHeader title="Detail" headingLevel={2} headingRef={ref} />);
    const heading = screen.getByRole('heading', { level: 2, name: 'Detail' });
    expect(ref.current).toBe(heading);
    heading.focus();
    expect(heading).toHaveFocus();
  });
});

describe('Panel', () => {
  it('is a section labelled by its heading, level 2 by default', () => {
    render(<Panel title="Ticket">body</Panel>);
    const region = screen.getByRole('region', { name: 'Ticket' });
    expect(within(region).getByRole('heading', { level: 2, name: 'Ticket' })).toBeInTheDocument();
  });

  it('supports h3, aside, a custom titleId and an aria-label without a title', () => {
    const { rerender } = render(
      <Panel title="Status" headingLevel={3} as="aside" titleId="status-title">
        x
      </Panel>,
    );
    expect(screen.getByRole('complementary', { name: 'Status' })).toBeInTheDocument();
    expect(document.getElementById('status-title')?.tagName).toBe('H3');
    rerender(
      <Panel aria-label="Totals" padded={false}>
        x
      </Panel>,
    );
    expect(screen.getByRole('region', { name: 'Totals' })).toBeInTheDocument();
  });
});

describe('SearchField', () => {
  it('has a visually hidden label and reports string values', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <SearchField
        id="q"
        label="Order no., customer or mobile"
        placeholder="Search"
        value=""
        onChange={onChange}
      />,
    );
    const input = screen.getByLabelText('Order no., customer or mobile');
    expect(input).toHaveAttribute('type', 'search');
    expect(input).not.toHaveClass('border-2');
    await user.type(input, 'a');
    expect(onChange).toHaveBeenCalledWith('a');
  });

  it('emphasis="scan" is the 2px leaf field and accepts a ref and Enter handler', async () => {
    const user = userEvent.setup();
    const ref = createRef<HTMLInputElement>();
    const onKeyDown = vi.fn();
    render(
      <SearchField
        id="scan"
        label="Scan barcode"
        value=""
        onChange={() => {}}
        emphasis="scan"
        inputRef={ref}
        onKeyDown={onKeyDown}
      />,
    );
    const input = screen.getByLabelText('Scan barcode');
    expect(input).toHaveClass('border-2', 'border-leaf');
    expect(ref.current).toBe(input);
    await user.type(input, '{Enter}');
    expect(onKeyDown).toHaveBeenCalled();
  });
});

describe('SplitView', () => {
  it('renders both labelled regions, and only the list when detail is null', () => {
    const { rerender } = render(
      <SplitView
        list={<p>list</p>}
        detail={<p>detail</p>}
        listLabel="Orders"
        detailLabel="Order"
      />,
    );
    expect(screen.getByRole('region', { name: 'Orders' })).toHaveTextContent('list');
    expect(screen.getByRole('region', { name: 'Order' })).toHaveTextContent('detail');
    rerender(<SplitView list={<p>list</p>} detail={null} listLabel="Orders" detailLabel="Order" />);
    expect(screen.queryByRole('region', { name: 'Order' })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Orders' })).toHaveClass('flex-1');
  });

  it('ratio 2:3 gives the detail the larger share', () => {
    render(
      <SplitView
        list={<p>l</p>}
        detail={<p>d</p>}
        listLabel="List"
        detailLabel="Detail"
        ratio="2:3"
      />,
    );
    expect(screen.getByRole('region', { name: 'List' })).toHaveClass('lg:basis-2/5');
    expect(screen.getByRole('region', { name: 'Detail' })).toHaveClass('lg:basis-3/5');
  });
});

describe('ActionLink', () => {
  it.each([
    ['primary', 'bg-accent'],
    ['outline', 'border-ink'],
    ['danger-outline', 'border-danger-ink'],
  ] as const)('%s is a 44px link', (variant, cls) => {
    render(
      <ActionLink href="/x" variant={variant}>
        Go
      </ActionLink>,
    );
    const link = screen.getByRole('link', { name: 'Go' });
    expect(link).toHaveAttribute('href', '/x');
    expect(link).toHaveClass('min-h-11', cls);
  });
});

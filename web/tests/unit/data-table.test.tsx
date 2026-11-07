import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DataTable, type DataTableColumn } from '@/components/common/DataTable';

const replace = vi.fn();
let search = '';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => '/staff/orders',
  useSearchParams: () => new URLSearchParams(search),
}));

interface Row {
  id: string;
  name: string;
}

const rows: Row[] = [
  { id: '1', name: 'Organic rice 5 kg' },
  { id: '2', name: 'Shamima' },
];

const columns: Array<DataTableColumn<Row>> = [
  { id: 'name', header: 'Name', cell: (row) => row.name, sortable: true },
];

beforeEach(() => {
  replace.mockClear();
  search = '';
});

describe('DataTable', () => {
  it('renders a loading skeleton, not the table, while loading', () => {
    render(
      <DataTable
        caption="Orders"
        columns={columns}
        rows={undefined}
        getRowId={(r) => r.id}
        isLoading
        emptyState={{ title: 'No orders' }}
      />,
    );
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('renders ErrorState on error, with retry wired to onRetry', async () => {
    const onRetry = vi.fn();
    render(
      <DataTable
        caption="Orders"
        columns={columns}
        rows={undefined}
        getRowId={(r) => r.id}
        isError
        onRetry={onRetry}
        emptyState={{ title: 'No orders' }}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('renders EmptyState in words (e.g. "None recorded"-style text), not a blank table, when there are no rows', () => {
    render(
      <DataTable
        caption="Orders"
        columns={columns}
        rows={[]}
        getRowId={(r) => r.id}
        emptyState={{ title: 'No orders placed yet.' }}
      />,
    );
    expect(screen.getByText('No orders placed yet.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('renders every row when data is present', () => {
    render(
      <DataTable
        caption="Orders"
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        emptyState={{ title: 'No orders' }}
      />,
    );
    expect(screen.getByRole('table', { name: 'Orders' })).toBeInTheDocument();
    expect(screen.getByText('Organic rice 5 kg')).toBeInTheDocument();
    expect(screen.getByText('Shamima')).toBeInTheDocument();
  });

  it('writes a sort change to the URL — U29', async () => {
    render(
      <DataTable
        caption="Orders"
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        emptyState={{ title: 'No orders' }}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Sort by Name' }));
    expect(replace).toHaveBeenCalledWith(
      expect.stringContaining('sort=name'),
      expect.objectContaining({ scroll: false }),
    );
    expect(replace).toHaveBeenCalledWith(expect.stringContaining('dir=asc'), expect.anything());
  });

  it('writes a page change to the URL — U29', async () => {
    render(
      <DataTable
        caption="Orders"
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        pagination={{ totalCount: 30, pageSize: 10 }}
        emptyState={{ title: 'No orders' }}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(replace).toHaveBeenCalledWith(
      expect.stringContaining('page=2'),
      expect.objectContaining({ scroll: false }),
    );
  });

  it('writes a search submission to the URL — U29', async () => {
    render(
      <DataTable
        caption="Orders"
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        search={{ label: 'Search orders' }}
        emptyState={{ title: 'No orders' }}
      />,
    );
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search orders' }), 'SO-2026');
    await userEvent.click(screen.getByRole('button', { name: 'Search' }));
    expect(replace).toHaveBeenCalledWith(
      expect.stringContaining('q=SO-2026'),
      expect.objectContaining({ scroll: false }),
    );
  });

  // HO-P4 §11.1.7: the restyle changes the look only; the scroll region stays focusable and named.
  it('keeps a focusable, named scroll region in the back-office card style', () => {
    render(
      <DataTable
        caption="Orders"
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        emptyState={{ title: 'No orders' }}
      />,
    );
    const region = screen.getByRole('region', { name: 'Orders (scrolls horizontally)' });
    expect(region).toHaveAttribute('tabindex', '0');
    expect(region).toHaveClass('rounded-2xl');
    expect(screen.getByRole('columnheader', { name: /Name/ })).toHaveClass(
      'text-[13px]',
      'font-semibold',
      'text-ink-muted',
    );
    expect(screen.getAllByRole('row')[1]).toHaveClass('border-surface-sunken');
  });
});

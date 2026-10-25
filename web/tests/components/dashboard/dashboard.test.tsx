import { describe, expect, it } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import StaffHomePage from '@/app/(staff)/staff/page';
import { DashboardView } from '@/components/dashboard/DashboardView';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { dashboardControl, resetReportsMockData } from '@/mocks/handlers/reports';
import { useDashboard } from '@/lib/hooks/useReports';
import type { Dashboard, DashboardTile } from '@/lib/api/dashboard';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { asAdministrator, renderWithClient } from '../reports/helpers';

/**
 * The page's "Needs attention" and "Latest orders" panels use branch-scoped queries, whose hook seeds
 * the active branch (the staff shell does this in the app, before any page mounts). Seeding it
 * up front keeps the dashboard's query key still, so the poll counts below are the page's own.
 */
function renderWithActiveBranch(ui: React.ReactElement) {
  asAdministrator();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(['staff', 'active-branch'], 'b0000000-0000-0000-0000-00000000a001');
  return { client, ...render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>) };
}

const money = (amount: string) => ({ amount, currencyCode: 'BDT' });

function payload(tiles: DashboardTile[], over: Partial<Dashboard> = {}): Dashboard {
  return {
    branchId: 'b1',
    branchName: 'Main outlet',
    localDate: '2026-10-14',
    timeZoneId: 'Asia/Dhaka',
    generatedOn: '2026-10-14T03:42:00+00:00',
    refreshSeconds: 60,
    tiles,
    ...over,
  };
}

const ordersToday: DashboardTile = {
  key: 'orders.today',
  title: 'Orders today',
  figures: [
    { key: 'placed', label: 'Placed today', value: 11, type: 'Integer' },
    { key: 'toPack', label: 'To pack', value: 6, type: 'Integer' },
  ],
  drillDown: {
    reportKey: 'order-fulfilment',
    from: '2026-10-14',
    to: '2026-10-14',
    parameters: {},
  },
};

describe('DashboardView — U-A series', () => {
  it('U-A1: renders exactly the tiles sent, in the server order', () => {
    const tiles = ['c', 'a', 'b'].map((k) => ({ ...ordersToday, key: k, title: `Tile ${k}` }));
    render(<DashboardView dashboard={payload(tiles)} updatedAt={1} />);
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(['Tile c', 'Tile a', 'Tile b']);
  });

  it('U-A2: an orders-only payload has no money, stock or sales tile and no placeholder', () => {
    render(<DashboardView dashboard={payload([ordersToday])} updatedAt={1} />);
    expect(
      screen.queryByText(/revenue|payments|stock|receivables|cash-up/i),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/locked|hidden|restricted|no access/i)).not.toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(1);
  });

  it('U-A3: a null figure is a dash with Not recorded, never 0', () => {
    const tile: DashboardTile = {
      key: 'x',
      title: 'Order age',
      figures: [{ key: 'oldestAge', label: 'Oldest', value: null, type: 'Integer', unit: 'h' }],
      drillDown: null,
    };
    render(<DashboardView dashboard={payload([tile])} updatedAt={1} />);
    const figure = screen.getByText('Oldest').closest('div')!;
    expect(figure).toHaveTextContent('—');
    expect(within(figure).getByText('Not recorded')).toBeInTheDocument();
    expect(figure).not.toHaveTextContent('0');
  });

  it('U-A4: no link without a drillDown, a link with one', () => {
    const without = { ...ordersToday, key: 'n', title: 'No link', drillDown: null };
    render(<DashboardView dashboard={payload([without, ordersToday])} updatedAt={1} />);
    // Same strength as before, scoped to the tile links: the header now also carries the two
    // shortcut actions ("New counter sale", "Receive goods"), which are not tile links.
    expect(screen.getAllByRole('link', { name: /View report/ })).toHaveLength(1);
    expect(screen.getAllByRole('link')).toHaveLength(3);
    expect(screen.getByRole('link', { name: /View report/ })).toHaveAttribute(
      'href',
      '/staff/reports/order-fulfilment?from=2026-10-14&to=2026-10-14',
    );
  });

  it('U-A7: money comes from the string and the date is the payload local date', () => {
    const tile: DashboardTile = {
      key: 'p',
      title: 'Payments',
      figures: [{ key: 'cash', label: 'Cash', value: money('9800.00'), type: 'Money' }],
      drillDown: null,
    };
    render(
      <DashboardView
        dashboard={payload([tile], {
          localDate: '2026-10-13',
          branchName: 'London outlet',
          timeZoneId: 'Europe/London',
        })}
        updatedAt={1}
      />,
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Today — 13 Oct 2026 · London outlet',
    );
    expect(screen.getByText(/9,800\.00/)).toBeInTheDocument();
    expect(screen.getByText(/Updated 04:42 \(Europe\/London\)/)).toBeInTheDocument();
  });

  it('shows a tile variance as the server amount only: no word, no sign logic', () => {
    const tile: DashboardTile = {
      key: 'c',
      title: 'Cash-up',
      figures: [
        { key: 'variance', label: 'Variance', value: money('-350.00'), type: 'Money' },
        { key: 'variance2', label: 'Other', value: money('0.00'), type: 'Money' },
      ],
      drillDown: null,
    };
    render(<DashboardView dashboard={payload([tile])} updatedAt={1} />);
    expect(screen.queryByText(/Over|Short|Matched|Mismatch/)).not.toBeInTheDocument();
    expect(screen.getByText(/350\.00/)).toBeInTheDocument();
  });

  it('shows an empty state for an empty payload', () => {
    render(<DashboardView dashboard={payload([])} updatedAt={1} />);
    expect(screen.getByText('Nothing to show for today yet')).toBeInTheDocument();
  });

  it('U-A5: a real refetch of /staff updates the figures, keeps the dialog open and focus where it was, and announces politely', async () => {
    resetReportsMockData();
    const { client } = renderWithActiveBranch(
      <>
        <StaffHomePage />
        <ConfirmDialog
          open
          onOpenChange={() => {}}
          title="Add note"
          consequence="Saves a note."
          onConfirm={() => {}}
        />
      </>,
    );
    // First poll: Placed today = 11.
    await waitFor(() => expect(screen.getByText('11')).toBeInTheDocument());
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    cancel.focus();
    expect(document.activeElement).toBe(cancel);
    expect(screen.queryByText('Dashboard updated')).not.toBeInTheDocument();

    // The poll fires: the mock's second answer has Placed today = 12.
    await act(async () => {
      await client.invalidateQueries({ queryKey: ['dashboard'] });
    });
    await waitFor(() => expect(screen.getByText('12')).toBeInTheDocument());

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(document.activeElement).toBe(cancel);
    expect(await screen.findByText('Dashboard updated')).toBeInTheDocument();
    expect(screen.getByText('Dashboard updated').closest('[aria-live]')).toHaveAttribute(
      'aria-live',
      'polite',
    );
  });
});

function Harness() {
  const dashboard = useDashboard();
  return (
    <p>{dashboard.data ? `polls ${dashboard.data.tiles[0]?.figures[0]?.value}` : 'loading'}</p>
  );
}

describe('useDashboard — ADR-FE-135 (U-A5, U-A6)', () => {
  it('polls on the payload refreshSeconds and never in the background', async () => {
    resetReportsMockData();
    dashboardControl.refreshSeconds = 30;
    server.use(
      http.get('*/api/staff/branches/mine', () =>
        HttpResponse.json({
          branchIds: ['b0000000-0000-0000-0000-00000000a001'],
          primaryBranchId: 'b0000000-0000-0000-0000-00000000a001',
          activeBranchId: 'b0000000-0000-0000-0000-00000000a001',
          activeBranchRefusal: null,
        }),
      ),
    );
    const { client } = renderWithClient(<Harness />);
    await waitFor(() => expect(screen.getByText(/polls 11/)).toBeInTheDocument());
    const query = client.getQueryCache().find({ queryKey: ['dashboard', null] });
    const options = query?.options as {
      refetchInterval: (q: unknown) => number | false;
      refetchIntervalInBackground: boolean;
    };
    expect(options.refetchIntervalInBackground).toBe(false);
    expect(options.refetchInterval({ state: { data: { refreshSeconds: 30 } } })).toBe(30_000);
    expect(options.refetchInterval({ state: { data: undefined } })).toBe(false);
  });
});

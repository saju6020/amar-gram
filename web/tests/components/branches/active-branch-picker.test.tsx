import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { ActiveBranchPicker } from '@/components/branches/ActiveBranchPicker';
import { ACTIVE_BRANCH_KEY } from '@/lib/hooks/useActiveBranch';

// §8.3: the active branch is TanStack Query state under `ACTIVE_BRANCH_KEY`, not a module-level
// store — each test below builds its own `QueryClient` (the same one `ActiveBranchPicker` reads
// and writes through `useQueryClient()`), so there is nothing to reset between tests.
function renderWithClient(children: React.ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const { container } = render(
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>,
  );
  return { queryClient, container };
}

describe('ActiveBranchPicker — HO-ADM-002 §11.2, ADR-FE-016', () => {
  it('U-B5: hidden with one branch', async () => {
    server.use(
      http.get('*/api/staff/branches/mine', () =>
        HttpResponse.json({
          branchIds: ['b1'],
          primaryBranchId: 'b1',
          activeBranchId: 'b1',
          activeBranchRefusal: null,
        }),
      ),
      http.get('*/api/admin/branches', () =>
        HttpResponse.json([
          {
            id: 'b1',
            code: 'MAIN',
            name: 'Dhanmondi outlet',
            timeZoneId: 'Asia/Dhaka',
            isActive: true,
          },
        ]),
      ),
    );
    const { queryClient, container } = renderWithClient(<ActiveBranchPicker />);
    await waitFor(() => expect(queryClient.getQueryData(ACTIVE_BRANCH_KEY)).toBe('b1')); // the seed effect has now run
    expect(container).toBeEmptyDOMElement();
  });

  it('U-B5: shown with two branches, and changing it updates the value client.ts reads for X-Branch-Id', async () => {
    server.use(
      http.get('*/api/staff/branches/mine', () =>
        HttpResponse.json({
          branchIds: ['b1', 'b2'],
          primaryBranchId: 'b1',
          activeBranchId: 'b1',
          activeBranchRefusal: null,
        }),
      ),
      http.get('*/api/admin/branches', () =>
        HttpResponse.json([
          {
            id: 'b1',
            code: 'MAIN',
            name: 'Dhanmondi outlet',
            timeZoneId: 'Asia/Dhaka',
            isActive: true,
          },
          {
            id: 'b2',
            code: 'LDN',
            name: 'London outlet',
            timeZoneId: 'Europe/London',
            isActive: true,
          },
        ]),
      ),
    );
    const user = userEvent.setup();
    const { queryClient } = renderWithClient(<ActiveBranchPicker />);

    const select = await screen.findByLabelText(/branch/i);
    await waitFor(() => expect(queryClient.getQueryData(ACTIVE_BRANCH_KEY)).toBe('b1'));

    await user.selectOptions(select, 'b2');
    expect(queryClient.getQueryData(ACTIVE_BRANCH_KEY)).toBe('b2');
  });

  it('ADM-002-FU2: a long branch name is truncated by classes, not by data — full name in option text and title', async () => {
    const longName = 'The Very Long Named Organic Grocery Outlet Number Two'.padEnd(40, 'x');
    server.use(
      http.get('*/api/staff/branches/mine', () =>
        HttpResponse.json({
          branchIds: ['b1', 'b2'],
          primaryBranchId: 'b1',
          activeBranchId: 'b1',
          activeBranchRefusal: null,
        }),
      ),
      http.get('*/api/admin/branches', () =>
        HttpResponse.json([
          { id: 'b1', code: 'LONG', name: longName, timeZoneId: 'Asia/Dhaka', isActive: true },
          {
            id: 'b2',
            code: 'MAIN',
            name: 'Dhanmondi outlet',
            timeZoneId: 'Asia/Dhaka',
            isActive: true,
          },
        ]),
      ),
    );
    const user = userEvent.setup();
    const { container, queryClient } = renderWithClient(<ActiveBranchPicker />);
    const select = await screen.findByLabelText(/branch/i);
    await waitFor(() => expect(select).toHaveAttribute('title', longName));
    expect(screen.getByRole('option', { name: longName })).toBeInTheDocument();
    expect(select).toHaveClass('min-w-0', 'flex-1', 'truncate');
    expect(container.firstElementChild).toHaveClass('w-full', 'min-w-0', 'max-w-md');
    expect(screen.getByText('Branch')).toHaveClass('flex-shrink-0');
    // Behaviour is intact: the long-named option is still selectable by keyboard-equivalent change,
    // and the title follows the selection. (The real overflow guard is Playwright E-B3; jsdom has no layout.)
    await user.selectOptions(select, 'b2');
    expect(queryClient.getQueryData(ACTIVE_BRANCH_KEY)).toBe('b2');
    await waitFor(() => expect(select).toHaveAttribute('title', 'Dhanmondi outlet'));
  });

  // HO-P4 §11.1.5 / U5, ADR-FE-182: the sidebar variant is the same component on leaf.
  describe('variant="sidebar"', () => {
    function branches(ids: string[]) {
      server.use(
        http.get('*/api/staff/branches/mine', () =>
          HttpResponse.json({
            branchIds: ids,
            primaryBranchId: 'b1',
            activeBranchId: 'b1',
            activeBranchRefusal: null,
          }),
        ),
        http.get('*/api/admin/branches', () =>
          HttpResponse.json(
            ids.map((id, i) => ({
              id,
              code: `C${i}`,
              name: `Outlet ${id}`,
              timeZoneId: 'Asia/Dhaka',
              isActive: true,
            })),
          ),
        ),
      );
    }

    it('U5: with two branches it renders a labelled "Outlet" select and changes the active branch', async () => {
      branches(['b1', 'b2']);
      const user = userEvent.setup();
      const { queryClient } = renderWithClient(<ActiveBranchPicker variant="sidebar" />);
      const select = await screen.findByRole('combobox', { name: 'Outlet' });
      await waitFor(() => expect(queryClient.getQueryData(ACTIVE_BRANCH_KEY)).toBe('b1'));
      await user.selectOptions(select, 'b2');
      expect(queryClient.getQueryData(ACTIVE_BRANCH_KEY)).toBe('b2');
    });

    it('U5: with one branch it renders nothing, but the seed effect still runs', async () => {
      branches(['b1']);
      const { queryClient, container } = renderWithClient(<ActiveBranchPicker variant="sidebar" />);
      await waitFor(() => expect(queryClient.getQueryData(ACTIVE_BRANCH_KEY)).toBe('b1'));
      expect(container).toBeEmptyDOMElement();
    });

    it('two sidebar pickers in one document do not share an id', async () => {
      branches(['b1', 'b2']);
      renderWithClient(
        <>
          <ActiveBranchPicker variant="sidebar" />
          <ActiveBranchPicker variant="sidebar" />
        </>,
      );
      const selects = await screen.findAllByRole('combobox', { name: 'Outlet' });
      expect(selects).toHaveLength(2);
      expect(selects[0]?.id).not.toBe(selects[1]?.id);
    });
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { resetOrderingMockData } from '../../../mocks/handlers/ordering/store';
import { PosScreen } from '@/components/pos/PosScreen';
import { setUrl } from '../common/nav-mock';

vi.mock('next/navigation', () => import('../common/nav-mock'));

/**
 * HO-P4 S2 — U22 and U23 (§15): the counter sale's tap tiles, ticket, tender and money rules. The totals,
 * the "Exact" amount and the change due are the server's strings; the browser adds nothing up.
 */
function renderWithClient(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

/** Thai Jasmine Rice 1 kg of the shop mock: 780.00. */
const JASMINE_RICE = '8900000000201';

beforeEach(() => {
  resetOrderingMockData();
  setUrl('/staff/pos');
});

async function addByName(user: ReturnType<typeof userEvent.setup>, text: string) {
  await user.click(screen.getByRole('button', { name: 'Search by name' }));
  await user.type(screen.getByLabelText('Product name or code'), text);
  const results = await screen.findByRole('list', { name: 'Search results' });
  await waitFor(() => expect(within(results).getAllByRole('button').length).toBeGreaterThan(0));
  return results;
}

describe('Tiles and ticket - U22', () => {
  it('a search result tile adds a basket line, and the ticket total is the quote’s grand total', async () => {
    const user = userEvent.setup();
    renderWithClient(<PosScreen />);
    expect(screen.getByRole('heading', { level: 1, name: 'Counter sale' })).toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument(); // no category tabs (BG-6)
    const results = await addByName(user, 'Jasmine');
    await user.click(within(results).getAllByRole('button')[0]!);
    const basket = await screen.findByRole('list', { name: 'Basket' });
    expect(within(basket).getAllByRole('listitem')).toHaveLength(1);
    const total = await screen.findByRole('region', { name: 'Sale total' });
    await waitFor(() => expect(within(total).getByRole('definition')).toHaveTextContent(/780\.00/));
  });

  it('the tender is a radiogroup with Cash and Card (terminal); the card choice asks for a terminal slip number, never a card number', async () => {
    const user = userEvent.setup();
    renderWithClient(<PosScreen />);
    const group = screen.getByRole('radiogroup', { name: 'Tender' });
    expect(within(group).getAllByRole('radio').map((r) => r.closest('label')?.textContent)).toEqual(['Cash', 'Card (terminal)']);
    expect(within(group).getByRole('radio', { name: 'Cash' })).toBeChecked();
    expect(screen.queryByLabelText('Terminal slip number')).not.toBeInTheDocument();
    await user.click(within(group).getByRole('radio', { name: 'Card (terminal)' }));
    expect(screen.getByLabelText('Terminal slip number')).toBeInTheDocument();
    expect(document.body.innerHTML).not.toMatch(/card number(?!\.)|expiry|cvv/i);
  });

  it('"Walk-in · add customer" opens the existing name and mobile fields', async () => {
    const user = userEvent.setup();
    renderWithClient(<PosScreen />);
    expect(screen.queryByLabelText(/Customer name/)).not.toBeInTheDocument();
    const chip = screen.getByRole('button', { name: 'Walk-in · add customer' });
    expect(chip).toHaveAttribute('aria-expanded', 'false');
    await user.click(chip);
    expect(chip).toHaveAttribute('aria-expanded', 'true');
    await user.type(screen.getByLabelText(/Customer name/), 'Walk-in Buyer');
    expect(screen.getByLabelText(/Mobile number/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Walk-in Buyer/ })).toBeInTheDocument();
  });
});

describe('Money rules at the counter - U23', () => {
  it('"Exact" fills the amount with the quote’s total string unchanged and no change is shown before completion', async () => {
    const user = userEvent.setup();
    renderWithClient(<PosScreen />);
    const field = screen.getByLabelText('Scan a barcode');
    await user.click(field);
    await user.type(field, `${JASMINE_RICE}{Enter}`);
    await screen.findByRole('list', { name: 'Basket' });
    const total = await screen.findByRole('region', { name: 'Sale total' });
    await waitFor(() => expect(within(total).getByRole('definition')).toHaveTextContent(/780\.00/));
    const exact = screen.getByRole('button', { name: 'Exact' });
    await waitFor(() => expect(exact).toBeEnabled());
    await user.click(exact);
    expect(screen.getByLabelText(/handed over/)).toHaveValue('780.00');
    expect(exact).toHaveAttribute('aria-pressed', 'true');
    // Fixed quick amounts fill the field as typed, too.
    await user.click(screen.getByRole('button', { name: /1,?000\.00/ }));
    expect(screen.getByLabelText(/handed over/)).toHaveValue('1000.00');
    expect(document.body.textContent).not.toMatch(/change (due|to give)/i);
  });

  it('after completion the screen shows the server’s change due', async () => {
    const user = userEvent.setup();
    renderWithClient(<PosScreen />);
    const field = screen.getByLabelText('Scan a barcode');
    await user.click(field);
    await user.type(field, `${JASMINE_RICE}{Enter}`);
    await screen.findByRole('list', { name: 'Basket' });
    await user.click(screen.getByRole('button', { name: 'Walk-in · add customer' }));
    await user.type(screen.getByLabelText(/Customer name/), 'Walk-in Buyer');
    await user.type(screen.getByLabelText(/Mobile number/), '01711112222');
    await user.click(screen.getByRole('button', { name: /1,?000\.00/ }));
    await user.click(screen.getByRole('button', { name: 'Add payment' }));
    const complete = screen.getByRole('button', { name: 'Complete sale' });
    await waitFor(() => expect(complete).toBeEnabled());
    await user.click(complete);
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Complete sale' }));
    expect(await screen.findByRole('heading', { name: /Sale complete/ })).toBeInTheDocument();
    expect(screen.getByText(/Change due:/)).toHaveTextContent(/220\.00/);
    expect(screen.getByRole('link', { name: 'Print receipt' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New sale' })).toBeInTheDocument();
  });
});

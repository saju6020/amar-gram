import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { delay, http, HttpResponse } from 'msw';
import { server } from '../../../mocks/server';
import { money, resetOrderingMockData, skuInfo, uuid } from '../../../mocks/handlers/ordering/store';
import { computeQuote } from '../../../mocks/handlers/ordering/quote';
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
    // HO-P5 U24 supersedes "no category tabs (BG-6)": the category tablist and its tap grid now exist.
    const categories = screen.getByRole('tablist', { name: 'Item categories' });
    expect(within(categories).getAllByRole('tab').map((t) => t.textContent)[0]).toBe('All');
    expect(within(categories).getAllByRole('tab')).toHaveLength(12);
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

  it('"Walk-in (no customer)" opens the existing name and mobile fields', async () => {
    const user = userEvent.setup();
    renderWithClient(<PosScreen />);
    expect(screen.queryByLabelText(/Customer name/)).not.toBeInTheDocument();
    const chip = screen.getByRole('button', { name: 'Walk-in (no customer) · Add customer' });
    expect(chip).toHaveAttribute('aria-expanded', 'false');
    await user.click(chip);
    expect(chip).toHaveAttribute('aria-expanded', 'true');
    await user.type(screen.getByLabelText(/Customer name/), 'Walk-in Buyer');
    expect(screen.getByLabelText(/Mobile number/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Walk-in Buyer/ })).toBeInTheDocument();
  });
});

describe('Money rules at the counter - U23', () => {
  // HO-P5 U25 supersedes this case's "no change is shown before completion": the quote's changeDue / cashShort for the
  // typed cash is shown (BG-7), and the fixed amounts still fill the field as typed.
  it('"Exact" fills the amount with the quote’s total string unchanged and the quote answers the change for the typed cash', async () => {
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
    // The change is the quote's answer for 1000.00 against 780.00, not a sum made here.
    await waitFor(() => expect(document.body.textContent).toMatch(/Change due\s*৳?220\.00/));
  });

  it('typing less than the total shows what is still to pay, from the quote', async () => {
    const user = userEvent.setup();
    renderWithClient(<PosScreen />);
    const field = screen.getByLabelText('Scan a barcode');
    await user.click(field);
    await user.type(field, `${JASMINE_RICE}{Enter}`);
    await screen.findByRole('list', { name: 'Basket' });
    const total = await screen.findByRole('region', { name: 'Sale total' });
    await waitFor(() => expect(within(total).getByRole('definition')).toHaveTextContent(/780\.00/));
    await user.type(screen.getByLabelText(/handed over/), '500');
    await waitFor(() => expect(document.body.textContent).toMatch(/Still to pay\s*৳?280\.00/));
    expect(document.body.textContent).not.toMatch(/Change due/);
  });

  it('shows nothing about change until some cash is typed', async () => {
    const user = userEvent.setup();
    renderWithClient(<PosScreen />);
    const field = screen.getByLabelText('Scan a barcode');
    await user.click(field);
    await user.type(field, `${JASMINE_RICE}{Enter}`);
    await screen.findByRole('list', { name: 'Basket' });
    const total = await screen.findByRole('region', { name: 'Sale total' });
    await waitFor(() => expect(within(total).getByRole('definition')).toHaveTextContent(/780\.00/));
    expect(document.body.textContent).not.toMatch(/Change due|Still to pay/);
  });

  it('after completion the screen shows the server’s change due', async () => {
    const user = userEvent.setup();
    renderWithClient(<PosScreen />);
    const field = screen.getByLabelText('Scan a barcode');
    await user.click(field);
    await user.type(field, `${JASMINE_RICE}{Enter}`);
    await screen.findByRole('list', { name: 'Basket' });
    await user.click(screen.getByRole('button', { name: 'Walk-in (no customer) · Add customer' }));
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

/**
 * HO-P5 Amended (ab) and the stale-quote cases: the change preview is the quote's answer for the cash typed, so it is only
 * shown while the quote on screen is for exactly this basket and this cash, and not at all once a payment has been added.
 */
describe('Change preview staleness - U25 (Amended (ab))', () => {
  const OATS_400 = '8900000000101';
  const seen: Array<{ lines: number; cash: number | null }> = [];

  /** A quote handler with a response delay chosen per request, so the order in which answers arrive can be controlled. */
  function slowQuote(delayFor: (body: { lines: unknown[]; tenderedCash?: number | null }) => number) {
    server.use(
      http.post('*/api/staff/pos/quote', async ({ request }) => {
        const body = (await request.json()) as { lines: Array<{ skuId: string; quantity: number }>; tenderedCash?: number | null };
        seen.push({ lines: body.lines.length, cash: body.tenderedCash ?? null });
        await delay(delayFor(body));
        const lines = body.lines.map((l) => ({ lineId: uuid(), skuId: l.skuId, quantity: l.quantity, priceWhenAddedCents: skuInfo(l.skuId)?.priceCents ?? 0 }));
        const result = computeQuote(lines, { fulfilment: 'Counter', customerHasOrders: false });
        const grand = result.totals.grand;
        const handed = body.tenderedCash == null ? null : Math.round(body.tenderedCash * 100);
        return HttpResponse.json({
          ...result.wire,
          changeDue: handed !== null && handed >= grand ? money(handed - grand) : null,
          cashShort: handed !== null && handed < grand ? money(grand - handed) : null,
        });
      }),
    );
  }

  async function scan(user: ReturnType<typeof userEvent.setup>, code: string) {
    const field = screen.getByLabelText('Scan a barcode');
    await user.click(field);
    await user.type(field, `${code}{Enter}`);
  }
  const text = () => document.body.textContent ?? '';

  beforeEach(() => {
    seen.length = 0;
  });

  it('is hidden once a payment has been added, and stays hidden while more cash is typed', async () => {
    const user = userEvent.setup();
    renderWithClient(<PosScreen />);
    await scan(user, JASMINE_RICE);
    await screen.findByRole('list', { name: 'Basket' });
    await user.type(screen.getByLabelText(/handed over/), '1000');
    await waitFor(() => expect(text()).toMatch(/Change due\s*৳?220\.00/));
    await user.click(screen.getByRole('button', { name: 'Add payment' }));
    expect(screen.getByRole('list', { name: 'Payments taken' })).toBeInTheDocument();
    await user.type(screen.getByLabelText(/handed over/), '500');
    await new Promise((resolve) => setTimeout(resolve, 900));
    expect(text()).not.toMatch(/Change due|Still to pay/);
    // Removing the payment brings the one-tender answer back.
    await user.click(within(screen.getByRole('list', { name: 'Payments taken' })).getByRole('button'));
    await waitFor(() => expect(text()).toMatch(/Still to pay\s*৳?280\.00/));
  });

  it('a basket change after cash was typed never shows the old basket’s change', async () => {
    const user = userEvent.setup();
    slowQuote((body) => (body.lines.length > 1 ? 1200 : 0));
    renderWithClient(<PosScreen />);
    await scan(user, JASMINE_RICE);
    await screen.findByRole('list', { name: 'Basket' });
    await user.type(screen.getByLabelText(/handed over/), '1000');
    await waitFor(() => expect(text()).toMatch(/Change due\s*৳?220\.00/));
    await scan(user, OATS_400);
    await waitFor(() => expect(within(screen.getByRole('list', { name: 'Basket' })).getAllByRole('listitem')).toHaveLength(2));
    // The new quote is in flight (1.2 s): the old 220.00 must not stay on screen as if it were for this basket.
    await waitFor(() => expect(seen.some((s) => s.lines === 2)).toBe(true));
    expect(text()).not.toMatch(/Change due\s*৳?220\.00/);
    await waitFor(() => expect(text()).toMatch(/Change due|Still to pay/), { timeout: 3000 });
    expect(text()).not.toMatch(/Change due\s*৳?220\.00/);
  });

  it('an answer that arrives late for cash that is no longer typed is never shown', async () => {
    const user = userEvent.setup();
    slowQuote((body) => (body.tenderedCash === 500 ? 1500 : 0));
    renderWithClient(<PosScreen />);
    await scan(user, JASMINE_RICE);
    await screen.findByRole('list', { name: 'Basket' });
    const cash = screen.getByLabelText(/handed over/);
    await user.type(cash, '500');
    await waitFor(() => expect(seen.some((s) => s.cash === 500)).toBe(true));
    await user.clear(cash);
    await user.type(cash, '1000');
    await waitFor(() => expect(text()).toMatch(/Change due\s*৳?220\.00/));
    // The slow answer for 500 lands after this: it must not replace the one for 1000.
    await new Promise((resolve) => setTimeout(resolve, 1800));
    expect(text()).toMatch(/Change due\s*৳?220\.00/);
    expect(text()).not.toMatch(/Still to pay/);
  });
});

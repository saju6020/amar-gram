import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../../../mocks/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { orderingIds as ordering } from '../../../mocks/handlers/ordering/fixtures';
import { findOrder, resetOrderingMockData } from '../../../mocks/handlers/ordering/store';
import { billingIds, resetBillingMockData } from '../../../mocks/handlers/billing';
import { findInvoice, invoiceDetail, totalsDiscountLabelOf } from '../../../mocks/handlers/billing/store';
import { SUBSCRIPTION_DISCOUNT_LABEL } from '../../../mocks/handlers/subscriptions/discountLabel';
import { subscriptionOrderSeeds } from '../../../mocks/handlers/subscriptions/fixtures';
import { customerDetail, orderLineView, totalsView } from '../../../mocks/handlers/ordering/customer';
import { MyOrderDetail } from '@/components/orders/MyOrderDetail';
import { StaffOrderDetail } from '@/components/orders/StaffOrderDetail';
import { InvoiceDetailScreen } from '@/components/billing/InvoiceDetailScreen';
import { MyInvoiceDetail } from '@/components/billing/MyInvoiceDetail';
import { setUrl } from '../common/nav-mock';

vi.mock('next/navigation', () => import('../common/nav-mock'));

/** Owner decision 2026-11-09 (HO-P6 Amended): "Subscription discount (10%)" where the screens showed a generic discount. */
function renderWithClient(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

const subscriptionOrder = () => subscriptionOrderSeeds().find((s) => findOrder(s.orderId)?.channel === 'Subscription')!;

beforeEach(() => {
  resetOrderingMockData();
  resetBillingMockData();
  setUrl('/staff/orders');
});

describe('the mock sends the label only for subscription orders', () => {
  it('lines and totals carry it on a subscription order and null on any other', () => {
    expect(SUBSCRIPTION_DISCOUNT_LABEL).toBe('Subscription discount (10%)');
    const sub = findOrder(subscriptionOrder().orderId)!;
    expect(sub.lineDiscountCents).toBeGreaterThan(0);
    expect(totalsView(sub).lineDiscountLabel).toBe(SUBSCRIPTION_DISCOUNT_LABEL);
    expect(orderLineView(sub.lines[0]!, SUBSCRIPTION_DISCOUNT_LABEL).discountLabel).toBe(SUBSCRIPTION_DISCOUNT_LABEL);
    const plain = findOrder(ordering.orders.confirmedCod)!;
    expect(totalsView(plain).lineDiscountLabel).toBeNull();
    expect(orderLineView(plain.lines[0]!, null).discountLabel).toBeNull();
  });
});

function serveCustomerOrder(orderId: string) {
  server.use(
    http.get('*/api/customers/me/orders/:id', () => HttpResponse.json(customerDetail(findOrder(orderId)!))),
    http.get('*/api/branches', () => HttpResponse.json([])),
  );
}

describe('customer order page', () => {
  it('labels the item discount total and the discounted line, with the amounts', async () => {
    serveCustomerOrder(subscriptionOrder().orderId);
    renderWithClient(<MyOrderDetail orderId={subscriptionOrder().orderId} />);
    const totals = await screen.findByRole('region', { name: /order summary|summary/i });
    expect(within(totals).getByText(SUBSCRIPTION_DISCOUNT_LABEL)).toBeInTheDocument();
    expect(within(totals).queryByText('Item discounts')).not.toBeInTheDocument();
    const lines = screen.getByRole('list', { name: /items/i });
    expect(within(lines).getByText(SUBSCRIPTION_DISCOUNT_LABEL, { exact: false })).toBeInTheDocument();
  });

  it('keeps "Item discounts" and shows no line label when the label is null', async () => {
    serveCustomerOrder(ordering.orders.confirmedCod);
    renderWithClient(<MyOrderDetail orderId={ordering.orders.confirmedCod} />);
    const totals = await screen.findByRole('region', { name: /order summary|summary/i });
    expect(within(totals).getByText('Item discounts')).toBeInTheDocument();
    expect(screen.queryByText(/Subscription discount/)).not.toBeInTheDocument();
  });
});

describe('staff order page', () => {
  it('labels the item discount total', async () => {
    renderWithClient(<StaffOrderDetail orderId={subscriptionOrder().orderId} />);
    expect(await screen.findByText(SUBSCRIPTION_DISCOUNT_LABEL)).toBeInTheDocument();
    expect(screen.queryByText('Item discounts')).not.toBeInTheDocument();
  });

  it('keeps "Item discounts" when the label is null', async () => {
    renderWithClient(<StaffOrderDetail orderId={ordering.orders.confirmedCod} />);
    expect(await screen.findByText('Item discounts')).toBeInTheDocument();
    expect(screen.queryByText(/Subscription discount/)).not.toBeInTheDocument();
  });
});

/** The billing mock labels a discounted invoice line whose source is a subscription order (none is seeded, so one is made). */
function makeSubscriptionInvoice(id: string) {
  const invoice = findInvoice(id)!;
  const line = invoice.lines[0]!;
  line.sourceKind = 'Order';
  line.sourceId = subscriptionOrder().orderId;
  line.discountCents = 5000;
  return invoice;
}

describe('invoice pages', () => {
  it('the mock labels the line and the totals only for a subscription order line', () => {
    const plain = invoiceDetail(findInvoice(billingIds.issuedInvoiceId)!);
    expect(plain.totals.discountLabel).toBeNull();
    expect(plain.lines.every((l) => l.discountLabel === null)).toBe(true);
    const labelled = invoiceDetail(makeSubscriptionInvoice(billingIds.issuedInvoiceId));
    expect(labelled.lines[0]!.discountLabel).toBe(SUBSCRIPTION_DISCOUNT_LABEL);
    expect(labelled.totals.discountLabel).toBe(SUBSCRIPTION_DISCOUNT_LABEL);
    expect(totalsDiscountLabelOf([])).toBeNull();
  });

  it('staff invoice: the totals row and the line carry the label', async () => {
    makeSubscriptionInvoice(billingIds.issuedInvoiceId);
    renderWithClient(<InvoiceDetailScreen invoiceId={billingIds.issuedInvoiceId} />);
    expect((await screen.findAllByText(SUBSCRIPTION_DISCOUNT_LABEL)).length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText('Discounts')).not.toBeInTheDocument();
  });

  it('staff invoice: keeps "Discounts" and no label when null', async () => {
    renderWithClient(<InvoiceDetailScreen invoiceId={billingIds.issuedInvoiceId} />);
    expect(await screen.findByText('Discounts')).toBeInTheDocument();
    expect(screen.queryByText(/Subscription discount/)).not.toBeInTheDocument();
  });

  it('customer invoice: labelled and null', async () => {
    makeSubscriptionInvoice(billingIds.issuedInvoiceId);
    const first = renderWithClient(<MyInvoiceDetail invoiceId={billingIds.issuedInvoiceId} />);
    expect((await screen.findAllByText(SUBSCRIPTION_DISCOUNT_LABEL)).length).toBeGreaterThanOrEqual(2);
    first.unmount();
    resetBillingMockData();
    renderWithClient(<MyInvoiceDetail invoiceId={billingIds.issuedInvoiceId} />);
    expect(await screen.findByText('Discounts')).toBeInTheDocument();
    expect(screen.queryByText(/Subscription discount/)).not.toBeInTheDocument();
  });
});

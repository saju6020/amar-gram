import type { PortalBalances, PortalDashboard } from '@/lib/api/portal';
import type { ReorderResult } from '@/lib/api/my-orders';

/**
 * `mocks/handlers/portal/fixtures.ts` — HO-POR-002 §12. Dashboard bodies shaped exactly like
 * `PortalDashboardViewModel` on master (HO-POR-001, merged): camelCase, `yyyy-MM-dd` dates, money as
 * `{ amount: "…", currencyCode }`, `Unavailable` sections with `data: null`, and NO
 * `subscriptions` key. No field here is one the backend does not send (HO-ACC-002 §5.1).
 */
export const portalIds = {
  orders: {
    pending: 'c1000000-0000-0000-0000-000000000001',
    delivered: 'c1000000-0000-0000-0000-000000000002',
    cancelled: 'c1000000-0000-0000-0000-000000000003',
    mixed: 'c1000000-0000-0000-0000-000000000004',
    nothing: 'c1000000-0000-0000-0000-000000000005',
    notFound: 'c1000000-0000-0000-0000-0000000000f4',
    refused: 'c1000000-0000-0000-0000-0000000000f0',
    conflict: 'c1000000-0000-0000-0000-0000000000f9',
  },
  invoices: {
    overdue: 'e1000000-0000-0000-0000-000000000001',
    open: 'e1000000-0000-0000-0000-000000000002',
    usd: 'e1000000-0000-0000-0000-000000000003',
  },
} as const;

const GENERATED_ON = '2026-10-12T04:30:00+00:00';
const ready = <T>(data: T) => ({ state: 'Ready' as const, data });
const unavailable = () => ({ state: 'Unavailable' as const, data: null });

const HOW_TO_PAY =
  'You can pay at the outlet by cash or card, or by bank transfer. Contact the outlet if you need the transfer details.';

export const fullBalances: PortalBalances = {
  hasOutstanding: true,
  outstanding: [
    { amount: '3250.00', currencyCode: 'BDT' },
    { amount: '40.00', currencyCode: 'USD' },
  ],
  overdue: [{ amount: '1250.00', currencyCode: 'BDT' }],
  openInvoiceCount: 3,
  oldestDueOn: '2026-09-16',
  invoices: [
    {
      invoiceId: portalIds.invoices.overdue,
      invoiceNumber: 'INV-2026-00318',
      issuedOn: '2026-09-02',
      dueOn: '2026-09-16',
      total: { amount: '1250.00', currencyCode: 'BDT' },
      balanceDue: { amount: '1250.00', currencyCode: 'BDT' },
      status: 'Issued',
    },
    {
      invoiceId: portalIds.invoices.open,
      invoiceNumber: 'INV-2026-00341',
      issuedOn: '2026-09-16',
      dueOn: '2026-09-30',
      total: { amount: '2500.00', currencyCode: 'BDT' },
      balanceDue: { amount: '2000.00', currencyCode: 'BDT' },
      status: 'PartPaid',
    },
    {
      invoiceId: portalIds.invoices.usd,
      invoiceNumber: 'INV-2026-00352',
      issuedOn: '2026-09-20',
      dueOn: '2026-10-07',
      total: { amount: '40.00', currencyCode: 'USD' },
      balanceDue: { amount: '40.00', currencyCode: 'USD' },
      status: 'Issued',
    },
  ],
  howToPay: HOW_TO_PAY,
};

/** Orders in four states and balances in BDT and USD. */
export function fullDashboard(): PortalDashboard {
  return {
    generatedOn: GENERATED_ON,
    customer: ready({ fullName: 'Sam Rahman' }),
    balances: ready(structuredClone(fullBalances)),
    orders: ready({
      items: [
        {
          orderId: portalIds.orders.pending,
          orderNumber: 'SO-2026-00061',
          placedOn: '2026-10-09T05:00:00+00:00',
          status: 'PendingPayment',
          total: { amount: '1840.00', currencyCode: 'BDT' },
          itemCount: 2,
          canReorder: false,
          trackingNumber: null,
        },
        {
          orderId: portalIds.orders.delivered,
          orderNumber: 'SO-2026-00042',
          placedOn: '2026-09-02T05:00:00+00:00',
          status: 'Delivered',
          total: { amount: '3450.00', currencyCode: 'BDT' },
          itemCount: 3,
          canReorder: true,
          trackingNumber: 'DHK-88213-BD',
        },
        {
          orderId: portalIds.orders.cancelled,
          orderNumber: 'SO-2026-00031',
          placedOn: '2026-08-14T05:00:00+00:00',
          status: 'Cancelled',
          total: { amount: '980.00', currencyCode: 'BDT' },
          itemCount: 1,
          canReorder: true,
          trackingNumber: null,
        },
        {
          orderId: portalIds.orders.mixed,
          orderNumber: 'SO-2026-00027',
          placedOn: '2026-07-20T05:00:00+00:00',
          status: 'Delivered',
          total: { amount: '5210.00', currencyCode: 'BDT' },
          itemCount: 6,
          canReorder: true,
          trackingNumber: null,
        },
      ],
    }),
  };
}

/** A brand-new customer: every section `Ready` and empty. */
export function newCustomerDashboard(): PortalDashboard {
  return {
    generatedOn: GENERATED_ON,
    customer: ready({ fullName: 'Nusrat Jahan' }),
    balances: ready({
      hasOutstanding: false,
      outstanding: [],
      overdue: [],
      openInvoiceCount: 0,
      oldestDueOn: null,
      invoices: [],
      howToPay: HOW_TO_PAY,
    }),
    orders: ready({ items: [] }),
  };
}

/** `balances` Unavailable (and nothing else lost). */
export function degradedDashboard(): PortalDashboard {
  return { ...fullDashboard(), balances: unavailable() };
}

/** The `orders` key absent: "not delivered yet" (HO-POR-001 §1 Amended 2026-10-09). */
export function ordersNotDeliveredDashboard(): PortalDashboard {
  const { orders: _omitted, ...rest } = fullDashboard();
  void _omitted;
  return rest;
}

export const reorderResults = {
  allAdded: { addedCount: 3, unavailable: [] } satisfies ReorderResult,
  mixed: {
    addedCount: 3,
    unavailable: [
      { productName: 'Organic rice 5 kg', reason: 'OutOfStock' },
      { productName: 'Mustard oil 1 L', reason: 'NotPurchasable' },
      { productName: 'Raw honey 500 g', reason: 'QuantityOutOfRange' },
      { productName: 'Red lentils 1 kg', reason: 'CartFull' },
      { productName: 'Mystery item', reason: 'SomethingTheClientHasNeverHeardOf' },
    ],
  } satisfies ReorderResult,
  nothing: {
    addedCount: 0,
    unavailable: [
      { productName: 'Brown sugar 1 kg', reason: 'OutOfStock' },
      { productName: 'Ghee 400 g', reason: 'NotPurchasable' },
    ],
  } satisfies ReorderResult,
};

export type PortalScenario = 'full' | 'new' | 'degraded' | 'ordersNotDelivered' | 'failed';

export function dashboardFor(scenario: PortalScenario): PortalDashboard {
  switch (scenario) {
    case 'new':
      return newCustomerDashboard();
    case 'degraded':
      return degradedDashboard();
    case 'ordersNotDelivered':
      return ordersNotDeliveredDashboard();
    default:
      return fullDashboard();
  }
}

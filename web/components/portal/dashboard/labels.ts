import type { BadgeProps } from '@/components/ui/badge';

/**
 * `components/portal/dashboard/labels.ts` — HO-POR-002 U-X1 / CODE_REVIEW focus: every enumeration
 * the dashboard shows goes through a label map, so no identifier such as `PendingPayment` reaches
 * the page. An unknown value gets a neutral fallback label (the wire is an open set); it is never
 * echoed.
 */
type Tone = NonNullable<BadgeProps['variant']>;

export interface StatusLabel {
  label: string;
  tone: Tone;
}

const UNKNOWN_STATUS: StatusLabel = { label: 'Status unavailable', tone: 'neutral' };

function lookup(map: Readonly<Record<string, StatusLabel>>, key: string): StatusLabel {
  return map[key] ?? UNKNOWN_STATUS;
}

const ORDER: Readonly<Record<string, StatusLabel>> = {
  PendingPayment: { label: 'Awaiting payment', tone: 'warning' },
  Confirmed: { label: 'Confirmed', tone: 'success' },
  Packing: { label: 'Being packed', tone: 'success' },
  Packed: { label: 'Packed', tone: 'success' },
  Dispatched: { label: 'On its way', tone: 'success' },
  Delivered: { label: 'Delivered', tone: 'success' },
  Cancelled: { label: 'Cancelled', tone: 'neutral' },
  Returned: { label: 'Returned', tone: 'neutral' },
  Refunded: { label: 'Refunded', tone: 'neutral' },
};
export const orderStatusLabel = (status: string) => lookup(ORDER, status);

const INVOICE: Readonly<Record<string, StatusLabel>> = {
  Issued: { label: 'Open', tone: 'neutral' },
  PartPaid: { label: 'Part paid', tone: 'warning' },
};
export const invoiceStatusLabel = (status: string) => lookup(INVOICE, status);

/**
 * `components/staff-subscriptions/staffCopy.ts` -- HO-P6 S2. The few sentences the staff screens need that
 * `lib/subscriptions/copy.ts` (S0) does not have, because S0's are written in the customer's voice ("Your delivery
 * ..."). They are listed in the S2 slice report so S0 or the integrator can hoist them. Nothing here is computed: every
 * date is a server field passed in and formatted by `lib/subscriptions/dates.ts` (ADR-FE-110, ADR-FE-112).
 */
import { formatCycleDate } from '@/lib/subscriptions/dates';

export const STAFF_LIST_TITLE = 'Subscriptions';
export const STAFF_LIST_INTRO = 'Every customer subscription, with its next delivery and payment state.';
export const STAFF_UNPAID_TITLE = 'Unpaid subscriptions';
export const STAFF_UNPAID_INTRO =
  'Subscriptions suspended after unpaid orders, and those at risk of it. Only a shop manager or an administrator can restart one: open it and choose Restart.';
export const NO_DELIVERY_PAUSED = 'None while paused';
export const NO_DELIVERY_SUSPENDED = 'None while suspended';
export const NO_DELIVERY_CANCELLED = 'None: cancelled';
export const NEVER_RECORDED = 'Never: none recorded';
export const NOT_CANCELLED = 'Not cancelled';
export const SUSPENDED_NO_ORDERS = 'No orders are placed until staff restart it. The customer has been told.';
export const ADDRESS_REMOVED_STAFF = "The delivery address was removed from the customer's address book.";

/** "The delivery on Tue 20 Oct is already being prepared." (shown when the server says `isLocked`). */
export const staffLockedText = (nextDeliveryOn: string): string =>
  `The delivery on ${formatCycleDate(nextDeliveryOn)} is already being prepared.`;

/** "3 unpaid in a row". */
export const unpaidInARow = (streak: number): string => `${streak} unpaid in a row`;

/** The compact "{n} unpaid" shown in the list when the streak is above zero. */
export const unpaidShort = (streak: number): string => `${streak} unpaid`;

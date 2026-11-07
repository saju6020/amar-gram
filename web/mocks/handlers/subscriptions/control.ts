import { SUBSCRIPTION_SETTINGS, addDays } from './schedule';
import {
  commerceClock,
  db,
  findSubscription,
  persist,
  resetSubscriptionsMockData,
  setMaxExportRows,
  suspendOf,
} from './store';

/**
 * `mocks/handlers/subscriptions/control.ts` — HO-P6 S0 (§11.1.4). Test controls for the mock **server**
 * (never app code): what an end-to-end spec cannot cause through the UI, such as "the cut-off passes". Exposed
 * on `window.__subscriptionsMock` only in a development or test build; mocks load only when
 * `NEXT_PUBLIC_USE_MOCKS=true`. Reload the screen (or let its query refetch) after calling one.
 */
export interface SubscriptionsMockControls {
  /** Back to the seeds. */
  reset(): void;
  /** Moves an Active subscription's `nextDeliveryOn` inside the cut-off (it becomes locked). */
  lock(id: string): void;
  /** Moves an Active subscription's `nextDeliveryOn` well outside the cut-off. */
  unlock(id: string): void;
  /** Suspends a live subscription for a reason. */
  suspend(id: string, reason: 'UnpaidCycles' | 'ProductUnavailable'): void;
  /** Sets the subscriber discount, e.g. `"0.00"` or `"10.00"` (a decimal text, as the setting is). */
  setDiscount(text: string): void;
  /** Adds `count` older failed cycles so the history has more than one page. */
  addCycles(id: string, count: number): void;
  /** Lowers the CSV export cap so the 413 can be proved; `null` restores 50,000. */
  setMaxExportRows(rows: number | null): void;
}

export function createControls(): SubscriptionsMockControls {
  return {
    reset: () => resetSubscriptionsMockData(),
    lock: (id) => {
      const s = findSubscription(id);
      if (!s || s.status !== 'Active') return;
      s.nextDeliveryOn = addDays(commerceClock().today, SUBSCRIPTION_SETTINGS.changeCutoffDays);
      persist();
    },
    unlock: (id) => {
      const s = findSubscription(id);
      if (!s || s.status !== 'Active') return;
      s.nextDeliveryOn = addDays(commerceClock().today, SUBSCRIPTION_SETTINGS.changeCutoffDays + 10);
      persist();
    },
    suspend: (id, reason) => {
      const s = findSubscription(id);
      if (s) suspendOf(s, reason);
    },
    setDiscount: (text) => {
      db.discountPercent = text;
      persist();
    },
    addCycles: (id, count) => {
      const s = findSubscription(id);
      if (!s) return;
      const oldest = db.cycles
        .filter((c) => c.subscriptionId === id)
        .map((c) => c.cycleOn)
        .sort()[0] ?? commerceClock().today;
      for (let i = 1; i <= count; i += 1) {
        const cycleOn = addDays(oldest, -7 * s.terms.intervalWeeks * i);
        db.cycles.push({
          id: crypto.randomUUID(),
          subscriptionId: id,
          cycleOn,
          outcome: 'Failed',
          failureReason: 'OutOfStock',
          orderId: null,
          orderNumber: null,
          orderState: null,
          paymentExpiresOn: null,
          discountPercent: db.discountPercent,
          processedOn: `${cycleOn}T00:00:00.000Z`,
        });
      }
      persist();
    },
    setMaxExportRows: (rows) => setMaxExportRows(rows),
  };
}

declare global {
  interface Window {
    __subscriptionsMock?: SubscriptionsMockControls;
  }
}

export function installSubscriptionsMockControls(): void {
  if (typeof window === 'undefined') return;
  window.__subscriptionsMock = createControls();
}

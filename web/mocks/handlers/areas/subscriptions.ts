import type { HttpHandler } from 'msw';
import { installSubscriptionsMockControls } from '../subscriptions/control';
import { customerSubscriptionsHandlers } from '../subscriptions/customer';
import { staffSubscriptionsHandlers } from '../subscriptions/staff';
import { touchpointSubscriptionsHandlers } from '../subscriptions/touchpoints';

/**
 * Subscriptions MSW request handlers (HO-P6). The three arrays live in `mocks/handlers/subscriptions/`, one per
 * slice (customer: S1, staff: S2, touch points: S3), over one store and one port of the server's schedule rules
 * (ADR-FE-193). `mocks/handlers/index.ts` already imports this file.
 */
export const subscriptionsHandlers: HttpHandler[] = [
  ...customerSubscriptionsHandlers,
  ...staffSubscriptionsHandlers,
  ...touchpointSubscriptionsHandlers,
];

// Test controls for the mock server (window.__subscriptionsMock): development / test builds only.
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
  installSubscriptionsMockControls();
}

export { subscriptionFixtureIds, seedDates } from '../subscriptions/fixtures';
export { resetSubscriptionsMockData } from '../subscriptions/store';

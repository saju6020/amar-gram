import { SUBSCRIPTION_VIEW_ROLES } from '@/lib/api/staff-subscriptions';
import type { NavArea } from '../types';

/**
 * Subscriptions navigation entries.
 *
 * Owned entirely by the Subscriptions area — this is the ONE file that area adds to when it builds
 * its screens (web/README.md "Adding a functional area"). No other area, and no shared file,
 * should ever need to change because of this one.
 */
export const subscriptionsNav: NavArea = {
  key: 'subscriptions',
  label: 'Subscriptions',
  audience: 'both',
  items: [
    // HO-P6 S2 (§11.3.2): the staff list. Presentation-only role limit (Subscriptions.View); the server's 403 has the last word.
    {
      label: 'Subscriptions',
      href: '/staff/subscriptions',
      icon: 'repeat',
      audience: 'staff',
      roles: SUBSCRIPTION_VIEW_ROLES,
    },
  ],
};

import type { NavArea } from './types';
import { accountsNav } from './areas/accounts';
import { administrationNav } from './areas/administration';
import { notificationsNav } from './areas/notifications';
import { fileStorageNav } from './areas/file-storage';
import { shopNav } from './areas/shop';
import { inventoryNav } from './areas/inventory';
import { billingNav } from './areas/billing';
import { ordersNav } from './areas/orders';
import { subscriptionsNav } from './areas/subscriptions';
import { portalNav } from './areas/portal';
import { reportingNav } from './areas/reporting';
import { crossCuttingNav } from './areas/cross-cutting';

/**
 * The complete navigation registry — one entry per functional area, imported from that area's
 * own file under nav/areas/. All 12 are pre-registered here so this file never needs another
 * edit: an area adds its screens by populating `items: []` in its OWN nav/areas/<area>.ts file
 * only. See web/README.md "Adding a functional area" before changing anything under nav/.
 */
export const navRegistry: NavArea[] = [
  accountsNav,
  administrationNav,
  notificationsNav,
  fileStorageNav,
  shopNav,
  inventoryNav,
  billingNav,
  ordersNav,
  subscriptionsNav,
  portalNav,
  reportingNav,
  crossCuttingNav,
];

export type { NavArea, NavAreaKey, NavItem } from './types';

import type { HttpHandler } from 'msw';
import { accountsHandlers } from './areas/accounts';
import { administrationHandlers } from './areas/administration';
// HO-ADM-002 §12/§13 — this handover's own handlers live under mocks/handlers/admin/** (not
// mocks/handlers/areas/administration.ts, which §13 does not list and is left as the empty stub);
// aliased to avoid colliding with the import above.
import { administrationHandlers as adminAreaHandlers } from './admin';
import { notificationsHandlers } from './areas/notifications';
// HO-NTF-002 §12/§13 — this handover's handlers live under mocks/handlers/notifications/** (the
// path its §12 names), aliased like HO-ADM-002's; areas/notifications.ts stays the empty stub.
import { notificationsAreaHandlers } from './notifications';
import { fileStorageHandlers } from './areas/file-storage';
import { shopHandlers } from './areas/shop';
import { inventoryHandlers } from './areas/inventory';
// HO-IMP-002 §12/§13 — this handover's handlers live under mocks/handlers/inventory/** (aliased,
// like HO-ADM-002's); areas/inventory.ts stays the empty stub.
import { inventoryAreaHandlers } from './inventory';
import { billingHandlers } from './areas/billing';
// HO-BIL-002 §12/§13 — this handover's handlers live under mocks/handlers/billing/**, aliased like
// HO-ADM-002's and HO-NTF-002's; areas/billing.ts stays the empty stub.
import { billingAreaHandlers } from './billing';
import { ordersHandlers } from './areas/orders';
// HO-ORD-002 §12/§13 — this handover's handlers live under mocks/handlers/ordering/** (aliased like
// HO-ADM-002's); areas/orders.ts stays the empty stub. Registered BEFORE the inventory handlers: it
// answers the batch list for the shop mock's SKUs and falls through to inventory for any other.
import { orderingAreaHandlers } from './ordering';
import { subscriptionsHandlers } from './areas/subscriptions';
import { portalHandlers } from './areas/portal';
// HO-POR-002 §12/§13 — this handover's handlers live under mocks/handlers/portal/** (aliased, like
// HO-ADM-002's); areas/portal.ts stays the empty stub.
import { portalAreaHandlers } from './portal';
import { reportingHandlers } from './areas/reporting';
// HO-RPT-002 §12/§13 — this handover's handlers live under mocks/handlers/reports/**, aliased like
// HO-ADM-002's; areas/reporting.ts stays the empty stub.
import { reportsAreaHandlers } from './reports';
import { crossCuttingHandlers } from './areas/cross-cutting';
// HO-XCT-002 §12.3/§13 — this handover's handlers live under mocks/handlers/operations/** (aliased,
// like HO-ADM-002's); areas/cross-cutting.ts stays the empty stub. Registered FIRST: its erased-
// customer read falls through to the Accounts mock for every other id.
import { operationsAreaHandlers } from './operations';

/**
 * Every MSW handler, combined — one array per area (web/mocks/handlers/areas/<area>.ts),
 * collected here exactly once. Same rule as web/nav/index.ts: an area adds mock handlers by
 * populating its OWN file; this index is pre-wired for all 12 and should not need another edit.
 */
export const handlers: HttpHandler[] = [
  ...operationsAreaHandlers,
  ...accountsHandlers,
  ...administrationHandlers,
  ...adminAreaHandlers,
  ...notificationsHandlers,
  ...notificationsAreaHandlers,
  ...fileStorageHandlers,
  ...shopHandlers,
  ...orderingAreaHandlers,
  ...inventoryHandlers,
  ...inventoryAreaHandlers,
  ...billingHandlers,
  ...billingAreaHandlers,
  ...ordersHandlers,
  ...subscriptionsHandlers,
  ...portalHandlers,
  ...portalAreaHandlers,
  ...reportingHandlers,
  ...reportsAreaHandlers,
  ...crossCuttingHandlers,
];

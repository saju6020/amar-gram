import { http, HttpResponse, type HttpHandler } from 'msw';
import { isGuid } from '@/lib/validation/guid';
import { getStaffRoleIdsForRequest } from '../areas/accounts';
import { customerSummaryOf, dueTomorrowOf } from './store';
import { MOCK_VIEW_ROLES } from './staff';

/**
 * `mocks/handlers/subscriptions/touchpoints.ts` — HO-P6 S3 (§11.4.6). The two read endpoints the back-office touch points
 * use, from `StaffSubscriptionsController` (`src/Api/AmarGram.Api/Controllers/StaffSubscriptionsController.cs`), over the S0
 * store: T3 `GET api/staff/subscriptions/due-tomorrow` (:51-58) and T9 `GET api/staff/customers/{customerId}/subscriptions`
 * (:150-165). Both need `Subscriptions.View` (ActionRoles.Subscriptions.cs:12-14); a request with no modelled staff session
 * passes, like the other mocks. The product flag (`isSubscribable`) is in `mocks/handlers/shop/staff.ts`.
 */

let roleOverride: string[] | null = null;

/** Test seam: answer as these roles regardless of the session cookie. `null` clears it. */
export function setMockTouchpointRoles(roles: string[] | null): void {
  roleOverride = roles;
}

/** The server's `403` from `[RequireAction(Actions.Subscriptions.View)]` (StaffSubscriptionsController.cs:53, :157). */
function cannotView(request: Request): boolean {
  const roles = roleOverride ?? getStaffRoleIdsForRequest(request);
  return roles !== null && !roles.some((role) => MOCK_VIEW_ROLES.includes(role));
}

const forbidden = () =>
  HttpResponse.json(
    { errors: [{ errorCode: 'ActionNotPermitted', errorMessage: 'Not permitted.' }] },
    { status: 403 },
  );

export const touchpointSubscriptionsHandlers: HttpHandler[] = [
  // T3 -- subscription orders due tomorrow (:51-58); `Cache-Control: no-store`
  http.get('*/api/staff/subscriptions/due-tomorrow', ({ request }) => {
    if (cannotView(request)) return forbidden(); // :53
    return HttpResponse.json(dueTomorrowOf(), { headers: { 'Cache-Control': 'no-store' } });
  }),

  // T9 -- one customer's subscriptions (:150-165). The `{customerId:guid}` segment: anything else is no route, a 404.
  http.get('*/api/staff/customers/:customerId/subscriptions', ({ request, params }) => {
    // The route constraint `{customerId:guid}` is matched before any filter runs: a non-GUID id is 404 for every role.
    const customerId = String(params.customerId);
    if (!isGuid(customerId)) return new HttpResponse(null, { status: 404 });
    if (cannotView(request)) return forbidden(); // :157
    // An unknown customer simply has none (200): the query reads the subscriptions table, not the customer.
    return HttpResponse.json(customerSummaryOf(customerId), { headers: { 'Cache-Control': 'no-store' } });
  }),
];

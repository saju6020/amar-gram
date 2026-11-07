import type { ReactElement } from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { renderWithClient } from '../reports/helpers';
import { setMockSubscriptionRoles } from '../../../mocks/handlers/subscriptions/staff';
import { resetSubscriptionsMockData } from '../../../mocks/handlers/subscriptions/store';

/** Shared setup for the HO-P6 S2 component tests: a staff session with the given roles, and a fresh subscriptions store. */
export function sessionFor(roleIds: string[]) {
  return {
    staffAccountId: 's0000000-0000-0000-0000-000000000001',
    fullName: 'Rahim Uddin',
    roleIds,
    issuedOn: '2026-10-14T00:00:00Z',
    lastActivityOn: '2026-10-14T00:00:00Z',
    idleExpiresOn: '2026-10-14T01:00:00Z',
    absoluteExpiresOn: '2026-10-14T09:00:00Z',
    idleTimeoutMinutes: 30,
    serverTime: '2026-10-14T00:00:00Z',
  };
}

/** Signs the screen in as these roles: the session the UI reads, and the roles the mock server checks. */
export function actAs(...roleIds: string[]) {
  server.use(http.get('*/api/staff/session', () => HttpResponse.json(sessionFor(roleIds))));
  setMockSubscriptionRoles(roleIds);
}

export function freshStore() {
  resetSubscriptionsMockData();
  setMockSubscriptionRoles(null);
}

export function renderScreen(ui: ReactElement) {
  return renderWithClient(ui);
}

/** Like `renderScreen`, but a query's own retry (the hooks retry once) waits 0 ms, so an error test needs no real delay. */
export function renderScreenWithInstantRetry(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0 } } });
  return { client, ...render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>) };
}

/** The request URLs the server saw for a path suffix, in order. */
export function recordRequests(pathEnd: string): URL[] {
  const seen: URL[] = [];
  server.events.on('request:start', ({ request }) => {
    const url = new URL(request.url);
    if (url.pathname.endsWith(pathEnd)) seen.push(url);
  });
  return seen;
}

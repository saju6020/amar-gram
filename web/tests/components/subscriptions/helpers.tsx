import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { createControls } from '@/mocks/handlers/subscriptions/control';
import { subscriptionFixtureIds } from '@/mocks/handlers/subscriptions/fixtures';
import { resetSubscriptionsMockData } from '@/mocks/handlers/subscriptions/store';

/** Shared helpers for the HO-P6 S1 component tests. */

export const ids = subscriptionFixtureIds;

export function renderWithClient(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 }, mutations: { retry: false } },
  });
  return { client, ...render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>) };
}

/** The customer session cookie the subscriptions, shop and ordering mocks read. */
export function signIn(): void {
  document.cookie = 'pc_session=test-session; path=/';
}
export function signOut(): void {
  document.cookie = 'pc_session=; path=/; max-age=0';
}

export function resetSubscriptions(): void {
  resetSubscriptionsMockData();
  window.sessionStorage.clear();
}

export const mockControls = createControls();

interface Address {
  id: string;
  label: string;
  line1: string;
  city: string;
  district: string;
  postalCode: string | null;
  isDefault: boolean;
}

/** Sam's address book as the Accounts endpoint would send it (the real accounts mock needs a full sign-in). */
export function serveAddresses(book: Address[] = [defaultAddress()]): { current: Address[] } {
  const state = { current: book };
  server.use(
    http.get('*/api/customers/me/addresses', () =>
      HttpResponse.json({ addresses: state.current.map((a) => ({ ...a, line2: null })), maxAddresses: 10 }),
    ),
    http.post('*/api/customers/me/addresses', async ({ request }) => {
      const body = (await request.json()) as Omit<Address, 'id' | 'isDefault'>;
      const created: Address = { ...body, id: '5a000000-0000-0000-0000-0000000000ff', isDefault: false };
      state.current = [...state.current, created];
      return HttpResponse.json({ addressId: created.id }, { status: 201 });
    }),
  );
  return state;
}

export function defaultAddress(): Address {
  return {
    id: ids.addresses.samHome,
    label: 'Home',
    line1: 'House 7, Road 3, Dhanmondi',
    city: 'Dhaka',
    district: 'Dhaka',
    postalCode: '1209',
    isDefault: true,
  };
}

/** Records the URL of every request the handlers see whose URL contains `part`, until `stop()`. */
export function recordRequests(part: string): { urls: string[]; stop: () => void } {
  const urls: string[] = [];
  const listener = ({ request }: { request: Request }) => {
    if (request.url.includes(part)) urls.push(request.url);
  };
  server.events.on('request:start', listener);
  return { urls, stop: () => server.events.removeListener('request:start', listener) };
}

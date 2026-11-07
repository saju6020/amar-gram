import * as React from 'react';
import { act } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShopAccountLinks } from '@/app/(shop)/_components/ShopAccountLinks';
import { MobileTabBar } from '@/components/shop/MobileTabBar';
import { ProductCard } from '@/components/catalogue/ProductCard';
import { CUSTOMER_SESSION_QUERY_KEY } from '@/lib/hooks/useSession';
import { makeItem } from '../catalogue/catalogue-fixtures';

/**
 * Real-API e2e finding (journey-real-api, 2026-11-07): the storefront threw "Hydration failed" on every shop page because
 * the header's cart badge loads the session first, so a boundary hydrating later already found it in the client cache
 * and rendered the signed-in/guest markup where the server HTML had the loading placeholder. Each component that reads
 * the session must render the server's markup on its first client render, whatever the cache holds.
 */
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => '/shop',
  useSearchParams: () => new URLSearchParams(''),
}));

const SESSIONS = {
  guest: null,
  customer: {
    customerId: 'c0000000-0000-0000-0000-000000000001',
    fullName: 'Test Customer',
    expiresOn: '2030-01-01T00:00:00Z',
    recordStatus: 'Complete',
  },
};

function tree(client: QueryClient, ui: React.ReactElement) {
  return <QueryClientProvider client={client}>{ui}</QueryClientProvider>;
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe.each(Object.entries(SESSIONS))(
  'hydrating with a %s session already cached',
  (_name, session) => {
    it.each([
      ['ShopAccountLinks', <ShopAccountLinks key="a" />],
      ['MobileTabBar', <MobileTabBar key="b" />],
      ['ProductCard (wishlist heart)', <ProductCard key="c" item={makeItem()} />],
    ] as Array<[string, React.ReactElement]>)('%s matches the server HTML', async (_label, ui) => {
      const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
      // Server: an empty cache, so the session is still pending.
      const server = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const html = renderToString(tree(server, ui));
      // Client: the cache already holds the answer (another boundary hydrated and fetched first).
      const client = new QueryClient({
        defaultOptions: { queries: { retry: false, staleTime: 60_000 } },
      });
      client.setQueryData(CUSTOMER_SESSION_QUERY_KEY, session);
      const container = document.createElement('div');
      container.innerHTML = html;
      document.body.appendChild(container);
      const recoverable: string[] = [];
      await act(async () => {
        hydrateRoot(container, tree(client, ui), {
          onRecoverableError: (error) => recoverable.push(String((error as Error).message)),
        });
      });
      const logged = errors.mock.calls.filter((call) => String(call[0]).includes('ydrat'));
      expect([...recoverable, ...logged.map((call) => String(call[0]))]).toEqual([]);
    });
  },
);

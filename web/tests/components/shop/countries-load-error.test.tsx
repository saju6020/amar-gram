import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import CountriesPage from '@/app/(shop)/shop/countries/page';

/**
 * S19 — a failed API read used to be `throw`n from the Server Component, which `next start`
 * answered with a 500. The page now returns a rendered error state with a retry link.
 */
const down = () => HttpResponse.json({ title: 'down' }, { status: 500 });

describe('storefront pages render an error state when the API fails — S19', () => {
  it('/shop/countries', async () => {
    server.use(http.get('*/api/shop/origins', down));
    render(await CountriesPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText(/couldn't load the shop/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Try again' })).toHaveAttribute(
      'href',
      '/shop/countries',
    );
  });

  it('logs the underlying failure on the server and asks not to be indexed', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    server.use(http.get('*/api/shop/origins', down));
    try {
      render(await CountriesPage({ searchParams: Promise.resolve({}) }));
      expect(log).toHaveBeenCalledWith('Storefront read failed:', expect.any(Error));
      expect(document.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
    } finally {
      log.mockRestore();
    }
  });
});

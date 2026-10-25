import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { resetShopMockData } from '@/mocks/handlers/shop';
import { renderWithClient, signOutForTest } from '../product/test-utils';
import { NoResults } from '@/components/catalogue/NoResults';
import { Pagination } from '@/components/catalogue/Pagination';
import { makeItem } from './catalogue-fixtures';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push }),
  usePathname: () => '/shop/products',
  useSearchParams: () => new URLSearchParams(),
}));

beforeEach(() => {
  resetShopMockData();
  push.mockClear();
  signOutForTest();
});

describe('NoResults — HO-SHP-002 §11.2, US-SHP-06 AC3', () => {
  it('U-A4: Did you mean links rewrite q; the popular grid renders', () => {
    renderWithClient(
      <NoResults
        q="royl canan"
        suggestions={{
          didYouMean: ['rolled oats'],
          popular: [makeItem({ productId: 'p-2', name: 'Popular Pick' })],
        }}
        hrefForQuery={(q) => `/shop/products?q=${encodeURIComponent(q)}&brand=Sunfield`}
        clearHref="/shop/products?q=royl%20canan"
      />,
    );
    expect(screen.getByText(/No products match/)).toHaveTextContent('“royl canan”');
    expect(screen.getByRole('link', { name: 'rolled oats' })).toHaveAttribute(
      'href',
      '/shop/products?q=rolled%20oats&brand=Sunfield',
    );
    expect(screen.getByRole('heading', { name: 'Popular right now' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Popular Pick' })).toBeInTheDocument();
  });

  it('filters only (no q): says so and offers Clear filters', () => {
    render(
      <NoResults q="" suggestions={null} hrefForQuery={() => ''} clearHref="/shop/products" />,
    );
    expect(screen.getByText('Nothing matches these filters')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Clear filters' })).toHaveAttribute(
      'href',
      '/shop/products',
    );
  });
});

describe('Pagination — real links', () => {
  it('marks the current page and links the rest', () => {
    render(
      <Pagination
        pageNumber={2}
        pageSize={24}
        totalCount={100}
        hrefFor={(p) => `/shop/products?pageNumber=${p}`}
      />,
    );
    expect(screen.getByRole('link', { name: 'Page 2' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Page 3' })).toHaveAttribute(
      'href',
      '/shop/products?pageNumber=3',
    );
    expect(screen.getByRole('link', { name: 'Previous' })).toBeInTheDocument();
  });

  it('renders nothing for a single page', () => {
    const { container } = render(
      <Pagination pageNumber={1} pageSize={24} totalCount={5} hrefFor={() => '/x'} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

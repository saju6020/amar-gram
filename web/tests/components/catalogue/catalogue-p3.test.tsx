import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CatalogueControls } from '@/app/(shop)/_components/CatalogueControls';
import { NoResults } from '@/components/catalogue/NoResults';
import { Pagination } from '@/components/catalogue/Pagination';
import { ResultSummary } from '@/components/catalogue/ResultSummary';
import { CATEGORIES, FACETS, makeItem } from './catalogue-fixtures';

/**
 * HO-P3 S2 §15 U15 … U18: the catalogue rebuilt to Catalogue.dc.html - the heading band and its
 * count, the "Certified organic only" switch, the segmented sort and the empty state.
 */

const replace = vi.fn();
let search = '';
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  usePathname: () => '/shop/products',
  useSearchParams: () => new URLSearchParams(search),
}));

function controls(fixed?: Parameters<typeof CatalogueControls>[0]['fixed']) {
  return (
    <CatalogueControls
      facets={FACETS}
      categories={CATEGORIES}
      currencyCode="BDT"
      fixed={fixed}
      summary={null}
    >
      <div>results</div>
    </CatalogueControls>
  );
}

function setup(query = '', fixed?: Parameters<typeof CatalogueControls>[0]['fixed']) {
  search = query;
  return render(controls(fixed));
}

const lastUrl = () => replace.mock.calls.at(-1)?.[0] as string;
const filterCard = () => within(screen.getByRole('complementary', { name: 'Filters' }));

beforeEach(() => {
  replace.mockClear();
});

describe('U15: the heading band', () => {
  // The server-rendered band (h1 + polite count) is asserted in catalogue-view-503.test.tsx, which
  // runs in the node environment that renders the async Server Component.
  it('without a band title (an origin page) the count sits in the toolbar', () => {
    search = '';
    render(
      <CatalogueControls
        facets={FACETS}
        categories={CATEGORIES}
        currencyCode="BDT"
        summary={<ResultSummary totalCount={7} q="" />}
      >
        <div>results</div>
      </CatalogueControls>,
    );
    expect(screen.getByRole('status')).toHaveTextContent('7 products');
  });

  it('has no District filter (G1)', () => {
    setup();
    expect(screen.queryByText(/district/i)).not.toBeInTheDocument();
  });
});

describe('U16: the "Certified organic only" switch', () => {
  it('turning it on adds certification=CertifiedOrganic to the URL', async () => {
    const user = userEvent.setup();
    setup('q=oats');
    const organic = filterCard().getByRole('checkbox', { name: 'Certified organic only' });
    expect(organic).not.toBeChecked();
    await user.click(organic);
    expect(lastUrl()).toBe('/shop/products?q=oats&certification=CertifiedOrganic');
  });

  it('turning it off removes it, and its chip is named "Remove filter Certified organic"', async () => {
    const user = userEvent.setup();
    setup('q=oats&certification=CertifiedOrganic');
    expect(filterCard().getByRole('checkbox', { name: 'Certified organic only' })).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Remove filter Certified organic' }));
    expect(lastUrl()).toBe('/shop/products?q=oats');
  });

  it('unticking the switch removes it too', async () => {
    const user = userEvent.setup();
    setup('q=oats&certification=CertifiedOrganic');
    await user.click(filterCard().getByRole('checkbox', { name: 'Certified organic only' }));
    expect(lastUrl()).toBe('/shop/products?q=oats');
  });

  it('Clear filters keeps the page-fixed country (an origin page) and the search', async () => {
    const user = userEvent.setup();
    setup('q=oats&certification=CertifiedOrganic&brand=Sunfield', { origin: ['TH'] });
    await user.click(filterCard().getByRole('button', { name: 'Clear filters' }));
    // The country is the page's own, so it is never written to the URL.
    expect(lastUrl()).toBe('/shop/products?q=oats');
  });
});

describe('U17: the sort control', () => {
  it('from md it is a radio group of the API sorts; changing it keeps the filters and the search', async () => {
    const user = userEvent.setup();
    setup('q=oats&brand=Sunfield');
    const group = screen.getByRole('radiogroup', { name: 'Sort' });
    const labels = within(group)
      .getAllByRole('radio')
      .map((radio) => radio.closest('label')?.textContent);
    // With a search, Relevance is offered and is the one in effect.
    expect(labels).toEqual([
      'Relevance',
      'Newest',
      'Price: low to high',
      'Price: high to low',
      'Popularity',
      'Rating',
    ]);
    expect(within(group).getByRole('radio', { name: 'Relevance' })).toBeChecked();
    await user.click(within(group).getByRole('radio', { name: 'Price: low to high' }));
    expect(lastUrl()).toBe('/shop/products?q=oats&brand=Sunfield&sort=price_asc');
  });

  it('without a search there is no Relevance', () => {
    setup();
    const group = screen.getByRole('radiogroup', { name: 'Sort' });
    expect(within(group).queryByRole('radio', { name: 'Relevance' })).not.toBeInTheDocument();
    expect(within(group).getByRole('radio', { name: 'Newest' })).toBeChecked();
  });
});

describe('U18: no results', () => {
  it('filters only: "Nothing matches those filters" with Clear filters', () => {
    render(
      <NoResults q="" suggestions={null} hrefForQuery={() => ''} clearHref="/shop/products" />,
    );
    expect(screen.getByText('Nothing matches those filters')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Clear filters' })).toHaveAttribute(
      'href',
      '/shop/products',
    );
  });

  it('a search still offers "Did you mean" and the popular products', () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <NoResults
          q="oatz"
          suggestions={{
            didYouMean: ['oats'],
            popular: [makeItem({ productId: 'p-9', name: 'Popular Pick' })],
          }}
          hrefForQuery={(q) => `/shop/products?q=${q}`}
          clearHref="/shop/products?q=oatz"
        />
      </QueryClientProvider>,
    );
    expect(screen.getByRole('link', { name: 'oats' })).toHaveAttribute(
      'href',
      '/shop/products?q=oats',
    );
    expect(screen.getByRole('heading', { name: 'Popular right now' })).toBeInTheDocument();
  });
});

describe('pagination', () => {
  it('numbers are 44px circles with aria-current; Next is a pill link', () => {
    render(
      <Pagination
        pageNumber={1}
        pageSize={10}
        totalCount={25}
        hrefFor={(p) => `/x?pageNumber=${p}`}
      />,
    );
    const current = screen.getByRole('link', { name: 'Page 1' });
    expect(current).toHaveAttribute('aria-current', 'page');
    expect(current).toHaveClass('size-11', 'rounded-full');
    expect(screen.getByRole('link', { name: 'Next' })).toHaveAttribute('href', '/x?pageNumber=2');
  });
});

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { resetShopMockData } from '@/mocks/handlers/shop';
import ShopHomePage from '@/app/(shop)/shop/page';
import { CategoryTiles } from '@/components/shop/home/CategoryTiles';
import { GrowersBand } from '@/components/shop/home/GrowersBand';
import { SeasonalCard } from '@/components/shop/home/SeasonalCard';
import { CATEGORY_LABELS } from '@/lib/shop/labels';
import type { CategoryNode, Origin } from '@/lib/api/shop-catalogue';
import { CATEGORIES, makeItem } from '../catalogue/catalogue-fixtures';
import { renderWithClient, signOutForTest } from '../product/test-utils';

// The page reads through `getPublic`, which is server-only (it throws under jsdom), so the four
// server reads are stubbed here; the components themselves are exercised for real.
const reads = vi.hoisted(() => ({
  banners: vi.fn(),
  categories: vi.fn(),
  origins: vi.fn(),
  catalogue: vi.fn(),
}));
vi.mock('@/lib/api/shop-catalogue', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/shop-catalogue')>()),
  getBannersServer: reads.banners,
  getCategoriesServer: reads.categories,
  getOriginsServer: reads.origins,
  getCatalogueServer: reads.catalogue,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => '/shop',
  useSearchParams: () => new URLSearchParams(),
}));

beforeEach(() => {
  resetShopMockData();
  signOutForTest();
});

const origin = (code: string, name: string, productCount = 3): Origin => ({
  code,
  name,
  sourcingNotes: null,
  productCount,
  isFeatured: true,
});

describe('CategoryTiles — U11', () => {
  it('shows one link per category with the HO-P2 label and the count', () => {
    const categories: CategoryNode[] = Object.keys(CATEGORY_LABELS).map((value, i) => ({
      value: value as CategoryNode['value'],
      productCount: i === 0 ? 1 : i + 1,
      subcategories: [],
    }));
    render(<CategoryTiles categories={categories} />);
    const nav = screen.getByRole('navigation', { name: 'Categories' });
    const links = within(nav).getAllByRole('link');
    expect(links).toHaveLength(categories.length);
    expect(links.length).toBe(11);
    categories.forEach((category, i) => {
      expect(links[i]).toHaveAttribute(
        'href',
        `/shop/products?category=${encodeURIComponent(category.value)}`,
      );
      expect(links[i]).toHaveTextContent(CATEGORY_LABELS[category.value]!);
    });
    expect(links[0]).toHaveTextContent('1 product');
    expect(links[1]).toHaveTextContent('2 products');
  });

  it('carries the content language onto each link', () => {
    render(
      <CategoryTiles
        lang="bn"
        categories={[{ value: 'Spices', productCount: 2, subcategories: [] }]}
      />,
    );
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      '/shop/products?category=Spices&lang=bn',
    );
  });

  it('renders nothing for an empty list', () => {
    const { container } = render(<CategoryTiles categories={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('GrowersBand — U12', () => {
  it('shows the heading, the paragraph and at most two origin tiles', () => {
    render(
      <GrowersBand
        origins={[origin('BD', 'Bangladesh', 1), origin('TH', 'Thailand'), origin('JP', 'Japan')]}
      />,
    );
    const band = document.getElementById('growers')!;
    expect(band).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
      'Our products name their origin.',
    );
    expect(screen.getByText(/We name the country of origin on our foods/)).toBeVisible();
    expect(screen.getByRole('link', { name: 'Read our sourcing story' })).toHaveAttribute(
      'href',
      '/shop/countries',
    );
    const tiles = within(band)
      .getAllByRole('link')
      .filter((link) => link.getAttribute('href')?.startsWith('/shop/countries/'));
    expect(tiles).toHaveLength(2);
    expect(tiles[0]).toHaveAttribute('href', '/shop/countries/BD');
    expect(tiles[0]).toHaveTextContent('Bangladesh');
    expect(tiles[0]).toHaveTextContent('1 product');
    expect(tiles[1]).toHaveTextContent('3 products');
  });

  it('with no featured origin it is text only and invents no grower', () => {
    render(<GrowersBand origins={[]} />);
    const band = document.getElementById('growers')!;
    expect(within(band).getAllByRole('link')).toHaveLength(1);
    expect(band.querySelector('img, svg')).toBeNull();
  });
});

describe('SeasonalCard (phone)', () => {
  it('shows the Home banner title and body, linking only to a safe link', () => {
    const banner = {
      slug: 's',
      title: 'Mango season is here',
      body: 'Himsagar from Rajshahi',
      placement: 'Home',
      linkUrl: '/shop/products',
    };
    const { rerender } = render(<SeasonalCard banner={banner} />);
    expect(screen.getByRole('link', { name: /Mango season is here/ })).toHaveAttribute(
      'href',
      '/shop/products',
    );
    rerender(<SeasonalCard banner={{ ...banner, linkUrl: 'javascript:alert(1)' }} />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('Mango season is here')).toBeInTheDocument();
    rerender(<SeasonalCard banner={null} />);
    expect(screen.queryByText('Mango season is here')).not.toBeInTheDocument();
  });
});

describe('Home page composition — U14', () => {
  it('orders hero, pantry, fresh, growers and promises; no staples box; categories nav', async () => {
    reads.banners.mockResolvedValue([]);
    reads.categories.mockResolvedValue(CATEGORIES);
    reads.origins.mockResolvedValue([origin('BD', 'Bangladesh')]);
    reads.catalogue.mockResolvedValue({ items: [makeItem()] });
    renderWithClient(await ShopHomePage({ searchParams: Promise.resolve({}) }));
    expect(screen.getAllByRole('heading', { level: 1 }).length).toBeGreaterThanOrEqual(1);
    const nav = screen.getByRole('navigation', { name: 'Categories' });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'See all products' })).toHaveAttribute(
      'href',
      '/shop/products',
    );
    const order = [
      screen.getByRole('heading', { level: 2, name: 'Shop the pantry' }),
      screen.getByRole('region', { name: 'Fresh from the haat' }),
      screen.getByRole('region', { name: 'Why shop with us' }),
    ];
    for (let i = 1; i < order.length; i++) {
      expect(
        order[i - 1]!.compareDocumentPosition(order[i]!) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
    expect(document.body.textContent).not.toMatch(/staples box|build my box/i);
  });

  it('U11: a failed categories read drops only the pantry section', async () => {
    reads.banners.mockResolvedValue([]);
    reads.categories.mockRejectedValue(new Error('down'));
    reads.origins.mockResolvedValue([]);
    reads.catalogue.mockResolvedValue({ items: [makeItem()] });
    renderWithClient(await ShopHomePage({ searchParams: Promise.resolve({}) }));
    expect(screen.queryByRole('navigation', { name: 'Categories' })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Fresh from the haat' })).toBeInTheDocument();
  });
});

// HO-P3 U9 / A15 for this slice's own files: token utilities only, no colour literals.
describe('no colour literals in the shop home files (HO-P3 U9)', () => {
  const root = path.resolve(import.meta.dirname, '../../..');
  const files = [
    'app/(shop)/shop/page.tsx',
    'app/(shop)/shop/countries/page.tsx',
    'app/(shop)/shop/countries/[countryCode]/page.tsx',
    'components/shop/ShopHero.tsx',
    'components/shop/OriginGrid.tsx',
    'components/hearth/DeliveryPromise.tsx',
    ...readdirSync(path.join(root, 'components/shop/home')).map((f) => `components/shop/home/${f}`),
  ];
  const strip = (source: string) =>
    source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\w"'])\/\/.*$/gm, '$1');
  it.each(files)('%s', (file) => {
    const code = strip(readFileSync(path.join(root, file), 'utf8'));
    const hit = code
      .split('\n')
      .find((line) => /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|\[#/.test(line));
    expect(hit, `colour literal in ${file}: ${hit}`).toBeUndefined();
  });
});

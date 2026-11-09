import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FoodDetailsForm } from '@/components/staff-shop/FoodDetailsForm';
import { VariantsTable } from '@/components/staff-shop/VariantsTable';
import type { StaffProductDetail } from '@/lib/api/staff-shop';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/staff/shop/products/p1',
  useSearchParams: () => new URLSearchParams(),
}));

const product = (over: Partial<StaffProductDetail> = {}) =>
  ({
    productId: 'p1',
    version: 1,
    kind: 'Standard',
    name: 'Rice',
    brand: 'B',
    description: '',
    category: 'RiceAndGrains',
    subcategory: null,
    tags: [],
    slug: 'rice',
    status: 'Draft',
    firstPublishedOn: null,
    taxClassId: 't1',
    countryOfOriginCode: null,
    isExpiryTracked: true,
    listedOnStorefront: true,
    food: null,
    images: [],
    certifications: [],
    publishChecklist: [],
    skus: [
      {
        skuId: 's1',
        code: 'RICE-1KG',
        barcode: '8900000000999',
        sizeOrWeight: '1 kg',
        flavour: null,
        colour: null,
        packQuantity: null,
        shippingWeightGrams: 1000,
        label: '1 kg',
        status: 'Active',
        currentPrice: { amount: '120.00', currencyCode: 'BDT' },
        scheduledPrice: { amount: '130.00', currencyCode: 'BDT' },
        stock: null,
      },
    ],
    ...over,
  }) as StaffProductDetail;

describe('Food & labelling and Pack sizes — HO-P4 §11.4.6/§11.4.7', () => {
  it('shows the certified-organic block only when CertifiedOrganic is among the certifications', () => {
    const { rerender } = render(
      <FoodDetailsForm product={product()} onSave={vi.fn()} onReload={() => {}} />,
    );
    expect(screen.queryByText('Certified organic')).not.toBeInTheDocument();
    rerender(
      <FoodDetailsForm
        product={product({ certifications: ['CertifiedOrganic'] })}
        onSave={vi.fn()}
        onReload={() => {}}
      />,
    );
    expect(screen.getByText('Certified organic')).toBeInTheDocument();
    // HO-P5 BG-14 (supersedes "no certificate upload or expiry control"): the expiry date field and the certificate
    // file uploader are there, labelled, and nothing says "Expired" until the server says so.
    expect(screen.getByLabelText('Certificate valid until')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Certificate file' })).toBeInTheDocument();
    expect(screen.queryByText('Expired')).not.toBeInTheDocument();
  });

  it('lists pack, SKU code, price (with the scheduled one), the Was price column, barcode and weight', () => {
    render(
      <VariantsTable
        product={product()}
        onAddSku={vi.fn()}
        onUpdateSku={vi.fn()}
        onSetStatus={vi.fn()}
        priceSkuId={null}
        onSelectPrices={() => {}}
        onSchedulePrice={vi.fn()}
      />,
    );
    for (const header of ['Pack', 'SKU code', 'Price', 'Was', 'Barcode', 'Shipping weight']) {
      expect(screen.getByRole('columnheader', { name: header })).toBeInTheDocument();
    }
    // HO-P5 BG-13 (supersedes "no Was column"): the product() fixture has no compare-at price, so the cell says "—".
    expect(screen.queryByRole('columnheader', { name: /compare/i })).not.toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: 'RICE-1KG' })).toBeInTheDocument();
    expect(screen.getByText(/Scheduled/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add pack size' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Reorder policies/ })).toHaveAttribute(
      'href',
      '/staff/inventory/reorder-policies',
    );
  });
});

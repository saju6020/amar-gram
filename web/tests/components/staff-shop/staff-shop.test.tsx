import { Suspense } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProductEditorHeader } from '@/components/staff-shop/ProductEditorHeader';
import { FoodDetailsForm } from '@/components/staff-shop/FoodDetailsForm';
import { ProductDetailsForm } from '@/components/staff-shop/ProductDetailsForm';
import { VariantsTable, stockText } from '@/components/staff-shop/VariantsTable';
import { ImagesEditor } from '@/components/staff-shop/ImagesEditor';
import { TranslationsEditor } from '@/components/staff-shop/TranslationsEditor';
import { ReviewModerationQueue } from '@/components/staff-shop/ReviewModerationQueue';
import { BundleEditor, rowNamedBy } from '@/components/staff-shop/BundleEditor';
import ProductFoodPage from '@/app/(staff)/staff/shop/products/[productId]/food/page';
import StaffProductsPage from '@/app/(staff)/staff/shop/products/page';
import { ApiConflictError, ApiValidationError } from '@/lib/api/client';
import { resetShopMockData } from '@/mocks/handlers/shop';
import { db } from '@/mocks/handlers/shop/store';
import type { ModerationItem, StaffProductDetail, StaffSku } from '@/lib/api/staff-shop';
import { renderWithClient } from '../product/test-utils';

const push = vi.fn();
const replace = vi.fn();
let search = '';
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace }),
  usePathname: () => '/staff/shop/products',
  useSearchParams: () => new URLSearchParams(search),
}));

const SKU = (over: Partial<StaffSku> = {}): StaffSku => ({
  skuId: 'sku-1',
  code: 'OAT-2KG',
  barcode: '8900000000101',
  sizeOrWeight: '2 kg',
  flavour: null,
  colour: null,
  packQuantity: null,
  shippingWeightGrams: null,
  label: '2 kg',
  status: 'Active',
  currentPrice: { amount: '2450.00', currencyCode: 'BDT' },
  scheduledPrice: null,
  stock: null,
  ...over,
});

const PRODUCT = (over: Partial<StaffProductDetail> = {}): StaffProductDetail => ({
  productId: 'p1',
  version: 3,
  kind: 'Standard',
  name: 'Organic Rolled Oats',
  brand: 'Amar Gram Farms',
  description: 'Food **for** breakfast',
  category: 'RiceAndGrains',
  subcategory: 'FlattenedAndPuffedRice',
  tags: ['oats'],
  slug: 'organic-rolled-oats',
  status: 'Draft',
  firstPublishedOn: null,
  taxClassId: 't1',
  countryOfOriginCode: null,
  isExpiryTracked: true,
  listedOnStorefront: true,
  food: null,
  images: [],
  certifications: [],
  skus: [SKU()],
  publishChecklist: [
    {
      item: 'CountryOfOrigin',
      isBlocking: true,
      isMet: false,
      message: 'Add the country of origin before publishing this food product.',
    },
    {
      item: 'PrimaryImage',
      isBlocking: false,
      isMet: false,
      message: 'Products without a photo convert poorly.',
    },
    { item: 'ActiveSku', isBlocking: true, isMet: true, message: 'At least one active SKU.' },
  ],
  ...over,
});

beforeEach(() => {
  resetShopMockData();
  push.mockClear();
  replace.mockClear();
  search = '';
});

describe('ProductEditorHeader — HO-SHP-002 §11.6, ADR-FE-034', () => {
  it('U-D1: Publish is enabled with an unmet blocking item; the refusal is shown and focus goes to the checklist', async () => {
    const user = userEvent.setup();
    const onTransition = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(
      <ProductEditorHeader product={PRODUCT()} onTransition={onTransition} onReload={() => {}} />,
    );
    const publish = screen.getByRole('button', { name: 'Publish' });
    expect(publish).toBeEnabled();
    // The checklist states blocking vs warning in text.
    const checklist = screen.getByRole('list', { name: 'Publish checklist' });
    expect(within(checklist).getByText(/Blocking:/)).toBeInTheDocument();
    expect(within(checklist).getByText(/Warning:/)).toBeInTheDocument();
    expect(within(checklist).getByText(/Done:/)).toBeInTheDocument();

    await user.click(publish);
    const dialog = await screen.findByRole('dialog', { name: 'Publish this product?' });
    expect(dialog).toHaveTextContent('Publish Organic Rolled Oats? It will appear in the shop.');
    await user.click(within(dialog).getByRole('button', { name: 'Publish' }));
    expect(onTransition).toHaveBeenCalledWith('publish');

    rerender(
      <ProductEditorHeader
        product={PRODUCT()}
        onTransition={onTransition}
        error="This product can't be published yet. Add the country of origin before publishing this food product."
        onReload={() => {}}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(/can.t be published yet/);
    await waitFor(() => expect(checklist).toHaveFocus());
    expect(document.body.textContent).not.toContain('ProductNotPublishable');
  });

  it('offers the actions for the current status, each confirmed with what it affects', async () => {
    const user = userEvent.setup();
    render(
      <ProductEditorHeader
        product={PRODUCT({ status: 'Active' })}
        onTransition={vi.fn()}
        onReload={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: 'Unpublish' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Archive' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Publish' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Archive' }));
    expect(await screen.findByRole('dialog')).toHaveTextContent('Archive Organic Rolled Oats?');
  });

  it('a 409 shows the reload message with a Reload button', async () => {
    const user = userEvent.setup();
    const onReload = vi.fn();
    render(
      <ProductEditorHeader
        product={PRODUCT()}
        onTransition={vi.fn()}
        error="This product was changed by someone else. Reload to see the latest."
        isConflict
        onReload={onReload}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Reload' }));
    expect(onReload).toHaveBeenCalled();
  });
});

describe('Food section — US-SHP-03', () => {
  it('U-D2: Food shows the food form with the generic labelling fields and optional certificate', () => {
    render(<FoodDetailsForm product={PRODUCT()} onSave={vi.fn()} onReload={() => {}} />);
    for (const label of [
      'Ingredient list',
      'Storage instructions',
      'Shelf life',
      'Net weight',
      'Allergens',
      'Organic certifier',
      'Certificate number',
    ]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
    expect(
      screen.getByText('Optional. Needed only when the product is marked Certified organic.'),
    ).toBeInTheDocument();
  });

  it('U-D2: a household product has no food section', async () => {
    const detergent = db.products.find((p) => p.category === 'HouseholdAndCare')!;
    await act(async () => {
      renderWithClient(
        <Suspense fallback={null}>
          <ProductFoodPage params={Promise.resolve({ productId: detergent.productId })} />
        </Suspense>,
      );
    });
    expect(
      await screen.findByText("Food details don't apply to this product", {}, { timeout: 4000 }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Shelf life')).not.toBeInTheDocument();
  });

  it('asks for both certificate fields once the product is Certified organic', () => {
    render(
      <FoodDetailsForm
        product={PRODUCT({ certifications: ['CertifiedOrganic'] })}
        onSave={vi.fn()}
        onReload={() => {}}
      />,
    );
    expect(
      screen.getByText(/both fields are needed before it can be published/),
    ).toBeInTheDocument();
  });
});

const STORED_FOOD = {
  ingredientList: 'Whole grain oats',
  storageInstructions: 'Keep cool and dry.',
  shelfLife: '12 months',
  netWeight: '500 g',
  allergens: 'May contain gluten',
  organicCertifier: 'Bangladesh Organic Council',
  organicCertificateNumber: 'BOC-2026-0142',
};

describe('Forms start from the loaded values — HO-SHP-001-FU1 (backlog S1)', () => {
  it('FoodDetailsForm shows every stored food field and no "starts empty" warning', () => {
    render(
      <FoodDetailsForm
        product={PRODUCT({ food: STORED_FOOD })}
        onSave={vi.fn()}
        onReload={() => {}}
      />,
    );
    expect(screen.getByLabelText('Ingredient list')).toHaveValue('Whole grain oats');
    expect(screen.getByLabelText('Shelf life')).toHaveValue('12 months');
    expect(screen.getByLabelText('Net weight')).toHaveValue('500 g');
    expect(screen.getByLabelText('Allergens')).toHaveValue('May contain gluten');
    expect(screen.getByLabelText('Organic certifier')).toHaveValue('Bangladesh Organic Council');
    expect(screen.getByLabelText('Certificate number')).toHaveValue('BOC-2026-0142');
    expect(screen.getByLabelText('Storage instructions')).toHaveValue('Keep cool and dry.');
    expect(screen.queryByText(/Saving replaces/)).not.toBeInTheDocument();
  });

  it('ProductDetailsForm ticks the stored certifications', () => {
    render(
      <ProductDetailsForm
        product={PRODUCT({ certifications: ['Halal', 'PesticideFree'] })}
        categories={[]}
        taxClasses={[{ id: 't1', code: 'STD', name: 'Standard', isActive: true }]}
        countries={[]}
        onSave={vi.fn()}
        onReload={() => {}}
      />,
    );
    const group = screen.getByRole('group', { name: 'Certifications' });
    expect(within(group).getByRole('checkbox', { name: 'Halal' })).toBeChecked();
    expect(within(group).getByRole('checkbox', { name: 'Pesticide-free' })).toBeChecked();
    expect(within(group).getByRole('checkbox', { name: 'Traditional' })).not.toBeChecked();
  });

  it('S1 regression: saving Details without touching certifications sends the loaded certifications back', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <ProductDetailsForm
        product={PRODUCT({ certifications: ['Halal', 'PesticideFree'] })}
        categories={[]}
        taxClasses={[{ id: 't1', code: 'STD', name: 'Standard', isActive: true }]}
        countries={[]}
        onSave={onSave}
        onReload={() => {}}
      />,
    );
    await user.type(screen.getByLabelText('Name'), ' 2');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect([...onSave.mock.calls[0]![0].certifications].sort()).toEqual(['Halal', 'PesticideFree']);
  });

  it('ImagesEditor lists the stored images in order, scope and primary, and saving unchanged sends them back', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    const A = '11111111-1111-1111-1111-111111111111';
    const B = '22222222-2222-2222-2222-222222222222';
    render(
      <ImagesEditor
        product={PRODUCT({
          images: [
            {
              fileId: A,
              url: null,
              altText: 'Front of pack',
              sortOrder: 0,
              isPrimary: false,
              skuId: null,
            },
            {
              fileId: B,
              url: null,
              altText: 'Side of pack',
              sortOrder: 1,
              isPrimary: true,
              skuId: 'sku-1',
            },
          ],
        })}
        onSave={onSave}
        onReload={() => {}}
      />,
    );
    expect(
      screen.getAllByLabelText('Stored file id').map((i) => (i as HTMLInputElement).value),
    ).toEqual([A, B]);
    expect(
      screen.getAllByLabelText('Alt text (required)').map((i) => (i as HTMLInputElement).value),
    ).toEqual(['Front of pack', 'Side of pack']);
    expect(screen.getAllByRole('radio', { name: 'Primary image' })[1]).toBeChecked();
    expect(screen.getByText(/scanned for viruses/)).toBeInTheDocument();
    await user.type(screen.getAllByLabelText('Alt text (required)')[0]!, '!');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls[0]![0]).toEqual([
      { fileId: A, skuId: null, altText: 'Front of pack!', sortOrder: 0, isPrimary: false },
      { fileId: B, skuId: 'sku-1', altText: 'Side of pack', sortOrder: 1, isPrimary: true },
    ]);
  });

  it('VariantsTable shows the SKU label when no attribute is set (the product name)', () => {
    render(
      <VariantsTable
        product={PRODUCT({ skus: [SKU({ sizeOrWeight: null, label: 'Organic Rolled Oats' })] })}
        onAddSku={vi.fn()}
        onUpdateSku={vi.fn()}
        onSetStatus={vi.fn()}
        priceSkuId={null}
        onSelectPrices={() => {}}
        onSchedulePrice={vi.fn()}
      />,
    );
    expect(screen.getByText('Organic Rolled Oats')).toBeInTheDocument();
  });
});

describe('VariantsTable — US-SHP-02, ADR-FE-032', () => {
  it('U-D3: stock null reads "No stock recorded"; a real zero reads "0 sellable"', () => {
    expect(stockText(null)).toBe('No stock recorded');
    expect(stockText(undefined)).toBe('No stock recorded');
    expect(
      stockText({
        sellableQuantity: 0,
        nextAllocatableExpiryOn: null,
        asOf: '2026-10-04T04:42:00Z',
      }),
    ).toMatch(/^0 sellable/);
    expect(
      stockText({
        sellableQuantity: 12,
        nextAllocatableExpiryOn: '2026-11-12',
        asOf: '2026-10-04T04:42:00Z',
      }),
    ).toMatch(/^12 sellable · best before 12 Nov 2026 · as of \d\d:\d\d$/);
    const product = PRODUCT({
      skus: [
        SKU({ skuId: 'a', code: 'NEVER', stock: null }),
        SKU({
          skuId: 'b',
          code: 'EMPTY',
          stock: {
            sellableQuantity: 0,
            nextAllocatableExpiryOn: null,
            asOf: '2026-10-04T04:42:00Z',
          },
        }),
      ],
    });
    render(
      <VariantsTable
        product={product}
        onAddSku={vi.fn()}
        onUpdateSku={vi.fn()}
        onSetStatus={vi.fn()}
        priceSkuId={null}
        onSelectPrices={() => {}}
        onSchedulePrice={vi.fn()}
      />,
    );
    expect(screen.getByText('No stock recorded')).toBeInTheDocument();
    expect(screen.getByText(/^0 sellable/)).toBeInTheDocument();
  });

  it('U-D4: scheduling — Now sends the current instant; a refused past date is blocked inline', async () => {
    const user = userEvent.setup();
    const onSchedulePrice = vi
      .fn()
      .mockRejectedValueOnce(
        new ApiValidationError({
          isValid: false,
          errors: [
            {
              propertyName: 'EffectiveFrom',
              errorCode: 'PriceCannotBeBackdated',
              errorMessage: '',
              resourceName: 'SkuPrice',
            },
          ],
        }),
      )
      .mockResolvedValue(undefined);
    const sku = SKU();
    render(
      <VariantsTable
        product={PRODUCT()}
        onAddSku={vi.fn()}
        onUpdateSku={vi.fn()}
        onSetStatus={vi.fn()}
        priceSkuId="sku-1"
        onSelectPrices={() => {}}
        priceHistory={{
          current: {
            skuPriceId: 'x',
            amount: { amount: '2450.00', currencyCode: 'BDT' },
            effectiveFrom: '2026-06-01T00:00:00Z',
            setBy: 's',
          },
          scheduled: [],
          past: [],
        }}
        onSchedulePrice={onSchedulePrice}
      />,
    );
    expect(screen.getByRole('region', { name: 'Current' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Scheduled' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Past' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Schedule a new price' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Amount/), '2500');
    // The server refuses a backdated price: the plain-language text appears on the dialog.
    const before = Date.now();
    await user.click(within(dialog).getByRole('button', { name: /schedule/i }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      "A new price can't start in the past.",
    );
    const sent = new Date(onSchedulePrice.mock.calls[0]![2] as string).getTime();
    expect(Math.abs(sent - before)).toBeLessThan(5000); // "Now" = the current instant
    expect(onSchedulePrice.mock.calls[0]![0]).toMatchObject({ skuId: sku.skuId });
    // The date input cannot select the past.
    await user.click(within(dialog).getByRole('radio', { name: /future/i }));
    expect(within(dialog).getByLabelText('Effective date and time')).toHaveAttribute('min');
  });

  it('S16: the amount label and the sent currency follow the API, and the copy is not about bookings', async () => {
    const user = userEvent.setup();
    const onSchedulePrice = vi.fn().mockResolvedValue(undefined);
    render(
      <VariantsTable
        product={PRODUCT()}
        onAddSku={vi.fn()}
        onUpdateSku={vi.fn()}
        onSetStatus={vi.fn()}
        priceSkuId="sku-1"
        onSelectPrices={() => {}}
        priceHistory={{
          current: {
            skuPriceId: 'x',
            amount: { amount: '25.00', currencyCode: 'USD' },
            effectiveFrom: '2026-06-01T00:00:00Z',
            setBy: 's',
          },
          scheduled: [],
          past: [],
        }}
        onSchedulePrice={onSchedulePrice}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Schedule a new price' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Amount (USD)')).toBeInTheDocument();
    expect(dialog).not.toHaveTextContent(/BDT/);
    expect(dialog).not.toHaveTextContent(/Orders and invoices/);
    expect(dialog).toHaveTextContent(/Orders placed before then keep their price/);
    await user.type(within(dialog).getByLabelText('Amount (USD)'), '30');
    await user.click(within(dialog).getByRole('button', { name: /^schedule$/i }));
    expect(onSchedulePrice.mock.calls[0]![3]).toBe('USD');
  });
});

describe('ImagesEditor — ADR-FE-035', () => {
  it('U-D5: an image without alt text is a field error; the upload tile and the virus-scan note are visible', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<ImagesEditor product={PRODUCT()} onSave={onSave} onReload={() => {}} />);
    expect(screen.getByText(/scanned for viruses/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Upload photo' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Add image' }));
    await user.type(
      screen.getByLabelText('Stored file id'),
      '11111111-1111-1111-1111-111111111111',
    );
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Describe the image in a short alt text.')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });
});

describe('Sections keep their values — NFR-USA-5', () => {
  it('U-D6: a 409 shows the reload message and keeps what was typed', async () => {
    const user = userEvent.setup();
    const onReload = vi.fn();
    const onSave = vi.fn().mockRejectedValue(new ApiConflictError());
    render(
      <ProductDetailsForm
        product={PRODUCT()}
        categories={[
          {
            value: 'RiceAndGrains',
            productCount: 1,
            subcategories: [{ value: 'FlattenedAndPuffedRice', productCount: 1 }],
          },
        ]}
        taxClasses={[{ id: 't1', code: 'STD', name: 'Standard', isActive: true }]}
        countries={[{ code: 'TH', name: 'Thailand' }]}
        onSave={onSave}
        onReload={onReload}
      />,
    );
    const name = screen.getByLabelText('Name');
    await user.clear(name);
    await user.type(name, 'Renamed product');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This product was changed by someone else. Reload to see the latest.',
    );
    expect(screen.getByLabelText('Name')).toHaveValue('Renamed product');
    await user.click(screen.getByRole('button', { name: 'Reload' }));
    expect(onReload).toHaveBeenCalled();
  });

  it('U-X2: a dirty editor section asks before a link navigates away', async () => {
    const user = userEvent.setup();
    render(
      <>
        <a href="/somewhere-else">Back to products</a>
        <ProductDetailsForm
          product={PRODUCT()}
          categories={[]}
          taxClasses={[{ id: 't1', code: 'STD', name: 'Standard', isActive: true }]}
          countries={[]}
          onSave={vi.fn()}
          onReload={() => {}}
        />
      </>,
    );
    await user.type(screen.getByLabelText('Name'), ' edited');
    await user.click(screen.getByRole('link', { name: 'Back to products' }));
    expect(await screen.findByRole('dialog', { name: 'Leave this page?' })).toBeInTheDocument();
  });

  it('shows the description preview through the shared LimitedMarkup, and normalised tags', async () => {
    const user = userEvent.setup();
    render(
      <ProductDetailsForm
        product={PRODUCT()}
        categories={[]}
        taxClasses={[{ id: 't1', code: 'STD', name: 'Standard', isActive: true }]}
        countries={[]}
        onSave={vi.fn()}
        onReload={() => {}}
      />,
    );
    expect(within(screen.getByLabelText('Description preview')).getByText('for').tagName).toBe(
      'STRONG',
    );
    const tags = screen.getByLabelText('Tags');
    await user.clear(tags);
    await user.type(tags, ' Grain-Free, organic,GRAIN-FREE ');
    expect(screen.getByText(/Saved as: grain-free, organic/)).toBeInTheDocument();
    // Food: expiry tracking is locked on; slug is editable before first publication.
    expect(screen.getByRole('checkbox', { name: /Track batches and expiry/ })).toBeDisabled();
  });
});

describe('TranslationsEditor — US-SHP-14 AC3', () => {
  const props = { product: PRODUCT(), onSave: vi.fn(), onRemove: vi.fn(), onReload: () => {} };

  it('U-D7: hidden with one locale', () => {
    const { container } = render(
      <TranslationsEditor {...props} defaultLocale="en" locales={['en']} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('U-D7: with two locales, one sub-form for bn showing the default text', async () => {
    const user = userEvent.setup();
    render(
      <TranslationsEditor
        {...props}
        product={PRODUCT({
          translations: [
            {
              locale: 'bn',
              name: 'বাংলা নাম',
              description: null,
              ingredientList: null,
            },
          ],
        })}
        defaultLocale="en"
        locales={['en', 'bn']}
      />,
    );
    expect(screen.getAllByRole('heading', { name: /Bangla \(bn\)/ })).toHaveLength(1);
    expect(screen.getByText('Default: Organic Rolled Oats')).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('বাংলা নাম');
    await user.click(screen.getByRole('button', { name: /Remove translation \(bn\)/ }));
    expect(await screen.findByRole('dialog')).toHaveTextContent(
      /Customers reading Bangla will see the default text/,
    );
  });
});

describe('StaffProductTable via the page — UI-4, HW-2', () => {
  it('U-D8: a barcode typed and confirmed with Enter searches with that value and updates the URL', async () => {
    const user = userEvent.setup();
    renderWithClient(<StaffProductsPage />);
    const search = await screen.findByLabelText('Name, SKU or barcode');
    await user.type(search, '8900000000101{Enter}');
    await waitFor(() =>
      expect(push.mock.calls.some(([url]) => String(url).includes('barcode=8900000000101'))).toBe(
        true,
      ),
    );
    expect(screen.getByRole('link', { name: /Export CSV/ })).toHaveAttribute(
      'href',
      expect.stringContaining('/api/staff/shop/products/export.csv'),
    );
  });
});

describe('ReviewModerationQueue — US-SHP-09', () => {
  const ITEM: ModerationItem = {
    reviewId: 'r1',
    productId: 'p1',
    productName: 'Organic Rolled Oats',
    skuLabel: '2 kg',
    rating: 2,
    title: '<b>Too</b> small',
    body: 'Wish the bag was **bigger**',
    customerDisplayName: 'Nadia S.',
    submittedOn: '2026-10-04T05:00:00Z',
    status: 'PendingModeration',
  };

  it('U-D9: Reject without a reason is a field error; with a reason it sends the request', async () => {
    const user = userEvent.setup();
    const onAct = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<ReviewModerationQueue items={[ITEM]} onAct={onAct} />);
    expect(container.querySelector('b, strong')).toBeNull(); // title and body are plain text
    await user.click(screen.getByRole('button', { name: /Reject review of/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Reject this review?' });
    await user.click(within(dialog).getByRole('button', { name: 'Reject review' }));
    expect(
      await within(dialog).findByText('Choose a reason for rejecting this review.'),
    ).toBeInTheDocument();
    expect(onAct).not.toHaveBeenCalled();

    await user.selectOptions(within(dialog).getByLabelText('Reason'), 'Spam');
    await user.type(within(dialog).getByLabelText(/Note/), 'Looks automated');
    await user.click(within(dialog).getByRole('button', { name: 'Reject review' }));
    expect(onAct).toHaveBeenCalledWith({
      kind: 'reject',
      reviewId: 'r1',
      reason: 'Spam',
      note: 'Looks automated',
    });
  });

  it('Publish and Hide are confirmed with what they affect', async () => {
    const user = userEvent.setup();
    const onAct = vi.fn().mockResolvedValue(undefined);
    render(
      <ReviewModerationQueue
        items={[ITEM, { ...ITEM, reviewId: 'r2', status: 'Published' }]}
        onAct={onAct}
      />,
    );
    await user.click(screen.getAllByRole('button', { name: /Publish review of/ })[0]!);
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('It will appear on the Organic Rolled Oats page');
    await act(async () => {
      await user.click(within(dialog).getByRole('button', { name: 'Publish' }));
    });
    expect(onAct).toHaveBeenCalledWith({ kind: 'publish', reviewId: 'r1' });
    await user.click(screen.getByRole('button', { name: /Hide review of/ }));
    expect(await screen.findByRole('dialog')).toHaveTextContent(
      'no longer count toward its rating',
    );
  });
});

describe('BundleEditor — US-SHP-12', () => {
  it('shows the server InvalidBundleComponent on the row whose SKU it names', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockRejectedValue(
      new ApiValidationError({
        isValid: false,
        errors: [
          {
            propertyName: 'components',
            errorCode: 'InvalidBundleComponent',
            errorMessage: 'SKU MO-1_5L is discontinued.',
            resourceName: 'Product',
          },
        ],
      }),
    );
    render(
      <BundleEditor
        product={PRODUCT({
          kind: 'Bundle',
          bundleComponents: [
            {
              componentSkuId: 'a',
              skuCode: 'OAT-400G',
              productName: 'Organic Rolled Oats',
              quantity: 1,
              isOnSale: true,
            },
            {
              componentSkuId: 'b',
              skuCode: 'MO-1_5L',
              productName: 'Pure Mustard Oil',
              quantity: 1,
              isOnSale: true,
            },
          ],
        })}
        renderPicker={() => null}
        onSave={onSave}
        onReload={() => {}}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Save' }));
    const alert = await screen.findByText(/MO-1_5L is discontinued/);
    expect(alert.closest('li')).toHaveTextContent('Pure Mustard Oil');
    expect(rowNamedBy('SKU X is a bundle', [{ code: 'Y' }])).toBe(-1);
  });

  it('S14: a code is matched whole, not as part of a longer code', () => {
    const rows = [{ code: 'KIT-1' }, { code: 'KIT-10' }];
    expect(rowNamedBy('SKU KIT-10 is a kit.', rows)).toBe(1);
    expect(rowNamedBy('SKU "KIT-1" is a kit.', rows)).toBe(0);
    expect(rowNamedBy('SKU KIT-10 is a kit.', [{ code: 'KIT-1' }])).toBe(-1);
    expect(rowNamedBy('SKU A.B is bad', [{ code: 'A.B' }])).toBe(0);
    expect(rowNamedBy('SKU AxB is bad', [{ code: 'A.B' }])).toBe(-1);
  });

  it('S14: the same SKU cannot be added twice', async () => {
    const user = userEvent.setup();
    render(
      <BundleEditor
        product={PRODUCT({ kind: 'Bundle', bundleComponents: [] })}
        renderPicker={(onPick) => (
          <button
            type="button"
            onClick={() => onPick({ skuId: 'sku-1', code: 'RC-1', label: 'Rolled Oats (RC-1)' })}
          >
            Pick RC-1
          </button>
        )}
        onSave={vi.fn()}
        onReload={() => {}}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Pick RC-1' }));
    await user.click(screen.getByRole('button', { name: 'Pick RC-1' }));
    expect(screen.getAllByLabelText('Quantity')).toHaveLength(1);
    expect(screen.getByRole('status')).toHaveTextContent(/already in the kit/);
  });
});

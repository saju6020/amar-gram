import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DeliveryPromiseCard } from '@/components/hearth/DeliveryPromise';
import { ProductDetailsTabs } from '@/components/product/ProductDetailsTabs';
import { ProductHeading } from '@/components/product/ProductHeading';
import { shopFixtureIds } from '@/mocks/handlers/shop';
import { mockDetail } from './test-utils';

/** HO-P5 S1 §15 U9 (`ProductHeading` district), U12 (`DeliveryPromiseCard` lead time) and the Origin tab. */

const heading = (district?: string | null) => (
  <ProductHeading
    name="Organic Rolled Oats"
    nameLang="en"
    brand="Amar Gram Farms"
    rating={{ average: 4.5, count: 23 }}
    country={{ code: 'BD', name: 'Bangladesh' }}
    district={district}
  />
);

describe('U9: ProductHeading', () => {
  it('shows "Grown in {district}" above the producer eyebrow only when there is a district', () => {
    const { container, rerender } = render(heading('Dinajpur'));
    const grown = screen.getByText('Grown in Dinajpur');
    expect(grown).toHaveClass('text-leaf', 'uppercase');
    const producer = screen.getByText(/Amar Gram Farms/);
    // Above the existing eyebrow, and the eyebrow itself is unchanged.
    expect(
      grown.compareDocumentPosition(producer) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(producer).toHaveTextContent('Amar Gram Farms · Bangladesh');
    expect(screen.getByRole('link', { name: 'Bangladesh' })).toHaveAttribute(
      'href',
      '/shop/countries/BD',
    );

    rerender(heading(null));
    expect(screen.queryByText(/Grown in/)).not.toBeInTheDocument();
    expect(container.querySelector('header p')).toHaveTextContent('Amar Gram Farms · Bangladesh');
    rerender(heading(undefined));
    expect(screen.queryByText(/Grown in/)).not.toBeInTheDocument();
  });
});

describe('the Origin & producer tab', () => {
  it('lists the District when the product has one, and not otherwise', async () => {
    const user = userEvent.setup();
    const detail = mockDetail(shopFixtureIds.multiVariantSlug);
    expect(detail.districtOfOrigin).toBe('Dinajpur');
    const { unmount } = render(<ProductDetailsTabs detail={detail} />);
    await user.click(screen.getByRole('tab', { name: 'Origin & producer' }));
    expect(screen.getByRole('tabpanel', { name: 'Origin & producer' })).toHaveTextContent(
      'District: Dinajpur',
    );
    unmount();
    render(<ProductDetailsTabs detail={{ ...detail, districtOfOrigin: null }} />);
    await user.click(screen.getByRole('tab', { name: 'Origin & producer' }));
    expect(screen.getByRole('tabpanel', { name: 'Origin & producer' })).not.toHaveTextContent(
      'District',
    );
  });
});

describe('U12: DeliveryPromiseCard', () => {
  const TODAY =
    'Pick a delivery slot at checkout. The fee is shown before you place the order.';

  it('states the server lead time when it sends one', () => {
    const { rerender } = render(<DeliveryPromiseCard leadTimeDays={1} />);
    expect(
      screen.getByText(
        'Standard delivery usually takes 1 day. Pick a slot at checkout; the fee is shown before you order.',
      ),
    ).toBeInTheDocument();
    rerender(<DeliveryPromiseCard leadTimeDays={3} />);
    expect(screen.getByText(/usually takes 3 days/)).toBeInTheDocument();
    expect(screen.queryByText(TODAY)).not.toBeInTheDocument();
  });

  it('U12c: a lead time of 0 keeps today’s text (Amended (q)), never "usually takes 0 days"', () => {
    render(<DeliveryPromiseCard leadTimeDays={0} />);
    expect(screen.getByText(TODAY)).toBeInTheDocument();
    expect(screen.queryByText(/usually takes/)).not.toBeInTheDocument();
  });

  it('keeps today’s text without a lead time, and keeps its other facts and export', () => {
    const { rerender } = render(<DeliveryPromiseCard />);
    expect(screen.getByText(TODAY)).toBeInTheDocument();
    rerender(<DeliveryPromiseCard leadTimeDays={null} className="x" />);
    expect(screen.getByText(TODAY)).toBeInTheDocument();
    // A lead time of 0 is not a "usually takes 0 days" claim.
    rerender(<DeliveryPromiseCard leadTimeDays={0} />);
    expect(screen.getByText(TODAY)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Delivery and payment' })).toBeInTheDocument();
    expect(screen.getByText('Cash on delivery, or bank transfer.')).toBeInTheDocument();
  });
});

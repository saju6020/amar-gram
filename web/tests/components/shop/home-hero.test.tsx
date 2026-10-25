import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { DeliveryPromiseCard, PromiseStrip } from '@/components/hearth/DeliveryPromise';
import { ShopHero } from '@/components/shop/ShopHero';
import { makeItem } from '../catalogue/catalogue-fixtures';

describe('Delivery promise and promise strip — only true rules', () => {
  it('the product card states slot and fee at checkout, pickup at a branch and the payment methods', () => {
    render(<DeliveryPromiseCard />);
    const card = screen.getByRole('region', { name: 'Delivery and payment' });
    expect(card).toHaveTextContent(/delivery slot at checkout/i);
    expect(card).toHaveTextContent(/fee is shown before you place the order/i);
    expect(card).toHaveTextContent(/pick it up at a branch/i);
    expect(card).toHaveTextContent(/cash on delivery, or bank transfer/i);
    expect(card.textContent).not.toMatch(/next[- ]day|same[- ]day|free delivery|within \d/i);
  });

  // U13 (HO-P3): the home strip is the design's four dashed promise cards, true facts only.
  it('U13: the home strip states the organic, cash-on-delivery, returns and delivery facts only', () => {
    render(<PromiseStrip />);
    const strip = screen.getByRole('region', { name: 'Why shop with us' });
    expect(within(strip).getAllByRole('listitem')).toHaveLength(4);
    expect(strip).toHaveTextContent('Organic where we say so');
    expect(strip).toHaveTextContent('Certified items are marked');
    expect(strip).toHaveTextContent('Cash on delivery');
    expect(strip).toHaveTextContent('Pay when it reaches you');
    expect(strip).toHaveTextContent('Returns on eligible items');
    expect(strip.textContent).not.toMatch(/village on every pack|free delivery|৳|next[- ]day/i);
  });
});

describe('ShopHero — built from the banner, nothing invented (U10)', () => {
  it('uses the banner title, body and link; draws no eyebrow', () => {
    render(
      <ShopHero
        banner={{
          slug: 'b',
          title: 'Harvest season',
          body: 'Everything a new kitchen needs.',
          placement: 'Home',
          linkUrl: '/shop/products?category=RiceAndGrains',
        }}
        featured={makeItem()}
      />,
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Harvest season');
    expect(screen.getByText('Everything a new kitchen needs.')).toBeInTheDocument();
    expect(screen.queryByText(/from our village to your kitchen/i)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Find out more/ })).toHaveAttribute(
      'href',
      '/shop/products?category=RiceAndGrains',
    );
    expect(screen.getByRole('link', { name: 'Meet the growers' })).toHaveAttribute(
      'href',
      '#growers',
    );
    // The harvest card links to the newest product and shows "producer · country" from the API.
    const harvest = screen.getByRole('link', { name: /This week.s harvest/ });
    expect(harvest).toHaveAttribute('href', '/shop/products/organic-rolled-oats');
    expect(harvest).toHaveTextContent('Organic Rolled Oats');
    expect(harvest).toHaveTextContent('Amar Gram Farms · Bangladesh');
  });

  it('with no banner it shows the design headline, intro and both buttons', () => {
    render(<ShopHero banner={null} featured={null} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Honest food, grown the slow way.',
    );
    expect(screen.getByText(/bought straight from the families who grow them/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Shop the harvest/ })).toHaveAttribute(
      'href',
      '/shop/products',
    );
    expect(screen.getByRole('link', { name: 'Meet the growers' })).toHaveAttribute(
      'href',
      '#growers',
    );
    // No product yet: no harvest card.
    expect(screen.queryByText(/This week.s harvest/)).not.toBeInTheDocument();
  });
});

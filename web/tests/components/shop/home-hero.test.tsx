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

  it('the home strip uses the same facts', () => {
    render(<PromiseStrip />);
    const strip = screen.getByRole('region', { name: 'Why shop with us' });
    expect(within(strip).getAllByRole('listitem')).toHaveLength(4);
    expect(strip.textContent).not.toMatch(/next[- ]day|same[- ]day|free delivery/i);
  });
});

describe('ShopHero — built from the banner, nothing invented', () => {
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
    expect(screen.getByRole('link', { name: /Find out more/ })).toHaveAttribute(
      'href',
      '/shop/products?category=RiceAndGrains',
    );
    expect(screen.getByRole('link', { name: /Organic Rolled Oats/ })).toHaveAttribute(
      'href',
      '/shop/products/organic-rolled-oats',
    );
  });

  it('with no banner it keeps the page headline and a shop button', () => {
    render(<ShopHero banner={null} featured={null} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Fresh from the village, with the origin on every product',
    );
    expect(screen.getByRole('link', { name: /Shop all products/ })).toHaveAttribute(
      'href',
      '/shop/products',
    );
  });
});

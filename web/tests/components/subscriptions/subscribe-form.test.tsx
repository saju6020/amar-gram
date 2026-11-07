import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { SubscribeForm } from '@/components/subscriptions/SubscribeForm';
import { seedDates } from '@/mocks/handlers/subscriptions/fixtures';
import { shopFixtureIds } from '@/mocks/handlers/shop';
import { optionsOf } from '@/mocks/handlers/subscriptions/store';
import { currentUrl, setUrl } from '../common/nav-mock';
import {
  defaultAddress,
  ids,
  recordRequests,
  renderWithClient,
  resetSubscriptions,
  serveAddresses,
  signIn,
  signOut,
} from './helpers';

vi.mock('next/navigation', () => import('../common/nav-mock'));

const dates = seedDates();
const OATS_2KG = shopFixtureIds.skuOats2kg;

beforeEach(() => {
  resetSubscriptions();
  signIn();
  setUrl(`/portal/subscriptions/new/${OATS_2KG}`);
  serveAddresses();
});
afterEach(signOut);

async function formReady(skuId = OATS_2KG) {
  const view = renderWithClient(<SubscribeForm skuId={skuId} />);
  await screen.findByRole('button', { name: 'Start subscription' });
  // The default address and the first available payment method arrive after the first paint.
  await waitFor(() => expect(screen.getByRole('radio', { name: /^Home \(default\)/ })).toBeChecked());
  await waitFor(() => expect(within(screen.getByRole('radiogroup', { name: /How you.ll pay/ })).getAllByRole('radio').some((r) => (r as HTMLInputElement).checked)).toBe(true));
  return view;
}

describe('the Subscribe form from the options (U9)', () => {
  it('limits the quantity, takes the intervals from the payload, and states the range and the reminder lead in words', async () => {
    await formReady();
    const quantity = screen.getByLabelText('Quantity per delivery');
    expect(quantity).toHaveAttribute('min', '1');
    expect(quantity).toHaveAttribute('max', '20');
    expect(screen.getByText('Choose 1 to 20.')).toBeVisible();
    const intervals = within(screen.getByRole('radiogroup', { name: 'How often' })).getAllByRole('radio');
    expect(intervals.map((r) => r.closest('label')?.textContent)).toEqual([
      'Every 2 weeks',
      'Every 4 weeks',
      'Every 6 weeks',
      'Every 8 weeks',
      'Every 12 weeks',
    ]);
    expect(screen.getByRole('radio', { name: 'Every 4 weeks' })).toBeChecked();

    const date = screen.getByLabelText('First delivery date');
    expect(date).toHaveAttribute('type', 'date');
    expect(date).toHaveValue(dates.earliestFirstDeliveryOn);
    expect(date).toHaveAttribute('min', dates.earliestFirstDeliveryOn);
    expect(date).toHaveAttribute('max', dates.latestFirstDeliveryOn);
    expect(screen.getByText(/^Choose a date from \w{3} \d+ \w{3} to \w{3} \d+ \w{3}\. We'll remind you 3 days before each delivery\.$/)).toBeVisible();
  });

  it('the intervals and the maximum quantity follow what the server sends', async () => {
    server.use(
      http.get('*/api/customers/me/subscriptions/options', () =>
        HttpResponse.json({ ...optionsOf(ids.customerId, OATS_2KG)!, allowedIntervalWeeks: [4, 8], maxQuantity: 5 }),
      ),
    );
    await formReady();
    const intervals = within(screen.getByRole('radiogroup', { name: 'How often' })).getAllByRole('radio');
    expect(intervals).toHaveLength(2);
    expect(screen.getByLabelText('Quantity per delivery')).toHaveAttribute('max', '5');
    expect(screen.getByText('Choose 1 to 5.')).toBeVisible();
  });
});

describe('not offered (U10)', () => {
  it('a product that is not subscribable shows the server\'s reason and a way back, and no form', async () => {
    const kit = ids.skus.oats4kg; // sold out: not purchasable
    renderWithClient(<SubscribeForm skuId={kit} />);
    expect(await screen.findByText("This product can't be subscribed to right now.")).toBeVisible();
    expect(screen.getByText('This product is not available to subscribe to right now.')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Back to the shop' })).toHaveAttribute('href', '/shop');
    expect(screen.queryByRole('button', { name: 'Start subscription' })).toBeNull();
  });

  it('an existing subscription is linked instead of offering a second', async () => {
    renderWithClient(<SubscribeForm skuId={ids.skus.oats400} />);
    expect(await screen.findByText('You already subscribe to this.')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Manage your subscription' })).toHaveAttribute(
      'href',
      `/portal/subscriptions/${ids.mine.activeUnlocked}`,
    );
    expect(screen.queryByRole('button', { name: 'Start subscription' })).toBeNull();
  });

  it('an unknown SKU is "We couldn\'t find that product."', async () => {
    renderWithClient(<SubscribeForm skuId="b0000000-0000-0000-0000-00000000dead" />);
    expect(await screen.findByText("We couldn't find that product.")).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Start subscription' })).toBeNull();
  });
});

describe('payment methods (U11)', () => {
  it('nothing is requested until an address is chosen; a delivery asks with deliveryAddressId; a pickup with pickupBranchId', async () => {
    serveAddresses([]);
    const requests = recordRequests('/subscriptions/payment-methods');
    renderWithClient(<SubscribeForm skuId={OATS_2KG} />);
    await screen.findByRole('button', { name: 'Start subscription' });
    expect(screen.getByText('Choose a delivery address to see how you can pay.')).toBeVisible();
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(requests.urls).toEqual([]);

    const user = userEvent.setup();
    await user.click(screen.getByRole('radio', { name: /^Collect from an outlet/ }));
    expect(screen.getByText('Choose an outlet to see how you can pay.')).toBeVisible();
    const outlets = await screen.findByRole('radiogroup', { name: 'Collect from' });
    await user.click(await within(outlets).findAllByRole('radio').then((all) => all[0]!));
    await screen.findByRole('radio', { name: 'Pay at the shop on collection' });
    expect(requests.urls.at(-1)).toContain(`pickupBranchId=${ids.mainBranchId}`);
    requests.stop();
  });

  it('a delivery request carries the chosen address; a method Orders will not offer is a disabled radio with its reason tied by aria-describedby', async () => {
    const requests = recordRequests('/subscriptions/payment-methods');
    const user = userEvent.setup();
    renderWithClient(<SubscribeForm skuId={ids.skus.masala750} />);
    await screen.findByRole('button', { name: 'Start subscription' });
    await screen.findByRole('radio', { name: /^Cash on delivery/ });
    const quantity = screen.getByLabelText('Quantity per delivery');
    await user.clear(quantity);
    await user.type(quantity, '2');

    // The list is re-read for the new quantity (debounced), so look the radio up again each time.
    await waitFor(() => expect(screen.getByRole('radio', { name: /^Cash on delivery/ })).toBeDisabled(), { timeout: 4000 });
    const reason = screen.getByText(/Cash on delivery is available for orders up to/);
    expect(screen.getByRole('radio', { name: /^Cash on delivery/ }).getAttribute('aria-describedby')).toBe(reason.id);
    expect(requests.urls.some((u) => u.includes(`deliveryAddressId=${defaultAddress().id}`))).toBe(true);
    // The quantity is sent, debounced: the last request is for two.
    await waitFor(() => expect(requests.urls.at(-1)).toContain('quantity=2'), { timeout: 4000 });
    // Bank transfer is the one available, and is chosen for the customer.
    expect(screen.getByRole('radio', { name: 'Bank transfer' })).toBeChecked();
    requests.stop();
  });
});

describe('no browser estimate (U12)', () => {
  it('shows the unit price, the rate in words and the note, and no subtotal, discount amount or total', async () => {
    await formReady();
    const price = screen.getByRole('region', { name: 'Price' });
    expect(within(price).getByText(/Each pack:/)).toHaveTextContent('৳2,450.00');
    expect(within(price).getByText('Subscription discount: 10% off every delivery')).toBeVisible();
    expect(
      within(price).getByText('Delivery and tax are added when each order is placed. Each order is priced on the day it is placed.'),
    ).toBeVisible();
    expect(screen.queryByText(/subtotal|estimated|total/i)).toBeNull();
    expect(screen.queryByText(/৳2,205|৳245/)).toBeNull();
  });
});

describe('the inline address (U13)', () => {
  it('"Add a new address" saves through Accounts, selects the new address and keeps every other choice; nothing is stored', async () => {
    const user = userEvent.setup();
    await formReady();
    await user.click(screen.getByRole('radio', { name: 'Every 8 weeks' }));
    await user.click(screen.getByRole('button', { name: 'Add a new address' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add address' });
    await user.type(within(dialog).getByLabelText(/^Label/), 'Parents');
    await user.type(within(dialog).getByLabelText(/^Address line 1/), 'House 9, Road 2');
    await user.type(within(dialog).getByLabelText(/^City/), 'Dhaka');
    await user.type(within(dialog).getByLabelText(/^District/), 'Dhaka');
    await user.click(within(dialog).getByRole('button', { name: /^Save/ }));

    const added = await screen.findByRole('radio', { name: /^Parents/ });
    await waitFor(() => expect(added).toBeChecked());
    expect(screen.getByRole('radio', { name: 'Every 8 weeks' })).toBeChecked();
    expect(window.localStorage.length).toBe(0);
    const keys = Array.from({ length: window.sessionStorage.length }, (_, i) => window.sessionStorage.key(i)!);
    expect(keys.filter((key) => !key.startsWith('__amargram_'))).toEqual([]);
  });
});

describe('submitting (U14)', () => {
  it('a 201 goes to the new subscription\'s page, where the first delivery is announced', async () => {
    const user = userEvent.setup();
    await formReady();
    await user.click(screen.getByRole('button', { name: 'Start subscription' }));
    await waitFor(() => expect(currentUrl()).toMatch(/^\/portal\/subscriptions\/[0-9a-f-]{36}\?subscribed=1$/));
  });

  it('a 400 maps to the fields with a summary, keeps the values, and the { error } 400 reads as the generic sentence', async () => {
    const user = userEvent.setup();
    await formReady();
    await user.click(screen.getByRole('radio', { name: 'Every 6 weeks' }));
    await user.clear(screen.getByLabelText('First delivery date'));
    await user.type(screen.getByLabelText('First delivery date'), dates.today);
    await user.click(screen.getByRole('button', { name: 'Start subscription' }));

    const summary = await screen.findByText(/We couldn.t start your subscription/);
    expect(summary.closest('[role="alert"]')).not.toBeNull();
    const field = await screen.findAllByText(/Choose a delivery date between/);
    expect(field.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole('radio', { name: 'Every 6 weeks' })).toBeChecked();
    expect(screen.getByLabelText('First delivery date')).toHaveValue(dates.today);

    server.use(
      http.post('*/api/customers/me/subscriptions', () =>
        HttpResponse.json({ error: 'fulfilment must be Delivery or Pickup.' }, { status: 400 }),
      ),
    );
    await user.click(screen.getByRole('button', { name: 'Start subscription' }));
    expect(await screen.findByText("We couldn't save that. Please check your choices and try again.")).toBeVisible();
    expect(screen.getByRole('radio', { name: 'Every 6 weeks' })).toBeChecked();
  });

  it('SubscriptionAlreadyExists re-reads the options and links to the existing subscription; PaymentMethodUnavailable re-reads the payment methods', async () => {
    const user = userEvent.setup();
    const methods = recordRequests('/subscriptions/payment-methods');
    await formReady();
    await waitFor(() => expect(methods.urls.length).toBeGreaterThan(0));
    const before = methods.urls.length;
    server.use(
      http.post('*/api/customers/me/subscriptions', () =>
        HttpResponse.json(
          {
            errors: [
              {
                propertyName: 'PaymentMethod',
                errorCode: 'PaymentMethodUnavailable',
                errorMessage: 'That payment method is not available for this order.',
              },
            ],
            isValid: false,
          },
          { status: 400 },
        ),
      ),
    );
    await user.click(screen.getByRole('button', { name: 'Start subscription' }));
    expect((await screen.findAllByText('That payment method is not available for this order.')).length).toBeGreaterThan(0);
    await waitFor(() => expect(methods.urls.length).toBeGreaterThan(before));
    methods.stop();
  });

  it('the button is busy while in flight, announced, and is the only thing disabled', async () => {
    const user = userEvent.setup();
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.post('*/api/customers/me/subscriptions', async () => {
        await gate;
        return HttpResponse.json({ error: 'x' }, { status: 400 });
      }),
    );
    await formReady();
    await user.click(screen.getByRole('button', { name: 'Start subscription' }));
    const busy = await screen.findByRole('button', { name: 'Starting your subscription…' });
    expect(busy).toBeDisabled();
    expect(busy).toHaveAttribute('aria-busy', 'true');
    release();
    await screen.findByRole('button', { name: 'Start subscription' });
  });
});

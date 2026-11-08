import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { SubscriptionDetail } from '@/components/subscriptions/SubscriptionDetail';
import { formatCycleDate } from '@/lib/subscriptions/dates';
import { seedDates } from '@/mocks/handlers/subscriptions/fixtures';
import { customerDetailOf, findSubscription } from '@/mocks/handlers/subscriptions/store';
import { currentUrl, setUrl } from '../common/nav-mock';
import { subscriptionKeys } from '@/lib/subscriptions/keys';
import { ids, recordRequests, renderWithClient, resetSubscriptions, serveAddresses, signIn, signOut } from './helpers';

vi.mock('next/navigation', () => import('../common/nav-mock'));

const dates = seedDates();

beforeEach(() => {
  resetSubscriptions();
  signIn();
  serveAddresses();
});
afterEach(signOut);

async function open(id: string, search = '') {
  setUrl(`/portal/subscriptions/${id}${search}`);
  const view = renderWithClient(<SubscriptionDetail id={id} />);
  // A dialog opened by the page hides the heading from the accessibility tree, so wait on the text.
  await screen.findAllByText(/Organic Rolled Oats|Date Palm Gur|Thai Jasmine Rice|Garam Masala/);
  return view;
}

const writes = () => recordRequests('/api/customers/me/subscriptions/');

describe('change terms (U18)', () => {
  it('sends the version, closes on 200, and shows the server\'s sentence in a status region', async () => {
    const user = userEvent.setup();
    const requests = writes();
    await open(ids.mine.activeUnlocked);
    await user.click(screen.getByRole('button', { name: 'Change' }));
    const dialog = await screen.findByRole('dialog', { name: /^Change Organic Rolled Oats/ });
    const quantity = await within(dialog).findByLabelText('Quantity per delivery');
    await user.click(within(dialog).getByRole('button', { name: 'One more' }));
    expect(quantity).toHaveValue(3);

    let body: Record<string, unknown> | undefined;
    server.events.on('request:start', async ({ request }) => {
      if (request.method === 'PUT') body = (await request.clone().json()) as Record<string, unknown>;
    });
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /^Change / })).toBeNull());
    expect(await screen.findByText(/^Done\. Your next delivery on .* will be 3 × Organic Rolled Oats 400 g\.$/)).toBeVisible();
    expect(body).toMatchObject({ version: 1, quantity: 3, intervalWeeks: 4, fulfilment: 'Delivery', paymentMethod: 'CashOnDelivery' });
    expect(requests.urls.some((u) => u.endsWith('/terms'))).toBe(true);
    requests.stop();
  });

  it('after the cut-off the change is scheduled: the sentence names the following delivery and the pending panel lists it', async () => {
    const user = userEvent.setup();
    await open(ids.mine.activeLocked);
    await user.click(screen.getByRole('button', { name: 'Change' }));
    const dialog = await screen.findByRole('dialog', { name: /^Change Thai Jasmine Rice/ });
    // Back to the current terms the server holds first would be "no change"; choose a different interval.
    await user.click(await within(dialog).findByRole('radio', { name: 'Every 8 weeks' }));
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    expect(
      await screen.findByText(/is already being prepared, so this change starts with the delivery on \w{3} \d+ \w{3}\.$/),
    ).toBeVisible();
    expect(screen.getByRole('region', { name: 'Scheduled changes' })).toHaveTextContent('New terms from the delivery on');
  });

  it('a 409 keeps the dialog open with the customer\'s values, shows the stale sentence and re-reads the subscription', async () => {
    const user = userEvent.setup();
    await open(ids.mine.activeUnlocked);
    await user.click(screen.getByRole('button', { name: 'Change' }));
    const dialog = await screen.findByRole('dialog', { name: /^Change / });
    await user.click(await within(dialog).findByRole('radio', { name: 'Every 6 weeks' }));
    const requests = recordRequests(`/subscriptions/${ids.mine.activeUnlocked}`);
    server.use(
      http.put('*/api/customers/me/subscriptions/:id/terms', () =>
        HttpResponse.json(
          { errors: [{ propertyName: 'ExpectedVersion', errorCode: 'StaleVersion', errorMessage: 'x' }], isValid: false },
          { status: 409 },
        ),
      ),
    );
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    expect(await within(dialog).findByText("This subscription changed in another window. We've loaded the latest.")).toBeVisible();
    expect(within(dialog).getByRole('radio', { name: 'Every 6 weeks' })).toBeChecked();
    await waitFor(() => expect(requests.urls.filter((u) => !u.includes('/terms')).length).toBeGreaterThan(0));
    requests.stop();
  });

  it('nothing changed reads as the server\'s NoChangeRequested sentence', async () => {
    const user = userEvent.setup();
    await open(ids.mine.activeUnlocked);
    await user.click(screen.getByRole('button', { name: 'Change' }));
    const dialog = await screen.findByRole('dialog', { name: /^Change / });
    await within(dialog).findByRole('radio', { name: 'Every 4 weeks' });
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    expect(await within(dialog).findByText('Nothing was changed - these are already the terms of your subscription.')).toBeVisible();
  });
});

describe('skip (U19)', () => {
  it('the confirmation names the date, nothing is sent before it, and the request carries that date', async () => {
    const user = userEvent.setup();
    await open(ids.mine.activeUnlocked);
    const requests = writes();
    await user.click(screen.getByRole('button', { name: /^Skip the delivery on / }));
    const dialog = await screen.findByRole('dialog', { name: `Skip the delivery on ${formatCycleDate(dates.unlockedNextDeliveryOn)}?` });
    expect(requests.urls.filter((u) => u.endsWith('/skip'))).toEqual([]);
    let body: unknown;
    server.events.on('request:start', async ({ request }) => {
      if (request.url.endsWith('/skip')) body = await request.clone().json();
    });
    await user.click(within(dialog).getByRole('button', { name: 'Skip this delivery' }));
    expect(await screen.findByText(/^Done\. That delivery is skipped\. Your next delivery is on /)).toBeVisible();
    expect(body).toEqual({ cycleOn: dates.unlockedNextDeliveryOn });
    requests.stop();
  });

  it('CycleNoLongerSkippable shows the server\'s sentence in the dialog and the page re-reads', async () => {
    const user = userEvent.setup();
    await open(ids.mine.activeUnlocked);
    server.use(
      http.post('*/api/customers/me/subscriptions/:id/skip', () =>
        HttpResponse.json(
          {
            errors: [
              {
                propertyName: 'CycleOn',
                errorCode: 'CycleNoLongerSkippable',
                errorMessage: 'The delivery on Tue 10 Nov can no longer be skipped. You can skip the one on Tue 8 Dec.',
              },
            ],
            isValid: false,
          },
          { status: 400 },
        ),
      ),
    );
    await user.click(screen.getByRole('button', { name: /^Skip the delivery on / }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Skip this delivery' }));
    expect(await within(dialog).findByText('The delivery on Tue 10 Nov can no longer be skipped. You can skip the one on Tue 8 Dec.')).toBeVisible();
  });
});

describe('the reminder\'s skip link (U20, ADR-FE-111)', () => {
  it('a date equal to skippableCycleOn opens the confirmation, sends nothing, and drops the parameter', async () => {
    const requests = writes();
    await open(ids.mine.activeUnlocked, `?skip=${dates.unlockedNextDeliveryOn}`);
    expect(await screen.findByRole('dialog', { name: `Skip the delivery on ${formatCycleDate(dates.unlockedNextDeliveryOn)}?` })).toBeVisible();
    await waitFor(() => expect(currentUrl()).toBe(`/portal/subscriptions/${ids.mine.activeUnlocked}`));
    expect(requests.urls.filter((u) => u.endsWith('/skip'))).toEqual([]);
    requests.stop();
  });

  it('another date is explained and the delivery that can be skipped is offered instead', async () => {
    const user = userEvent.setup();
    await open(ids.mine.activeUnlocked, `?skip=${dates.today}`);
    expect(await screen.findByText('That delivery can no longer be skipped.')).toBeVisible();
    expect(screen.queryByRole('dialog')).toBeNull();
    await user.click(screen.getByRole('button', { name: `Skip the delivery on ${formatCycleDate(dates.unlockedNextDeliveryOn)} instead` }));
    expect(await screen.findByRole('dialog', { name: `Skip the delivery on ${formatCycleDate(dates.unlockedNextDeliveryOn)}?` })).toBeVisible();
    expect(currentUrl()).toBe(`/portal/subscriptions/${ids.mine.activeUnlocked}`);
  });

  it('a cached detail that does not list the date does not decide: the dialog opens once the re-read lists it', async () => {
    const id = ids.mine.activeUnlocked;
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0, staleTime: 0 } } });
    // What an earlier visit left behind: a detail whose skippable delivery is another one.
    client.setQueryData(subscriptionKeys.detail(id), {
      ...customerDetailOf(findSubscription(id)!),
      skippableCycleOn: dates.today,
    });
    setUrl(`/portal/subscriptions/${id}?skip=${dates.unlockedNextDeliveryOn}`);
    render(
      <QueryClientProvider client={client}>
        <SubscriptionDetail id={id} />
      </QueryClientProvider>,
    );
    expect(await screen.findByRole('dialog', { name: `Skip the delivery on ${formatCycleDate(dates.unlockedNextDeliveryOn)}?` })).toBeVisible();
    expect(screen.queryByText('That delivery can no longer be skipped.')).toBeNull();
  });

  it('with skippableCycleOn null the explanation has no offer; a malformed value is ignored and removed', async () => {
    server.use(
      http.get(`*/api/customers/me/subscriptions/${ids.mine.activeUnlocked}`, () =>
        HttpResponse.json({ ...customerDetailOf(findSubscription(ids.mine.activeUnlocked)!), skippableCycleOn: null, allowedActions: ['ChangeTerms'] }),
      ),
    );
    const first = await open(ids.mine.activeUnlocked, `?skip=${dates.unlockedNextDeliveryOn}`);
    expect(await screen.findByText('That delivery can no longer be skipped.')).toBeVisible();
    expect(screen.queryByRole('button', { name: /instead$/ })).toBeNull();
    first.unmount();

    await open(ids.mine.activeUnlocked, '?skip=soon');
    await waitFor(() => expect(currentUrl()).toBe(`/portal/subscriptions/${ids.mine.activeUnlocked}`));
    expect(screen.queryByText('That delivery can no longer be skipped.')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('pause, resume, cancel and withdraw (U21)', () => {
  it('pause confirms in the unlocked wording and answers with the server\'s sentence', async () => {
    const user = userEvent.setup();
    await open(ids.mine.activeUnlocked);
    await user.click(screen.getByRole('button', { name: 'Pause' }));
    const dialog = await screen.findByRole('dialog', { name: 'Pause Organic Rolled Oats?' });
    expect(dialog).toHaveTextContent('Pause this subscription? No orders are placed until you resume.');
    await user.click(within(dialog).getByRole('button', { name: 'Pause subscription' }));
    expect(await screen.findByText('Done. Your subscription is paused. Resume it any time.')).toBeVisible();
    expect(await screen.findByRole('button', { name: 'Resume' })).toBeVisible();
  });

  it('resume offers an optional date limited to the server\'s range, sends it only when chosen, and maps a refusal to the field', async () => {
    const user = userEvent.setup();
    await open(ids.mine.paused);
    await user.click(screen.getByRole('button', { name: 'Resume' }));
    const dialog = await screen.findByRole('dialog', { name: /^Resume / });
    const date = within(dialog).getByLabelText('First delivery date (optional)');
    await waitFor(() => expect(date).toHaveAttribute('min', dates.earliestFirstDeliveryOn));
    expect(date).toHaveAttribute('max', dates.latestFirstDeliveryOn);

    await user.type(date, dates.today);
    await user.click(within(dialog).getByRole('button', { name: 'Resume subscription' }));
    expect(await within(dialog).findByText(/Choose a delivery date between/)).toBeVisible();

    await user.clear(date);
    await user.type(date, dates.latestFirstDeliveryOn);
    await user.click(within(dialog).getByRole('button', { name: 'Resume subscription' }));
    expect(await screen.findByText(`Done. Your subscription is back on. Your next delivery is on ${formatCycleDate(dates.latestFirstDeliveryOn)}.`)).toBeVisible();
  });

  it('a suspension cannot be resumed by the customer: the server\'s sentence is shown', async () => {
    const user = userEvent.setup();
    server.use(
      http.get(`*/api/customers/me/subscriptions/${ids.mine.suspendedUnpaid}`, () =>
        HttpResponse.json({ ...customerDetailOf(findSubscription(ids.mine.suspendedUnpaid)!), allowedActions: ['Resume', 'Cancel'] }),
      ),
    );
    await open(ids.mine.suspendedUnpaid);
    await user.click(screen.getByRole('button', { name: 'Resume' }));
    const dialog = await screen.findByRole('dialog', { name: /^Resume / });
    await user.click(within(dialog).getByRole('button', { name: 'Resume subscription' }));
    expect(await within(dialog).findByText('This subscription was paused after 2 unpaid orders. Please contact the shop to restart it.')).toBeVisible();
  });

  it('cancel cannot be sent without a reason; the note has a counter and is sent as plain text', async () => {
    const user = userEvent.setup();
    await open(ids.mine.activeUnlocked);
    await user.click(screen.getByRole('button', { name: 'Cancel subscription' }));
    const dialog = await screen.findByRole('dialog', { name: 'Cancel Organic Rolled Oats?' });
    const sent: unknown[] = [];
    server.events.on('request:start', async ({ request }) => {
      if (request.url.endsWith('/cancel')) sent.push(await request.clone().json());
    });
    await user.click(within(dialog).getByRole('button', { name: 'Cancel subscription' }));
    expect(await within(dialog).findByText('Choose a reason so we know how to improve.')).toBeVisible();
    expect(sent).toEqual([]);

    const reasons = within(dialog).getAllByRole('radio').map((r) => r.closest('label')?.textContent);
    expect(reasons).toEqual([
      "I don't need it any more",
      'I have too much at home',
      "It wasn't to our taste",
      'It costs too much',
      "I'm switching to another product",
      'Something else',
    ]);
    await user.click(within(dialog).getByRole('radio', { name: 'It costs too much' }));
    const note = within(dialog).getByLabelText(/Anything else/);
    expect(note).toHaveAttribute('maxlength', '500');
    await user.type(note, '<b>x</b>');
    expect(within(dialog).getByText('8 of 500 characters')).toBeVisible();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel subscription' }));
    expect(await screen.findByText('Done. Your subscription is cancelled.')).toBeVisible();
    expect(sent).toEqual([{ reason: 'TooExpensive', note: '<b>x</b>' }]);
    // The note is never rendered back as markup.
    expect(document.querySelector('b')).toBeNull();
  });

  it('withdraw lists what will not happen and sends a DELETE', async () => {
    const user = userEvent.setup();
    await open(ids.mine.activeLocked);
    await user.click(screen.getByRole('button', { name: 'Withdraw scheduled changes' }));
    const dialog = await screen.findByRole('dialog', { name: 'Withdraw scheduled changes?' });
    expect(within(dialog).getAllByRole('listitem')[0]).toHaveTextContent('New terms from the delivery on');
    let method = '';
    server.events.on('request:start', ({ request }) => {
      if (request.url.endsWith('/pending-changes')) method = request.method;
    });
    await user.click(within(dialog).getByRole('button', { name: 'Withdraw changes' }));
    expect(await screen.findByText('Done. The scheduled change has been withdrawn.')).toBeVisible();
    expect(method).toBe('DELETE');
    expect(screen.queryByRole('region', { name: 'Scheduled changes' })).toBeNull();
  });
});

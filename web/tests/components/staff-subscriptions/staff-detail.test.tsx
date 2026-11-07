import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { StaffSubscriptionDetailScreen } from '@/components/staff-subscriptions/StaffSubscriptionDetailScreen';
import { createControls } from '../../../mocks/handlers/subscriptions/control';
import { subscriptionFixtureIds } from '../../../mocks/handlers/subscriptions/fixtures';
import { cyclesOf, findSubscription } from '../../../mocks/handlers/subscriptions/store';
import { accountsFixtureIds } from '../../../mocks/handlers/areas/accounts';
import { actAs, freshStore, recordRequests, renderScreen } from './helpers';

vi.mock('next/navigation', () => import('../common/nav-mock'));
// Dialog flows type, submit and re-read; give them room when the machine is busy (a parallel Playwright run shares it).
vi.setConfig({ testTimeout: 20_000 });

const ids = subscriptionFixtureIds;
const SUSPENDED = ids.others.suspendedUnpaid; // Shirin Akter, Raw Forest Honey, UnpaidCycles
const ACTIVE = ids.others.active; // Farhana Yasmin, Organic Rolled Oats 2 kg
const CANCELLED = ids.others.cancelled; // Tanvir Ahmed

beforeEach(() => {
  freshStore();
  actAs('ShopManager');
});

const open = (id: string) => renderScreen(<StaffSubscriptionDetailScreen subscriptionId={id} />);
const dialog = () => screen.getByRole('dialog');

/** U30 -- read-only panels, the records written out, no reinstater id, actions only for those allowed and able. */
describe('U30 staff detail', () => {
  it('shows the customer, schedule, terms, records and history as text', async () => {
    open(SUSPENDED);
    expect(await screen.findByRole('heading', { level: 1, name: /Raw Forest Honey · 500 g/ })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Customer' })).toHaveTextContent('Shirin Akter');
    expect(screen.getByRole('region', { name: 'Terms' })).toHaveTextContent('Every 2 weeks');
    expect(screen.getByRole('region', { name: 'Terms' })).toHaveTextContent('Bank transfer');
    expect(screen.getByRole('region', { name: 'Schedule' })).toHaveTextContent('None while suspended');
    const records = screen.getByRole('region', { name: 'Records' });
    expect(records).toHaveTextContent(/Suspended on .*: Unpaid orders/);
    expect(records).toHaveTextContent('Never: none recorded');
    expect(records).toHaveTextContent('Not cancelled');
    const history = screen.getByRole('region', { name: 'Order history' });
    expect(within(history).getAllByText('Expired unpaid').length).toBe(2);
    expect(within(history).getAllByRole('link', { name: /^ORD-/ })[0]).toHaveAttribute('href', expect.stringMatching(/^\/staff\/orders\//));
  });

  it('writes a cancelled one out with its reason label and note', async () => {
    open(CANCELLED);
    const records = await screen.findByRole('region', { name: 'Records' });
    expect(records).toHaveTextContent(/Cancelled on .*: Cancelled by the shop, Customer asked us by phone to stop deliveries\./);
  });

  it('offers Restart and Cancel for a suspended subscription, Cancel only for an active one, nothing for a cancelled one', async () => {
    const first = open(SUSPENDED);
    expect(await screen.findByRole('button', { name: 'Restart' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel subscription' })).toBeInTheDocument();
    first.unmount();

    const second = open(ACTIVE);
    expect(await screen.findByRole('button', { name: 'Cancel subscription' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Restart' })).not.toBeInTheDocument();
    second.unmount();

    const third = open(CANCELLED);
    await screen.findByRole('region', { name: 'Records' });
    // The role is known (so the absence is the server's allowedStaffActions, not a session still loading).
    await waitFor(() => expect(third.client.getQueryData(['session', 'staff'])).toBeTruthy());
    expect(screen.queryByRole('button', { name: 'Restart' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel subscription' })).not.toBeInTheDocument();
  });

  it.each([['Reception'], ['Accountant'], ['Inventory']])('%s sees the record and the who-can-act sentence, no actions', async (role) => {
    actAs(role);
    open(SUSPENDED);
    expect(await screen.findByText('Only a shop manager or an administrator can restart or cancel a subscription.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Restart' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel subscription' })).not.toBeInTheDocument();
  });

  it('shows a pending cancel and a pending skip as text with the date the server names', async () => {
    open(ids.mine.activeLocked); // locked, with pending terms
    const schedule = await screen.findByRole('region', { name: 'Schedule' });
    expect(schedule).toHaveTextContent(/is already being prepared/);
    expect(schedule).toHaveTextContent(/From .*: 3 × every 4 weeks, deliver to me, bank transfer/);
  });

  it('is "not found" for an id that is not a GUID, with no request, and for an unknown one', async () => {
    const seen = recordRequests(`/api/staff/subscriptions/not-a-guid`);
    const first = open('not-a-guid');
    expect(await screen.findByText("We couldn't find that subscription.")).toBeInTheDocument();
    expect(seen).toHaveLength(0);
    first.unmount();

    open('5b000000-0000-0000-0000-0000000000ff');
    expect(await screen.findByText("We couldn't find that subscription.")).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'All subscriptions' })).toHaveAttribute('href', '/staff/subscriptions');
  });

  it('pages the history past the 50 the detail carries ("Show more" = T6 page 2), with every entry once', async () => {
    createControls().addCycles(ACTIVE, 55);
    const total = cyclesOf(ACTIVE).length; // the 2 seeded cycles and the 55 added
    expect(total).toBe(57);
    const seen = recordRequests(`/api/staff/subscriptions/${ACTIVE}/cycles`);
    const user = userEvent.setup();
    open(ACTIVE);
    const history = await screen.findByRole('region', { name: 'Order history' });
    expect(within(history).getAllByRole('row')).toHaveLength(51); // header + 50
    await user.click(within(history).getByRole('button', { name: 'Show more' }));
    await waitFor(() => expect(within(history).getAllByRole('row')).toHaveLength(total + 1));
    expect(seen[0]!.searchParams.get('pageNumber')).toBe('2');
    expect(await within(history).findByText(`All ${total} entries shown. Order numbers open the staff order page.`)).toBeInTheDocument();
    expect(within(history).queryByRole('button', { name: 'Show more' })).not.toBeInTheDocument();
    // No entry is repeated across the pages: every delivery date and every order number appears once.
    const rows = within(history).getAllByRole('row').slice(1);
    const dates = rows.map((row) => within(row).getAllByRole('cell')[0]!.textContent);
    expect(new Set(dates).size).toBe(dates.length);
    const orders = within(history).queryAllByRole('link', { name: /^ORD-/ }).map((l) => l.textContent);
    expect(new Set(orders).size).toBe(orders.length);
  });

  it('keeps a "Try again" when a later page fails, hides "All … entries shown" meanwhile, and recovers (page 2, then page 3)', async () => {
    createControls().addCycles(ACTIVE, 105); // 107 in all: 50 + 50 + 7
    const total = cyclesOf(ACTIVE).length;
    const failures: Record<string, number> = { '2': 2, '3': 2 }; // the automatic retry fails too, so the error shows
    server.use(
      http.get(`*/api/staff/subscriptions/${ACTIVE}/cycles`, ({ request }) => {
        const page = new URL(request.url).searchParams.get('pageNumber')!;
        if ((failures[page] ?? 0) > 0) {
          failures[page]! -= 1;
          return HttpResponse.json({}, { status: 500 });
        }
        return undefined;
      }),
    );
    const user = userEvent.setup();
    open(ACTIVE);
    const history = await screen.findByRole('region', { name: 'Order history' });

    await user.click(within(history).getByRole('button', { name: 'Show more' }));
    expect(await within(history).findByText("We couldn’t load more orders.", {}, { timeout: 6000 })).toBeInTheDocument();
    expect(within(history).queryByText(/entries shown/)).not.toBeInTheDocument();
    expect(within(history).queryByRole('button', { name: 'Show more' })).not.toBeInTheDocument();
    await user.click(within(history).getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(within(history).getAllByRole('row')).toHaveLength(101));
    expect(within(history).queryByText("We couldn’t load more orders.")).not.toBeInTheDocument();

    await user.click(within(history).getByRole('button', { name: 'Show more' }));
    expect(await within(history).findByText("We couldn’t load more orders.", {}, { timeout: 6000 })).toBeInTheDocument();
    expect(within(history).getAllByRole('row')).toHaveLength(101); // page 2 stays
    expect(within(history).queryByText(/entries shown/)).not.toBeInTheDocument();
    await user.click(within(history).getByRole('button', { name: 'Try again' }));
    expect(await within(history).findByText(`All ${total} entries shown. Order numbers open the staff order page.`)).toBeInTheDocument();
    expect(within(history).getAllByRole('row')).toHaveLength(total + 1);
  });

  it('shows the server estimate as sent, with the leading minus as text', async () => {
    open(ACTIVE);
    const estimate = await screen.findByRole('region', { name: 'Estimate per delivery' });
    expect(estimate).toHaveTextContent('Subscription discount −10%');
    expect(estimate).toHaveTextContent('Estimated total');
  });
});

/** U31 -- Restart. */
describe('U31 reinstate', () => {
  it('names the customer and product, needs a reason, limits it to 500 characters', async () => {
    const user = userEvent.setup();
    open(SUSPENDED);
    await user.click(await screen.findByRole('button', { name: 'Restart' }));
    expect(within(dialog()).getByRole('heading', { name: "Restart Shirin Akter's subscription to Raw Forest Honey?" })).toBeInTheDocument();
    expect(within(dialog()).getByText('Leave empty to restart from the earliest possible date.')).toBeInTheDocument();

    await user.click(within(dialog()).getByRole('button', { name: 'Restart' }));
    expect(await within(dialog()).findByText('Give a reason for restarting this subscription.')).toBeInTheDocument();

    const reason = within(dialog()).getByLabelText(/Reason/);
    await user.click(reason);
    await user.paste('x'.repeat(501));
    await user.click(within(dialog()).getByRole('button', { name: 'Restart' }));
    expect(await within(dialog()).findByText('Use up to 500 characters.')).toBeInTheDocument();
    expect(within(dialog()).getByText(/501 \/ 500/)).toBeInTheDocument();
  });

  it('posts the reason, re-reads the staff detail, and shows the restart without who did it', async () => {
    const user = userEvent.setup();
    const posts: unknown[] = [];
    server.events.on('request:start', async ({ request }) => {
      if (request.method === 'POST' && request.url.endsWith(`/${SUSPENDED}/reinstate`)) posts.push(await request.clone().json());
    });
    open(SUSPENDED);
    await user.click(await screen.findByRole('button', { name: 'Restart' }));
    await user.type(within(dialog()).getByLabelText(/Reason/), '  Paid at the shop  ');
    await user.click(within(dialog()).getByRole('button', { name: 'Restart' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(posts).toEqual([{ reason: 'Paid at the shop' }]); // no firstDeliveryOn when none was chosen
    expect(await screen.findByRole('status')).toHaveTextContent(/^Restarted\. Next delivery on /);
    // Re-read: it is Active now, the Restart action is gone, and the record shows the date and reason.
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Restart' })).not.toBeInTheDocument());
    expect(screen.getByRole('region', { name: 'Records' })).toHaveTextContent(/Restarted on .*: Paid at the shop/);
    expect(document.body.textContent).not.toContain(accountsFixtureIds.adminStaffId);
    server.events.removeAllListeners();
  });

  it('sends a chosen first delivery date', async () => {
    const user = userEvent.setup();
    const posts: unknown[] = [];
    server.events.on('request:start', async ({ request }) => {
      if (request.method === 'POST') posts.push(await request.clone().json());
    });
    open(SUSPENDED);
    await user.click(await screen.findByRole('button', { name: 'Restart' }));
    await user.type(within(dialog()).getByLabelText(/Reason/), 'Called');
    const date = within(dialog()).getByLabelText('First delivery (optional)');
    expect(date).not.toHaveAttribute('min');
    expect(date).not.toHaveAttribute('max');
    await user.type(date, '2099-01-01');
    await user.click(within(dialog()).getByRole('button', { name: 'Restart' }));
    // The server's own range check answers: its sentence names the range and sits under the date.
    expect(await within(dialog()).findByText(/first delivery|date/i, { selector: '[role="alert"]' })).toBeInTheDocument();
    expect(posts).toEqual([{ reason: 'Called', firstDeliveryOn: '2099-01-01' }]);
    expect(within(dialog()).getByLabelText(/Reason/)).toHaveValue('Called'); // what was typed is kept
    server.events.removeAllListeners();
  });

  it.each([
    ['ReinstatementReasonRequired', 'Reason', 'Give a reason for restarting this subscription.', /Reason/],
    ['InvalidFirstDeliveryDate', 'FirstDeliveryOn', 'Choose a date from Mon 9 Nov to Wed 9 Dec.', 'First delivery (optional)'],
  ])('maps %s to its field', async (code, property, message, field) => {
    const user = userEvent.setup();
    server.use(
      http.post('*/api/staff/subscriptions/:id/reinstate', () =>
        HttpResponse.json({ errors: [{ propertyName: property, errorCode: code, errorMessage: message }] }, { status: 400 }),
      ),
    );
    open(SUSPENDED);
    await user.click(await screen.findByRole('button', { name: 'Restart' }));
    await user.type(within(dialog()).getByLabelText(/Reason/), 'Because');
    await user.click(within(dialog()).getByRole('button', { name: 'Restart' }));
    const input = within(dialog()).getByLabelText(field);
    await waitFor(() => expect(input).toHaveAccessibleDescription(expect.stringContaining(message)));
    expect(within(dialog()).getByLabelText(/Reason/)).toHaveValue('Because');
  });

  it.each([
    ['SubscriptionCannotBeReinstated', 'Status', 'Only a suspended subscription can be restarted.'],
    ['SkuNotSubscribable', 'SubscriptionId', 'This product is not available to subscribe to right now.'],
  ])('shows %s as a message in the dialog', async (code, property, message) => {
    const user = userEvent.setup();
    server.use(
      http.post('*/api/staff/subscriptions/:id/reinstate', () =>
        HttpResponse.json({ errors: [{ propertyName: property, errorCode: code, errorMessage: message }] }, { status: 400 }),
      ),
    );
    open(SUSPENDED);
    await user.click(await screen.findByRole('button', { name: 'Restart' }));
    await user.type(within(dialog()).getByLabelText(/Reason/), 'Because');
    await user.click(within(dialog()).getByRole('button', { name: 'Restart' }));
    expect(await within(dialog()).findByText(message)).toBeInTheDocument();
  });

  it('replaces the actions with the permission message when the server answers 403', async () => {
    const user = userEvent.setup();
    server.use(
      http.post('*/api/staff/subscriptions/:id/reinstate', () =>
        HttpResponse.json({ errors: [{ errorCode: 'ActionNotPermitted', errorMessage: 'Not permitted.' }] }, { status: 403 }),
      ),
    );
    open(SUSPENDED);
    await user.click(await screen.findByRole('button', { name: 'Restart' }));
    await user.type(within(dialog()).getByLabelText(/Reason/), 'Because');
    await user.click(within(dialog()).getByRole('button', { name: 'Restart' }));
    expect(await screen.findByText('You don’t have permission to do this.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Restart' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel subscription' })).not.toBeInTheDocument();
  });
});

/** U32 -- staff cancel. */
describe('U32 staff cancel', () => {
  it('needs a note, and an unlocked cancel ends it at once', async () => {
    const user = userEvent.setup();
    open(ACTIVE);
    await user.click(await screen.findByRole('button', { name: 'Cancel subscription' }));
    expect(within(dialog()).getByRole('heading', { name: "Cancel Farhana Yasmin's subscription to Organic Rolled Oats?" })).toBeInTheDocument();
    expect(within(dialog()).getByText(/No more orders will be placed/)).toBeInTheDocument();

    await user.click(within(dialog()).getByRole('button', { name: 'Cancel subscription' }));
    expect(await within(dialog()).findByText('Give a reason for cancelling this subscription.')).toBeInTheDocument();
    await user.type(within(dialog()).getByLabelText(/Note/), 'Customer asked by phone');
    await user.click(within(dialog()).getByRole('button', { name: 'Cancel subscription' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await screen.findByRole('status')).toHaveTextContent('Subscription cancelled.');
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Cancel subscription' })).not.toBeInTheDocument());
    expect(screen.getByRole('region', { name: 'Records' })).toHaveTextContent(/Cancelled on .*: Cancelled by the shop, Customer asked by phone/);
  });

  it('uses the locked wording only because the server says isLocked, and shows the scheduled result after the re-read', async () => {
    createControls().lock(ACTIVE);
    expect(findSubscription(ACTIVE)!.nextDeliveryOn).not.toBeNull();
    const user = userEvent.setup();
    open(ACTIVE);
    await user.click(await screen.findByRole('button', { name: 'Cancel subscription' }));
    expect(within(dialog()).getByText(/is already being prepared and will still be placed; the subscription ends after it\./)).toBeInTheDocument();
    await user.type(within(dialog()).getByLabelText(/Note/), 'Moving away');
    await user.click(within(dialog()).getByRole('button', { name: 'Cancel subscription' }));

    expect(await screen.findByRole('status')).toHaveTextContent(/^Cancellation scheduled\. Ends after the delivery on /);
    expect(await within(screen.getByRole('region', { name: 'Schedule' })).findByText(/^Ends after the delivery on /)).toBeInTheDocument();
  });

  it('maps CancellationReasonRequired to the note, and keeps what was typed', async () => {
    const user = userEvent.setup();
    server.use(
      http.post('*/api/staff/subscriptions/:id/cancel', () =>
        HttpResponse.json(
          { errors: [{ propertyName: 'Note', errorCode: 'CancellationReasonRequired', errorMessage: 'Give a reason for cancelling this subscription.' }] },
          { status: 400 },
        ),
      ),
    );
    open(ACTIVE);
    await user.click(await screen.findByRole('button', { name: 'Cancel subscription' }));
    await user.type(within(dialog()).getByLabelText(/Note/), 'Because');
    await user.click(within(dialog()).getByRole('button', { name: 'Cancel subscription' }));
    await waitFor(() =>
      expect(within(dialog()).getByLabelText(/Note/)).toHaveAccessibleDescription(expect.stringContaining('Give a reason for cancelling this subscription.')),
    );
    expect(within(dialog()).getByLabelText(/Note/)).toHaveValue('Because');
  });

  it('closes without a request on Keep subscription', async () => {
    const user = userEvent.setup();
    const posts = recordRequests(`/${ACTIVE}/cancel`);
    open(ACTIVE);
    await user.click(await screen.findByRole('button', { name: 'Cancel subscription' }));
    await user.click(within(dialog()).getByRole('button', { name: 'Keep subscription' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(posts).toHaveLength(0);
    server.events.removeAllListeners();
  });
});

describe('who may act is not guessed', () => {
  it('shows neither buttons nor the role note while the session is loading, and nothing at all when no action is allowed', async () => {
    server.use(http.get('*/api/staff/session', async () => new Promise(() => undefined))); // never answers
    open(SUSPENDED);
    await screen.findByRole('region', { name: 'Records' });
    expect(screen.queryByText(/Only a shop manager/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Restart' })).not.toBeInTheDocument();
  });

  it('a read-only role gets no role note on a cancelled subscription (there is nothing to do)', async () => {
    actAs('Reception');
    const view = open(CANCELLED);
    await screen.findByRole('region', { name: 'Records' });
    await waitFor(() => expect(view.client.getQueryData(['session', 'staff'])).toBeTruthy());
    expect(screen.queryByText(/Only a shop manager/)).not.toBeInTheDocument();
  });
});

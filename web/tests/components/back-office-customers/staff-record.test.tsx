import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { resetReportsMockData } from '@/mocks/handlers/reports';
import { CustomerProfileView } from '@/components/back-office-overview/CustomerProfileView';
import { renderWithClient } from '../reports/helpers';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/staff/customers',
  useSearchParams: () => new URLSearchParams(),
}));

const SESSION = (roleIds: string[]) => ({
  staffAccountId: 'staff-1',
  fullName: 'Rahim Uddin',
  roleIds,
  issuedOn: '2026-10-14T00:00:00Z',
  lastActivityOn: '2026-10-14T00:00:00Z',
  idleExpiresOn: '2026-10-14T01:00:00Z',
  absoluteExpiresOn: '2026-10-14T09:00:00Z',
  idleTimeoutMinutes: 30,
  serverTime: '2026-10-14T00:00:00Z',
});

const DETAIL = {
  id: 'c1',
  fullName: 'Nusrat Jahan',
  mobileNumber: '01711000001',
  emailAddress: 'nusrat@example.com',
  recordStatus: 'Complete',
  registrationChannel: 'Reception',
  status: 'Active',
  mergedIntoCustomerId: null,
  customerSince: '2026-03-14T09:30:00Z',
  area: 'Dhanmondi',
  orderCount: 7,
  lifetimeSpend: { amount: '12500.00', currencyCode: 'BDT' },
  tags: ['Regular'],
  noteCount: 2,
};

beforeEach(() => {
  resetReportsMockData();
  server.use(
    http.get('*/api/staff/session', () => HttpResponse.json(SESSION(['Reception']))),
    http.get('*/api/staff/customers/c1', () => HttpResponse.json(DETAIL)),
  );
});

describe('Customer notes — U39 (HO-P5 §11.5.4, BG-19)', () => {
  const NOTES = [
    {
      id: 'n2',
      text: '<img src=x onerror=alert(1)> **call first**\nsecond line',
      authorStaffId: 's1',
      authorName: 'Nadia Karim',
      createdOn: '2026-10-21T10:00:00Z',
    },
    { id: 'n1', text: 'Prefers delivery after 5pm.', authorStaffId: 's2', authorName: null, createdOn: '2026-10-20T09:15:00Z' },
  ];

  it('lists the notes as the server sends them (newest first) with author and time, and renders note text literally', async () => {
    server.use(http.get('*/api/staff/customers/c1/notes', () => HttpResponse.json(NOTES)));
    renderWithClient(<CustomerProfileView customerId="c1" headingLevel={2} />);
    await userEvent.click(await screen.findByRole('tab', { name: 'Notes (2)' }));

    const list = await screen.findByRole('list', { name: 'Notes' });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    // Markup in a note is shown as typed, never parsed: there is no image, and the line break is kept as text.
    expect(items[0]).toHaveTextContent('<img src=x onerror=alert(1)> **call first**');
    expect(list.querySelector('img')).toBeNull();
    expect(items[0]).toHaveTextContent('Nadia Karim · 21 Oct 2026');
    expect(items[0]).toHaveTextContent('(Asia/Dhaka)');
    // A note whose author's account is gone still reads sensibly.
    expect(items[1]).toHaveTextContent('A former colleague');
  });

  it('adds a note (<= 1000, with a counter) and refetches the list after the 201', async () => {
    const stored = [...NOTES];
    let posted: unknown = null;
    server.use(
      http.get('*/api/staff/customers/c1/notes', () => HttpResponse.json(stored)),
      http.post('*/api/staff/customers/c1/notes', async ({ request }) => {
        posted = await request.json();
        stored.unshift({
          id: 'n3',
          text: (posted as { text: string }).text,
          authorStaffId: 'staff-1',
          authorName: 'Rahim Uddin',
          createdOn: '2026-10-22T08:00:00Z',
        });
        return HttpResponse.json({ noteId: 'n3' }, { status: 201 });
      }),
    );
    renderWithClient(<CustomerProfileView customerId="c1" headingLevel={2} />);
    await userEvent.click(await screen.findByRole('tab', { name: 'Notes (2)' }));

    const box = await screen.findByLabelText('Add a note');
    expect(box).toHaveAttribute('maxlength', '1000');
    expect(screen.getByRole('button', { name: 'Add note' })).toBeDisabled();
    await userEvent.type(box, 'Call the guard');
    expect(screen.getByText('14 / 1000')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Add note' }));

    await waitFor(() => expect(posted).toEqual({ text: 'Call the guard' }));
    expect(await screen.findByText('Call the guard')).toBeInTheDocument();
    expect(box).toHaveValue('');
    expect(within(screen.getByRole('list', { name: 'Notes' })).getAllByRole('listitem')).toHaveLength(3);
  });

  it('shows the server\'s message when it refuses a note, and keeps what was typed', async () => {
    server.use(
      http.get('*/api/staff/customers/c1/notes', () => HttpResponse.json([])),
      http.post('*/api/staff/customers/c1/notes', () =>
        HttpResponse.json(
          {
            isValid: false,
            errors: [
              {
                propertyName: 'Text',
                errorCode: 'CustomerNoteLimitExceeded',
                errorMessage: 'No more than 200 notes are kept on one customer.',
                resourceName: 'CustomerStaffRecordAggregate',
              },
            ],
          },
          { status: 400 },
        ),
      ),
    );
    renderWithClient(<CustomerProfileView customerId="c1" headingLevel={2} />);
    await userEvent.click(await screen.findByRole('tab', { name: 'Notes (2)' }));
    await userEvent.type(await screen.findByLabelText('Add a note'), 'One more');
    await userEvent.click(screen.getByRole('button', { name: 'Add note' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No more than 200 notes are kept on one customer.');
    expect(screen.getByLabelText('Add a note')).toHaveValue('One more');
  });
});

describe('Customer tags — U40 (HO-P5 §11.5.4, BG-19)', () => {
  it('enforces at most 10 tags of at most 30 characters, sends the whole set, and shows the set the server stored', async () => {
    let sent: unknown = null;
    server.use(
      http.put('*/api/staff/customers/c1/tags', async ({ request }) => {
        sent = await request.json();
        // The stored set is the server's, and it can differ from what was sent (here a colleague added "VIP" meanwhile).
        return HttpResponse.json({ tags: ['Regular', 'Wholesale', 'VIP'] });
      }),
    );
    renderWithClient(<CustomerProfileView customerId="c1" headingLevel={2} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Edit tags' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit tags' });

    const input = within(dialog).getByLabelText('Add a tag');
    expect(input).toHaveAttribute('maxlength', '30');
    await userEvent.type(input, '  Wholesale {Enter}');
    await userEvent.type(input, 'wholesale{Enter}');
    expect(within(dialog).getByRole('alert')).toHaveTextContent('“wholesale” is already a tag.');
    expect(within(dialog).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Regular', 'Wholesale']);
    // A refused tag stays in the box to be corrected.
    expect(input).toHaveValue('wholesale');
    await userEvent.clear(input);

    // Fill to the limit of ten; the eleventh is refused on screen, before any request.
    for (let n = 1; n <= 8; n += 1) await userEvent.type(input, `Tag ${n}{Enter}`);
    expect(within(dialog).getByText('10 of 10 tags · up to 30 characters each')).toBeInTheDocument();
    await userEvent.type(input, 'Eleventh{Enter}');
    expect(within(dialog).getByRole('alert')).toHaveTextContent('A customer can have up to 10 tags.');
    expect(sent).toBeNull();

    // The refused eleventh stays typed in the box, and would be saved with the set: clear it, then remove down and save.
    await userEvent.clear(input);
    // Remove down to what the test wants stored, then save.
    for (let n = 1; n <= 8; n += 1) {
      await userEvent.click(within(dialog).getByRole('button', { name: `Remove tag Tag ${n}` }));
    }
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save tags' }));
    await waitFor(() => expect(sent).toEqual({ tags: ['Regular', 'Wholesale'] }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    // The chips show the server's returned set, not the draft that was sent.
    expect(within(screen.getByRole('list', { name: 'Tags' })).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Regular', 'Wholesale', 'VIP']);
  });

  it('a tag typed but not added is saved with the set, and a bad one blocks the save with a message', async () => {
    let sent: unknown = null;
    server.use(
      http.put('*/api/staff/customers/c1/tags', async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json({ tags: (sent as { tags: string[] }).tags });
      }),
    );
    renderWithClient(<CustomerProfileView customerId="c1" headingLevel={2} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Edit tags' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit tags' });
    // A duplicate typed and left in the box blocks the save, with a reason.
    await userEvent.type(within(dialog).getByLabelText('Add a tag'), 'regular');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save tags' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('“regular” is already a tag.');
    expect(sent).toBeNull();
    // A new one typed and left in the box is part of the save.
    await userEvent.clear(within(dialog).getByLabelText('Add a tag'));
    await userEvent.type(within(dialog).getByLabelText('Add a tag'), 'Gift');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save tags' }));
    await waitFor(() => expect(sent).toEqual({ tags: ['Regular', 'Gift'] }));
  });

  it('shows the server\'s message when it refuses the set, and the dialog stays open', async () => {
    server.use(
      http.put('*/api/staff/customers/c1/tags', () =>
        HttpResponse.json(
          {
            isValid: false,
            errors: [
              {
                propertyName: 'Tags',
                errorCode: 'InvalidCustomerTag',
                errorMessage: 'A tag must be between 1 and 30 characters.',
                resourceName: 'CustomerStaffRecordAggregate',
              },
            ],
          },
          { status: 400 },
        ),
      ),
    );
    renderWithClient(<CustomerProfileView customerId="c1" headingLevel={2} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Edit tags' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit tags' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save tags' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('A tag must be between 1 and 30 characters.');
  });
});

describe('Staff-started password reset — U41 (HO-P5 §11.5.4, BG-19)', () => {
  it('confirms where it goes, then reports only the channel, the masked destination and the expiry; never a token', async () => {
    let calls = 0;
    server.use(
      http.post('*/api/staff/customers/c1/password-reset', () => {
        calls += 1;
        return HttpResponse.json({ channel: 'Mobile', maskedDestination: '***001', expiresOn: '2026-10-22T08:15:00Z' });
      }),
    );
    renderWithClient(<CustomerProfileView customerId="c1" headingLevel={2} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Send password reset' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Send a password reset link to Nusrat Jahan? It goes to their own mobile or email.');
    expect(calls).toBe(0);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Send reset link' }));

    const result = await screen.findByText(/Reset link sent by mobile to \*\*\*001\./);
    expect(result).toHaveTextContent('It expires at 14:15 (Asia/Dhaka).');
    // The destination is the masked one, not the customer's number, and nothing resembling a token or link is shown.
    expect(result.textContent).not.toContain('01711000001');
    expect(document.body.textContent).not.toMatch(/token|https?:\/\/\S*reset/i);
    expect(calls).toBe(1);
  });

  it('a 403 shows the permission message', async () => {
    server.use(
      http.post('*/api/staff/customers/c1/password-reset', () =>
        HttpResponse.json(
          { errors: [{ errorCode: 'ActionNotPermitted', errorMessage: 'You are not permitted to perform this action.' }] },
          { status: 403 },
        ),
      ),
    );
    renderWithClient(<CustomerProfileView customerId="c1" headingLevel={2} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Send password reset' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Send reset link' }));
    expect(await screen.findByText(/You don't have permission to do this/)).toBeInTheDocument();
  });
});

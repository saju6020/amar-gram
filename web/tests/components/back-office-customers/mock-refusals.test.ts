import { beforeEach, describe, expect, it } from 'vitest';
import { apiFetch, ApiError, ApiForbiddenError, ApiValidationError } from '@/lib/api/client';
import {
  addCustomerNote,
  browseCustomers,
  getCustomerNotes,
  getStaffCustomer,
  requestCustomerPasswordReset,
  setCustomerTags,
} from '@/lib/api/staff-customers';
import { getStaffAccounts } from '@/lib/api/staff-admin';
import {
  accountsFixtureIds as ids,
  resetAccountsMockData,
  setMockStaffLockedUntil,
} from '../../../mocks/handlers/areas/accounts';
import '../../../mocks/handlers/admin/branches';

/**
 * HO-P5 S4 — U47 (§15) for the accounts mock: one case per refusal this slice added to the customers, notes, tags,
 * password-reset and staff-list handlers, so the mock answers as the real server does. Each `describe` names the server
 * file and line it mirrors. The mock reads the staff session from the cookie its own sign-in writes, so a case signs in first.
 */
async function signIn(identifier: string, password: string): Promise<void> {
  await apiFetch('/api/staff/auth/sign-in', { method: 'POST', body: { identifier, password } });
}
const asAdministrator = () => signIn(ids.adminIdentifier, ids.adminPassword);
const asReception = () => signIn(ids.stockIdentifier, ids.stockPassword);
const asInventory = () => signIn(ids.inventoryIdentifier, ids.inventoryPassword);

beforeEach(() => {
  resetAccountsMockData();
});

async function failureOf(run: () => Promise<unknown>): Promise<unknown> {
  try {
    await run();
  } catch (error) {
    return error;
  }
  throw new Error('expected the request to be refused');
}

async function violationOf(run: () => Promise<unknown>) {
  const error = await failureOf(run);
  expect(error).toBeInstanceOf(ApiValidationError);
  return (error as ApiValidationError).response.errors[0]!;
}

async function statusOf(run: () => Promise<unknown>): Promise<number> {
  const error = await failureOf(run);
  expect(error).toBeInstanceOf(ApiError);
  return (error as ApiError).status;
}

describe('GET /api/staff/customers/browse — StaffCustomersController.cs:52-74, BrowseCustomersQueryHandler.cs:17-71', () => {
  it('refuses the four bad inputs with a bare 400, in the controller\'s order', async () => {
    await asReception();
    // The client clamps pageNumber and pageSize, so go round it for the server's own caps.
    expect(await statusOf(() => apiFetch('/api/staff/customers/browse?pageNumber=1000001'))).toBe(400);
    expect(await statusOf(() => apiFetch('/api/staff/customers/browse?pageSize=101'))).toBe(400);
    expect(await statusOf(() => apiFetch('/api/staff/customers/browse?sort=oldest'))).toBe(400);
    expect(await statusOf(() => browseCustomers({ search: 'x'.repeat(101) }))).toBe(400);
    expect(await statusOf(() => browseCustomers({ tag: 'x'.repeat(101) }))).toBe(400);
    // Exactly at the limits is fine.
    await expect(browseCustomers({ search: 'x'.repeat(100), pageSize: 100 })).resolves.toMatchObject({ pageSize: 100 });
  });

  it('needs Customers.View: Inventory is refused with a 403', async () => {
    await asInventory();
    expect(await failureOf(() => browseCustomers())).toBeInstanceOf(ApiForbiddenError);
  });

  it('lists only active customers; "Rahman" matches a name, an "@" term matches an email, digits match a mobile only when the term is phone-like', async () => {
    await asReception();
    const everyone = await browseCustomers({ pageSize: 100 });
    // A merged record is not one staff browse to.
    expect(everyone.items.some((c) => c.id === ids.mergeAlreadyMergedId)).toBe(false);
    expect(everyone.items.every((c) => c.status === 'Active')).toBe(true);

    expect((await browseCustomers({ search: 'rahman' })).items.map((c) => c.fullName)).toEqual(['Sam Rahman']);
    expect((await browseCustomers({ search: 'signed-in-customer@' })).items.map((c) => c.fullName)).toEqual(['Sam Rahman']);
    // A phone-like term of three or more digits matches mobiles.
    expect((await browseCustomers({ search: '01799' })).items.map((c) => c.fullName)).toEqual(['Sam Rahman']);
    // Two digits are too few to be a mobile search, and "Sam 99" is not phone-like.
    expect((await browseCustomers({ search: '99' })).items).toHaveLength(0);
    expect((await browseCustomers({ search: 'Sam 99' })).items).toHaveLength(0);
  });

  it('filters by one tag exactly, sorts by recent (default) or name, and pages', async () => {
    await asReception();
    expect((await browseCustomers({ tag: 'Regular' })).items.map((c) => c.fullName)).toEqual(['Sam Rahman']);
    expect((await browseCustomers({ tag: 'regular' })).items).toHaveLength(0);

    const byName = await browseCustomers({ sort: 'name', pageSize: 100 });
    const names = byName.items.map((c) => c.fullName);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));

    const first = await browseCustomers({ sort: 'name', pageSize: 3 });
    const second = await browseCustomers({ sort: 'name', pageSize: 3, pageNumber: 2 });
    expect(first.items).toHaveLength(3);
    expect(first.totalCount).toBe(byName.totalCount);
    expect(second.items[0]!.id).toBe(byName.items[3]!.id);
  });
});

describe('GET /api/staff/customers/{id} — StaffCustomerViewModel.cs:11-13', () => {
  it('carries the summary: since, area, order count, lifetime spend as a money string, tags and note count', async () => {
    await asReception();
    const customer = await getStaffCustomer(ids.customerId);
    expect(customer).toMatchObject({
      area: 'Dhanmondi',
      orderCount: 3,
      lifetimeSpend: { amount: '4250.00', currencyCode: 'BDT' },
      tags: ['Regular'],
      noteCount: 1,
    });
    expect(Number.isNaN(Date.parse(customer.customerSince))).toBe(false);
  });
});

describe('Customer notes — StaffCustomersController.cs:92-129, CustomerStaffRecordAggregate.cs:35-53', () => {
  it('reads newest first with the author as he is now, and an unknown customer reads as an empty list', async () => {
    await asAdministrator();
    await addCustomerNote(ids.customerId, 'Second note');
    const notes = await getCustomerNotes(ids.customerId);
    expect(notes.map((n) => n.text)).toEqual(['Second note', 'Prefers delivery after 5pm. Call the guard at the gate.']);
    expect(notes[0]!.authorName).toBe('Ada Administrator');
    expect(notes[1]!.authorName).toBe('Nadia Karim');
    expect(await getCustomerNotes('c0000000-0000-0000-0000-00000000dead')).toEqual([]);
  });

  it('refuses an empty or blank note (NotEmptyValidator on Text), a note over 2000 (MaximumLengthValidator), and one over 1000 after trimming (InvalidCustomerNote)', async () => {
    await asReception();
    for (const text of ['', '   ']) {
      const refusal = await violationOf(() => addCustomerNote(ids.customerId, text));
      expect(refusal).toMatchObject({ errorCode: 'NotEmptyValidator', propertyName: 'Text' });
    }
    expect(await violationOf(() => addCustomerNote(ids.customerId, 'x'.repeat(2001)))).toMatchObject({
      errorCode: 'MaximumLengthValidator',
      propertyName: 'Text',
    });
    expect(await violationOf(() => addCustomerNote(ids.customerId, 'x'.repeat(1001)))).toMatchObject({
      errorCode: 'InvalidCustomerNote',
      propertyName: 'Text',
    });
    // Padding does not count: 1000 characters plus spaces is a note of 1000.
    await expect(addCustomerNote(ids.customerId, ` ${'x'.repeat(1000)} `)).resolves.toHaveProperty('noteId');
    const stored = (await getCustomerNotes(ids.customerId))[0]!;
    expect(stored.text).toHaveLength(1000);
  });

  it('keeps at most 200 notes per customer (CustomerNoteLimitExceeded), and refuses a missing or inactive customer with a 400 on CustomerId, not a 404', async () => {
    await asAdministrator();
    for (let n = 1; n < 200; n += 1) await addCustomerNote(ids.customerId, `Note ${n}`);
    expect((await getCustomerNotes(ids.customerId)).length).toBe(200);
    expect(await violationOf(() => addCustomerNote(ids.customerId, 'One too many'))).toMatchObject({
      errorCode: 'CustomerNoteLimitExceeded',
      propertyName: 'Text',
    });
    expect(await violationOf(() => addCustomerNote('c0000000-0000-0000-0000-00000000dead', 'Hi'))).toMatchObject({
      errorCode: 'CustomerNotFound',
      propertyName: 'CustomerId',
    });
    expect(await violationOf(() => addCustomerNote(ids.mergeAlreadyMergedId, 'Hi'))).toMatchObject({
      errorCode: 'AccountNotActive',
      propertyName: 'CustomerId',
    });
  });

  it('needs Customers.AddNote: Inventory gets a 403, and the note is not written', async () => {
    await asInventory();
    expect(await failureOf(() => addCustomerNote(ids.customerId, 'Hi'))).toBeInstanceOf(ApiForbiddenError);
    await asReception();
    expect((await getCustomerNotes(ids.customerId)).length).toBe(1);
  });
});

describe('Customer tags — StaffCustomersController.cs:131-146, CustomerStaffRecordAggregate.cs:55-86', () => {
  it('trims, de-duplicates without regard to case keeping the first spelling, and answers with the set as stored', async () => {
    await asReception();
    const result = await setCustomerTags(ids.customerId, ['  VIP ', 'vip', 'Wholesale', 'VIP']);
    expect(result.tags).toEqual(['VIP', 'Wholesale']);
    expect((await getStaffCustomer(ids.customerId)).tags).toEqual(['VIP', 'Wholesale']);
    // The empty set clears them.
    expect((await setCustomerTags(ids.customerId, [])).tags).toEqual([]);
  });

  it('refuses a blank tag or one over 30 characters (InvalidCustomerTag), more than 10 (CustomerTagLimitExceeded) and more than 50 sent (PredicateValidator), all on Tags', async () => {
    await asReception();
    expect(await violationOf(() => setCustomerTags(ids.customerId, ['ok', '  ']))).toMatchObject({ errorCode: 'InvalidCustomerTag', propertyName: 'Tags' });
    expect(await violationOf(() => setCustomerTags(ids.customerId, ['x'.repeat(31)]))).toMatchObject({ errorCode: 'InvalidCustomerTag', propertyName: 'Tags' });
    await expect(setCustomerTags(ids.customerId, ['x'.repeat(30)])).resolves.toBeTruthy();
    const eleven = Array.from({ length: 11 }, (_, n) => `tag${n}`);
    expect(await violationOf(() => setCustomerTags(ids.customerId, eleven))).toMatchObject({ errorCode: 'CustomerTagLimitExceeded', propertyName: 'Tags' });
    // Duplicates collapse before the count, so eleven spellings of ten tags is fine.
    await expect(setCustomerTags(ids.customerId, [...eleven.slice(0, 10), 'TAG0'])).resolves.toBeTruthy();
    const fiftyOne = Array.from({ length: 51 }, (_, n) => `t${n}`);
    expect(await violationOf(() => setCustomerTags(ids.customerId, fiftyOne))).toMatchObject({ errorCode: 'PredicateValidator', propertyName: 'Tags' });
    // A refused set changes nothing.
    expect((await getStaffCustomer(ids.customerId)).tags).toHaveLength(10);
  });

  it('needs Customers.SetTags (403 for Inventory) and an active customer (400 AccountNotActive)', async () => {
    await asInventory();
    expect(await failureOf(() => setCustomerTags(ids.customerId, ['a']))).toBeInstanceOf(ApiForbiddenError);
    await asReception();
    expect(await violationOf(() => setCustomerTags(ids.mergeAlreadyMergedId, ['a']))).toMatchObject({ errorCode: 'AccountNotActive' });
  });
});

describe('POST …/password-reset — StaffCustomersController.cs:148-161, RequestCustomerPasswordResetCommandHandler.cs:34-80, IdentifierMasking.cs', () => {
  it('goes to the customer\'s own mobile, masked as the server masks it, and expires in 15 minutes; no token is returned', async () => {
    await asReception();
    const before = Date.now();
    const result = await requestCustomerPasswordReset(ids.customerId);
    expect(result.channel).toBe('Mobile');
    expect(result.maskedDestination).toBe('***999');
    expect(Object.keys(result).sort()).toEqual(['channel', 'expiresOn', 'maskedDestination']);
    const minutes = (Date.parse(result.expiresOn) - before) / 60_000;
    expect(minutes).toBeGreaterThan(14.9);
    expect(minutes).toBeLessThan(15.1);
  });

  it('falls back to email, masked to the first letter and the domain', async () => {
    await asReception();
    // "Email Only Customer" has no mobile number.
    const emailOnly = (await browseCustomers({ search: 'existing-email-only@' })).items[0]!;
    const result = await requestCustomerPasswordReset(emailOnly.id);
    expect(result).toMatchObject({ channel: 'Email', maskedDestination: 'e***@example.com' });
  });

  it('needs Customers.RequestPasswordReset (403 for Inventory), and an active customer (400 CustomerNotFound / AccountNotActive on CustomerId)', async () => {
    await asInventory();
    expect(await failureOf(() => requestCustomerPasswordReset(ids.customerId))).toBeInstanceOf(ApiForbiddenError);
    await asReception();
    expect(await violationOf(() => requestCustomerPasswordReset('c0000000-0000-0000-0000-00000000dead'))).toMatchObject({
      errorCode: 'CustomerNotFound',
      propertyName: 'CustomerId',
    });
    expect(await violationOf(() => requestCustomerPasswordReset(ids.mergeAlreadyMergedId))).toMatchObject({
      errorCode: 'AccountNotActive',
      propertyName: 'CustomerId',
    });
  });
});

describe('GET /api/staff-accounts — StaffAccountSummaryViewModel.cs, StaffAccountStatusRules.cs:11-15, GetStaffAccountsQueryHandler.cs:36-72', () => {
  it('derives the status on the server: no password is NotSetUp, a running lockout is Locked, otherwise Active', async () => {
    await asAdministrator();
    const find = async (id: string) => (await getStaffAccounts({ pageSize: 100 })).items.find((s) => s.id === id)!;
    expect((await find(ids.adminStaffId)).status).toBe('Active');
    expect((await find(ids.noPasswordStaffId)).status).toBe('NotSetUp');
    setMockStaffLockedUntil(ids.stockStaffId, new Date(Date.now() + 10 * 60_000).toISOString());
    expect((await find(ids.stockStaffId)).status).toBe('Locked');
    // An expired lockout is no lockout.
    setMockStaffLockedUntil(ids.stockStaffId, new Date(Date.now() - 60_000).toISOString());
    expect((await find(ids.stockStaffId)).status).toBe('Active');
  });

  it('lists the assigned branches, the primary first then by name, and none for a person with no assignment', async () => {
    await asAdministrator();
    const items = (await getStaffAccounts({ pageSize: 100 })).items;
    const admin = items.find((s) => s.id === ids.adminStaffId)!;
    expect(admin.branches.map((b) => [b.name, b.isPrimary])).toEqual([
      ['Dhanmondi outlet', true],
      ['London outlet', false],
    ]);
    expect(items.find((s) => s.id === ids.inventoryStaffId)!.branches).toEqual([]);
  });
});

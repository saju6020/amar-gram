import type { Page } from '@playwright/test';
import { test, expect as baseExpect, signInAsStaff } from './fixtures';
import { control } from './ordering-helpers';
import { expectAxeClean } from './reports-helpers';
import { orderingIds as ids } from '../../mocks/handlers/ordering/fixtures';

const expect = baseExpect.configure({ timeout: 20_000 });
// One retry: a cold route compile can lose the MSW service-worker race on the first request (fixtures.ts).
test.describe.configure({ timeout: 120_000, retries: 1 });

/**
 * HO-ORD-002 §16 staff E-series on MSW: fulfilment (E-B1 staff half), bank transfers (E-C1, E-C3),
 * returns and refunds (E-D2, E-D3, with no restock step - HO-ORD-001 gate fix 3), pick list and manifest
 * (E-E1, E-E2) and the administration screens. Each test starts from a freshly reset mock.
 */
const O = ids.orders;

async function start(page: Page) {
  await page.goto('/staff/sign-in');
  await control(page, 'reset');
  await signInAsStaff(page);
}

test.describe('fulfilment (US-ORD-09 to US-ORD-11, US-ORD-20)', () => {
  test('E7: on desktop, select an order in the list, tick the pick list, Start packing enables', async ({ page }) => {
    await start(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/staff/orders');
    await page.getByRole('button', { name: 'ORD-2026-000104', exact: true }).click();
    await expect(page).toHaveURL(/[?&]order=/);
    const panel = page.getByRole('region', { name: 'Selected order' });
    await expect(panel.getByRole('heading', { name: 'Order ORD-2026-000104' })).toBeVisible();
    const pickList = panel.getByRole('list', { name: 'Pick list' });
    await expect(pickList).toBeVisible();
    const startPacking = panel.getByRole('button', { name: 'Start packing' });
    await expect(startPacking).toBeDisabled();
    for (const box of await pickList.getByRole('checkbox').all()) await box.check();
    await expect(startPacking).toBeEnabled();
    // The selection is the URL's, so a reload keeps it.
    await page.reload();
    await expect(page.getByRole('region', { name: 'Selected order' }).getByRole('heading', { name: 'Order ORD-2026-000104' })).toBeVisible();
    // Below 1024 px the row links to the full order page instead.
    await page.setViewportSize({ width: 800, height: 900 });
    await page.goto('/staff/orders');
    await page.getByRole('link', { name: 'ORD-2026-000104' }).click();
    await expect(page).toHaveURL(/\/staff\/orders\/f0000000-0000-0000-0000-000000000104$/);
  });

  test('E8: the status pills carry the server counts, a Packed pill filters, and a row shows its area and slot', async ({ page }) => {
    await start(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/staff/orders');
    const pills = page.getByRole('tablist', { name: 'Order status' });
    // The pill's name is its label, then the server's count and noun ("Packed, 1 order").
    await expect(pills.getByRole('tab', { name: /^All\s*,\s*\d+ orders?$/ })).toBeVisible();
    await expect(pills.getByRole('tab', { name: /^Packed\s*,\s*1 order$/ })).toBeVisible();
    await pills.getByRole('tab', { name: /^Packed\s*,\s*1 order$/ }).click();
    await expect(page).toHaveURL(/[?&]status=Packed/);
    const table = page.getByRole('table', { name: 'Orders' });
    await expect(table.getByRole('row')).toHaveCount(2); // the header and the one seeded Packed order
    // A delivery row names its area and its slot (BG-3).
    await expect(table.getByRole('row').nth(1)).toContainText('Dhaka');
    await expect(table.getByRole('row').nth(1)).toContainText(/· 10:00-13:00/);
  });

  test('E8: a pick-list tick is the server’s - it survives a reload', async ({ page }) => {
    await start(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/staff/orders?order=${O.confirmedCod}`);
    const panel = page.getByRole('region', { name: 'Selected order' });
    const boxes = panel.getByRole('list', { name: 'Pick list' }).getByRole('checkbox');
    await expect(boxes.first()).not.toBeChecked();
    await boxes.first().check();
    await expect(boxes.first()).toBeChecked();
    // Give the write time to land, then read the order afresh.
    await expect.poll(async () => page.evaluate(async (id) => (await (await fetch(`/api/staff/orders/${id}`)).json()).lines[0].picked, O.confirmedCod)).toBe(true);
    await page.reload();
    await expect(panel.getByRole('list', { name: 'Pick list' }).getByRole('checkbox').first()).toBeChecked();
  });

  test('E8: Mark packed, then dispatch to a rider - the shipment shows the rider and the order page has no tracking action', async ({ page }) => {
    await start(page);
    await page.goto(`/staff/orders/${O.confirmedCod}`);
    await page.getByRole('button', { name: 'Start packing' }).click();
    const actions = page.getByRole('group', { name: 'Order actions' });
    await actions.getByRole('button', { name: 'Mark packed' }).click();
    await expect(actions.getByRole('button', { name: 'Mark packed' })).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 1, name: 'Order ORD-2026-000104' })).toBeVisible();
    await expect(page.getByText('Packed').first()).toBeVisible();

    await actions.getByRole('button', { name: 'Dispatch' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('radio', { name: 'Rider' }).check({ force: true });
    await dialog.getByLabel('Which rider').selectOption({ label: 'Rafiq Hasan' });
    await expect(dialog.getByLabel('Tracking number')).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Dispatch' }).click();
    const shipment = page.getByRole('region', { name: 'Shipment' });
    await expect(shipment).toContainText('Rider');
    await expect(shipment).toContainText('Rafiq Hasan');
    await expect(shipment.getByRole('button')).toHaveCount(0);
  });

  test('the riders page adds a rider and refuses a name already used', async ({ page }) => {
    await start(page);
    await page.goto('/staff/fulfilment/riders');
    await expect(page.getByRole('heading', { level: 1, name: 'Riders' })).toBeVisible();
    // A table from 768 px, stacked cards below it: read the page's main region either way.
    const main = page.locator('#main-content');
    await expect(main).toContainText('Jahid Alam');
    // UI-6: the registry is axe-clean, with the list and then with the dialog open.
    await expectAxeClean(page);
    await page.getByRole('button', { name: 'Add rider' }).click();
    const dialog = page.getByRole('dialog', { name: 'Add a rider' });
    await expectAxeClean(page);
    await dialog.getByLabel('Name').fill('Nur Alam');
    await dialog.getByRole('button', { name: 'Add rider' }).click();
    await expect(main).toContainText('Nur Alam');
    await page.getByRole('button', { name: 'Add rider' }).click();
    await page.getByRole('dialog').getByLabel('Name').fill('Rafiq Hasan');
    await page.getByRole('dialog').getByRole('button', { name: 'Add rider' }).click();
    await expect(page.getByRole('dialog').getByText('A rider with this name already exists at this branch.')).toBeVisible();
  });

  test('E-B1: pack, dispatch with tracking, record the COD cash with its collector', async ({ page }) => {
    await start(page);
    await page.goto(`/staff/orders/${O.confirmedCod}`);
    await expect(page.getByRole('heading', { level: 1, name: 'Order ORD-2026-000104' })).toBeVisible();
    // Only the actions the server allows are offered.
    await expect(page.getByRole('button', { name: 'Record delivery', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Start packing' }).click();
    await expect(page.getByRole('group', { name: 'Order actions' }).getByRole('button', { name: 'Dispatch' })).toBeVisible();

    await page.getByRole('group', { name: 'Order actions' }).getByRole('button', { name: 'Dispatch' }).click();
    const dispatch = page.getByRole('dialog');
    await dispatch.getByLabel('Which courier').selectOption({ label: 'Pathao Courier' });
    await dispatch.getByLabel('Tracking number').fill('PC-5550001');
    await dispatch.getByRole('button', { name: 'Dispatch' }).click();
    await expect(page.getByRole('region', { name: 'Shipment' })).toContainText('PC-5550001');

    await page.getByRole('button', { name: 'Record delivery', exact: true }).click();
    const delivery = page.getByRole('dialog');
    await expect(delivery.locator('#cod-amount')).not.toHaveValue('');
    await delivery.getByLabel('Rider’s name').fill('Rafiq (rider)');
    await delivery.getByRole('button', { name: 'Review' }).click();
    await expect(delivery.getByText(/cash collected by Rafiq \(rider\) for ORD-2026-000104/)).toBeVisible();
    await delivery.getByRole('button', { name: 'Confirm' }).click();
    await expect(page.getByRole('region', { name: 'Money' })).toContainText('Rafiq (rider)');
    await expect(page.getByText('Delivered').first()).toBeVisible();
  });

  test('a COD cash record needs the rider’s name before it can be reviewed', async ({ page }) => {
    await start(page);
    await page.goto(`/staff/orders/${O.dispatchedCod}`);
    await page.getByRole('button', { name: 'Record delivery', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Rider’s name').fill('');
    await dialog.getByRole('button', { name: 'Review' }).click();
    await expect(dialog.getByText('Enter the rider who collected the cash.')).toBeVisible();
  });

  test('E-D3: a refused COD parcel opens a return that is then received into quarantine', async ({ page }) => {
    await start(page);
    await page.goto(`/staff/orders/${O.dispatchedCod}`);
    await page.getByRole('button', { name: 'Record delivery failure' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText(/received into quarantine/)).toBeVisible();
    await dialog.getByRole('button', { name: 'Record' }).click();
    await expect(page).toHaveURL(/\/staff\/returns\//);
    await expect(page.getByRole('heading', { name: 'Receive the goods' })).toBeVisible();
    await page.getByRole('button', { name: 'Record receipt' }).click();
    await expect(page.getByRole('heading', { name: 'Received into quarantine' })).toBeVisible();
    await expect(page.getByRole('button', { name: /restock|write off/i })).toHaveCount(0);
  });

  test('E-E1: the pick list is grouped by location and batch and starts packing', async ({ page }) => {
    await start(page);
    await page.goto('/staff/fulfilment/pick-list');
    await expect(page.getByRole('heading', { level: 1, name: 'Pick list' })).toBeVisible();
    const sheet = page.getByRole('article', { name: 'Pick list' });
    await expect(sheet.getByRole('heading', { level: 2 }).first()).toBeVisible();
    await expect(sheet.getByRole('columnheader', { name: 'Batch' }).first()).toBeVisible();
    await expect(sheet.getByRole('link')).toHaveCount(0); // no navigation on the paper
    const startButton = page.getByRole('button', { name: /Start packing \d+ order/ });
    await startButton.click();
    await expect(page.getByRole('status').filter({ hasText: /of \d+ started/ })).toBeVisible();
    await page.goto(`/staff/orders/${O.confirmedCod}`);
    await expect(page.getByText('Being packed').first()).toBeVisible();
  });

  test('E-E2: the courier manifest downloads as CSV', async ({ page }) => {
    await start(page);
    await page.goto('/staff/orders');
    await page.getByText('Courier manifest (CSV)').click();
    await page.getByLabel('Courier').selectOption({ label: 'Pathao Courier' });
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download manifest' }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^manifest-.*\.csv$/);
  });

  test('the packing slip prints without navigation and shows the COD amount', async ({ page }) => {
    await start(page);
    await page.goto(`/staff/orders/${O.confirmedCod}/packing-slip`);
    const sheet = page.getByRole('article', { name: 'Packing slip' });
    await expect(sheet.getByText(/Cash on delivery — collect/)).toBeVisible();
    await expect(sheet.getByRole('columnheader', { name: 'Batch' })).toBeVisible();
    await expect(sheet.getByRole('link')).toHaveCount(0);
  });
});

test.describe('money screens (US-ORD-19, US-ORD-08, US-ORD-15)', () => {
  test('E-C1: confirm a reported bank transfer after restating the amount', async ({ page }) => {
    await start(page);
    await page.goto('/staff/orders/awaiting-payment');
    await page.getByRole('button', { name: 'Confirm transfer for ORD-2026-000102' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Bank reference').fill('BANK-77');
    await dialog.getByRole('button', { name: 'Review' }).click();
    await expect(dialog.getByText(/received against ORD-2026-000102\?/)).toBeVisible();
    await dialog.getByRole('button', { name: 'Confirm' }).click();
    await expect(page.getByRole('status').filter({ hasText: /Transfer confirmed|Recorded\./ })).toBeVisible();
  });

  test('E-C3: the person who recorded a held payment cannot approve it; someone else can', async ({ page }) => {
    await start(page);
    await page.goto(`/staff/orders/${O.heldPayment}`);
    await expect(page.getByRole('region', { name: 'Payment waiting for approval' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Confirm transfer' })).toHaveCount(0);
    await control(page, 'actAsOther');
    await page.getByRole('button', { name: 'Approve payment' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Someone else must approve a payment you recorded.' })).toBeVisible();
    await control(page, 'actAsAdmin');
    await page.getByRole('button', { name: 'Approve payment' }).click();
    await expect(page.getByRole('region', { name: 'Payment waiting for approval' })).toHaveCount(0);
  });

  test('U-D9/E: a reconciliation issue shows what was entered and needs a note to resolve', async ({ page }) => {
    await start(page);
    await page.goto('/staff/orders/reconciliation');
    await expect(page.getByRole('heading', { level: 1, name: 'Reconciliation issues' })).toBeVisible();
    await page.getByRole('button', { name: /Resolve/ }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Resolve issue' }).click();
    await expect(dialog.getByText('Enter a reason.')).toBeVisible();
    await dialog.getByLabel('Resolution note').fill('Checked the bank statement; matched by hand.');
    await dialog.getByRole('button', { name: 'Resolve issue' }).click();
    await expect(page.getByText('No open issues.')).toBeVisible();
  });

  test('E-D2: approve a return that needs a defect, receive it, refund it — and there is no restock step', async ({ page }) => {
    await start(page);
    await page.goto(`/staff/returns/${ids.returns.requestedDefect}`);
    const approve = page.getByRole('button', { name: 'Approve return' });
    await expect(approve).toBeDisabled();
    await expect(page.getByText(/Approve is unavailable until a defect is confirmed/)).toBeVisible();
    await page.getByRole('checkbox', { name: /Defect confirmed/ }).first().check();
    await page.getByRole('textbox', { name: /Defect note/ }).first().fill('Seal broken on arrival, supplier batch defect.');
    await expect(approve).toBeEnabled();
    await approve.click();
    await expect(page.getByRole('heading', { name: 'Receive the goods' })).toBeVisible();
    await page.getByRole('button', { name: 'Record receipt' }).click();
    await expect(page.getByRole('heading', { name: 'Received into quarantine' })).toBeVisible();
    await expect(page.getByRole('button', { name: /restock|write off/i })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Inventory batches screen' })).toBeVisible();

    await page.getByRole('button', { name: 'Issue refund' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText(/Store credit/)).toBeVisible();
    await expect(dialog.getByText("Store credit isn't available yet.")).toBeVisible();
    await dialog.getByRole('radio', { name: 'Cash in store' }).check();
    await dialog.getByLabel('Reference').fill('RCPT-1');
    await dialog.getByLabel('Reason').fill('Return received');
    await dialog.getByRole('button', { name: 'Review' }).click();
    await expect(dialog.getByText(/by cash in store for ORD-/)).toBeVisible();
    await dialog.getByRole('button', { name: 'Issue refund' }).click();
    await expect(dialog).toHaveCount(0);
  });
});

test.describe('administration (US-ORD-05, 06, 11, 19)', () => {
  test('couriers: a tracking template without {tracking} is refused with the server’s message', async ({ page }) => {
    await start(page);
    await page.goto('/staff/admin/couriers');
    await page.getByRole('button', { name: 'Add a courier' }).click();
    await page.getByLabel('Courier name').fill('Steadfast');
    await page.getByLabel('Tracking link template').fill('https://track.example/nothing');
    await page.getByRole('button', { name: 'Save courier' }).click();
    await expect(page.getByText(/must contain \{tracking\}/)).toBeVisible();
    await page.getByLabel('Tracking link template').fill('https://track.example/{tracking}');
    await page.getByRole('button', { name: 'Save courier' }).click();
    await expect(page.getByRole('list', { name: 'Couriers' }).locator('p', { hasText: 'Steadfast' })).toBeVisible();
  });

  test('discount codes: a rejected definition is shown on its field and nothing typed is lost', async ({ page }) => {
    await start(page);
    await page.goto('/staff/admin/discount-codes/new');
    await page.getByLabel('Code').fill('spring');
    await expect(page.getByLabel('Code')).toHaveValue('SPRING');
    await page.getByLabel('Percent off').fill('150');
    await page.getByRole('button', { name: 'Save code' }).click();
    await expect(page.getByText(/above 0 and at most 100/)).toBeVisible();
    await expect(page.getByLabel('Code')).toHaveValue('SPRING');
    await page.getByLabel('Percent off').fill('10');
    await page.getByRole('button', { name: 'Save code' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Discount codes' })).toBeVisible();
  });

  test('payment settings: saving asks first, and the preview matches what was typed', async ({ page }) => {
    await start(page);
    await page.goto('/staff/admin/payment-settings');
    await page.getByLabel('Account name').fill('Amar Gram Ltd');
    await expect(page.getByRole('region', { name: 'What the customer sees' })).toContainText('Amar Gram Ltd');
    await page.getByRole('button', { name: 'Save account' }).click();
    await expect(page.getByRole('dialog')).toContainText('Customers will be asked to transfer to this account.');
    await page.getByRole('dialog').getByRole('button', { name: 'Save account' }).click();
    await expect(page.getByText(/Saved\./)).toBeVisible();
  });

  test('delivery zones: the server names the zone for an address, or says none serves it', async ({ page }) => {
    await start(page);
    await page.goto(`/staff/admin/delivery-zones/${ids.zoneDhakaId}`);
    await page.locator('#zone-test-district').fill('Dhaka');
    await page.getByRole('button', { name: 'Test', exact: true }).click();
    await expect(page.getByText(/Served by/)).toBeVisible();
    await page.locator('#zone-test-district').fill('Atlantis');
    await page.getByRole('button', { name: 'Test', exact: true }).click();
    await expect(page.getByText(/No zone serves this address/)).toBeVisible();
  });
});

test.describe('customer page Orders panel (HO-ORD-002-FU1, backlog ORD-82)', () => {
  test("lists the customer's orders and links to one", async ({ page }) => {
    await start(page);
    await page.goto(`/staff/customers/${ids.customerId}`);
    const panel = page.getByRole('region', { name: 'Orders' });
    await expect(panel.getByRole('link', { name: 'New counter sale for this customer' })).toBeVisible();
    const first = panel.getByRole('link', { name: /^ORD-/ }).first();
    await expect(first).toBeVisible();
    await first.click();
    await expect(page).toHaveURL(/\/staff\/orders\//);
  });
});

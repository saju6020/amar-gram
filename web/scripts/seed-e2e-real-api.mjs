#!/usr/bin/env node
// Fixtures for the real-API Playwright specs that the dev seed (seed-dev.mjs) does not create. Run it AFTER
// `node web/scripts/seed-dev-db.mjs --db <name>`, with that database API up (start-seeded-api.mjs):
//
//   SEED_STAFF_PASSWORD=... node web/scripts/seed-e2e-real-api.mjs --api http://localhost:5127 [--out <dir>]
//
// Everything goes through the real API as e2e.admin@amargram.test (so validation and audit apply), and every item is
// looked up before it is created, so a second run changes nothing. It writes two JSON files into --out (default: the OS
// temp folder) for the specs that read a seed file: bil-seed.json (BIL_SEED, billing-real-api) and rpt-seed.json
// (REPORTS_SEED, reports-real-api). Passwords come from the environment and are never printed.
//
// Created:
//   - inventory-real-api: stock locations "Cold store" and "Back store" (Warehouse); SKUs E2E-FOOD-1 "E2E Organic rice
//     5 kg" (barcode 9900000000011, expiry-tracked), E2E-FOOD-2 "E2E Rice", E2E-BAG-1 "E2E Jute Bag" and E2E-CHILLED-1
//     "E2E Chilled Milk" (Refrigerated 1-5 C), all priced and not listed on the storefront.
//   - billing-real-api: tax class VAT15 (15 %), three walk-in customers, an Accountant ("Aisha Accountant").
//   - reports-real-api: a second Accountant ("Mahmud Accountant"; the schedule case ticks both by name).
//
// Safety: refuses an API whose GET /api/dev/database says amargram_dev or amargram_test (or says nothing).

import { writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const argv = process.argv.slice(2);
const arg = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const API = (arg('api') ?? '').replace(/\/+$/, '');
const OUT = arg('out') ?? tmpdir();
const PASSWORD = process.env.SEED_STAFF_PASSWORD ?? '';
const ADMIN = process.env.E2E_STAFF_ADMIN ?? 'e2e.admin@amargram.test';
const MAIN_BRANCH_ID = '00000000-0000-0000-0000-00000000ba1c';
const REFUSED = ['amargram_dev', 'amargram_test'];

const fail = (m) => {
  console.error(`seed-e2e-real-api: ${m}`);
  process.exit(1);
};
if (!API) fail('pass --api <url> of an API on a scratch database (e.g. http://localhost:5127).');
if (PASSWORD.length < 10)
  fail('set SEED_STAFF_PASSWORD (the password seed-dev.mjs gave the e2e staff).');
if (/:(5005|3000)$/.test(API)) fail(`refusing ${API}: that is the developer app.`);

const jar = new Map();
async function call(method, path, body, { allow = [] } = {}) {
  const headers = { Accept: 'application/json' };
  if (jar.size) headers.Cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
  if (jar.get('pc_csrf') && method !== 'GET')
    headers['X-CSRF-Token'] = decodeURIComponent(jar.get('pc_csrf'));
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(API + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  for (const c of response.headers.getSetCookie()) {
    const [pair] = c.split(';');
    const eq = pair.indexOf('=');
    jar.set(pair.slice(0, eq), pair.slice(eq + 1));
  }
  const text = await response.text();
  let parsed = text;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    /* not JSON */
  }
  if (!response.ok && !allow.includes(response.status))
    throw new Error(`${method} ${path} -> ${response.status} ${text.slice(0, 300)}`);
  return { status: response.status, body: parsed };
}
const get = async (path) => (await call('GET', path)).body;
const items = (b) => (Array.isArray(b) ? b : (b?.items ?? []));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (m) => console.log(`seed-e2e-real-api: ${m}`);

async function main() {
  // 1. which database is this?
  let database;
  try {
    const r = await fetch(`${API}/api/dev/database`);
    if (r.ok) database = (await r.json()).database;
  } catch {
    /* handled below */
  }
  if (!database) fail(`could not confirm which database ${API} uses (GET /api/dev/database).`);
  if (REFUSED.includes(String(database).toLowerCase()))
    fail(`refusing ${database}: it is not a scratch database.`);
  log(`API ${API} is on ${database}`);

  await call('POST', '/api/staff/auth/sign-in', { identifier: ADMIN, password: PASSWORD });

  // 2. stock locations
  const locations = items(await get('/api/staff/inventory/locations'));
  for (const [code, name] of [
    ['COLD', 'Cold store'],
    ['BACK', 'Back store'],
  ]) {
    if (locations.some((l) => l.name === name)) continue;
    await call('POST', '/api/staff/inventory/locations', { code, name, kind: 'Warehouse' });
    log(`location ${name} created`);
  }

  // 3. tax class VAT15
  const taxClasses = items(await get('/api/admin/tax-classes'));
  const standard = taxClasses.find((t) => t.code === 'STANDARD') ?? taxClasses[0];
  if (!standard) throw new Error('No tax class exists on this API; seed the reference data (migrations) before running this script.');
  let vat = taxClasses.find((t) => t.code === 'VAT15');
  if (!vat) {
    const created = (
      await call('POST', '/api/admin/tax-classes', { code: 'VAT15', name: 'VAT 15%' })
    ).body;
    vat = { id: created.taxClassId ?? created.id };
    await call('POST', `/api/admin/tax-classes/${vat.id}/rates`, {
      ratePercent: 15,
      effectiveFrom: new Date(Date.now() + 3000).toISOString(), // a rate cannot start in the past
    });
    await sleep(3500);
    log('tax class VAT15 created');
  }
  const taxId = vat.id ?? vat.taxClassId;
  const standardId = standard.id ?? standard.taxClassId;

  // 4. inventory SKUs (codes and barcodes are fixed up front: a barcode cannot be edited afterwards)
  const skus = [
    ['E2E Organic rice 5 kg', 'E2E-FOOD-1', 'RiceAndGrains', true, '9900000000011', null],
    ['E2E Rice', 'E2E-FOOD-2', 'RiceAndGrains', true, '9900000000028', null],
    ['E2E Jute Bag', 'E2E-BAG-1', 'HouseholdAndCare', false, '9900000000035', null],
    [
      'E2E Chilled Milk',
      'E2E-CHILLED-1',
      'DairyAndEggs',
      true,
      '9900000000042',
      { condition: 'Refrigerated', minTemperatureC: 1, maxTemperatureC: 5 },
    ],
  ];
  for (const [name, code, category, expiry, barcode, storage] of skus) {
    const existing = items(
      await get(`/api/staff/shop/products?search=${encodeURIComponent(name)}&pageSize=50`),
    );
    let id = existing.find((p) => p.name === name)?.productId;
    if (!id) {
      const created = (
        await call('POST', '/api/staff/shop/products', {
          kind: 'Standard',
          name,
          brand: 'E2E',
          category,
          subcategory: null,
          taxClassId: standardId,
          slug: code.toLowerCase(),
        })
      ).body;
      id = created.productId ?? created.id;
      let p = await get(`/api/staff/shop/products/${id}`);
      await call('PUT', `/api/staff/shop/products/${id}`, {
        expectedVersion: p.version,
        name,
        brand: 'E2E',
        description: 'End-to-end fixture.',
        category,
        subcategory: null,
        tags: [],
        taxClassId: standardId,
        countryOfOriginCode: 'BD',
        listedOnStorefront: false,
        isExpiryTracked: expiry,
        certifications: [],
      });
      p = await get(`/api/staff/shop/products/${id}`);
      await call('POST', `/api/staff/shop/products/${id}/skus`, {
        expectedVersion: p.version,
        code,
        barcode,
        sizeOrWeight: '1 each',
        flavour: null,
        colour: null,
        packQuantity: null,
        shippingWeightGrams: 500,
      });
      p = await get(`/api/staff/shop/products/${id}`);
      const sku = p.skus.find((s) => s.code === code);
      await call('POST', `/api/staff/shop/skus/${sku.id ?? sku.skuId}/prices`, {
        amount: '100.00',
        currencyCode: 'BDT',
        effectiveFrom: new Date(Date.now() - 30_000).toISOString(),
      });
      log(`product ${name} (${code}) created`);
    }
    if (storage) await call('PUT', `/api/staff/inventory/storage-profiles/${id}`, storage);
  }

  // 5. staff: two accountants on the main branch
  const accounts = items(await get('/api/staff-accounts?pageSize=100'));
  for (const [fullName, mobile, email] of [
    ['Aisha Accountant', '01711000777', 'e2e.accountant@amargram.test'],
    ['Mahmud Accountant', '01711000778', 'e2e.accountant2@amargram.test'],
  ]) {
    const account = accounts.find((a) => a.emailAddress === email);
    let id = account?.id ?? account?.staffAccountId;
    if (!id) {
      id = (
        await call('POST', '/api/staff-accounts', {
          fullName,
          mobileNumber: mobile,
          emailAddress: email,
          roleIds: ['Accountant'],
          password: PASSWORD,
        })
      ).body.staffAccountId;
      log(`staff ${fullName} created`);
    }
    await call('PUT', `/api/admin/staff/${id}/branches`, {
      branchIds: [MAIN_BRANCH_ID],
      primaryBranchId: MAIN_BRANCH_ID,
    });
  }

  // 6. three walk-in customers
  const customers = [];
  for (const [name, mobile] of [
    ['Billing Walkin One', '01911000001'],
    ['Billing Walkin Two', '01911000002'],
    ['Billing Walkin Three', '01911000003'],
  ]) {
    const found = items(await get(`/api/staff/customers?mobile=${mobile}`)).find(
      (c) => c.fullName === name,
    );
    let id = found?.customerId ?? found?.id;
    if (!id) {
      const created = (
        await call('POST', '/api/staff/customers', { fullName: name, mobileNumber: mobile })
      ).body;
      id = created.customerId ?? created.id;
      log(`customer ${name} created`);
    }
    customers.push({ id, name });
  }

  // 7. the seed files the specs read
  mkdirSync(OUT, { recursive: true });
  const person = (email) => ({ mobile: email, password: PASSWORD }); // sign-in takes a mobile OR an email
  writeFileSync(
    join(OUT, 'bil-seed.json'),
    JSON.stringify(
      {
        password: PASSWORD,
        branchId: MAIN_BRANCH_ID,
        taxId,
        admin: ADMIN,
        reception: 'e2e.reception@amargram.test',
        accountant: 'e2e.accountant@amargram.test',
        customers,
      },
      null,
      1,
    ),
    { mode: 0o600 }, // holds the staff password
  );
  writeFileSync(
    join(OUT, 'rpt-seed.json'),
    JSON.stringify(
      {
        branchId: MAIN_BRANCH_ID,
        people: {
          Administrator: person(ADMIN),
          Accountant: person('e2e.accountant@amargram.test'),
          ShopManager: person('e2e.shopmanager@amargram.test'),
          Reception: person('e2e.reception@amargram.test'),
        },
      },
      null,
      1,
    ),
    { mode: 0o600 }, // holds the staff password
  );
  log(`done. BIL_SEED=${join(OUT, 'bil-seed.json')} REPORTS_SEED=${join(OUT, 'rpt-seed.json')}`);
}

main().catch((err) => fail(err.message));

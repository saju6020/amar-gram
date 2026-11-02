import { beforeEach, describe, expect, it } from 'vitest';
import { resetShopMockData, shopFixtureIds } from '@/mocks/handlers/shop';
import { db } from '@/mocks/handlers/shop/store';
import { resolveMockUploadOutcome } from '@/mocks/handlers/files/uploadBehavior';

/**
 * U47 (HO-P5 §15, ADR-FE-185, §18 A19) -- one case per mocked refusal S3 added in `mocks/handlers/shop/staff.ts` and
 * `mocks/handlers/files/**`: the mock answers with the status, code and property name the server does. Server file:line
 * in each title.
 */

const BASE = 'http://localhost:5005';
const OATS = shopFixtureIds.multiVariantProductId;
const mustard = () => db.products.find((p) => p.slug === 'pure-mustard-oil')!;

async function call(method: string, path: string, body?: unknown) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, json: text ? (JSON.parse(text) as any) : null };
}

const errorsOf = (json: { errors: Array<{ propertyName: string; errorCode: string; errorMessage: string }> }) => json.errors;

async function detail(productId: string) {
  return (await call('GET', `/api/staff/shop/products/${productId}`)).json;
}

async function putDetails(productId: string, over: Record<string, unknown>) {
  const p = await detail(productId);
  return call('PUT', `/api/staff/shop/products/${productId}`, {
    expectedVersion: p.version,
    name: p.name,
    brand: p.brand,
    description: p.description,
    category: p.category,
    subcategory: p.subcategory,
    tags: p.tags,
    taxClassId: p.taxClassId,
    countryOfOriginCode: p.countryOfOriginCode,
    listedOnStorefront: p.listedOnStorefront,
    isExpiryTracked: p.isExpiryTracked,
    certifications: p.certifications,
    ...over,
  });
}

beforeEach(() => resetShopMockData());

describe('U47 — district of origin (UpdateProductDetailsCommandValidator.cs:15, ProductAggregate.cs:312-318)', () => {
  it('more than 60 characters is a 400 MaximumLengthValidator on DistrictOfOrigin', async () => {
    const r = await putDetails(OATS, { districtOfOrigin: 'x'.repeat(61) });
    expect(r.status).toBe(400);
    expect(errorsOf(r.json)[0]).toMatchObject({ propertyName: 'DistrictOfOrigin', errorCode: 'MaximumLengthValidator' });
  });

  it('a control character is a 400 PredicateValidator on DistrictOfOrigin', async () => {
    const r = await putDetails(OATS, { districtOfOrigin: 'Dina\u0007jpur' });
    expect(r.status).toBe(400);
    expect(errorsOf(r.json)[0]).toMatchObject({ propertyName: 'DistrictOfOrigin', errorCode: 'PredicateValidator' });
  });

  it('a tab passes the validator but the aggregate refuses it: 400 InvalidDistrictOfOrigin', async () => {
    const r = await putDetails(OATS, { districtOfOrigin: 'Dina\tjpur' });
    expect(r.status).toBe(400);
    expect(errorsOf(r.json)[0]).toMatchObject({ propertyName: 'DistrictOfOrigin', errorCode: 'InvalidDistrictOfOrigin' });
  });

  it('a refused save changes nothing and a trimmed district is stored; blank clears it', async () => {
    await putDetails(OATS, { districtOfOrigin: 'x'.repeat(61) });
    expect((await detail(OATS)).districtOfOrigin).toBe('Dinajpur');
    expect((await putDetails(OATS, { districtOfOrigin: '  Sylhet  ' })).status).toBe(204);
    expect((await detail(OATS)).districtOfOrigin).toBe('Sylhet');
    expect((await putDetails(OATS, { districtOfOrigin: '   ' })).status).toBe(204);
    expect((await detail(OATS)).districtOfOrigin).toBeNull();
  });
});

describe('U47 — bulk publish / hide (PublishProductCommandValidator.cs:14-24, BulkChangeProductStatusCommandHandler.cs)', () => {
  const bulk = (body: unknown) => call('POST', '/api/staff/shop/products/bulk-status', body);

  it('no ids is a 400 NotEmptyValidator on ProductIds', async () => {
    const r = await bulk({ productIds: [], action: 'Publish' });
    expect(r.status).toBe(400);
    expect(errorsOf(r.json)).toEqual(
      expect.arrayContaining([expect.objectContaining({ propertyName: 'ProductIds', errorCode: 'NotEmptyValidator' })]),
    );
  });

  it('more than 100 ids is a 400 with the server message', async () => {
    const ids = Array.from({ length: 101 }, (_, i) => `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`);
    const r = await bulk({ productIds: ids, action: 'Publish' });
    expect(r.status).toBe(400);
    expect(errorsOf(r.json)[0]).toMatchObject({
      propertyName: 'ProductIds.Count',
      errorCode: 'LessThanOrEqualValidator',
      errorMessage: 'Choose at most 100 products at a time.',
    });
  });

  it('an empty id is a 400 on ProductIds[0]; an unknown or wrongly-cased action is a 400 InvalidBulkAction on Action', async () => {
    const empty = await bulk({ productIds: ['00000000-0000-0000-0000-000000000000'], action: 'Publish' });
    expect(empty.status).toBe(400);
    expect(errorsOf(empty.json)[0]).toMatchObject({ propertyName: 'ProductIds[0]', errorCode: 'NotEmptyValidator' });
    for (const action of ['Archive', 'publish', undefined]) {
      const r = await bulk({ productIds: [OATS], action });
      expect(r.status).toBe(400);
      expect(errorsOf(r.json)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            propertyName: 'Action',
            errorCode: 'InvalidBulkAction',
            errorMessage: 'Action must be Publish or Unpublish.',
          }),
        ]),
      );
    }
    // Nothing was changed by any of the refusals.
    expect((await detail(OATS)).status).toBe('Active');
  });

  it('is 200 whatever the mix: each product has its own outcome and code, and a failure never blocks the others', async () => {
    const draft = shopFixtureIds.unmetChecklistProductId; // Draft with an unmet blocking checklist item
    const unknown = '99999999-9999-4999-8999-999999999999';
    const r = await bulk({ productIds: [OATS, draft, unknown, OATS], action: 'Publish' });
    expect(r.status).toBe(200);
    expect(r.json.action).toBe('Publish');
    // Duplicates collapse (`Distinct`); the counts are the server's.
    expect(r.json.items).toHaveLength(3);
    expect(r.json.succeededCount).toBe(0);
    expect(r.json.failedCount).toBe(3);
    const byId = Object.fromEntries(r.json.items.map((i: any) => [i.productId, i]));
    expect(byId[OATS]).toMatchObject({ succeeded: false, status: null, errorCode: 'InvalidProductTransition', propertyName: 'Status', message: 'Cannot publish from Active.' });
    expect(byId[draft]).toMatchObject({ succeeded: false, errorCode: 'ProductNotPublishable', propertyName: 'Status' });
    expect(byId[draft].message).toMatch(/^This product can't be published yet: /);
    expect(byId[unknown]).toMatchObject({ succeeded: false, errorCode: 'ProductNotFound', propertyName: 'ProductIds' });
  });

  it('Unpublish moves an Active product to Draft; a second time is refused for that product only', async () => {
    const first = await bulk({ productIds: [OATS], action: 'Unpublish' });
    expect(first.json).toMatchObject({ succeededCount: 1, failedCount: 0 });
    expect(first.json.items[0]).toMatchObject({ succeeded: true, status: 'Draft', errorCode: null });
    expect((await detail(OATS)).status).toBe('Draft');
    const again = await bulk({ productIds: [OATS], action: 'Unpublish' });
    expect(again.status).toBe(200);
    expect(again.json.items[0]).toMatchObject({ succeeded: false, errorCode: 'InvalidProductTransition', message: 'Cannot unpublish from Draft.' });
  });

  it('an expired organic certificate blocks publishing with its own code (single and bulk)', async () => {
    const id = mustard().productId;
    expect((await bulk({ productIds: [id], action: 'Unpublish' })).json.succeededCount).toBe(1);
    const viaBulk = await bulk({ productIds: [id], action: 'Publish' });
    expect(viaBulk.status).toBe(200);
    expect(viaBulk.json.items[0]).toMatchObject({ succeeded: false, errorCode: 'OrganicCertificateExpired', propertyName: 'Status' });
    const p = await detail(id);
    const viaSingle = await call('POST', `/api/staff/shop/products/${id}/publish`, { expectedVersion: p.version });
    expect(viaSingle.status).toBe(400);
    expect(errorsOf(viaSingle.json)[0]).toMatchObject({ propertyName: 'Status', errorCode: 'OrganicCertificateExpired' });
    expect(p.publishChecklist.find((c: any) => c.item === 'OrganicCertificateNotExpired')).toMatchObject({
      isBlocking: true,
      isMet: false,
    });
  });
});

describe('U47 — compare-at ("Was") price (ScheduleSkuPriceCommandValidator.cs:24-32, SkuPriceAggregate.cs:46-47)', () => {
  const skuId = () => db.products.find((p) => p.productId === OATS)!.skus[0]!.skuId;
  const schedule = (body: Record<string, unknown>) =>
    call('POST', `/api/staff/shop/skus/${skuId()}/prices`, {
      amount: 700,
      currencyCode: 'BDT',
      effectiveFrom: new Date().toISOString(),
      ...body,
    });

  it('a compare-at that does not exceed the price is a 400 CompareAtMustExceedPrice on CompareAtAmount (equal included)', async () => {
    for (const compareAtAmount of [650, 700]) {
      const r = await schedule({ compareAtAmount });
      expect(r.status).toBe(400);
      expect(errorsOf(r.json)[0]).toMatchObject({
        propertyName: 'CompareAtAmount',
        errorCode: 'CompareAtMustExceedPrice',
        errorMessage: 'The compare-at price must be greater than the price.',
      });
    }
  });

  it('shape rules: below 0.01, above the cap and more than two decimals are 400s on CompareAtAmount', async () => {
    expect(errorsOf((await schedule({ compareAtAmount: 0 })).json)[0]).toMatchObject({ propertyName: 'CompareAtAmount' });
    expect(errorsOf((await schedule({ compareAtAmount: 10_000_000_000 })).json)[0]).toMatchObject({ propertyName: 'CompareAtAmount' });
    const decimals = await schedule({ compareAtAmount: 800.005 });
    expect(decimals.status).toBe(400);
    expect(errorsOf(decimals.json)[0]).toMatchObject({ propertyName: 'CompareAtAmount' });
  });

  it('a valid Was price is stored with the current price; a later price without one clears it', async () => {
    expect((await schedule({ compareAtAmount: 800 })).status).toBe(201);
    let sku = (await detail(OATS)).skus[0];
    expect(sku.compareAtPrice).toEqual({ amount: '800.00', currencyCode: 'BDT' });
    expect((await schedule({})).status).toBe(201);
    sku = (await detail(OATS)).skus[0];
    expect(sku.compareAtPrice).toBeNull();
  });
});

describe('U47 — organic certificate (SetFoodDetailsCommandHandler.cs:36-42, FoodDetails.cs:58-59, FileRules.cs:33-37)', () => {
  const food = async (productId: string, over: Record<string, unknown>) => {
    const p = await detail(productId);
    return call('PUT', `/api/staff/shop/products/${productId}/food`, {
      expectedVersion: p.version,
      ingredientList: p.food?.ingredientList ?? null,
      organicCertifier: p.food?.organicCertifier ?? null,
      organicCertificateNumber: p.food?.organicCertificateNumber ?? null,
      organicCertificateExpiresOn: p.food?.organicCertificateExpiresOn ?? null,
      organicCertificateFileId: p.food?.organicCertificateFileId ?? null,
      ...over,
    });
  };

  const upload = async (name: string, type: string, size: number, purpose?: string) => {
    const outcome = await resolveMockUploadOutcome({ name, type, size }, (id) => `/api/files/${id}/content`, purpose);
    return outcome;
  };

  it('a file id nobody uploaded is a 400 InvalidCertificateFile on OrganicCertificateFileId', async () => {
    const r = await food(OATS, { organicCertificateFileId: 'mock-file-does-not-exist' });
    expect(r.status).toBe(400);
    expect(errorsOf(r.json)[0]).toMatchObject({ propertyName: 'OrganicCertificateFileId', errorCode: 'InvalidCertificateFile' });
  });

  it('a file uploaded for another purpose is refused; one uploaded as OrganicCertificate is attached and viewable', async () => {
    const photo = await upload('pack.png', 'image/png', 1000, 'ProductImage');
    expect(photo.status).toBe(201);
    const wrong = await food(OATS, { organicCertificateFileId: photo.body.fileId });
    expect(wrong.status).toBe(400);
    expect(errorsOf(wrong.json)[0]).toMatchObject({ errorCode: 'InvalidCertificateFile' });

    const cert = await upload('certificate.pdf', 'application/pdf', 4000, 'OrganicCertificate');
    expect(cert.status).toBe(201);
    const ok = await food(OATS, { organicCertificateFileId: cert.body.fileId });
    expect(ok.status).toBe(204);
    const stored = (await detail(OATS)).food;
    expect(stored.organicCertificateFileId).toBe(cert.body.fileId);
    expect(stored.organicCertificateUrl).toMatch(new RegExp(`^/api/files/${cert.body.fileId}/content\\?exp=\\d+&disp=inline&sig=`));
  });

  it('a file already on another product is refused; the product\'s own file may be re-submitted unchanged', async () => {
    const cert = await upload('certificate.pdf', 'application/pdf', 4000, 'OrganicCertificate');
    expect((await food(OATS, { organicCertificateFileId: cert.body.fileId })).status).toBe(204);
    const taken = await food(mustard().productId, { organicCertificateFileId: cert.body.fileId });
    expect(taken.status).toBe(400);
    expect(errorsOf(taken.json)[0]).toMatchObject({ errorCode: 'InvalidCertificateFile' });
    // The seeded certificate the oats already carry is re-sent by every ordinary save.
    expect((await food(mustard().productId, {})).status).toBe(204);
  });

  it('the server derives "expired" from UTC today; null clears the file and the date', async () => {
    expect((await food(OATS, { organicCertificateExpiresOn: '2020-01-01' })).status).toBe(204);
    expect((await detail(OATS)).food.organicCertificateExpired).toBe(true);
    expect((await food(OATS, { organicCertificateExpiresOn: '2099-01-01' })).status).toBe(204);
    expect((await detail(OATS)).food.organicCertificateExpired).toBe(false);
    expect((await food(OATS, { organicCertificateExpiresOn: null, organicCertificateFileId: null })).status).toBe(204);
    const cleared = (await detail(OATS)).food;
    expect(cleared).toMatchObject({ organicCertificateExpiresOn: null, organicCertificateFileId: null, organicCertificateUrl: null, organicCertificateExpired: false });
  });

  it('upload purpose OrganicCertificate: a text file is a 400 FileTypeNotAllowed on ContentType; over 10 MB is a 400 FileTooLarge on Content', async () => {
    const wrongType = await upload('notes.txt', 'text/plain', 100, 'OrganicCertificate');
    expect(wrongType.status).toBe(400);
    expect(wrongType.body).toMatchObject({ errors: [{ errorCode: 'FileTypeNotAllowed', propertyName: 'ContentType' }] });
    const tooBig = await upload('scan.pdf', 'application/pdf', 10 * 1024 * 1024 + 1, 'OrganicCertificate');
    expect(tooBig.status).toBe(400);
    expect(tooBig.body).toMatchObject({ errors: [{ errorCode: 'FileTooLarge', propertyName: 'Content' }] });
    for (const type of ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']) {
      expect((await upload('ok', type, 10 * 1024 * 1024, 'OrganicCertificate')).status).toBe(201);
    }
  });
});

describe('U47 — the staff list extras (GetStaffProductsQueryHandler.cs:72-146)', () => {
  it('has the BG-9 extras for the page: sizes cheapest first, the price range, stock, organic and null image', async () => {
    const r = await call('GET', '/api/staff/shop/products?pageSize=100');
    const oats = r.json.items.find((i: any) => i.productId === OATS);
    expect(oats).toMatchObject({
      countryOfOrigin: { code: 'BD', name: 'Bangladesh' },
      packSizes: ['400 g', '2 kg', '4 kg'],
      isOrganic: true,
    });
    expect(oats.priceRange).toEqual({
      min: { amount: '650.00', currencyCode: 'BDT' },
      max: { amount: '4400.00', currencyCode: 'BDT' },
    });
    expect(typeof oats.availableStock).toBe('number');
    expect(oats.primaryImage).toBeNull();
    // A bundle holds no stock of its own.
    const bundle = r.json.items.find((i: any) => i.kind === 'Bundle');
    if (bundle) expect(bundle.availableStock).toBeNull();
  });
});

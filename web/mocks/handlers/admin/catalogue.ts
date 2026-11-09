import { http, HttpResponse, type HttpHandler } from 'msw';
import {
  administrationFixtureIds,
  validationError,
  notFound,
  noContent,
  loadPersisted,
  savePersisted,
  clearPersisted,
} from './fixtures';

const PERSIST_KEY = '__amargram_admin_catalogue_mock_db__';

/** `mocks/handlers/admin/catalogue.ts` — HO-ADM-002 §12, HO-ADM-001 §8.6/§12.4. Tax classes with
 *  effective-dated rates. */

interface TaxClass {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}
interface TaxRate {
  id: string;
  taxClassId: string;
  ratePercent: string;
  effectiveFrom: string;
}

function seedTaxClasses(): Map<string, TaxClass> {
  const standard: TaxClass = {
    id: administrationFixtureIds.taxClassStandardId,
    code: 'STD',
    name: 'Standard',
    isActive: true,
  };
  return new Map([[standard.id, standard]]);
}

function seedTaxRates(): Map<string, TaxRate> {
  const current: TaxRate = {
    id: crypto.randomUUID(),
    taxClassId: administrationFixtureIds.taxClassStandardId,
    ratePercent: '15.00',
    effectiveFrom: '2026-01-01T00:00:00Z',
  };
  return new Map([[current.id, current]]);
}

interface PersistedShape {
  taxClasses: Array<[string, TaxClass]>;
  taxRates: Array<[string, TaxRate]>;
}
const persisted = loadPersisted<PersistedShape>(PERSIST_KEY);

let taxClasses = persisted ? new Map(persisted.taxClasses) : seedTaxClasses();
let taxRates = persisted ? new Map(persisted.taxRates) : seedTaxRates();

function persist(): void {
  savePersisted(PERSIST_KEY, {
    taxClasses: [...taxClasses.entries()],
    taxRates: [...taxRates.entries()],
  });
}

export function resetAdminCatalogueMockData(): void {
  taxClasses = seedTaxClasses();
  taxRates = seedTaxRates();
  clearPersisted(PERSIST_KEY);
}

export const adminCatalogueHandlers: HttpHandler[] = [
  http.get('*/api/admin/tax-classes', () => HttpResponse.json([...taxClasses.values()])),

  http.get('*/api/admin/tax-classes/:taxClassId', ({ params }) => {
    const taxClass = taxClasses.get(params.taxClassId as string);
    if (!taxClass) return notFound();
    return HttpResponse.json(taxClass);
  }),

  http.post('*/api/admin/tax-classes', async ({ request }) => {
    const body = (await request.json()) as { code: string; name: string };
    if ([...taxClasses.values()].some((t) => t.code === body.code))
      return validationError(
        'Code',
        'TaxClassCodeAlreadyExists',
        'A tax class with this code already exists.',
      );
    const id = crypto.randomUUID();
    taxClasses.set(id, { id, code: body.code, name: body.name, isActive: true });
    persist();
    return HttpResponse.json({ taxClassId: id }, { status: 201 });
  }),

  http.put('*/api/admin/tax-classes/:taxClassId', async ({ request, params }) => {
    const taxClass = taxClasses.get(params.taxClassId as string);
    if (!taxClass) return notFound();
    const body = (await request.json()) as { name: string; isActive: boolean };
    Object.assign(taxClass, body);
    persist();
    return noContent();
  }),

  http.get('*/api/admin/tax-classes/:taxClassId/rates', ({ params }) => {
    const list = [...taxRates.values()].filter((r) => r.taxClassId === params.taxClassId);
    return HttpResponse.json(list);
  }),

  http.post('*/api/admin/tax-classes/:taxClassId/rates', async ({ request, params }) => {
    const body = (await request.json()) as { ratePercent: string; effectiveFrom: string };
    if (new Date(body.effectiveFrom).getTime() < Date.now() - 60_000) {
      return validationError(
        'EffectiveFrom',
        'PriceCannotBeBackdated',
        'The effective date cannot be in the past.',
      );
    }
    const id = crypto.randomUUID();
    taxRates.set(id, {
      id,
      taxClassId: params.taxClassId as string,
      ratePercent: body.ratePercent,
      effectiveFrom: body.effectiveFrom,
    });
    persist();
    return HttpResponse.json({ taxRateId: id }, { status: 201 });
  }),
];

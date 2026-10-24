'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { submitSection } from '@/lib/shop/submitSection';
import type { StaffFoodDetail, StaffProductDetail } from '@/lib/api/staff-shop';
import { Field, SectionFrame, inputClass } from './SectionFrame';

const schema = z.object({
  ingredientList: z.string().max(4000),
  storageInstructions: z.string().max(1000),
  shelfLife: z.string().trim().max(100),
  netWeight: z.string().trim().max(50),
  allergens: z.string().trim().max(500),
  organicCertifier: z.string().trim().max(200),
  organicCertificateNumber: z.string().trim().max(100),
});
export type FoodFormValues = z.infer<typeof schema>;
const KNOWN = [
  'ingredientList',
  'storageInstructions',
  'shelfLife',
  'netWeight',
  'allergens',
  'organicCertifier',
  'organicCertificateNumber',
] as const;

function initial(food: StaffFoodDetail | null | undefined): FoodFormValues {
  return {
    ingredientList: food?.ingredientList ?? '',
    storageInstructions: food?.storageInstructions ?? '',
    shelfLife: food?.shelfLife ?? '',
    netWeight: food?.netWeight ?? '',
    allergens: food?.allergens ?? '',
    organicCertifier: food?.organicCertifier ?? '',
    organicCertificateNumber: food?.organicCertificateNumber ?? '',
  };
}

export interface FoodDetailsFormProps {
  product: StaffProductDetail;
  onSave: (values: FoodFormValues) => Promise<unknown>;
  onReload: () => void;
}

/**
 * HO-SHP-002 §11.6 `FoodDetailsForm` — US-SHP-03, food only (the page does not offer it for any
 * other category). HO-P2 §1.3: ingredient list, storage instructions, shelf life, net weight and
 * allergens, plus the organic certifier / certificate number — all PLAIN TEXT. The certificate
 * fields are optional; publishing needs both only when the product is marked Certified organic.
 * The form starts from the stored labelling returned by the staff read (HO-SHP-001-FU1).
 */
export function FoodDetailsForm({ product, onSave, onReload }: FoodDetailsFormProps) {
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isDirty, isSubmitting, isSubmitSuccessful },
  } = useForm<FoodFormValues>({
    resolver: zodResolver(schema),
    defaultValues: initial(product.food),
  });
  const organic = product.certifications.includes('CertifiedOrganic');

  return (
    <SectionFrame
      title="Food & labelling"
      errors={errors}
      isDirty={isDirty}
      isSubmitting={isSubmitting}
      isSubmitSuccessful={isSubmitSuccessful}
      onReload={onReload}
      onSubmit={handleSubmit(async (values) => {
        const ok = await submitSection(() => onSave(values), setError, KNOWN);
        if (ok) reset(values);
      })}
    >
      <Field
        id="fd-ingredients"
        label="Ingredient list"
        error={errors.ingredientList?.message}
        hint="Plain text."
      >
        <textarea
          id="fd-ingredients"
          rows={3}
          className={inputClass}
          {...register('ingredientList')}
        />
      </Field>
      <Field
        id="fd-storage"
        label="Storage instructions"
        error={errors.storageInstructions?.message}
        hint="Plain text."
      >
        <textarea
          id="fd-storage"
          rows={2}
          className={inputClass}
          {...register('storageInstructions')}
        />
      </Field>
      <div className="grid gap-4 md:grid-cols-2">
        <Field id="fd-shelf-life" label="Shelf life" error={errors.shelfLife?.message}>
          <input id="fd-shelf-life" className={inputClass} {...register('shelfLife')} />
        </Field>
        <Field id="fd-net-weight" label="Net weight" error={errors.netWeight?.message}>
          <input id="fd-net-weight" className={inputClass} {...register('netWeight')} />
        </Field>
      </div>
      <Field
        id="fd-allergens"
        label="Allergens"
        error={errors.allergens?.message}
        hint="Plain text, for example “Contains nuts”."
      >
        <textarea id="fd-allergens" rows={2} className={inputClass} {...register('allergens')} />
      </Field>
      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-2 p-0 text-sm font-semibold text-ink">Organic certification</legend>
        <p className="mb-3 text-xs text-ink-muted">
          {organic
            ? 'This product is marked Certified organic: both fields are needed before it can be published.'
            : 'Optional. Needed only when the product is marked Certified organic.'}
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <Field
            id="fd-certifier"
            label="Organic certifier"
            error={errors.organicCertifier?.message}
          >
            <input id="fd-certifier" className={inputClass} {...register('organicCertifier')} />
          </Field>
          <Field
            id="fd-certificate"
            label="Certificate number"
            error={errors.organicCertificateNumber?.message}
          >
            <input
              id="fd-certificate"
              className={inputClass}
              {...register('organicCertificateNumber')}
            />
          </Field>
        </div>
      </fieldset>
    </SectionFrame>
  );
}

'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { StatusPill } from '@/components/back-office/StatusPill';
import { Button } from '@/components/ui/button';
import { FileUploadField } from '@/components/files/FileUploadField';
import { resolveFileUrl, type StoredFileViewModel } from '@/lib/api/files';
import type { StaffFoodDetail, StaffProductDetail } from '@/lib/api/staff-shop';
import { Field, FieldError, SectionFrame, inputClass } from './SectionFrame';
import { submitProductSection } from './submitProductSection';

const schema = z.object({
  ingredientList: z.string().max(4000),
  storageInstructions: z.string().max(1000),
  shelfLife: z.string().trim().max(100),
  netWeight: z.string().trim().max(50),
  allergens: z.string().trim().max(500),
  organicCertifier: z.string().trim().max(200),
  organicCertificateNumber: z.string().trim().max(100),
  // BG-14: the last valid day (`yyyy-MM-dd`, or empty) and the stored file's id (empty = none).
  organicCertificateExpiresOn: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, 'Enter a valid date.'),
  organicCertificateFileId: z.string(),
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
  'organicCertificateExpiresOn',
  'organicCertificateFileId',
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
    organicCertificateExpiresOn: food?.organicCertificateExpiresOn ?? '',
    organicCertificateFileId: food?.organicCertificateFileId ?? '',
  };
}

export interface FoodDetailsFormProps {
  product: StaffProductDetail;
  /** Presentation only (`Shop.ProductsManage`): without it the certificate file can be viewed but not replaced or removed. */
  canManage?: boolean;
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
export function FoodDetailsForm({
  product,
  canManage = true,
  onSave,
  onReload,
}: FoodDetailsFormProps) {
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    watch,
    reset,
    formState: { errors, isDirty, isSubmitting, isSubmitSuccessful },
  } = useForm<FoodFormValues>({
    resolver: zodResolver(schema),
    defaultValues: initial(product.food),
  });
  const organic = product.certifications.includes('CertifiedOrganic');
  const storedFileId = product.food?.organicCertificateFileId ?? '';
  const fileId = watch('organicCertificateFileId');
  // A file uploaded in this session (name and size known); the stored one is shown by its link only.
  const [uploaded, setUploaded] = React.useState<StoredFileViewModel | null>(null);
  const viewUrl = resolveFileUrl(product.food?.organicCertificateUrl);
  const choose = (next: string) =>
    setValue('organicCertificateFileId', next, { shouldDirty: true, shouldValidate: false });

  return (
    <SectionFrame
      title="Food & labelling"
      errors={errors}
      isDirty={isDirty}
      isSubmitting={isSubmitting}
      isSubmitSuccessful={isSubmitSuccessful}
      onReload={onReload}
      onSubmit={handleSubmit(async (values) => {
        const ok = await submitProductSection(() => onSave(values), setError, KNOWN);
        if (ok) {
          setUploaded(null);
          reset(values);
        }
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
      <fieldset
        className={
          organic
            ? 'm-0 rounded-[var(--radius-md)] border border-leaf-soft bg-leaf-soft p-4 text-leaf-ink'
            : 'm-0 border-0 p-0'
        }
      >
        <legend className="mb-2 p-0 text-sm font-semibold text-ink">
          {organic ? 'Certified organic' : 'Organic certification'}
        </legend>
        <p className={organic ? 'mb-3 text-xs text-leaf-ink' : 'mb-3 text-xs text-ink-muted'}>
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
          <Field
            id="fd-cert-expiry"
            label="Certificate valid until"
            error={errors.organicCertificateExpiresOn?.message}
            hint="The last day the certificate is valid. A certified organic product cannot be published after it."
          >
            <input
              id="fd-cert-expiry"
              type="date"
              className={`${inputClass} min-h-11`}
              aria-invalid={!!errors.organicCertificateExpiresOn}
              {...register('organicCertificateExpiresOn')}
            />
            {product.food?.organicCertificateExpired && (
              <span className="self-start">
                <StatusPill tone="danger">Expired</StatusPill>
              </span>
            )}
          </Field>
          <div className="flex flex-col gap-1.5">
            {uploaded ? (
              <FileUploadField
                id="fd-cert-file"
                label="Certificate file"
                purpose="OrganicCertificate"
                value={uploaded}
                onChange={(file) => {
                  setUploaded(file);
                  // Removing a file uploaded just now falls back to the one on record.
                  choose(file ? file.fileId : storedFileId);
                }}
              />
            ) : fileId ? (
              <>
                <p className="text-sm font-semibold text-ink">Certificate file</p>
                <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius-sm)] border border-border bg-surface-sunken p-2.5 text-sm">
                  <span className="text-ink">A certificate file is on record.</span>
                  {viewUrl && fileId === storedFileId && (
                    <a
                      href={viewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-11 items-center font-semibold text-accent"
                    >
                      View certificate
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  )}
                  {canManage && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="min-h-11"
                      onClick={() => choose('')}
                    >
                      Remove file
                    </Button>
                  )}
                </div>
              </>
            ) : !canManage ? (
              <p className="text-sm text-ink-muted">No certificate file is on record.</p>
            ) : (
              <FileUploadField
                id="fd-cert-file"
                label="Certificate file"
                purpose="OrganicCertificate"
                value={null}
                onChange={(file) => {
                  setUploaded(file);
                  if (file) choose(file.fileId);
                }}
              />
            )}
            <FieldError message={errors.organicCertificateFileId?.message} />
          </div>
        </div>
      </fieldset>
    </SectionFrame>
  );
}

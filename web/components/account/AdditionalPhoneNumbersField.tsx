'use client';

import type { Control, FieldErrors, UseFormRegister } from 'react-hook-form';
import { useFieldArray } from 'react-hook-form';
import { pillInputClass } from '@/components/hearth/fields';
import { Button } from '@/components/ui/button';
import { MAX_ADDITIONAL_NUMBERS, type ProfileFormValues } from './ProfileForm.schema';

/**
 * `components/account/AdditionalPhoneNumbersField.tsx` — MEDIUM/LOW gate item 18 (first pass):
 * split out of `ProfileForm.tsx` once it was still over §11's ~200-line guideline after the
 * props/`method=post`/conditional-required gate fixes (items 3/4/14) put lines back on top of the
 * original hook-removal shrink. Owns its own `useFieldArray` against the parent's `control`, the
 * same "control/register passed down, field array owned locally" shape react-hook-form's own docs
 * use for exactly this kind of split.
 */
export function AdditionalPhoneNumbersField({
  control,
  register,
  errors,
}: {
  control: Control<ProfileFormValues>;
  register: UseFormRegister<ProfileFormValues>;
  errors: FieldErrors<ProfileFormValues>;
}) {
  const { fields, append, remove } = useFieldArray({ control, name: 'additionalPhoneNumbers' });

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-semibold text-ink">Additional phone numbers</legend>
      {fields.map((field, index) => (
        <div key={field.id} className="flex gap-2">
          <label htmlFor={`additional-${index}`} className="sr-only">
            Additional phone number {index + 1}
          </label>
          <input
            id={`additional-${index}`}
            autoComplete="tel"
            className={pillInputClass}
            {...register(`additionalPhoneNumbers.${index}.value` as const)}
          />
          <Button
            type="button"
            variant="pillSecondary"
            size="pillMd"
            onClick={() => remove(index)}
          >
            Remove
          </Button>
        </div>
      ))}
      {errors.additionalPhoneNumbers?.message && (
        <p role="alert" className="text-xs font-semibold text-danger-ink">
          {errors.additionalPhoneNumbers.message}
        </p>
      )}
      {fields.length < MAX_ADDITIONAL_NUMBERS ? (
        <Button
          type="button"
          variant="pillSecondary"
          size="pillMd"
          className="w-fit"
          onClick={() => append({ value: '' })}
        >
          Add a number
        </Button>
      ) : (
        <p className="text-xs text-ink-muted">
          You can have up to {MAX_ADDITIONAL_NUMBERS} additional numbers.
        </p>
      )}
    </fieldset>
  );
}

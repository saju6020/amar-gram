'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  useDialogReturnFocus,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { TaxClass } from '@/lib/api/admin-catalogue';
import { BUSINESS_LINES, type BusinessLine, type ManualChargeRequest } from '@/lib/api/billing-staff';
import { submitBillingForm } from '@/lib/api/errors';
import {
  MONEY_FORMAT_MESSAGE,
  MONEY_PATTERN,
  QUANTITY_PATTERN,
  normaliseMoney,
} from '@/lib/money';
import { CARD_NUMBER_MESSAGE, looksLikeCardNumber } from '@/lib/validation/cardNumberGuard';
import { FormRootError, MoneyField, SelectField, TextField } from './Fields';

/**
 * `components/billing/ManualChargeDialog.tsx` — HO-BIL-002 §11.2 (US-BIL-02). Adds a charge that no
 * order produced: **a fee** with a description, price, tax class and quantity. Nothing is computed
 * here: the server taxes and totals.
 */
const schema = z
  .object({
    description: z.string().trim().max(200),
    unitPrice: z.string().trim(),
    taxClassId: z.string(),
    quantity: z
      .string()
      .trim()
      .regex(QUANTITY_PATTERN, 'Enter a quantity such as 2 or 1.5.'),
    lineDiscount: z
      .string()
      .trim()
      .refine((value) => value === '' || MONEY_PATTERN.test(value), MONEY_FORMAT_MESSAGE),
    serviceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter the service date.'),
    businessLine: z.enum(['Shop']),
  })
  .superRefine((value, ctx) => {
    if (!value.description) {
      ctx.addIssue({ code: 'custom', path: ['description'], message: 'Describe the fee.' });
    } else if (looksLikeCardNumber(value.description)) {
      ctx.addIssue({ code: 'custom', path: ['description'], message: CARD_NUMBER_MESSAGE });
    }
    if (!MONEY_PATTERN.test(value.unitPrice)) {
      ctx.addIssue({ code: 'custom', path: ['unitPrice'], message: MONEY_FORMAT_MESSAGE });
    }
    if (!value.taxClassId) {
      ctx.addIssue({ code: 'custom', path: ['taxClassId'], message: 'Choose a tax class.' });
    }
  });
type Values = z.infer<typeof schema>;

export function ManualChargeDialog({
  open,
  onOpenChange,
  customerId,
  defaultDate,
  taxClasses,
  taxClassesUnavailable,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  defaultDate: string;
  taxClasses: TaxClass[] | undefined;
  taxClassesUnavailable?: boolean;
  onSubmit: (request: ManualChargeRequest) => Promise<{ chargeId: string }>;
}) {
  const returnFocusRef = useDialogReturnFocus(open);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: {
      description: '',
      unitPrice: '',
      taxClassId: '',
      quantity: '1',
      lineDiscount: '',
      serviceDate: defaultDate,
      businessLine: 'Shop',
    },
  });
  useEffect(() => {
    if (open) reset({ description: '', unitPrice: '', taxClassId: '', quantity: '1', lineDiscount: '', serviceDate: defaultDate, businessLine: 'Shop' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const submit = handleSubmit(async (values) => {
    const request: ManualChargeRequest = {
      customerId,
      description: values.description,
      unitPrice: normaliseMoney(values.unitPrice),
      taxClassId: values.taxClassId,
      quantity: values.quantity,
      lineDiscount: values.lineDiscount ? normaliseMoney(values.lineDiscount) : undefined,
      serviceDate: values.serviceDate,
      businessLine: values.businessLine as BusinessLine,
    };
    const done = await submitBillingForm(() => onSubmit(request), setError, {
      knownFields: ['description', 'unitPrice', 'taxClassId', 'quantity', 'lineDiscount', 'serviceDate', 'businessLine'],
    });
    if (done) {
      reset();
      onOpenChange(false);
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (isSubmitting) return;
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent returnFocusRef={returnFocusRef} className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add a manual charge</DialogTitle>
          <DialogDescription>
            Use this for something no order recorded. The server works out the tax when it builds
            the invoice.
          </DialogDescription>
        </DialogHeader>
        <form id="manual-charge-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
          <FormRootError message={errors.root?.message} />
          <TextField id="mc-description" label="Description" required error={errors.description?.message} {...register('description')} />
          <div className="grid gap-4 sm:grid-cols-2">
            <MoneyField id="mc-price" label="Unit price" required error={errors.unitPrice?.message} {...register('unitPrice')} />
            <SelectField
              id="mc-tax"
              label="Tax class"
              required
              error={errors.taxClassId?.message}
              hint={taxClassesUnavailable ? 'The tax classes could not be loaded for your role.' : undefined}
              {...register('taxClassId')}
            >
              <option value="">Choose a tax class…</option>
              {(taxClasses ?? []).filter((t) => t.isActive).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.code} — {t.name}
                </option>
              ))}
            </SelectField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField id="mc-quantity" label="Quantity" inputMode="decimal" required error={errors.quantity?.message} {...register('quantity')} />
            <MoneyField id="mc-discount" label="Discount" error={errors.lineDiscount?.message} {...register('lineDiscount')} />
            <TextField id="mc-date" label="Service date" type="date" required error={errors.serviceDate?.message} {...register('serviceDate')} />
            <SelectField id="mc-line" label="Business line" required error={errors.businessLine?.message} {...register('businessLine')}>
              {BUSINESS_LINES.map((line) => (
                <option key={line} value={line}>
                  {line}
                </option>
              ))}
            </SelectField>
          </div>
        </form>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="manual-charge-form" disabled={isSubmitting} aria-busy={isSubmitting}>
            {isSubmitting ? 'Adding…' : 'Add charge'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

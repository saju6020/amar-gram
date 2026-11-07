'use client';

import { useCallback, useState } from 'react';
import { UnsavedChangesGuard } from '@/components/account/UnsavedChangesGuard';
import {
  useChangeSubscriptionTerms,
  useRefreshPaymentMethods,
  useSubscriptionOptions,
} from '@/lib/hooks/useSubscriptions';
import { CHANGE_TERMS_DESCRIPTION, changeTitle, OPTIONS_FAILED, OPTIONS_LOADING } from '@/lib/subscriptions/copy';
import {
  hasSubscriptionCode,
  subscriptionFieldErrors,
  type SubscriptionFieldErrors,
} from '@/lib/subscriptions/errors';
import type { ActionDialogProps } from './dialogTypes';
import { SubscriptionDialog } from './SubscriptionDialog';
import { TermsFields } from './TermsFields';
import {
  draftFromTerms,
  draftProblems,
  hasProblems,
  sameDraft,
  termsRequestFields,
  type TermsDraft,
} from './termsDraft';
import { useResetOnOpen } from './useResetOnOpen';

/**
 * Change terms (HO-P6 §11.2.6): the Subscribe form's controls, starting from the subscription's current terms. The request
 * carries the `version` the screen read; a 200 closes the dialog and shows the server's sentence, which says whether the
 * change applies now or from a named delivery. A 409 keeps the dialog open with the customer's values and the stale
 * sentence while the page re-reads (the hook invalidates the detail). `focusAddress` opens it on the address choice
 * ("Choose another address").
 */
export function ChangeTermsDialog({
  subscription,
  open,
  onOpenChange,
  onDone,
  focusAddress,
}: ActionDialogProps & { focusAddress?: boolean }) {
  const change = useChangeSubscriptionTerms(subscription.id);
  const options = useSubscriptionOptions(subscription.product.skuId, open);
  const refreshMethods = useRefreshPaymentMethods();
  const original = draftFromTerms(subscription.terms);
  const [draft, setDraft] = useState<TermsDraft>(original);
  const [errors, setErrors] = useState<SubscriptionFieldErrors>({});
  useResetOnOpen(open, () => {
    setDraft(draftFromTerms(subscription.terms));
    setErrors({});
  });
  const patch = useCallback((next: Partial<TermsDraft>) => setDraft((d) => ({ ...d, ...next })), []);
  const dirty = open && !sameDraft(draft, original);

  async function confirm() {
    const maxQuantity = options.data?.maxQuantity ?? 20;
    const problems = draftProblems(draft, maxQuantity);
    if (hasProblems(problems)) {
      setErrors(problems);
      return;
    }
    setErrors({});
    try {
      const result = await change.mutateAsync({
        version: subscription.version,
        ...termsRequestFields(draft),
      });
      onOpenChange(false);
      onDone(result.message);
    } catch (caught) {
      if (hasSubscriptionCode(caught, 'PaymentMethodUnavailable')) void refreshMethods();
      setErrors(subscriptionFieldErrors(caught));
    }
  }

  return (
    <SubscriptionDialog
      open={open}
      onOpenChange={onOpenChange}
      wide
      title={changeTitle(subscription.product.productName)}
      description={CHANGE_TERMS_DESCRIPTION}
      confirmLabel="Save changes"
      pendingLabel="Saving…"
      pending={change.isPending}
      error={errors.root ?? null}
      onConfirm={() => void confirm()}
    >
      <UnsavedChangesGuard when={dirty} />
      {options.isPending ? (
        <p role="status" className="m-0 text-sm text-ink-muted">
          {OPTIONS_LOADING}
        </p>
      ) : options.data ? (
        <TermsFields
          idPrefix="chg"
          skuId={subscription.product.skuId}
          options={options.data}
          draft={draft}
          onChange={patch}
          errors={errors}
          focusAddress={focusAddress}
        />
      ) : (
        <p role="status" className="m-0 text-sm font-semibold text-danger-ink">
          {OPTIONS_FAILED}
        </p>
      )}
    </SubscriptionDialog>
  );
}

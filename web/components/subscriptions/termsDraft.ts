import type {
  SubscriptionFulfilment,
  SubscriptionPaymentMethod,
  SubscriptionTerms,
} from '@/lib/api/subscriptions';
import { CHOOSE_OUTLET_ERROR, CHOOSE_PAYMENT_ERROR } from '@/lib/subscriptions/copy';
import { SUBSCRIPTION_CODE_MESSAGES, type SubscriptionFieldErrors } from '@/lib/subscriptions/errors';

/**
 * The editable terms of a subscription as the Subscribe form and the change dialog hold them. Never stored: the draft
 * lives in component state only (§4.3), so it survives a validation error, a 409 and the inline "Add a new address".
 */
export interface TermsDraft {
  quantity: number;
  intervalWeeks: number;
  fulfilment: SubscriptionFulfilment;
  addressId: string | null;
  branchId: string | null;
  paymentMethod: SubscriptionPaymentMethod | null;
}

export function draftFromTerms(terms: SubscriptionTerms): TermsDraft {
  return {
    quantity: terms.quantity,
    intervalWeeks: terms.intervalWeeks,
    fulfilment: terms.fulfilment,
    addressId: terms.deliveryAddress?.id ?? null,
    branchId: terms.pickupBranch?.id ?? null,
    paymentMethod: terms.paymentMethod,
  };
}

export function sameDraft(a: TermsDraft, b: TermsDraft): boolean {
  return (
    a.quantity === b.quantity &&
    a.intervalWeeks === b.intervalWeeks &&
    a.fulfilment === b.fulfilment &&
    a.addressId === b.addressId &&
    a.branchId === b.branchId &&
    a.paymentMethod === b.paymentMethod
  );
}

/** The request fields for the draft: exactly one of the address and the outlet, matching the fulfilment. */
export function termsRequestFields(draft: TermsDraft) {
  return {
    quantity: draft.quantity,
    intervalWeeks: draft.intervalWeeks,
    fulfilment: draft.fulfilment,
    ...(draft.fulfilment === 'Delivery'
      ? { deliveryAddressId: draft.addressId ?? undefined }
      : { pickupBranchId: draft.branchId ?? undefined }),
    paymentMethod: draft.paymentMethod ?? ('BankTransfer' as const),
  };
}

/** What is missing before a request is worth sending; the server still has the last word. */
export function draftProblems(draft: TermsDraft, maxQuantity: number): SubscriptionFieldErrors {
  const problems: SubscriptionFieldErrors = {};
  if (!Number.isInteger(draft.quantity) || draft.quantity < 1 || draft.quantity > maxQuantity) {
    problems.quantity = `Choose a quantity between 1 and ${maxQuantity}.`;
  }
  if (draft.fulfilment === 'Delivery' && !draft.addressId) {
    problems.deliveryAddressId = SUBSCRIPTION_CODE_MESSAGES.DeliveryAddressNotFound;
  }
  if (draft.fulfilment === 'Pickup' && !draft.branchId) {
    problems.pickupBranchId = CHOOSE_OUTLET_ERROR;
  }
  if (!draft.paymentMethod) problems.paymentMethod = CHOOSE_PAYMENT_ERROR;
  return problems;
}

export const hasProblems = (problems: SubscriptionFieldErrors): boolean =>
  Object.values(problems).some(Boolean);

'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { ErrorState } from '@/components/common/ErrorState';
import { LoadingState } from '@/components/common/LoadingState';
import { HearthEmpty } from '@/components/hearth/HearthEmpty';
import { buttonVariants } from '@/components/ui/button';
import type { CheckoutChoices, PlaceOrderRequest } from '@/lib/api/checkout';
import { describeOrderingError, orderingViolationCodes } from '@/lib/api/errors';
import { useDeliveryAddresses, useCustomerProfile } from '@/lib/hooks/useAccount';
import { useAddDeliveryAddress } from '@/lib/hooks/useAccountMutations';
import { useCart } from '@/lib/hooks/useCart';
import { useCheckoutQuote, useCheckoutUrlState, usePlaceOrder } from '@/lib/hooks/useCheckout';
import { useIdempotencyKey } from '@/lib/hooks/useIdempotencyKey';
import { usePublicBranches } from '@/lib/hooks/useMyOrders';
import { useAcceptPolicyVersion } from '@/lib/hooks/usePublicContent';
import { ChangesPanel } from './ChangesPanel';
import { DeliverToSection } from './DeliverToSection';
import { DeliveryTimeSection } from './DeliveryTimeSection';
import { DiscountCodeField } from './DiscountCodeField';
import { OrderAside, OrderAsideFallback } from './OrderAside';
import { PaymentSection } from './PaymentSection';
import { PendingPoliciesPanel } from './PendingPoliciesPanel';

/** Until the branches load (or if they cannot): the shop's own zone. */
const FALLBACK_ZONE = 'Asia/Dhaka';
/** How long Place order stays disabled after `409 RequestInProgress` before the customer may press it again. */
const IN_PROGRESS_RECHECK_MS = 4000;

type SectionKey = 'fulfilment' | 'slot' | 'payment';
type UrlPatch = Parameters<ReturnType<typeof useCheckoutUrlState>['update']>[0];

/** Gives up waiting for the URL to show a choice (a navigation that never landed) after this long. */
const URL_SETTLE_TIMEOUT_MS = 5000;

/**
 * On one page the customer can make several choices in quick succession (a time window, then a payment
 * method), each a `router.replace` that lands asynchronously, while `useCheckoutUrlState().update` builds
 * the next URL from the address bar as it is *now* — so a second choice could overwrite the first. This
 * keeps the choices not yet reflected in the URL and re-sends them with each new patch. It also reports
 * `settling` while a choice has not reached the URL yet, so that Place order and the changes
 * acknowledgement wait for the quote of the choices on screen.
 */
function useMergedUrlUpdate(
  state: ReturnType<typeof useCheckoutUrlState>['state'],
  rawUpdate: ReturnType<typeof useCheckoutUrlState>['update'],
) {
  const pending = useRef<NonNullable<UrlPatch>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [settling, setSettling] = useState(false);
  const landed = useRef(state);
  landed.current = state;

  const settle = useCallback(() => {
    pending.current = {};
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setSettling(false);
  }, []);

  useEffect(() => {
    const current = state as unknown as Record<string, string | undefined>;
    const entries = Object.entries(pending.current);
    if (entries.length === 0) return;
    for (const [key, value] of entries) {
      if (current[key] === (value === '' ? undefined : value)) {
        delete (pending.current as Record<string, string | undefined>)[key];
      }
    }
    if (Object.keys(pending.current).length === 0) settle();
  }, [state, settle]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const update = useCallback(
    (patch: UrlPatch) => {
      const inUrl = new URLSearchParams(window.location.search);
      const changes = Object.entries(patch ?? {}).some(
        ([key, value]) => (inUrl.get(key) ?? undefined) !== (value === '' ? undefined : value),
      );
      if (!changes && Object.keys(pending.current).length === 0) return;
      const merged = { ...pending.current, ...patch };
      rawUpdate(merged);
      // Only what still differs from the landed state is waited for: a choice reverted before it reached
      // the URL changes nothing on screen, so the effect above would never clear it.
      const current = landed.current as unknown as Record<string, string | undefined>;
      pending.current = Object.fromEntries(
        Object.entries(merged).filter(([key, value]) => current[key] !== (value === '' ? undefined : value)),
      );
      if (Object.keys(pending.current).length === 0) {
        settle();
        return;
      }
      setSettling(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(settle, URL_SETTLE_TIMEOUT_MS);
    },
    [rawUpdate, settle],
  );

  return { update, settling };
}

/**
 * `components/checkout/CheckoutScreen.tsx` — ⭐ HO-P3 S3, ADR-FE-175 (amends ADR-FE-090/091/097). **One page**
 * with three numbered sections (Deliver to · Delivery time · Payment) beside the "Your basket" aside, as in
 * docs/design/store/Checkout.dc.html. **Every choice stays in the URL** and **the quote stays the single
 * source of truth** for prices, charges, slots, payment availability and whether the order can be placed.
 * The screen sends the choices and the quote's fingerprint back and renders what it is told; it adds nothing
 * up. `?step=` is retired: a stale one is ignored. Place order is single-shot (one idempotency key per
 * attempt, disabled while pending; a retry after `RequestInProgress` reuses the key); a changed quote
 * re-opens the acknowledgement.
 */
export function CheckoutScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { state, update: rawUpdate } = useCheckoutUrlState();
  const { update, settling: urlSettling } = useMergedUrlUpdate(state, rawUpdate);
  const cart = useCart();
  // The quote carries no images; the aside shows each line's photo from the basket it was built from.
  const imageBySku = useMemo(
    () => new Map((cart.data?.lines ?? []).map((line) => [line.skuId, line.imagePath] as const)),
    [cart.data],
  );
  const addresses = useDeliveryAddresses();
  const profile = useCustomerProfile();
  const addAddress = useAddDeliveryAddress();
  const acceptPolicy = useAcceptPolicyVersion();
  const place = usePlaceOrder();
  const [placedOrderId, setPlacedOrderId] = useState<string | null>(null);
  const branches = usePublicBranches();
  // Delivery windows are the branch's: label them in its zone, not a hard-coded one.
  const zone = branches.data?.[0]?.timeZoneId ?? FALLBACK_ZONE;
  const idempotency = useIdempotencyKey();

  const [recipient, setRecipient] = useState<{ name: string; phone: string } | null>(null);
  const [acknowledged, setAcknowledged] = useState<string | null>(null);
  const [placeError, setPlaceError] = useState<string | null>(null);
  const [sectionErrors, setSectionErrors] = useState<Partial<Record<SectionKey, string>>>({});
  const [inProgress, setInProgress] = useState(false);
  const [policyError, setPolicyError] = useState<string | null>(null);
  const [acceptingKey, setAcceptingKey] = useState<string | null>(null);
  const submitting = useRef(false);

  // 409 RequestInProgress: the first attempt is still running. Offer a way to its result (the link in the aside)
  // and, after a short wait, allow Place order again - with the SAME key, so the API replays that result.
  useEffect(() => {
    if (!inProgress) return undefined;
    const timer = setTimeout(() => {
      setInProgress(false);
      setPlaceError(null);
      void queryClient.invalidateQueries({ queryKey: ['me', 'orders'] });
    }, IN_PROGRESS_RECHECK_MS);
    return () => clearTimeout(timer);
  }, [inProgress, queryClient]);
  const switchedFor = useRef<string | null>(null);

  const hasLines = (cart.data?.lines.length ?? 0) > 0;
  const choices: CheckoutChoices = {
    fulfilment: state.fulfilment,
    addressId: state.addressId,
    serviceLevel: state.serviceLevel,
    slotDate: state.slotDate,
    slotWindowStart: state.slotWindowStart,
    pickupBranchId: state.pickupBranchId,
    paymentMethod: state.paymentMethod,
    discountCode: state.discountCode,
  };
  const quoteQuery = useCheckoutQuote(choices, hasLines);
  const quote = quoteQuery.data;
  const settling =
    urlSettling || quoteQuery.isSettling || quoteQuery.isPlaceholderData || quoteQuery.isFetching;

  // Recipient defaults from the profile, editable.
  useEffect(() => {
    if (recipient === null && profile.data) {
      setRecipient({ name: profile.data.fullName ?? '', phone: profile.data.mobileNumber ?? '' });
    }
  }, [profile.data, recipient]);

  const addressList = useMemo(() => addresses.data?.addresses ?? [], [addresses.data]);
  // Default delivery address.
  useEffect(() => {
    if (state.fulfilment === 'Delivery' && !state.addressId && addressList.length > 0) {
      update({ addressId: (addressList.find((a) => a.isDefault) ?? addressList[0])!.id });
    }
  }, [state.fulfilment, state.addressId, addressList, update]);

  // Default pickup branch.
  useEffect(() => {
    if (
      state.fulfilment === 'Pickup' &&
      !state.pickupBranchId &&
      quote &&
      quote.pickupBranches.length > 0
    ) {
      update({ pickupBranchId: quote.pickupBranches[0]!.id });
    }
  }, [state.fulfilment, state.pickupBranchId, quote, update]);

  // US-ORD-06 AC2: outside every zone -> collection is preselected (once per address).
  const outsideZone =
    quote?.delivery.available === false &&
    quote.delivery.unavailableReason === 'AddressOutsideServedZones';
  useEffect(() => {
    if (
      state.fulfilment === 'Delivery' &&
      outsideZone &&
      state.addressId &&
      switchedFor.current !== state.addressId
    ) {
      switchedFor.current = state.addressId;
      update({ fulfilment: 'Pickup', pickupBranchId: undefined });
    }
  }, [outsideZone, state.fulfilment, state.addressId, update]);

  const levels = quote?.delivery.serviceLevels ?? [];
  const effectiveLevel = state.serviceLevel ?? quote?.selectedServiceLevel ?? null;
  const chosenLevel = levels.find((level) => level.level === effectiveLevel);
  const slotSkipped =
    state.fulfilment === 'Pickup' || (levels.length <= 1 && (levels[0]?.slots.length ?? 0) === 0);
  const deliveryTaxUnavailable =
    quote?.blockingReasons.includes('DeliveryTaxNotConfigured') ?? false;
  const selectedPayment = quote?.paymentOptions.find(
    (option) => option.method === state.paymentMethod,
  );

  const fulfilmentIncomplete =
    state.fulfilment === 'Delivery'
      ? !state.addressId || !quote?.delivery.available || deliveryTaxUnavailable
      : !state.pickupBranchId;
  const slotIncomplete =
    !slotSkipped &&
    state.fulfilment === 'Delivery' &&
    (!chosenLevel || (chosenLevel.slots.length > 0 && !state.slotDate));
  const paymentIncomplete = !selectedPayment || !selectedPayment.available;

  /** What is still to choose, in the customer's words; listed beside Place order. */
  const choiceReasons: string[] = [];
  if (fulfilmentIncomplete) {
    choiceReasons.push(
      state.fulfilment === 'Delivery'
        ? deliveryTaxUnavailable
          ? 'Delivery is unavailable — choose collection to continue.'
          : !state.addressId
            ? 'Choose or add a delivery address.'
            : 'We can’t deliver to this address — choose another or collect instead.'
        : 'Choose a branch to collect from.',
    );
  }
  if (slotIncomplete) choiceReasons.push('Choose a delivery time.');
  if (paymentIncomplete) choiceReasons.push('Choose how you will pay.');

  /** Brings a section that needs the customer's attention back into view. */
  const reveal = (id: string) => document.getElementById(id)?.scrollIntoView?.({ block: 'center' });

  const handlePlaceError = (error: unknown) => {
    const codes = orderingViolationCodes(error);
    const message = describeOrderingError(error);
    // Any definitive refusal ends this key (the API replays it for an unchanged body); RequestInProgress keeps it.
    idempotency.settleFailure(error);
    if (codes.includes('CheckoutQuoteChanged') || codes.includes('StockNoLongerAvailable')) {
      setAcknowledged(null);
      void queryClient.invalidateQueries({ queryKey: ['checkout', 'quote'] });
      void queryClient.invalidateQueries({ queryKey: ['cart'] });
      setPlaceError(message);
    } else if (codes.includes('RequestInProgress')) {
      setInProgress(true);
      setPlaceError(message);
      void queryClient.invalidateQueries({ queryKey: ['me', 'orders'] });
    } else if (codes.includes('PaymentMethodUnavailable')) {
      setSectionErrors((current) => ({ ...current, payment: message }));
      reveal('co-pay');
    } else if (
      codes.some((c) =>
        [
          'DeliveryTaxNotConfigured',
          'AddressOutsideServedZones',
          'DeliveryAddressNotFound',
          'PickupBranchUnavailable',
          'RecipientPhoneRequired',
        ].includes(c),
      )
    ) {
      setSectionErrors((current) => ({ ...current, fulfilment: message }));
      reveal('co-deliver');
    } else if (
      codes.some((c) => ['ServiceLevelUnavailable', 'DeliverySlotUnavailable'].includes(c))
    ) {
      setSectionErrors((current) => ({ ...current, slot: message }));
      reveal('co-time');
    } else if (codes.includes('PolicyAcceptanceRequired')) {
      setPolicyError(message);
      // The quote now lists the policies still to accept; without a refetch the panel to accept them is empty.
      void queryClient.invalidateQueries({ queryKey: ['checkout', 'quote'] });
    } else {
      setPlaceError(message);
    }
  };

  async function handlePlace() {
    // The button is disabled while settling; this keeps a stale-quote place impossible even if it is not.
    if (!quote || submitting.current || settling) return;
    submitting.current = true;
    setPlaceError(null);
    const request: PlaceOrderRequest = {
      ...choices,
      serviceLevel:
        state.fulfilment === 'Delivery'
          ? (quote.selectedServiceLevel ?? choices.serviceLevel)
          : undefined,
      discountCode: quote.discount?.applied ? quote.discount.code : undefined,
      recipientName: recipient?.name.trim() || undefined,
      recipientPhone: recipient?.phone.trim() || undefined,
      quoteFingerprint: quote.fingerprint,
    };
    try {
      const placed = await place.mutateAsync({
        request,
        idempotencyKey: idempotency.keyFor(JSON.stringify(request)),
      });
      idempotency.renew();
      // Owner, 2026-10-19: straight to the order's details page (it shows the transfer instructions when the order
      // waits for one). `placedOrderId` holds this screen on "Opening your order…" meanwhile: placing the order empties
      // the basket, and the refetched basket would otherwise show "Your basket is empty" before the page changes.
      setPlacedOrderId(placed.orderId);
      router.push(`/portal/orders/${encodeURIComponent(placed.orderId)}?placed=1`);
    } catch (error) {
      handlePlaceError(error);
    } finally {
      submitting.current = false;
    }
  }

  if (placedOrderId) return <LoadingState rows={3} label="Opening your order…" />;
  if (cart.isPending) return <LoadingState rows={5} label="Loading your checkout…" />;
  if (cart.isError) {
    return (
      <ErrorState
        title="We couldn't load your basket."
        description="Your items are safe — please try again."
        headingLevel={2}
        onRetry={() => void cart.refetch()}
      />
    );
  }
  if (!hasLines) {
    return (
      <HearthEmpty
        title="Your basket is empty."
        description="Add something to your basket before checking out."
        action={
          <Link href="/shop" className={buttonVariants({ variant: 'pill', size: 'pillLg' })}>
            Browse the shop
          </Link>
        }
      />
    );
  }

  const selectedAddress = addressList.find((a) => a.id === state.addressId);
  const deliveryReady =
    state.fulfilment === 'Delivery' &&
    !!state.addressId &&
    quote?.delivery.available === true &&
    !deliveryTaxUnavailable;

  return (
    // The bottom padding keeps the phone's pinned Place order bar from covering the last section.
    <div className="flex flex-col gap-5 max-md:pb-40">
      <div className="flex flex-col gap-2">
        <Link
          href="/cart"
          className="inline-flex min-h-11 w-fit items-center gap-1.5 text-[13px] font-semibold text-accent-ink hover:text-accent"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          Back to basket
        </Link>
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h1 className="m-0 font-display text-[32px] font-bold leading-[1.1] tracking-tight text-ink md:text-[40px]">
            Checkout
          </h1>
          <span className="text-[13px] text-ink-muted md:hidden">Step 2 of 2</span>
        </div>
      </div>

      <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-[18px]">
          <DeliverToSection
            fulfilment={state.fulfilment}
            onFulfilment={(value) => {
              setSectionErrors({});
              update({
                fulfilment: value,
                serviceLevel: undefined,
                slotDate: undefined,
                slotWindowStart: undefined,
                paymentMethod: undefined,
              });
            }}
            addresses={addressList}
            addressId={state.addressId}
            onAddress={(id) =>
              update({
                addressId: id,
                slotDate: undefined,
                slotWindowStart: undefined,
                paymentMethod: undefined,
              })
            }
            onAddAddress={(values) => addAddress.mutateAsync(values)}
            pickupBranches={quote?.pickupBranches ?? []}
            pickupBranchId={state.pickupBranchId}
            onPickupBranch={(id) => update({ pickupBranchId: id })}
            delivery={quote?.delivery}
            deliveryTaxUnavailable={deliveryTaxUnavailable}
            districtName={selectedAddress?.district ?? null}
            recipientName={recipient?.name ?? ''}
            recipientPhone={recipient?.phone ?? ''}
            onRecipient={(patch) =>
              setRecipient((current) => ({
                name: patch.name ?? current?.name ?? '',
                phone: patch.phone ?? current?.phone ?? '',
              }))
            }
            error={sectionErrors.fulfilment ?? null}
          />
          <DeliveryTimeSection
            fulfilment={state.fulfilment}
            ready={deliveryReady}
            loading={!quote && !quoteQuery.isError}
            levels={levels}
            selectedLevel={effectiveLevel}
            onLevel={(level) =>
              update({ serviceLevel: level, slotDate: undefined, slotWindowStart: undefined })
            }
            slotDate={state.slotDate}
            slotWindowStart={state.slotWindowStart}
            onSlot={(date, start) => update({ slotDate: date, slotWindowStart: start })}
            zone={zone}
            error={sectionErrors.slot ?? null}
          />
          <PaymentSection
            options={quote?.paymentOptions ?? []}
            selected={state.paymentMethod}
            loading={!quote && !quoteQuery.isError}
            onSelect={(method) => {
              setSectionErrors((current) => ({ ...current, payment: undefined }));
              update({ paymentMethod: method });
            }}
            error={sectionErrors.payment ?? null}
          />
        </div>

        {quote ? (
          <OrderAside
            quote={quote}
            fulfilment={state.fulfilment}
            settling={settling}
            choiceReasons={choiceReasons}
            paymentMethod={state.paymentMethod}
            imageBySku={imageBySku}
            needsAcknowledgement={quote.changes.length > 0}
            acknowledged={acknowledged === quote.fingerprint}
            placing={place.isPending}
            inProgress={inProgress}
            placeError={placeError}
            onPlace={() => void handlePlace()}
            changesPanel={
              <ChangesPanel
                changes={quote.changes}
                fingerprint={quote.fingerprint}
                acknowledgedFingerprint={acknowledged}
                onAcknowledge={setAcknowledged}
                settling={settling}
              />
            }
            policiesPanel={
              <PendingPoliciesPanel
                policies={quote.pendingPolicies}
                acceptingKey={acceptingKey}
                error={policyError}
                onAccept={(policy) => {
                  setPolicyError(null);
                  setAcceptingKey(policy.key);
                  acceptPolicy.mutate(
                    { policyKey: policy.key, versionNumber: policy.versionNumber },
                    {
                      onSuccess: () => {
                        void queryClient.invalidateQueries({ queryKey: ['checkout', 'quote'] });
                      },
                      onError: (error) => setPolicyError(describeOrderingError(error)),
                      onSettled: () => setAcceptingKey(null),
                    },
                  );
                }}
              />
            }
            discountField={
              <DiscountCodeField
                appliedCode={state.discountCode}
                discount={quote.discount}
                checking={settling}
                onApply={(code) => update({ discountCode: code })}
                onRemove={() => update({ discountCode: undefined })}
              />
            }
          />
        ) : (
          <OrderAsideFallback
            failed={quoteQuery.isError}
            onRetry={() => void quoteQuery.refetch()}
          />
        )}
      </div>
    </div>
  );
}

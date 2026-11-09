'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { AuthCard } from '@/components/auth/AuthCard';
import { SignInForm } from '@/components/auth/SignInForm';
import { AuthModeSwitch, HearthAuthShell } from '@/components/hearth/HearthAuthShell';
import { useSignInCustomer } from '@/lib/hooks/useAuthMutations';
import { sanitizeNextPath } from '@/lib/validation/nextPath';
import {
  CUSTOMER_RETURN_PREFIXES,
  DEFAULT_CUSTOMER_LANDING,
  withCustomerNext,
} from '@/lib/routing/portal-links';

const REASONS = [
  'Track every order to your door',
  'Reorder your staples in a tap',
  'Every order and address in one place',
];

// US-ACC-04. `data-theme="customer"` — a customer-facing (auth) screen (see the handover's
// warm-customer-layer rule); staff sign-in (`(auth)/staff/sign-in`) does not set this.
// Store design (docs/design/store/SignIn.dc.html, HO-P3 S4) via HearthAuthShell.
export default function SignInPage() {
  return (
    <HearthAuthShell
      panelLabel="Why sign in"
      headline="Welcome"
      highlight="home"
      intro="One account for your orders and delivery addresses."
      reasons={REASONS}
    >
      <Suspense fallback={null}>
        <SignInPageContent />
      </Suspense>
    </HearthAuthShell>
  );
}

function SignInPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const signInMutation = useSignInCustomer();
  // Issues.md #5 — a visitor sent here by Checkout keeps `?next=` through sign-in and register.
  const next = searchParams.get('next');

  return (
    <div className="flex w-full max-w-[440px] flex-col gap-[22px]">
      <AuthModeSwitch
        current="sign-in"
        signInHref={withCustomerNext('/sign-in', next)}
        registerHref={withCustomerNext('/register', next)}
      />
      <AuthCard
        bare
        title="Sign in"
        titleClassName="text-[34px]"
        description="Use the mobile number or email you registered with."
        className="max-w-none gap-5"
      >
        <SignInForm
          audience="customer"
          appearance="hearth"
          onSignIn={(values) => signInMutation.mutateAsync(values)}
          isPending={signInMutation.isPending}
          error={signInMutation.error}
          onSuccess={() => {
            // SEC gate LOW (first pass) — the whole cache, not just the session key: if person B signs
            // in on a tab person A left signed in, B must never see A's still-cached data (admin-only
            // lists included) until it happens to go stale. §8.4's "invalidate before navigating, or
            // the guard sees a stale cached value and bounces back" is satisfied by `clear()` too — it
            // removes the session key outright, the same as sign-out/deletion/person-change already do.
            queryClient.clear();
            // HO-SHP-002 §13 (Amended 2026-10-04): `/shop` also survives sign-in (ADR-FE-038 — a guest who signs in
            // to save/alert/review returns to the same product and variant).
            // HO-ORD-002 ADR-FE-098: `/cart` and `/checkout` also survive sign-in (the cart's Checkout button sends a
            // signed-out visitor here with `?next=/checkout`; the guard stays closed for everything else).
            // The default `/portal/**` survives sign-in too.
            const destination = sanitizeNextPath(
              searchParams.get('next'),
              CUSTOMER_RETURN_PREFIXES,
              DEFAULT_CUSTOMER_LANDING,
            );
            router.push(destination);
          }}
        />
      </AuthCard>
    </div>
  );
}

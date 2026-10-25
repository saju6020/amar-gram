'use client';

import { Suspense, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { AuthCard } from '@/components/auth/AuthCard';
import { RegisterForm } from '@/components/auth/RegisterForm';
import { RegistrationSuccess } from '@/components/auth/RegistrationSuccess';
import { AuthModeSwitch, HearthAuthShell } from '@/components/hearth/HearthAuthShell';
import { useCaptcha } from '@/lib/hooks/useCaptcha';
import { useRegisterCustomer, useSignInCustomer } from '@/lib/hooks/useAuthMutations';
import { ApiRateLimitedError } from '@/lib/api/client';
import type { RegisterCustomerRequest } from '@/lib/api/auth';
import {
  CUSTOMER_RETURN_PREFIXES,
  DEFAULT_CUSTOMER_LANDING,
  withCustomerNext,
} from '@/lib/routing/portal-links';
import { sanitizeNextPath } from '@/lib/validation/nextPath';

// US-ACC-01. Customer-facing — warm layer.
const REASONS = [
  'One account for everything you buy',
  'Sign in with your mobile number or email',
  'Keep your addresses and orders together',
];

// ARCH gate HIGH 3 (first pass) — this page wires useCaptcha()/useRegisterCustomer(); RegisterForm
// itself takes their results as props (the shell handover §8.2 rule 4, its own comment).
export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterPageContent />
    </Suspense>
  );
}

function RegisterPageContent() {
  // Issues.md #5 — a visitor sent from Checkout keeps `?next=` through register and sign-in.
  const next = useSearchParams().get('next');
  const signInHref = withCustomerNext('/sign-in', next);
  const [success, setSuccess] = useState(false);
  const captcha = useCaptcha();
  const registerMutation = useRegisterCustomer();
  const signInMutation = useSignInCustomer();
  const router = useRouter();
  const queryClient = useQueryClient();
  const signedIn = useRef(false);

  // Owner, 2026-10-19: a new customer is signed in straight away with what they just typed and sent on to where they
  // were going (Checkout's `?next=/checkout`), instead of being asked to sign in a second time. Sign-in needs no
  // CAPTCHA, and the password never leaves this function. If that sign-in fails for any reason, the account still
  // exists and the "Your account is ready" screen offers Sign in, as before.
  async function registerThenSignIn(request: RegisterCustomerRequest) {
    const created = await registerMutation.mutateAsync(request);
    const identifier = request.mobileNumber?.trim() || request.emailAddress?.trim();
    if (identifier) {
      try {
        await signInMutation.mutateAsync({ identifier, password: request.password });
        signedIn.current = true;
      } catch {
        signedIn.current = false;
      }
    }
    return created;
  }

  function afterRegister() {
    if (!signedIn.current) {
      setSuccess(true);
      return;
    }
    // As the sign-in page does: drop every cached query (the guest's empty session included) before navigating.
    queryClient.clear();
    router.push(sanitizeNextPath(next, CUSTOMER_RETURN_PREFIXES, DEFAULT_CUSTOMER_LANDING));
  }

  // Hearth "Welcome home" register (owner-approved 2026-10-16, docs/design/accounts-identity/Register.dc.html and
  // RegisterSuccess.dc.html): the same frame as sign-in; the panel changes to "You're in." once the account exists.
  if (success) {
    return (
      <HearthAuthShell
        panelLabel="Welcome"
        headline="You’re"
        highlight="in"
        intro="Welcome to Amar Gram. Honest food and everyday goods, fresh from the village."
      >
        <RegistrationSuccess signInHref={signInHref} />
      </HearthAuthShell>
    );
  }

  return (
    <HearthAuthShell
      panelLabel="Why join"
      headline="Welcome"
      highlight="home"
      intro="It takes a minute. Then you can shop and save your addresses."
      reasons={REASONS}
    >
      <div className="flex w-full max-w-[440px] flex-col gap-[22px]">
        <AuthModeSwitch
          current="register"
          signInHref={signInHref}
          registerHref={withCustomerNext('/register', next)}
        />
        <AuthCard
          bare
          title="Create your account"
          titleClassName="text-[34px]"
          description="Give a mobile number, an email, or both — you’ll use one to sign in."
          className="max-w-none gap-5"
        >
          <RegisterForm
            captcha={captcha}
            onRegister={registerThenSignIn}
            isPending={registerMutation.isPending || signInMutation.isPending}
            rateLimitError={
              registerMutation.error instanceof ApiRateLimitedError ? registerMutation.error : null
            }
            onSuccess={afterRegister}
            signInHref={signInHref}
          />
        </AuthCard>
      </div>
    </HearthAuthShell>
  );
}

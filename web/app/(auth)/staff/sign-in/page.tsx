'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { StaffAuthFrame } from '@/components/back-office-overview/StaffAuthFrame';
import { SignInForm } from '@/components/auth/SignInForm';
import { useSignInStaff } from '@/lib/hooks/useStaffAuthMutations';
import { restorePreservedBranch } from '@/lib/branch';
import { sanitizeNextPath } from '@/lib/validation/nextPath';

// US-ACC-14. `(auth)/staff/sign-in` — deliberately NOT under `(staff)`, whose job is to REQUIRE a
// session; putting sign-in there is how a redirect loop is built (§8.3). No `data-theme` set — a
// staff screen, never the warm customer layer.
export default function StaffSignInPage() {
  return (
    <StaffAuthFrame
      title="Staff sign in"
      helper="Use your staff mobile number or email. Staff and customer accounts are separate."
    >
      <Suspense fallback={null}>
        <StaffSignInPageContent />
      </Suspense>
    </StaffAuthFrame>
  );
}

function StaffSignInPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const signInMutation = useSignInStaff();

  return (
    <SignInForm
      audience="staff"
      onSignIn={(values) => signInMutation.mutateAsync(values)}
      isPending={signInMutation.isPending}
      error={signInMutation.error}
      onSuccess={(result) => {
        // SEC gate LOW (first pass) — see the customer sign-in page's own comment.
        queryClient.clear();
        // ADM 12: only the SAME person re-signing in after a lapsed session keeps their branch.
        if ('staffAccountId' in result) restorePreservedBranch(queryClient, result.staffAccountId);
        const destination = sanitizeNextPath(searchParams.get('next'), '/staff/', '/staff');
        router.push(destination);
      }}
    />
  );
}

/**
 * `lib/dev/mock-worker.ts` — the one place the browser-side MSW worker is started (development with
 * `NEXT_PUBLIC_USE_MOCKS=true` only; see web/README.md).
 *
 * Both `app/providers.tsx` and `apiFetch` call `mockWorkerReady()`: whichever runs first starts the
 * worker and every caller awaits the same promise. A page's own effects run before the providers'
 * effect, so without this an early request (the register page's captcha, a sign-in submitted the
 * moment the form is live) raced the worker's registration, went to the real API origin, and was
 * refused. Returns `null` everywhere else (production, tests, the server), so callers skip the wait.
 * `NODE_ENV` is inlined at build time, so the `msw/browser` import never reaches a production bundle.
 */
let ready: Promise<void> | null = null;

export function mockWorkerReady(): Promise<void> | null {
  if (
    process.env.NODE_ENV !== 'development' ||
    process.env.NEXT_PUBLIC_USE_MOCKS !== 'true' ||
    typeof window === 'undefined'
  ) {
    return null;
  }
  ready ??= import('@/mocks/browser')
    .then(({ worker }) => worker.start({ onUnhandledRequest: 'bypass' }))
    .then(() => {
      (window as unknown as { __mswReady?: boolean }).__mswReady = true;
    });
  return ready;
}

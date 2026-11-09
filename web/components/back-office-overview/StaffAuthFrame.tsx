'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/** The sprout on the badge, in the leaf-soft tone (the same mark as the shop logo, drawn here because that logo carries a "Shop" tag). */
function Sprout() {
  return (
    <svg width="60%" height="60%" viewBox="0 0 32 32" fill="currentColor" aria-hidden="true">
      <path d="M16 28V15" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" />
      <path d="M16 17c0-5.5-3.6-9.4-10-9.6.2 6.4 4.1 9.8 10 9.6z" />
      <path d="M16 14c.3-5.6 3.9-9.3 10.2-9.3-.4 6.3-4.4 9.6-10.2 9.3z" />
      <path d="M6 28h20" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" />
    </svg>
  );
}

/**
 * `components/back-office-overview/StaffAuthFrame.tsx` — HO-P4 §11.2.1, US-ACC-14. The staff
 * sign-in and set-password pages' frame, to `StaffSignIn.dc.html`: a full-bleed banana-leaf page and
 * one white card holding the leaf-badge logo, the "Back office" tag, the page `h1` and (on sign-in)
 * a helper line. It replaces `AuthCard` on the two staff auth pages only; the shared `(auth)`
 * layout is untouched, so the frame covers it with a fixed full-viewport layer. A staff screen:
 * no `data-theme`. Like `AuthCard`, the heading takes focus on arrival.
 */
export function StaffAuthFrame({
  title,
  helper,
  children,
}: {
  /** The page's own `<h1>` text, which also takes initial focus. */
  title: string;
  helper?: ReactNode;
  children: ReactNode;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <div className="fixed inset-0 z-10 overflow-y-auto bg-leaf-ink" data-testid="staff-auth-frame">
      <div className="grid min-h-full place-items-center px-4 py-8">
        <main className="flex w-full max-w-[440px] flex-col gap-4 rounded-3xl bg-surface p-6 text-ink sm:p-9">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="grid size-11 flex-none place-items-center rounded-[50%_50%_50%_8px] bg-leaf text-leaf-soft"
            >
              <Sprout />
            </span>
            <span className="flex flex-col leading-[1.1]">
              <span className="font-display text-2xl font-bold">
                Amar <span className="text-leaf">Gram</span>
              </span>
              <span className="text-xs uppercase tracking-[0.12em] text-ink-muted">
                Back office
              </span>
            </span>
          </div>
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="font-display text-[32px] font-bold leading-tight focus:outline-none focus-visible:outline-none"
          >
            {title}
          </h1>
          {helper && <p className="text-ink-muted">{helper}</p>}
          {children}
        </main>
      </div>
    </div>
  );
}

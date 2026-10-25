import Link from 'next/link';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface HearthAuthShellProps {
  /** The plain words of the headline, then the italic mango word, then the full stop. */
  headline: string;
  highlight: string;
  intro: string;
  /** Desktop-only list under the intro: reasons (a leaf tick each) … */
  reasons?: string[];
  /** … or numbered steps (forgot password). */
  steps?: string[];
  /** Accessible name of the welcome panel. */
  panelLabel: string;
  children: React.ReactNode;
}

/** The sprout mark, drawn in the current colour (the same shape as the shop logo's badge). */
function Sprout() {
  return (
    <svg width="26" height="26" viewBox="0 0 32 32" fill="currentColor" aria-hidden="true">
      <path
        d="M16 28V15"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.4}
        strokeLinecap="round"
      />
      <path d="M16 17c0-5.5-3.6-9.4-10-9.6.2 6.4 4.1 9.8 10 9.6z" />
      <path d="M16 14c.3-5.6 3.9-9.3 10.2-9.3-.4 6.3-4.4 9.6-10.2 9.3z" />
      <path d="M6 28h20" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" />
    </svg>
  );
}

/**
 * `components/hearth/HearthAuthShell.tsx` — the customer "Welcome home" frame (docs/design/store/SignIn.dc.html):
 * a banana-leaf panel (light logo badge, the wordmark, "Welcome *home.*", the reasons, and the way to the back
 * office) beside the page's form on desktop; a compact leaf band above it on a phone. It breaks out of the `(auth)`
 * layout's centring padding (`-mx-4 -my-10`) to fill the screen. The panel's headline is a `<p>`: the page's own
 * `<h1>` lives in the form column. Staff (auth) pages never use it.
 */
export function HearthAuthShell({
  headline,
  highlight,
  intro,
  reasons,
  steps,
  panelLabel,
  children,
}: HearthAuthShellProps) {
  return (
    <div
      data-theme="customer"
      className="-mx-4 -my-10 grid min-h-screen flex-1 self-stretch bg-surface-page md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]"
    >
      <section
        aria-label={panelLabel}
        className="relative flex flex-col gap-4 overflow-hidden rounded-b-band bg-leaf px-5 pb-7 pt-5 text-leaf-soft md:justify-between md:gap-8 md:rounded-none md:px-16 md:py-12"
      >
        <Link
          href="/shop"
          className="inline-flex w-fit items-center gap-2.5 text-leaf-soft no-underline"
        >
          <span
            aria-hidden="true"
            className="grid size-11 flex-none place-items-center rounded-[50%_50%_50%_8px] bg-leaf-soft text-leaf"
          >
            <Sprout />
          </span>
          <span className="font-display text-[28px] font-bold leading-none">
            Amar <span className="text-warm">Gram</span>
          </span>
        </Link>
        <div className="flex max-w-[460px] flex-col gap-3 md:gap-4">
          <p className="m-0 font-display text-[38px] font-bold leading-[1.05] tracking-[-0.03em] md:text-5xl">
            {headline} <em className="font-medium text-warm">{highlight}</em>.
          </p>
          <p className="m-0 text-sm leading-relaxed text-leaf-soft md:text-lg">{intro}</p>
          {reasons && (
            <ul className="m-0 hidden list-none flex-col gap-3 p-0 md:flex">
              {reasons.map((text) => (
                <li key={text} className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="grid size-9 flex-none place-items-center rounded-full bg-leaf-ink text-warm"
                  >
                    <Check size={18} strokeWidth={2.4} />
                  </span>
                  {text}
                </li>
              ))}
            </ul>
          )}
          {steps && (
            <ol className="m-0 hidden list-none flex-col gap-3 p-0 md:flex">
              {steps.map((text, index) => (
                <li key={text} className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="grid size-9 flex-none place-items-center rounded-full bg-leaf-ink text-sm font-bold text-warm"
                  >
                    {index + 1}
                  </span>
                  {text}
                </li>
              ))}
            </ol>
          )}
        </div>
        <p className="m-0 text-sm text-leaf-soft">
          Staff member?{' '}
          <Link href="/staff/sign-in" className="font-semibold text-leaf-soft underline">
            Sign in to the back office
          </Link>
        </p>
      </section>

      <main className="flex items-start justify-center px-5 py-7 md:items-center md:p-12">
        {children}
      </main>
    </div>
  );
}

/**
 * The two-link switch above the sign-in and register forms. They are routes, so they are links (not tabs);
 * `signInHref` and `registerHref` already carry the allow-listed `?next=`.
 */
export function AuthModeSwitch({
  current,
  signInHref,
  registerHref,
  className,
}: {
  current: 'sign-in' | 'register';
  signInHref: string;
  registerHref: string;
  className?: string;
}) {
  const items = [
    { key: 'sign-in', label: 'Sign in', href: signInHref },
    { key: 'register', label: 'Create an account', href: registerHref },
  ] as const;
  return (
    <nav
      aria-label="Account"
      className={cn(
        'grid w-full grid-cols-2 gap-1 rounded-pill border-[1.5px] border-border bg-surface p-1',
        className,
      )}
    >
      {items.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          aria-current={item.key === current ? 'page' : undefined}
          className={cn(
            'grid min-h-11 place-items-center rounded-pill px-3 text-center text-[15px] font-semibold no-underline',
            item.key === current ? 'bg-leaf text-leaf-soft' : 'text-ink hover:bg-leaf-soft',
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

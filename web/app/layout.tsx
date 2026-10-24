import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Fraunces, Work_Sans } from 'next/font/google';
import { Providers } from './providers';
import { NavigationProgress } from '@/components/common/NavigationProgress';
import { WebVitalsReporter } from '@/components/observability/WebVitalsReporter';
import { ServiceWorkerCleanup } from '@/components/offline/ServiceWorkerCleanup';
import './globals.css';

// Site fonts (Phase 2, 2026-10-24): Fraunces for display (headings, prices, the wordmark) and Work Sans
// for body text, as variable fonts. They feed the --font-display and --font-sans tokens in app/globals.css.
const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-display-loaded',
  display: 'swap',
});

const workSans = Work_Sans({
  subsets: ['latin'],
  variable: '--font-sans-loaded',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Amar Gram',
  description: 'Amar Gram — organic and everyday goods from the village to your door.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${workSans.variable}`}>
      <body>
        {/* Issues.md #1/#6 — a top progress bar for every page change, in every area. */}
        <Suspense fallback={null}>
          <NavigationProgress />
        </Suspense>
        <Providers>{children}</Providers>
        {/* HO-XCT-002 §11.6, ADR-FE-146 — real-user web vitals; sends nothing from /staff/**. */}
        <WebVitalsReporter />
        {/* HO-XCT-002 ADR-FE-140 — removes a stale /staff/ worker in dev and mock mode, on every load. */}
        <ServiceWorkerCleanup />
      </body>
    </html>
  );
}

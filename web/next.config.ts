import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // HO-P5 Amended (au): `E2E_KEEP_ROUTES=1` (set by the e2e chunk runner, never by `npm run dev`) keeps every
  // route `next dev` compiles for the whole run. With Next's defaults (5 pages, 60 s idle) a long run keeps
  // disposing routes; each disposal rebuilds the client bundle ("Compiled in 0ms"), and a page served across that
  // rebuild can name a client chunk that then 404s, so it never hydrates and clicks do nothing. Dev server only.
  ...(process.env.E2E_KEEP_ROUTES === '1'
    ? { onDemandEntries: { maxInactiveAge: 6 * 60 * 60 * 1000, pagesBufferLength: 1000 } }
    : {}),
  // HO-XCT-002 §12.2 — the offline service worker must always be revalidated so a new build's
  // worker replaces the old one. No `Service-Worker-Allowed` header: its scope stays `/staff/`
  // (ADR-FE-139). `/_next/static/*` keeps Next's own immutable caching.
  async headers() {
    return [
      {
        source: '/staff/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache' },
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
        ],
      },
    ];
  },
};

export default nextConfig;

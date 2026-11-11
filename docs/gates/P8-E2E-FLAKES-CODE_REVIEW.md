GATE: CODE_REVIEW
HANDOVER: P8-E2E-FLAKES
COMMITS: 21bba59..HEAD (branch fix/p8-e2e-flakes)
DATE: 2026-11-11
STATUS: PASS

FINDINGS
- [MEDIUM] web/components/common/NavigationProgress.tsx:93-102 — no test covers the new pre-mount path (click before mount sets `startedBeforeMount`, mount then shows the bar). issues-4-5-6.test.tsx is unchanged, so the product change is proven only by the journey real-API spec. Add a Vitest case: click an internal link before render, then render, expect the bar. Note module-level state also leaks between Vitest cases (a click while unmounted leaves the flag set for the next render); reset it via `vi.resetModules()` or an exported test reset.
- [LOW] web/components/common/NavigationProgress.tsx:21-30,95-98 — the pending flag is never cleared except by mounting. A pre-hydration click that does not navigate (link cancelled by its own handler, or a soft navigation that finishes before mount) makes the bar appear on mount; the mount effect runs after the `[pathname, query]` reset effect, so it is not cancelled and stays until the 15 s safety timeout. Harmless in practice (one root-layout instance, app/layout.tsx:35), but could be bounded: record a timestamp and ignore a pending start older than a second or two, or skip it if the pathname changed.
- [LOW] web/components/common/NavigationProgress.tsx:60 — `onStart` is a single global slot; a second mounted instance would silently take over from the first. Only one instance exists today. Acceptable.
- [LOW] web/tests/e2e/reports-real-api.spec.ts:88-111 — every run issues one more 100-unit invoice dated today and leaves it (the customer "Reports Walkin" is reused by mobile, the invoice is not). Fine on a scratch e2e database; it can inflate today's revenue for specs that count or sum today's invoices. No such spec found in the diff scope; note if one appears.

Verified, no finding:
- SSR safety: the module-level block is guarded by `typeof window !== 'undefined'`; `start`, `onClick`, `onSubmit` touch window/document only when invoked; `startNavigationProgress` unchanged.
- HMR / double registration: previous remove function is called first via window key, and it removes all three listeners; no listener accumulation. React StrictMode double effect: cleanup nulls `onStart`, re-run restores it; the flag is consumed on the first run.
- Filters preserved verbatim: button !== 0, modifier keys, target other than _self, download, cross-origin, same page+search. Hash-only links to the same page and path are still ignored (isSamePageTarget compares pathname and search). GET-only form filter unchanged.
- Interaction with the 15 s timeout and `startNavigationProgress`: unchanged; the timeout effect keys on `active`, and the event listener now routes through `start()` so it also works before mount.
- Tests not weakened: journey step 1 drops the retry loop (stricter, one click, bar must appear; poll on `__progressSeen` is the sole wait); reports E-C now asserts exact `Margin` inside the labelled result rather than any text on the page, and has data; xct E-C3/E-C4 use `exact: true` and a longer timeout on the second assertion; journey step 4 and `acceptPendingPolicies` changes only fix navigation/readiness.
- `npx vitest run tests/components/issues-4-5-6.test.tsx`: 7 passed. e2e and servers not run (machine load), as instructed.

SCOPE CHECK
- files in allowed scope: 6/6
- files outside allowed scope: none

import { LoadingState } from '@/components/common/LoadingState';

/**
 * `(staff)` route loading UI — shown inside the group's shell the moment a link is followed, until the
 * next page's content is ready, so a slow page never looks frozen (Issues.md #1).
 *
 * HO-P4 §11.1.8: the skeleton mirrors the new page — a heading block (eyebrow, title) and one white
 * card — so the page does not jump when the real content arrives. `LoadingState` supplies the one
 * `role="status"` announcement; the decorative bars here are hidden from assistive tech.
 */
export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <div aria-hidden="true" className="flex flex-col gap-2">
        <div className="h-3.5 w-32 rounded-[var(--radius-sm)] bg-surface-sunken motion-safe:animate-pulse" />
        <div className="h-8 w-64 max-w-full rounded-[var(--radius-sm)] bg-surface-sunken motion-safe:animate-pulse" />
      </div>
      <div className="rounded-2xl border border-border bg-surface p-5">
        <LoadingState rows={6} />
      </div>
    </div>
  );
}

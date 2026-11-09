import { StaffShell } from '@/components/common/staff-shell';
import { StaffSessionGuard } from '@/components/staff/StaffSessionGuard';
import { IdleLock } from '@/components/staff/IdleLock';
import { StaffLockProvider } from '@/components/staff/IdleLockContext';
import { ConnectivityProvider } from '@/components/offline/ConnectivityProvider';
import { OfflineBanner } from '@/components/offline/OfflineBanner';
import { OfflineSnapshotSync } from '@/components/offline/OfflineSnapshotSync';
import { OverdueRestoreBanner } from '@/components/operations/OverdueRestoreBanner';
import { ServiceWorkerRegistrar } from '@/components/offline/ServiceWorkerRegistrar';

// Back-office shell for every /staff/** route (the scaffold handover §8.3). Thin by design (§8.2 rule 5) —
// the interactive shell itself lives in a client component; this layout only composes it.
//
// HO-ACC-002 §11.9, ADR-FE-004/010: `StaffSessionGuard` replaces `lib/identity.ts` for every
// existing and future staff page; `IdleLock` wraps everything below it so the page — and every
// form's react-hook-form state — stays mounted through a lock/re-authenticate cycle (US-ACC-08).
//
// ARCH gate HIGH (second pass) — `StaffLockProvider` sits ABOVE `StaffSessionGuard`, not inside
// `IdleLock`, so the guard can read whether the terminal is locked and, while it is, stop treating
// a `session_invalid`/`null` session read as "signed out" — see `IdleLockContext.tsx`'s own comment
// for why the lock state cannot live below the guard.
// HO-ADM-002 §8.1/§11.2, ADR-FE-016; HO-P4 §8.2, ADR-FE-182 — the `ActiveBranchPicker` now lives in
// `StaffShell`'s sidebar (`variant="sidebar"`), not above the page content. It is still mounted on
// every `/staff/**` navigation (so the active-branch seed effect always runs), and still hidden
// outright with one branch or none.
// HO-XCT-002 §8.1/§11.3, ADR-FE-142..145 — `ConnectivityProvider` (the ping loop and TanStack's notion of
// online) wraps everything; `OfflineBanner` is the first thing in <main>'s flow so a screen-reader user
// meets it before the data; `OfflineSnapshotSync` and `ServiceWorkerRegistrar` render nothing and run only
// inside the session guard, for a signed-in member of staff.
export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <StaffLockProvider>
      <ConnectivityProvider>
        <StaffSessionGuard>
          <IdleLock>
            <OfflineSnapshotSync />
            <ServiceWorkerRegistrar />
            <StaffShell>
              <OfflineBanner />
              <OverdueRestoreBanner />
              {children}
            </StaffShell>
          </IdleLock>
        </StaffSessionGuard>
      </ConnectivityProvider>
    </StaffLockProvider>
  );
}

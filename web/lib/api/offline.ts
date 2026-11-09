import { apiFetch } from './client';

/**
 * `lib/api/offline.ts` — HO-XCT-002 §8.2. The offline staff snapshot and the reachability
 * ping. Shapes verified against `StaffOfflineSnapshotController.cs`, `SystemPingController.cs` and
 * `src/Read/.../ViewModels/OperationsSnapshotViewModels.cs` (HO-XCT-001 section 12.4).
 */

export type SnapshotOmissionReason = 'NotPermitted' | 'NotAvailable';

export interface OfflineSnapshotBody {
  schemaVersion: number;
  branch: { id: string; name: string; timeZoneId: string };
  /** `yyyy-MM-dd` in the branch's zone. */
  localDate: string;
  generatedOn: string;
  validUntil: string;
  staffAccountId: string;
  idleTimeoutMinutes: number;
  refreshAfterSeconds: number;
  /** Keyed by section name. No section is defined in Amar Gram today, so the envelope arrives
   *  with no sections (or only omissions). */
  sections: Record<string, { items: unknown[] }>;
  omittedSections: Array<{ section: string; reason: SnapshotOmissionReason }>;
}

export const SNAPSHOT_SCHEMA_VERSION = 1;

/** `fresh` carries the body and the ETag when the API exposes it (cross-origin, only if listed in
 *  `Access-Control-Expose-Headers` — see HO-XCT-002 §1 Amended); `notModified` is a `304`. */
export type SnapshotFetchResult =
  | { kind: 'fresh'; body: OfflineSnapshotBody; etag: string | null }
  | { kind: 'notModified' };

export async function getOfflineSnapshot(
  ifNoneMatch: string | null,
): Promise<SnapshotFetchResult> {
  let etag: string | null = null;
  const body = await apiFetch<OfflineSnapshotBody | undefined>('/api/staff/offline-snapshot', {
    headers: ifNoneMatch ? { 'If-None-Match': ifNoneMatch } : undefined,
    cache: 'no-store',
    onResponseHeaders: (headers) => {
      etag = headers.get('ETag');
    },
  });
  if (body === undefined) return { kind: 'notModified' };
  return { kind: 'fresh', body, etag };
}

/** `GET /api/system/ping` — `204`, public and passive. Resolves on any answer that reached the
 *  server; rejects with the `ApiError` otherwise (status 0 = unreachable, 5xx = server trouble).
 *  Reported to the monitor by the monitor itself, so `apiFetch` is told to skip reporting. */
export async function pingServer(signal: AbortSignal): Promise<void> {
  await apiFetch<void>('/api/system/ping', {
    cache: 'no-store',
    signal,
    skipConnectivityReport: true,
    skipSessionErrorHandling: true,
  });
}

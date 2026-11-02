import { waitForFileUploadGate } from './gate';
import { findFileRule } from '@/lib/files/fileRules';

/**
 * The upload-outcome logic shared by the real MSW handler (`handlers.ts`, used by `npm run dev`
 * and Playwright's real browser) and the fake-`XMLHttpRequest` test harness (`tests/utils/fakeXhr.ts`,
 * used by Vitest). Kept in one place so "what does the mock do for this file name" has exactly one
 * definition — see that module's own doc comment for why Vitest cannot go through the real MSW
 * handler here: `@mswjs/interceptors`' jsdom `XMLHttpRequest` + `FormData`/`File` bridging throws
 * (`Cannot read properties of undefined (reading '_buffer')`) in this project's installed
 * `msw@2.15.0` / `jsdom@30.1.1` pairing — a jsdom-environment-specific defect in that bridging, not
 * in this slice's own request code (confirmed by reproducing the same failure against a bare
 * `XMLHttpRequest`/`FormData` with no application code involved). Real-browser Playwright runs are
 * unaffected — MSW's browser mode never goes through that bridging code at all.
 */
export interface MockUploadOutcome {
  status: number;
  body: Record<string, unknown>;
}

function violation(code: string, message: string, propertyName = 'Content') {
  return {
    errors: [{ propertyName, errorCode: code, errorMessage: message, resourceName: 'StoredFile' }],
    isValid: false,
  };
}

const scannedOnceFileNames = new Set<string>();

/**
 * HO-P5 BG-14 -- which purpose each uploaded file was stored for, so the shop mock can refuse a certificate file that is
 * not a fresh `OrganicCertificate` upload (`SetFoodDetailsCommandHandler.cs:36-42`). Only an upload that names its purpose
 * is recorded under it (the Vitest fake XHR does not pass one).
 */
const uploadedPurposes = new Map<string, string>();
export function uploadedFilePurpose(fileId: string): string | undefined {
  return uploadedPurposes.get(fileId);
}
let nextMockFileId = 1;

const GATE_NAME_PATTERN = /^gate-([a-zA-Z0-9_-]+)-/;

export interface MockUploadFileInfo {
  name: string;
  type: string;
  size: number;
}

/**
 * Every outcome §12 asks for, keyed off the uploaded file's own name (the one piece of a request a
 * test can set without needing per-purpose knowledge):
 *  - `reject-*` → `400 FileRejected`
 *  - `scan-unavailable-*` → `400 FileScanUnavailable` (stays this way every time)
 *  - `flaky-scan-once-*` → `400 FileScanUnavailable` the first time only, success after — proves
 *    Retry (C4/OQ-2) actually leads somewhere
 *  - `mismatch-*` → `400 FileContentMismatch`
 *  - `oversized-*` → `400 FileTooLarge`
 *  - `bad-purpose-*` → `403 FilePurposeNotAllowedForCaller`
 *  - `gate-<name>-*` → waits on the named gate (`gate.ts`) before succeeding — the "slow upload"
 *    fixture, released manually by a test, never a `sleep`
 *  - anything else → `201` with the §12.4 signed-file shape
 */
export async function resolveMockUploadOutcome(
  file: MockUploadFileInfo,
  buildContentUrl: (fileId: string, expUnixSeconds: number) => string,
  purpose?: string | null,
): Promise<MockUploadOutcome> {
  const name = file.name;

  // HO-P5 BG-14: an organic certificate is a PDF or an image, at most 10 MB -- `FileRules.cs:33-37`, refused in the order
  // `FilesController.ProcessFileSectionAsync` checks them (type at 252-255, then size at 288-291).
  if (purpose === 'OrganicCertificate') {
    const rule = findFileRule('OrganicCertificate');
    if (!rule.allowedContentTypes.includes((file.type || 'application/octet-stream').toLowerCase())) {
      return {
        status: 400,
        body: violation(
          'FileTypeNotAllowed',
          `'${file.type || 'application/octet-stream'}' is not an allowed type for purpose 'OrganicCertificate'.`,
          'ContentType',
        ),
      };
    }
    if (file.size > rule.maxSizeInBytes) {
      return {
        status: 400,
        body: violation(
          'FileTooLarge',
          `Exceeds the maximum size of ${rule.maxSizeInBytes} bytes for purpose 'OrganicCertificate'.`,
        ),
      };
    }
  }

  if (name.startsWith('reject-')) {
    return { status: 400, body: violation('FileRejected', 'The uploaded file was rejected.') };
  }
  if (name.startsWith('scan-unavailable-')) {
    return {
      status: 400,
      body: violation(
        'FileScanUnavailable',
        'The malware scanner is currently unavailable. Try again shortly.',
      ),
    };
  }
  if (name.startsWith('flaky-scan-once-') && !scannedOnceFileNames.has(name)) {
    scannedOnceFileNames.add(name);
    return {
      status: 400,
      body: violation(
        'FileScanUnavailable',
        'The malware scanner is currently unavailable. Try again shortly.',
      ),
    };
  }
  if (name.startsWith('mismatch-')) {
    return {
      status: 400,
      body: violation(
        'FileContentMismatch',
        "The file's content does not match its declared type.",
      ),
    };
  }
  if (name.startsWith('oversized-')) {
    return {
      status: 400,
      body: violation('FileTooLarge', 'Exceeds the maximum size for this purpose.'),
    };
  }
  if (name.startsWith('bad-purpose-')) {
    return {
      status: 403,
      body: violation(
        'FilePurposeNotAllowedForCaller',
        'You are not permitted to upload files for this purpose.',
        'Purpose',
      ),
    };
  }

  const gateMatch = GATE_NAME_PATTERN.exec(name);
  if (gateMatch?.[1]) {
    await waitForFileUploadGate(gateMatch[1]);
  }

  const fileId = `mock-file-${nextMockFileId}`;
  nextMockFileId += 1;
  if (purpose) uploadedPurposes.set(fileId, purpose);
  const exp = Math.floor(Date.now() / 1000) + 5 * 60;

  return {
    status: 201,
    body: {
      fileId,
      url: buildContentUrl(fileId, exp),
      contentType: file.type || 'application/octet-stream',
      sizeInBytes: file.size,
      originalFileName: name,
      urlExpiresOn: new Date(exp * 1000).toISOString(),
    },
  };
}

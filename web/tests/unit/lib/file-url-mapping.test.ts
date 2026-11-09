import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getApiUrl } from '@/lib/api/client';
import { uploadFile } from '@/lib/api/files';
import { installFakeXhr, restoreRealXhr } from '../../utils/fakeXhr';

/**
 * FIL backlog 25 -- the upload response's server-signed file url maps a RELATIVE
 * `/api/files/{id}/content?...` to an absolute API-origin url, so no component has to.
 */
const REL = '/api/files/9f1c/content?exp=1999999999&disp=inline&sig=abc';
const file = (url: string) => ({
  fileId: '9f1c',
  url,
  contentType: 'image/png',
  sizeInBytes: 10,
  originalFileName: 'a.png',
  urlExpiresOn: '2999-01-01T00:00:00.000Z',
});

describe('uploadFile response', () => {
  beforeEach(() =>
    installFakeXhr({ respond: () => ({ status: 201, body: file(REL) }) }),
  );
  afterEach(() => restoreRealXhr());

  it('anchors the url of the freshly uploaded file', async () => {
    const result = await uploadFile({
      file: new File([new Uint8Array(4)], 'a.png', { type: 'image/png' }),
      purpose: 'ProductImage',
      audience: 'staff',
    } as Parameters<typeof uploadFile>[0]);
    expect(result.url).toBe(getApiUrl(REL));
  });
});

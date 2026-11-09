import { describe, expect, it } from 'vitest';
import { getPublicBranches } from '@/lib/api/admin-branches';

/** A-APT1 (HO-ADM-002): the public branch type and the shared mock use the API's own field names. */
describe('public branch wire shape', () => {
  it('GET /api/branches sends addressLine/phoneNumber', async () => {
    const [raw] = await getPublicBranches();
    expect(raw).toHaveProperty('addressLine');
    expect(raw).toHaveProperty('phoneNumber');
    expect(raw).not.toHaveProperty('address');
    expect(raw).not.toHaveProperty('phone');
  });
});

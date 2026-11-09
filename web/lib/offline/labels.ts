/**
 * `lib/offline/labels.ts` — HO-XCT-002 §11.4. Plain-language wording for the codes the snapshot
 * carries. A status is always shown as text; an unknown code is spaced out rather than hidden.
 */

/** `CheckedIn` -> `Checked in`, `stockCounts` -> `Stock counts`. */
export function humanizeCode(code: string): string {
  const spaced = code.replace(/([a-z0-9])([A-Z])/g, '$1 $2').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

/** The sentence for a section left out of an otherwise valid copy, each reason in its own words. */
export function describeOmittedSection(section: string, reason: string): string {
  const label = humanizeCode(section);
  const lower = label.toLowerCase();
  if (reason === 'NotPermitted') {
    return `${label} weren't included in this copy. Your role doesn't include ${lower}, so they aren't saved on this device.`;
  }
  if (reason === 'NotAvailable') {
    return `${label} weren't included in this copy. That list isn't available in Amar Gram yet, so there was nothing to save.`;
  }
  return `${label} weren't included in this copy.`;
}

/** Up to two capital letters for an avatar: the first letters of the first and last word of the name. */
export function initialsOf(fullName: string | null | undefined): string {
  const words = (fullName ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const first = words[0]!.charAt(0);
  const last = words.length > 1 ? words[words.length - 1]!.charAt(0) : '';
  return `${first}${last}`.toUpperCase();
}

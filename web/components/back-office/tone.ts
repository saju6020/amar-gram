/**
 * The four status tones the back-office primitives share (HO-P4 §11.1, §8.3). Token classes only:
 * no hex, no rgb/hsl, no arbitrary colour values (U41 scans for them). Mango has no staff token
 * (OQ-1), so `warning` stands in for it.
 */
export type BackOfficeTone = 'neutral' | 'success' | 'warning' | 'danger';

/** Fill and text, each pairing at least 4.5:1. */
export const TONE_SURFACE: Record<BackOfficeTone, string> = {
  neutral: 'bg-surface-sunken text-ink-muted',
  success: 'bg-leaf-soft text-leaf-ink',
  warning: 'bg-warning-bg text-warning-ink',
  danger: 'bg-danger-bg text-danger-ink',
};

/** The matching border, for outlined tone cards. */
export const TONE_BORDER: Record<BackOfficeTone, string> = {
  neutral: 'border-border',
  success: 'border-leaf-soft',
  warning: 'border-warning-bg',
  danger: 'border-danger-bg',
};

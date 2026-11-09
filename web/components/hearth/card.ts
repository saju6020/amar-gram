/** Hearth card surfaces for customer screens (the store design: 24px radius, 1.5px border; staff screens do not use these). */
export const cardClass = 'rounded-3xl border-[1.5px] border-border bg-surface p-5 sm:px-6';
/** The neutral order-summary card: white, bordered, a little roomier. */
export const summaryCardClass = 'rounded-3xl border-[1.5px] border-border bg-surface p-6';
/** A sunken, borderless card for secondary notes and reasons. */
export const flatCardClass =
  'rounded-3xl border-[1.5px] border-surface-sunken bg-surface-sunken p-5 sm:px-6';
/** A 16px-radius inline banner (the design's `.banner`); add a tone class. */
export const bannerClass =
  'flex items-start gap-3 rounded-2xl border-[1.5px] px-[18px] py-3.5 text-sm';
export const bannerInfoClass = `${bannerClass} border-leaf/20 bg-leaf-soft text-leaf-ink`;
export const bannerWarnClass = `${bannerClass} border-warning-ink/20 bg-warning-bg text-warning-ink`;

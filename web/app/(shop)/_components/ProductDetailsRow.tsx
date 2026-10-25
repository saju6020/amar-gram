import * as React from 'react';

/**
 * The product details band (HO-P3 S2): the underline tabs, full width under the buy columns.
 * "Often bought together" no longer sits beside it - it is the "Goes well with" tiles at the foot
 * of the page (`ProductRecommendations`) - so this is a plain server-safe wrapper.
 */
export function ProductDetailsRow({ children }: { children: React.ReactNode }) {
  return <div className="min-w-0">{children}</div>;
}

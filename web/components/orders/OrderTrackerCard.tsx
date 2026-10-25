import { House, Package, ShoppingBag, Store, Truck } from 'lucide-react';
import { OrderTracker, type TrackerStep } from '@/components/hearth/OrderTracker';
import { cn } from '@/lib/utils';

/**
 * The card around the tracker (docs/design/store/MyOrders.dc.html, HO-P3 S4). Renders nothing for an order that has
 * no tracker (a cancelled order). The node statuses come from `orderTrackerSteps`, which only reads the order's
 * server-side status and history. `bare` drops the card's own border and padding, for use inside another card.
 */
export function OrderTrackerCard({
  steps,
  bare = false,
}: {
  steps: TrackerStep[] | null;
  bare?: boolean;
}) {
  if (!steps) return null;
  const pickup = steps[3]?.label === 'Ready to collect';
  const icons = [
    <ShoppingBag key="p" size={20} />,
    <Package key="c" size={20} />,
    <Package key="k" size={20} />,
    pickup ? <Store key="d" size={20} /> : <Truck key="d" size={20} />,
    <House key="h" size={20} />,
  ];
  const withIcons = steps.map((step, index) => ({ ...step, icon: icons[index] }));
  return (
    <section
      aria-label="Order progress"
      className={cn(
        !bare && 'rounded-card border-[1.5px] border-border bg-surface px-4 py-6 sm:px-8 sm:py-7',
      )}
    >
      <OrderTracker steps={withIcons} label="Order progress steps" />
    </section>
  );
}

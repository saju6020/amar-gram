import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { StatusPill } from '@/components/back-office/StatusPill';

/**
 * `components/back-office-admin/SettingsHub.tsx` — HO-P4 §11.6.10, OQ-8. A card grid where each card
 * names a setting area and links to the screen where it is edited (delivery zones, payment
 * settings, message templates, the maintenance switch). Nothing is edited here, and no value is
 * invented: a card says what lives behind its link, and the Shop card shows the maintenance state
 * the caller passes in (the page reads it from the system status query).
 */
export type MaintenanceState = 'loading' | 'on' | 'off' | 'unavailable';

interface HubCard {
  id: string;
  title: string;
  description: string;
  href: string;
  linkLabel: string;
}

const CARDS: HubCard[] = [
  {
    id: 'delivery',
    title: 'Delivery',
    description: 'The delivery zones and what customers pay to be delivered there.',
    href: '/staff/admin/delivery-zones',
    linkLabel: 'Delivery zones',
  },
  {
    id: 'payments',
    title: 'Payments',
    description: 'How customers can pay, and the rules that apply to payments.',
    href: '/staff/admin/payment-settings',
    linkLabel: 'Payment settings',
  },
  {
    id: 'templates',
    title: 'Message templates',
    description: 'The wording of the messages the system sends.',
    href: '/staff/admin/notification-templates',
    linkLabel: 'Message templates',
  },
];

function CardLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="mt-auto inline-flex min-h-11 w-fit items-center gap-2 font-semibold text-accent no-underline hover:underline"
    >
      {label}
      <ArrowRight size={16} aria-hidden="true" />
    </Link>
  );
}

function CardShell({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <li className="min-w-0">
      <section
        aria-labelledby={`settings-hub-${id}`}
        className="flex h-full flex-col gap-2 rounded-2xl border border-border bg-surface p-5"
      >
        <h2 id={`settings-hub-${id}`} className="font-display text-lg font-semibold text-ink">
          {title}
        </h2>
        {children}
      </section>
    </li>
  );
}

export function SettingsHub({ maintenance }: { maintenance: MaintenanceState }) {
  return (
    <ul aria-label="Where settings live" className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {CARDS.map((card) => (
        <CardShell key={card.id} id={card.id} title={card.title}>
          <p className="text-sm text-ink-muted">{card.description}</p>
          <CardLink href={card.href} label={card.linkLabel} />
        </CardShell>
      ))}
      <CardShell id="shop" title="Shop">
        <p className="text-sm text-ink-muted">
          Maintenance mode closes the shop to customers while staff screens keep working.
        </p>
        <p className="flex flex-wrap items-center gap-2 text-sm text-ink">
          Maintenance mode:
          {maintenance === 'loading' && <StatusPill tone="neutral">Checking…</StatusPill>}
          {maintenance === 'unavailable' && <StatusPill tone="neutral">Status unavailable</StatusPill>}
          {maintenance === 'on' && <StatusPill tone="danger">On</StatusPill>}
          {maintenance === 'off' && <StatusPill tone="success">Off</StatusPill>}
        </p>
        <CardLink href="/staff/admin/system" label="Maintenance switch" />
      </CardShell>
    </ul>
  );
}

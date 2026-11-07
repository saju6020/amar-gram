# Subscriptions Flow

## Status: Complete (backend, HO-P4 BG-15 / HO-P3 G2). Web screens are HO-SUB-002.

## What it does
A customer subscribes to a product staff have marked "Can be subscribed to" (every 2, 4, 6, 8 or 12
weeks, delivery or pickup, COD / bank transfer / pay at pickup). When a cycle's date arrives the
worker raises an **ordinary order through Ordering** (channel `Subscription`), and the customer is
told before it happens and can skip, pause, change or cancel up to a cut-off. There is **no
auto-charge, no token, no gateway** (ADR-238): a subscription saves re-ordering, not paying.
Spec: `docs/handover/HO-SUB-001.md` (adapted for Amar Gram, see below).

## Modules involved
| Module | Role |
|---|---|
| **Ordering** (feature segment `Subscription`, schema `subscription`) | Owns `SubscriptionAggregate` and `SubscriptionCycleAggregate` (ADR-237) |
| **Ordering** (orders) | Places each cycle's order: same ports, pricing, FEFO reservation, billing and messages as checkout |
| **Inventory** | Reserves by batch inside the order; the subscription never picks a batch |
| **Shop** | Product `IsSubscribable` flag (staff-editable); names and price via `ICatalogueLookup` |
| **Notifications** | Eight `subscription.*` templates; two subject guards; outbox only |
| **Administration** | Five `subscription.*` settings, the main branch's time zone |

## The flow
```
Subscribe (C1) ─ SKU purchasable + IsSubscribable · one live per customer+SKU · limit 20
   │            terms servable by Orders' own checkout quote (zone, COD ceiling, branch)
   ▼
Active ── NextDeliveryOn (local date, Asia/Dhaka)
   │   before the cut-off (2 days): skip / pause / change apply to the NEXT delivery
   │   after it: the change is PENDING and starts with the FOLLOWING cycle; the answer names the date
   ▼
SubscriptionWorkCycle (every 900 s, one scope per command, fixed pass order)
   1 unpaid      streak >= setting ──► SuspendSubscriptionCommand (re-checks the rule) ──► Suspended(UnpaidCycles)
   2 notices     notice date <= today < delivery ──► RequestNotificationCommand (once, NotAfter = cut-off)
   3 generation  due ──► query request ─► PlaceSubscriptionOrderCommand ─► RecordSubscriptionCycleCommand
   │              (three scopes; crash between 2 and 3 is repaired by the next pass: same idempotency key)
   ▼
Order outcome mirrored onto the cycle (OrderConfirmed / Cancelled(window) / Delivered / DeliveryFailed(refused))
   Expired or Refused = unpaid; Confirmed or Delivered ends the streak; Failed and Cancelled are ignored
```
Failures: out of stock / payment method / delivery / address missing consume the cycle and tell the
customer; an unavailable product also suspends. Staff (`Subscriptions.Manage`) reinstate; customers cannot.

## Key aggregates
- `SubscriptionAggregate` (Active, Paused, Suspended, Cancelled; owned `SubscribedProduct`, `Terms`,
  `PendingTerms`); schedule rules live in the pure `SubscriptionSchedule` (shared with the read side)
- `SubscriptionCycleAggregate` (own root, unbounded history; unique `(subscription_id, cycle_on)` and
  unique `order_id`); `UnpaidCycleRule.Streak` is **derived**, never stored

## Key invariants
- Exactly one order per cycle: order idempotency key `SubscriptionKeys.OrderIdempotencyGuid(id, cycleOn)`
  + `ix_subscription_cycle_per_date`; C8 treats a lost race as success
- Recording a cycle saves the cycle and advances the subscription in one `SaveChangesAsync` (ADR-240)
- Orders is never dispatched from inside a Subscriptions handler (F23, ADR-241)
- Event handlers (mirror, merge, account deletion) are idempotent and never enqueue (ADR-057)
- Events carry no strings; a cancellation note / reinstatement reason never reaches an event or a log
- `SubscriptionClock` is the only time-zone conversion point; its cut-off instant is UTC (Npgsql)

## Decisions made / adaptations from HO-SUB-001 (HO-P1, HO-P2)
- **Not built from HO-SUB-001**: the per-subscription authorisation pass (C10), its message and
  suspension reasons, and the `catalogue category group` rule. Eight templates (not nine). A product is subscribable when staff set `IsSubscribable`
  (`ProductAggregate.Subscription.cs`, `PUT /api/staff/shop/products/{id}` `isSubscribable`, exposed
  on the staff product detail)
- Live-subscription index is `ix_subscription_live_per_sku` on `(customer_id, sku_id)` (no nullable
  key column, so no `NULLS NOT DISTINCT`)
- "C-ORD-1/2/3" are not a separate Orders contract: `PlaceSubscriptionOrderCommandHandler` reuses
  Ordering's own ports and pure `CheckoutPricing`; the quote (`ICheckoutInputsLoader.LoadSubscriptionAsync`)
  stands in for `GetAvailablePaymentMethods`; the mirror handles this codebase's order events
- Subscriber discount: a labelled order discount (`Subscription discount`) from the setting, snapshotted
  on the cycle
- Merge: a duplicate's subscription the survivor already has is cancelled `CustomerMerged` and, like
  the rest, moves to the survivor, so a re-send finds nothing on the duplicate (2026-10-25)
- Staff: list, unpaid worklist, detail, customer panel, CSV export (injection-guarded), due-tomorrow tile
- Migration: edited into the in-place baseline `20261024151050_InitialAmarGram` (integrator re-baselines)

## Key files
- Domain: `src/Domain/AmarGram.Domain/Aggregates/Subscription/`, `DomainServices/Subscription*.cs`,
  `UnpaidCycleRule.cs`, `ValueObjects/Subscription{Clock,Terms}.cs`, `Events/Subscription/`
- Application: `CommandHandlers/Subscription/`, `Commands/Subscription/`, `DomainEventHandlers/Subscription/`,
  `CommandHandlers/Validators/SubscriptionCommandValidators.cs`
- Read: `src/Read/AmarGram.Read/QueryHandlers/Subscription/`, `ViewModels/SubscriptionViewModels.cs`
- Infrastructure: `Subscriptions/`, `Persistence/Configurations/Subscription*Configuration.cs`,
  `Notifications/Guards/Subscription*Guard.cs`
- Api: `Modules/SubscriptionsModule.cs`, `Controllers/{Customer,Staff}SubscriptionsController.cs`,
  `Background/Subscription{Worker,WorkCycle}.cs`
- Shared: `Constants/*Subscriptions.cs`, `Subscription{Rules,Keys,Messages,FailureClassifier}.cs`, `Enums/Subscription*.cs`
- Tests: `tests/*/Subscriptions/`, `tests/AmarGram.IntegrationTests/Endpoints/Subscriptions*EndpointTests.cs`
  (the discount test shares `AdministrationGlobalSettingsCollection`: the setting is global)

## Remaining work
- HO-SUB-002 web screens; invoice rendering of the discount is Ordering/Billing's
- No SMS / email provider: outside Development only the in-app copy reaches a customer
- I-D9 (a customer change racing C8) is guarded by `xmin` but has no dedicated test
- Auto-charge / failed-charge retry stay out of scope until a gateway exists (SRS Phase 5)

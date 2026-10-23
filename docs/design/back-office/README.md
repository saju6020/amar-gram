# Back office — UX

Twelve interactive staff screens that give the whole back office at a glance, in the Amar Gram theme.
Open [`index.html`](index.html) in a browser.

These screens carry their own deep banana-leaf sidebar (`#2F5114`, active item `#F4F8E8`). The
detailed per-area designs (orders, billing, imports & inventory, reporting, administration, accounts,
notifications, subscriptions, cross-cutting, file storage) live in their own folders and use the shared
staff shell rendered by `support.js`.

| File | Screen |
|---|---|
| `StaffSignIn.dc.html` | Staff sign in |
| `Dashboard.dc.html` | Dashboard (tiles, 14-day sales chart with table view, pipeline, alerts) |
| `Orders.dc.html` | Orders & fulfilment (pick list with first-expiry batch, packed → rider → delivered) |
| `CounterSale.dc.html` | Counter sale (POS) |
| `Products.dc.html` | Products list with bulk actions |
| `ProductEditor.dc.html` | Product editor (details, pack sizes, origin & certificate, photos, Bangla) |
| `Inventory.dc.html` | Inventory & batches, adjust stock |
| `Receiving.dc.html` | Goods receiving |
| `Customers.dc.html` | Customers |
| `Billing.dc.html` | Billing: maker-checker transfer approval, cash-up, invoices |
| `Reports.dc.html` | Reports |
| `Administration.dc.html` | Outlets, staff & roles, roster, settings |

Dashboard and report figures are labelled "Sample data".

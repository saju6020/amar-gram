# Dev sample data: seeding a database

`web/scripts/seed-dev.mjs` fills a database with one small, believable Dhaka organic shop. It goes
through the **real API**, so validation, the publication checklist, stock movements and audit all run
exactly as they do when someone uses the staff screens. `web/scripts/seed-dev-db.mjs` wraps the whole
job for one named database: create, migrate, bootstrap, start a private API, seed, verify, stop.

Both scripts are plain Node 20+ with no npm packages. Running them twice changes nothing: every item is
looked up before it is created.

## What it creates

| Area | Seeded |
|---|---|
| Staff (password `SEED_STAFF_PASSWORD`) | `e2e.admin@amargram.test` Administrator (Farhana Akter), `e2e.approver@amargram.test` Administrator (Shirin Sultana), `e2e.shopmanager@amargram.test` Shop manager, `e2e.reception@amargram.test` Reception, `e2e.inventory@amargram.test` Inventory. All are assigned to Main outlet as their primary branch. |
| Branch | The migration's main branch (`…ba1c`), renamed **Main outlet**, with its address in Dhanmondi, Dhaka 1209, a phone number, an email address, and opening hours of Saturday to Thursday 09:00–20:00 (closed on Friday). It also gets a sample billing profile. |
| Tax | Class **Standard** (`STANDARD`) at 0%. The migration's `DELIVERY` class gets a 0% rate if it has none. |
| Shop | The products in `web/scripts/data/amargram-catalogue.json` (HO-P2 §1.5): 44 published organic and everyday products across all 11 categories, from 9 producers (the API's `brand`), with 84 SKUs priced from ৳70 to ৳3,950. Food products have their country of origin, ingredients, storage, shelf life, net weight and allergens; about half carry certifications, and the certified-organic ones have a certifier and certificate number. The district of origin goes into the description and a tag, because the API keeps only the country. The origin countries are set up as featured sourcing origins. There are no images. |
| Stock | Supplier *Gram Distribution Ltd* (`GRAM-BD`), then 1 purchase order (issued), then 1 goods receipt of 24 units per SKU at Main outlet › Shop floor. Expiry-tracked SKUs get lot `SEED-2610-nn`, expiring 2027-09-30. Every SKU is sellable. |
| Content | One published **Shop** banner ("Free delivery in Dhaka on orders over ৳2,000") and 3 published FAQs. The **privacy** policy requires acceptance; the **terms** policy does not. Both have version 1 published. |
| Delivery | Zone **Dhaka** covering the whole Dhaka district, with cash on delivery allowed. Its Standard service costs ৳60, is free over ৳2,000, has a lead time of 1 day, and has two windows a day (10–14 and 15–19) from Saturday to Thursday. It also sets up a clearly fake bank-transfer account. |
| Customer (password `SEED_CUSTOMER_PASSWORD`) | **Ayesha Rahman**, `customer@amargram.test`, mobile `01819123456`. She has the address *Home*, House 12, Road 5, Block C, Mohammadpur, Dhaka 1207. She has not accepted the privacy policy yet, so the UI asks her once. |

These are **not** seeded: rosters, orders, invoices, product images, and any discount codes.

Effective dates: the API refuses tax rates dated in the past, so they take effect when the seed runs, not on 2026-01-01. SKU prices start 30 seconds before the run.

## Why one row is written directly

Every staff endpoint needs a signed-in Administrator, and the `DevUser` fallback does not help here:
`RequireActionFilter` answers 401 to any caller without a session. So the API cannot create the first
staff account. `seed-dev-db.mjs` inserts that single row (`e2e.admin@amargram.test`) without a
password, the same way `CreateStaffAccountCommand` would. Everything after that goes through the API,
including that admin's password, which is set by the normal reset flow.

## How passwords are set

Every staff account and the customer get their password through the normal reset flow:
`POST /api/staff/auth/password-reset/request` (or `/api/auth/…`), then
`POST /api/auth/password-reset/confirm`. The seeder reads the `#token=` link from the API's stdout.
The API's `DevelopmentChannelSender` writes there when it is started with
`Notifications:Channels:{Email,Sms}:Sender=Development`. The link must be an absolute **https** URL,
otherwise the message is suppressed as `RenderFailed`. That is why the seeding API runs with
`PublicSite:WebBaseUrl` and `Account:WebBaseUrl` set to `https://localhost:3000`. Passwords are never
printed.

## Run it (scratch database)

From the repo root, in Git Bash:

```bash
export PGPASSWORD=...                    # PostgreSQL password (PGHOST/PGPORT/PGUSER default to localhost/5432/postgres)
export SEED_STAFF_PASSWORD=...           # at least 10 characters
export SEED_CUSTOMER_PASSWORD=...        # at least 10 characters
node web/scripts/seed-dev-db.mjs --db amargram_seedcheck
```

The wrapper does the following:

1. Creates the database if it is missing. It never drops one.
2. Builds the API in **Release**, because the developer's own API usually holds `bin/Debug` locked.
3. Runs `dotnet ef database update --connection …` against that database.
4. Publishes a private copy of the API to a temp folder and **deletes its
   `appsettings.Development.json`** (that file points at `amargram_dev`).
5. Starts the copy on port **5099** with the overrides above, plus raised sign-in, reset and
   registration rate limits.
6. Runs `seed-dev.mjs` and then `seed-dev.mjs --verify`, and finally stops the API.

Options:

- `--port <n>` runs the seeding API on another port. Ports 5005 and 3000 are refused.
- `--skip-build` reuses the last Release build.
- `--no-verify` skips the checks.
- `--keep-log` keeps the API log.

Safety: the wrapper always refuses `amargram_test`, and refuses `amargram_dev` unless
`--i-mean-dev` is passed.

You can also run the seeder against an API you started yourself. That API must be in Development, use
the Development senders and an https base URL, and have its stdout redirected to a file:

```bash
node web/scripts/seed-dev.mjs --api http://localhost:5099 --api-log /path/to/api-stdout.log
node web/scripts/seed-dev.mjs --api http://localhost:5099 --verify    # read-only checks; empties the customer's cart after
```

`--verify` checks the following:

- Every staff account can sign in, and so can the customer.
- There is exactly one Shop banner, 3 FAQs, and a published terms policy.
- The shop filter brands are exactly the 9 seeded producers, and all 44 products are listed as in stock.
- The customer's only pending policy is `privacy`, and her address exists.
- A two-line delivery quote (Kalijira rice 2 kg ৳500 + mustard oil 1 L ৳850) gives subtotal 1,350,
  delivery 60 and total 1,410, with no excluded lines.
- Raising the rice quantity to 3 gives subtotal 2,350, delivery 0 and total 2,350.

## Rebuild `amargram_dev` from scratch

1. Stop the dev API (port 5005) and the web app (port 3000), so nothing holds connections to the
   database.
2. Back up the database:
   `pg_dump -h localhost -U postgres -Fc -f amargram_dev-<date>.dump amargram_dev`
   (see [backup-and-restore.md](backup-and-restore.md)).
3. Drop it:
   `psql -h localhost -U postgres -d postgres -c "DROP DATABASE amargram_dev WITH (FORCE)"`
4. Seed it. The wrapper creates the database again:
   `node web/scripts/seed-dev-db.mjs --db amargram_dev --i-mean-dev`
5. Start the dev API and the web app as usual. If you have one, set the e2e env file
   (`web/.env.e2e.local`) to the same `E2E_STAFF_*` identifiers, and set `E2E_STAFF_PASSWORD` to
   `SEED_STAFF_PASSWORD`.

To restore the old data instead, use `pg_restore -d amargram_dev <dump>` on an empty database.

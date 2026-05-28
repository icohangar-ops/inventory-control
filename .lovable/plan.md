
## Goal

A multi-user inventory system that owns stock truth (items, locations, on-hand qty, movements, valuation), receives POs from Precoro, posts COGS/stock journals to Xero, and exports valuation/movement data for Syft consolidation.

## Architecture

```text
 Precoro  ──(POs, vendors)──►  ┌─────────────────────────┐  ──(journals)──►  Xero
                               │  Inventory Control App  │
 Xero  ──(items, accounts)──►  │  (TanStack + Cloud DB)  │  ──(CSV export)──►  Syft
                               └─────────────────────────┘
```

Stack: TanStack Start + Lovable Cloud (Postgres + Auth). Xero & Precoro called from `createServerFn` handlers; OAuth tokens stored encrypted per workspace.

## Data model (Cloud DB)

- `locations` — warehouses / stockrooms
- `items` — SKU, name, UoM, default cost, xero_item_id, precoro_item_id, tracked (y/n)
- `stock_levels` — (item_id, location_id) → qty_on_hand, avg_cost
- `stock_movements` — append-only ledger: type (receipt/issue/transfer/adjust), item, from/to location, qty, unit_cost, reference (PO #, journal #), created_by, created_at
- `purchase_orders` — mirrored from Precoro: po_number, vendor, status, lines
- `po_receipts` — partial/full receipts against POs
- `journal_batches` — Xero posting log (status, xero_journal_id, payload, error)
- `integration_connections` — Xero/Precoro OAuth tokens, tenant ids
- `app_role` enum (`admin`, `warehouse`, `accountant`, `viewer`) + `user_roles` table + `has_role()` security-definer function (per Lovable RLS pattern)

Valuation method: **weighted average cost** (simplest, matches Xero's behavior). FIFO can come later.

## Roles

- **admin** — everything, manage integrations & users
- **accountant** — post journals to Xero, run valuation, export to Syft
- **warehouse** — receive POs, record issues/transfers/adjustments
- **viewer** — read-only

## Screens (v1)

1. **Dashboard** — stock value by location, low-stock items, pending PO receipts, last Xero post status
2. **Items** — list/search/edit SKUs, map to Xero & Precoro item IDs
3. **Locations** — manage warehouses
4. **Stock on hand** — pivot of item × location with qty + value
5. **Movements** — ledger with filters; "New movement" modal (receipt without PO / issue / transfer / adjustment with reason)
6. **Purchase orders** — list of POs synced from Precoro; click to receive (full/partial), creates receipt movements
7. **Journals** — period-end run: builds COGS + inventory journal from movements, preview, post to Xero
8. **Exports (Syft)** — date-range CSVs: stock valuation snapshot, movements, journal lines
9. **Settings → Integrations** — Connect Xero (OAuth), Connect Precoro (API token), sync items
10. **Settings → Users & roles** — invite users, assign roles
11. **Auth pages** — login, signup, reset-password

## Integrations

**Xero** (OAuth2)
- Scopes: `accounting.transactions accounting.settings accounting.contacts offline_access`
- Pull: chart of accounts (to map inventory + COGS GLs), items, tracking categories
- Push: manual journals for stock movements & period COGS
- Token refresh on each call via stored refresh_token

**Precoro** (API token)
- Pull: vendors, approved POs (paginated, incremental by `updated_at`)
- Sync job: server fn `syncPrecoroPOs()` callable from UI; cron later
- On receipt in our app, optionally PATCH PO status in Precoro (configurable)

**Syft** (CSV export)
- No live API — Syft reads from Xero. We export supplementary CSVs:
  - `valuation_YYYY-MM-DD.csv` (item, location, qty, avg_cost, value)
  - `movements_YYYYMM.csv`
  - `journal_lines_YYYYMM.csv`
- Downloaded from /exports page

## Build order

1. Enable Lovable Cloud + auth (email/password + Google), profiles table, roles table, RLS
2. Core schema migrations (items, locations, stock_levels, movements) + GRANTs + RLS
3. Item & Location CRUD + Stock-on-hand view
4. Manual stock movements (receipt/issue/transfer/adjust) with avg-cost recompute
5. Xero OAuth + items pull
6. Precoro API connection + PO pull + receive-against-PO flow
7. Journal builder + Xero posting
8. Syft CSV exports
9. Dashboard + polish

## Technical notes

- All integration calls in `createServerFn` (never client) — secrets via Lovable Cloud secrets (`XERO_CLIENT_ID`, `XERO_CLIENT_SECRET`, `PRECORO_API_KEY` or per-tenant token)
- Stock movements are **append-only**; `stock_levels` is a derived cache updated in a Postgres function `apply_movement(movement_id)` called transactionally
- Avg cost recompute: `new_avg = (qty*old_avg + recv_qty*recv_cost) / (qty + recv_qty)` on receipts; issues consume at current avg
- Journal posting is idempotent: each `journal_batch` row has a unique key; Xero idempotency-key on POST

## What v1 will NOT include (flag for later)

- FIFO/LIFO valuation
- Multi-currency
- Serial/lot tracking
- Barcode scanning
- Auto-sync schedules (manual "Sync" buttons only in v1)
- Writing items back to Xero/Precoro (one-way pull only in v1)
- Per-item reorder-point alerts beyond a simple dashboard list

## Open questions before I start

1. **Roughly how many SKUs / locations?** Your answer said "7" — was that 7 users, 7 SKUs, or 7 locations? Affects table/list UX choices.
2. **Valuation method** — confirm weighted-average is fine (Xero's native behavior), or do you need FIFO?
3. **Xero org type** — single Xero tenant, or do you consolidate multiple in Syft and need this app per-tenant?
4. **Visual direction** — any brand colors / preferred look (clean SaaS like Xero, dense like an ERP, dark mode)?

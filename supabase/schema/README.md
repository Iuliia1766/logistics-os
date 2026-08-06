# Database design

The v1 schema (`supabase/_v1_migrations/`) works for a demo and breaks on contact with
a real load board. This is the replacement. Below is what changed and why.

## Run order

```
00_extensions_reference.sql   extensions, us_places, equipment_types, load_stages
01_identity.sql               organizations, profiles, org_members, driver_profiles
02_loads.sql                  loads, load_stops, load_events, documents, tracking
03_marketplace_money.sql      offers, invoices, payments, broker_stats, subscriptions
04_comms.sql                  message_threads, thread_participants, messages
05_functions.sql              search, post/book/advance/cancel, offers, ping
06_views.sql                  v_loads, v_brokers, v_me, v_my_loads, v_my_threads
07_rls.sql                    RLS, grants, realtime
08_seed.sql                   ZIP import, brokers, synthetic payment history
```

ZIP loading is two steps because the CSV is flat lat/lng and the table wants a
geography point. Run `08_seed.sql` up to the `create table public.zip_import`
statement, import `supabase/seed/zips.csv` into `zip_import`, then run the rest:

```bash
psql "$DATABASE_URL" -c "create table public.zip_import (zip text, city text, state text, lat float8, lng float8)"
psql "$DATABASE_URL" -c "\copy public.zip_import FROM 'supabase/seed/zips.csv' CSV HEADER"
psql "$DATABASE_URL" -f supabase/schema/08_seed.sql
```

`broker_stats` is a materialised view. Refresh it nightly:

```sql
select cron.schedule('broker-stats', '0 4 * * *',
  $$refresh materialized view concurrently public.broker_stats$$);
```

---

## The five decisions that matter

### 1. PostGIS, not two float columns

v1 stored `lat`/`lng` and computed distance in JavaScript. That forced the board to
ship **every open load to the browser** before it could filter, and made "within 150
miles of me" unindexable. `us_places.geog` is a `geography(Point,4326)` with a GiST
index, so `ST_DWithin` is an index scan and `search_loads()` returns one page.

This is the difference between a board that works at 8 loads and one that works at
80,000.

### 2. Organizations, not users-as-companies

v1 put `company` and `mc_number` on the user row. That model dies the moment a carrier
hires a second driver or a shipper adds someone to the account. Freight is transacted
between **organizations**; people act for them through `org_members`. Every RLS policy
resolves through membership, which is why they all read the same way.

### 3. The state machine is data

v1's legal moves lived in a `CASE` inside `advance_load()`. They are now rows in
`load_stage_transitions (from, to, actor)`. Adding *cancelled* and *TONU* was a seed
line, not a function rewrite, and an illegal move fails on a lookup rather than on
whether anyone remembered to check.

### 4. Reliability is measured, not typed in

This is the one that matters commercially. v1 sold access to `on_time_pct` and
`avg_days_to_pay` — **columns someone typed by hand**. Here they are a materialised
view over `invoices` and `payments`: on-time means the invoice was settled on or before
`due_on`. The number a driver pays $29/month to see is now a measurement.

### 5. Entitlement is a subscription, not a boolean

v1 had `set_premium(boolean)` granted to `authenticated`. Any signed-in user could call
it and get the paid tier free. There is no such function here. `subscriptions` has no
INSERT or UPDATE grant at all — the billing webhook writes it with the service role, and
`i_am_premium()` reads it. `broker_stats` is revoked from `authenticated` outright, so
the only path to those columns is `v_brokers`, which is SECURITY DEFINER and checks the
subscription.

---

## Function audit — v1 → v2

| Function | Finding in v1 | Severity | Now |
|---|---|---|---|
| `set_premium` | Granted to every user. Premium was free to anyone who read the network tab. | **Critical** | Removed. Entitlement via `subscriptions` + webhook. |
| `advance_load` | `SELECT` then `UPDATE` with no lock — two taps could double-advance. | **High** | `SELECT … FOR UPDATE`; transitions validated against a table. |
| `advance_load` | Marked a load delivered with no POD; the only check was a browser checkbox. | **High** | `load_has_document(load,'pod')` enforced server-side. |
| `search_places` | Ordered city hits by ZIP, so "dallas" returned **Dallas, GA** first, then filled the list with 8 ZIPs from one city. Never matched `"Dallas, TX"` — which is exactly the string the app's resolver looked for, so the post form could not resolve a typed city at all. | **High** | One row per city, ranked by size, understands `City, ST`. |
| `handle_new_user` | Cast raw signup metadata straight to an enum. A bad `equipment` value raised inside the auth transaction and the signup failed with a 500. | **Medium** | Unknown values coerced to null; whole body wrapped so signup never dies. |
| `post_load` | No capacity check — 20,000 lb on a sprinter van was accepted. | **Medium** | Validated against `equipment_types.capacity_lb`. |
| `post_load` | No pickup-before-delivery check. | **Medium** | Validated, plus a table constraint. |
| `post_load` | Assigned a **random broker** to every load. | **Medium** | Broker is a parameter; null is allowed. |
| `book_load` | Never checked the carrier had operating authority. | **Medium** | Blocks a `pending` org. |
| `book_load` | The atomic claim was correct. | — | Kept as-is. |
| `send_message` | One flat thread per user with a `from_dispatch` flag — cannot express a conversation about a load with more than one counterparty. | **Medium** | Threads + participants, scoped to a load. |
| `zip_miles` / `road_miles` | Correct, but the road factor was hard-coded in the body. | Low | Reads `settings`. |
| `auto_dispatch_reply` | Fine for a demo; it is a fixture. | Low | Unchanged, still a stand-in. |

Constraints v1 left to the application, now enforced by the database: a load cannot be
in transit with no carrier; `delivered_at` is set exactly when stage is delivered;
stop windows cannot end before they start; an invoice cannot bill its own payee.

---

## What the app must change

The Next.js code in `src/` targets v1. Adopting this schema means:

| Code | Change |
|---|---|
| `requireProfile()` | Read `v_me` (`portal`, `company`, `is_premium`) instead of `profiles.role`. |
| Driver board query | Call `search_loads()` instead of `select * from v_loads where stage = 0` and filtering in `format.ts`. |
| `lib/format.ts` | Drop `filterLoads` / `sortLoads` / `deadhead` — the server does this now. Keep the formatters. |
| `Load` type | `shipper_id` → `shipper_org`; `carrier_id` → `carrier_org` + `driver_id`; `equipment` → `equipment_code`. |
| `setPremium()` | Delete. Replace with a checkout redirect; the webhook writes `subscriptions`. |
| `sendMessage()` | Now `send_message(body, load_id)`; read `v_my_threads`. |
| POD | Must upload a `pod` document before `advance_load` will deliver. |

`v_loads`, `v_brokers` and `book_load`/`advance_load`/`post_load` keep their names and
broad shapes, so the change is mechanical rather than a rewrite.

---

## Still not modelled

Deliberate omissions, so they are choices rather than oversights:

- **Insurance certificates and carrier onboarding.** A real board will not let a carrier
  book without a COI on file and an FMCSA authority check.
- **Factoring.** Most small carriers sell their invoices; `invoices.payee_org` would need
  to support assignment.
- **Accessorials** — detention, layover, lumper. `settings` holds the rates but nothing
  bills them.
- **Multi-currency.** The column exists; no FX table behind it.
- **Partitioning.** `load_tracking` grows fastest and will want monthly partitions.

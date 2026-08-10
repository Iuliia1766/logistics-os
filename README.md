# AI Logistics OS

A load board with two portals over one shared ledger. Drivers search open freight by
lane, deadhead, equipment and rate per mile, then book and run it. Shippers post freight
and watch it move. Neither side calls the other to ask where anything is.

**Stack:** Next.js (App Router) · Supabase (Postgres, Auth, Realtime, RLS) · Vercel

---

## Setting it up

**→ [SETUP.md](SETUP.md) — step by step, start to deployed.** Start there.

The rest of this file is about how the thing is built.

## Status

Typechecks, builds, and the pages render — verified with Node 24 / Next 15.5.
Not yet run against a real Supabase project, so expect to meet a few rough edges
on first use.

## How it is put together

**Two portals, one table.** `/driver` and `/shipper` are separate route groups with
separate queries. `requireProfile(role)` redirects anyone who lands in the wrong one.
Both read `public.loads`.

**The server owns the numbers.** Mileage, stage transitions and who booked what are
decided by Postgres functions (`post_load`, `book_load`, `advance_load`), not the client.
`book_load` claims a load with `where stage = 0 and carrier_id is null`, so two drivers
tapping at the same moment produce exactly one winner.

**Premium is a real gate, not a hidden div.** Broker reliability columns are withheld by a
column-level `GRANT` — a free account cannot read `reliability_score` even by hitting the
REST API directly. `v_brokers` hands those columns back only when `is_premium` is true,
and only the service role can set that.

**Distances** are great-circle × 1.15 from ZIP centroids, computed the same way in
Postgres (`road_miles`) and in the browser preview (`lib/format.ts`). Good for planning,
not for routing or billing — swap in a routing API when miles start deciding payment.

---

## Known gaps

- **No payments.** Premium is entitlement-only: `admin_set_premium()` is service_role
  only, and there is no client path to it. Point a payment provider's webhook at it
  before charging anyone.
- **Dispatch is a canned auto-reply** (`auto_dispatch_reply` in `0002_functions.sql`).
  Replace it with real dispatcher accounts; the thread shape does not change.
- **ETAs are arithmetic**, not telematics: `miles_remaining / 50 mph`.
- **Brokers are seed data.** There is no broker portal and no way to earn a reliability
  score — those numbers are fixtures.
- **No tests.**

---

## Data

ZIP codes and coordinates from [GeoNames](https://www.geonames.org/), CC BY 4.0.
41,197 postal codes across 29,668 places, including AK, HI, PR, VI, GU, AS and MP.
Military APO/FPO ZIPs are excluded — they are not freight destinations.

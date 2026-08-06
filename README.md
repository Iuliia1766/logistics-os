# AI Logistics OS

A load board with two portals over one shared ledger. Drivers search open freight by
lane, deadhead, equipment and rate per mile, then book and run it. Shippers post freight
and watch it move. Neither side calls the other to ask where anything is.

**Stack:** Next.js (App Router) · Supabase (Postgres, Auth, Realtime, RLS) · Vercel

---

## Status

The code is complete but **has never been built or run** — it was written without Node
installed, so `npm install`, typecheck and build have not been exercised. Expect to fix
a small number of mistakes on the first `npm run dev`. Everything below is the setup you
need before it can work at all.

---

## 1. Supabase

Create a project, then open **SQL Editor** and run these in order:

| Order | File | What it does |
|---|---|---|
| 1 | `supabase/migrations/0001_schema.sql` | Tables, enums, views |
| 2 | `supabase/migrations/0002_functions.sql` | RPCs, distance maths, signup trigger |
| 3 | `supabase/migrations/0003_rls.sql` | Row level security, grants, realtime |
| 4 | `supabase/seed/brokers.sql` | Seven brokers with payment histories |

Then load the ZIP table (41,197 rows — too big for the SQL editor):

**Table Editor → `zips` → Import data from CSV → `supabase/seed/zips.csv`**

Or from a terminal, using the connection string in *Project Settings → Database*:

```bash
psql "$DATABASE_URL" -c "\copy public.zips(zip,city,state,lat,lng) FROM 'supabase/seed/zips.csv' CSV HEADER"
```

Sanity check — this should return `41197` and `483`:

```sql
select (select count(*) from public.zips) as zips,
       public.zip_miles('75201','38103')  as dallas_to_memphis_miles;
```

### Auth settings

*Authentication → Providers → Email* — turn **Confirm email** off while you are testing,
or add `https://YOUR-APP.vercel.app/auth/callback` and `http://localhost:3000/auth/callback`
to *URL Configuration → Redirect URLs*.

---

## 2. Run it locally

You need Node 18.18+ installed (`brew install node`).

```bash
cp .env.local.example .env.local   # then paste your URL + anon key into it
npm install
npm run dev
```

Both values come from *Project Settings → API*. The anon key is meant to be public —
RLS is what protects the data. **Never put the `service_role` key in this app.**

---

## 3. Deploy

Push to GitHub, import the repo in Vercel, and add the same two environment variables
in *Vercel → Project → Settings → Environment Variables*. Vercel builds on every push.

```bash
git remote add origin git@github.com:YOUR-USER/logistics-os.git
git push -u origin main
```

---

## Try it

Sign up twice — once as a **Shipper**, once as a **Driver** (use a different email; a
driver also needs a home ZIP, which is where deadhead is measured from).

1. As the shipper, post a load: `75201` → `38103`, offer $1,400.
2. Sign out, sign in as the driver. The load is on the board with its miles, $/mi and
   deadhead from your ZIP. Book it.
3. Advance it through pickup → transit → delivered.
4. Sign back in as the shipper. The manifest tracker has followed along the whole way.

---

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
REST API directly. `v_brokers` hands those columns back only when `is_premium` is true.

**Distances** are great-circle × 1.15 from ZIP centroids, computed the same way in
Postgres (`road_miles`) and in the browser preview (`lib/format.ts`). Good for planning,
not for routing or billing — swap in a routing API when miles start deciding payment.

---

## Known gaps

- **No payments.** Premium is a boolean the user can toggle. Wire a payment provider's
  webhook to `set_premium()` and remove the client-side call before charging anyone.
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

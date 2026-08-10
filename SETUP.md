# Setup — start to deployed

Six steps, about 20 minutes. Do them in order; each one needs the one before it.

Everything in the code is done and verified — it typechecks, it builds, and the
pages render. What is left is connecting your three accounts, which needs your
logins, so it has to be you.

---

## Step 1 — Install Node

Go to **[nodejs.org](https://nodejs.org)** and download the **LTS** installer for macOS
(the `.pkg`). Open it and click through.

Then check it worked. Open Terminal and run:

```bash
node -v
```

You should see something like `v24.19.0`. If you get "command not found", close
Terminal, open a new one and try again.

---

## Step 2 — Put the code on GitHub

Go to **[github.com/new](https://github.com/new)** and create a repository:

- **Name:** `logistics-os`
- **Private** is fine
- Do **not** tick "Add a README", "Add .gitignore" or "Choose a license" — the repo
  already has all three, and ticking them will cause a conflict

On the next screen GitHub shows you a URL like
`https://github.com/YOUR-NAME/logistics-os.git`. Copy it, then run this in Terminal,
pasting your URL in place of the one below:

```bash
cd ~/Documents/LogisticsOS && git remote add origin https://github.com/YOUR-NAME/logistics-os.git && git push -u origin main
```

GitHub will ask you to sign in. Refresh the repo page — your files should be there.

---

## Step 3 — Create the Supabase database

Go to **[supabase.com/dashboard](https://supabase.com/dashboard)** → **New project**.

- **Name:** `logistics-os`
- **Database password:** let it generate one, and save it somewhere
- **Region:** pick the one closest to you

It takes a minute or two to finish setting up.

### Run the five SQL files

Open **SQL Editor** in the left sidebar. For each file below, in this order: open the
file on your computer, copy everything in it, paste it into the editor, and press
**Run**. Wait for "Success" before moving to the next one.

1. `supabase/_v1_migrations/0001_schema.sql`
2. `supabase/_v1_migrations/0002_functions.sql`
3. `supabase/_v1_migrations/0003_rls.sql`
4. `supabase/_v1_migrations/0004_profile.sql`
5. `supabase/_v1_migrations/0005_premium_fix.sql`

Then one more, which fills in the broker list:

6. `supabase/seed/brokers.sql`

> **Use the `_v1_migrations` folder, not `supabase/schema/`.** The `schema/` folder is a
> newer, better database design, but the app code has not been moved over to it yet.
> Running it will leave you with an app that cannot talk to its database.

### Turn off email confirmation (for now)

**Authentication → Sign In / Providers → Email** and switch **Confirm email** off.
This lets you sign up and get straight in while testing. Turn it back on before real
users arrive.

---

## Step 4 — Load the ZIP codes

The app needs all 41,197 US ZIP codes to calculate distance and deadhead. That is too
much to paste into the SQL editor, so there is a script for it.

In Supabase go to **Project Settings → API Keys** and copy the **`service_role`** key.
This key can do anything to your database, so:

- paste it only into the command below, nowhere else
- never put it in `.env.local`
- never commit it

From **Project Settings → Data API**, copy your **Project URL** too. Then run this,
substituting both values:

```bash
cd ~/Documents/LogisticsOS && SUPABASE_URL=https://YOUR-REF.supabase.co SUPABASE_SERVICE_ROLE_KEY=YOUR-SERVICE-ROLE-KEY node scripts/seed-zips.mjs
```

It prints progress and takes a minute or so. To confirm, run this in the SQL editor —
it should return **41197**:

```sql
select count(*) from zips;
```

---

## Step 5 — Run it on your own machine

In Supabase, go to **Project Settings → API Keys** and copy the **`anon`** key (the
public one — *not* `service_role` this time).

Open `.env.local` in the project folder and fill in the two blanks:

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR-ANON-KEY
```

Then start it:

```bash
cd ~/Documents/LogisticsOS && npm run dev
```

Open **http://localhost:3000**. You should see the front page with the two sign-up
buttons.

**Test it properly:** sign up as a **Shipper** (any email, any 8-character password).
Post a load from `75201` to `38103`. Sign out. Sign up as a **Carrier** with a
different email and home ZIP `75201`. Your load should be sitting on the board with
its miles, $/mi and deadhead. Book it, then move it through to delivered. Sign back in
as the shipper and the tracker will have followed the whole way.

Stop the server with `Ctrl+C`.

---

## Step 6 — Deploy to Vercel

Go to **[vercel.com/new](https://vercel.com/new)** and import your `logistics-os` repo.

Before clicking Deploy, open **Environment Variables** and add the same two from
Step 5:

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://YOUR-REF.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your anon key |

Click **Deploy**. When it finishes you get a URL like `logistics-os.vercel.app`.

Last thing: back in Supabase, go to **Authentication → URL Configuration** and add
your Vercel URL to **Site URL**, and add this to **Redirect URLs**:

```
https://YOUR-APP.vercel.app/auth/callback
```

From now on, every `git push` redeploys automatically.

---

## If something goes wrong

**"command not found: node"** — Step 1 did not finish. Close Terminal, open a new one.

**Sign-up seems to work but you land back on the sign-in page** — email confirmation is
still on. Step 3, last part.

**The load board is empty after posting a load** — you are signed in as the shipper who
posted it. A shipper sees their own shipments; the board is the carrier's view. Sign in
with the carrier account.

**"We do not recognise one of those ZIP codes"** — Step 4 did not finish. Check
`select count(*) from zips;` returns 41197.

**Vercel build fails** — almost always a missing environment variable. Check both are
set, then **Deployments → ⋯ → Redeploy**.

**"No Output Directory named 'public' found"** — Vercel's Framework Preset got set to
something other than Next.js. Go to **Settings → General → Build & Development
Settings**, set **Framework Preset** to **Next.js**, turn off any **Output Directory**
override, then **Deployments → ⋯ → Redeploy**.

---

## Turning Premium on for yourself

There is no button for this on purpose — a signed-in user must not be able to grant
themselves the paid tier. To switch it on for your own account while testing, run this
in the Supabase SQL editor:

```sql
select public.admin_set_premium('you@example.com', true);
```

Reload the app and broker reliability scores will be visible.

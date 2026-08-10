#!/usr/bin/env node
/**
 * Loads supabase/seed/zips.csv into the `zips` table.
 *
 * 41,197 rows is more than the SQL editor will take in one paste, and the
 * dashboard CSV importer is slow and easy to get wrong. This posts them in
 * batches through the REST API instead.
 *
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
 *   node scripts/seed-zips.mjs
 *
 * The service role key bypasses row level security, which is the point —
 * `zips` is read-only to everyone else. Pass it on the command line as
 * above; never put it in .env.local, and never in a NEXT_PUBLIC_ variable.
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const CSV = join(HERE, '..', 'supabase', 'seed', 'zips.csv');
const BATCH = 1000;
const DRY = process.argv.includes('--dry-run');

const url = process.env.SUPABASE_URL?.replace(/\/+$/, '');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!DRY && (!url || !key)) {
  console.error(
    'Set both variables, for example:\n\n' +
    '  SUPABASE_URL=https://xxx.supabase.co \\\n' +
    '  SUPABASE_SERVICE_ROLE_KEY=eyJ... \\\n' +
    '  node scripts/seed-zips.mjs\n',
  );
  process.exit(1);
}

const text = await readFile(CSV, 'utf8');
// the file was written with CRLF line endings
const lines = text.trim().split(/\r?\n/);
const header = lines.shift().split(',');
const want = ['zip', 'city', 'state', 'lat', 'lng'];
if (want.some((c, i) => header[i] !== c)) {
  console.error(`Unexpected CSV header: ${header.join(',')}`);
  process.exit(1);
}

const rows = [];
for (const line of lines) {
  // city names contain commas ("Sault Ste. Marie"), so split from both ends
  const first = line.indexOf(',');
  const rest = line.slice(first + 1);
  const lastTwo = rest.lastIndexOf(',');
  const lastThree = rest.lastIndexOf(',', lastTwo - 1);
  const lastFour = rest.lastIndexOf(',', lastThree - 1);
  const zip = line.slice(0, first);
  const city = rest.slice(0, lastFour).replace(/^"|"$/g, '');
  const state = rest.slice(lastFour + 1, lastThree);
  const lat = Number(rest.slice(lastThree + 1, lastTwo));
  const lng = Number(rest.slice(lastTwo + 1));

  if (!/^\d{5}$/.test(zip) || !city || state.length !== 2 || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    console.error(`Skipping unparseable row: ${line}`);
    continue;
  }
  rows.push({ zip, city, state, lat, lng });
}

console.log(`Parsed ${rows.length.toLocaleString()} ZIP codes from zips.csv`);
if (DRY) {
  console.log('Sample:', rows.slice(0, 2), '…', rows.at(-1));
  console.log('Dry run — nothing sent.');
  process.exit(0);
}

let done = 0;
for (let i = 0; i < rows.length; i += BATCH) {
  const chunk = rows.slice(i, i + BATCH);
  const res = await fetch(`${url}/rest/v1/zips`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=ignore-duplicates,return=minimal',
    },
    body: JSON.stringify(chunk),
  });
  if (!res.ok) {
    console.error(`\nBatch starting at row ${i} failed: ${res.status} ${await res.text()}`);
    process.exit(1);
  }
  done += chunk.length;
  process.stdout.write(`\r  loaded ${done.toLocaleString()} / ${rows.length.toLocaleString()}`);
}

console.log(`\nDone. Check it with:  select count(*) from zips;   →  ${rows.length}`);

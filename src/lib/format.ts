import type { Load, LoadFilters, SortKey } from './types';

export const usd = (n: number) =>
  '$' + Math.round(n).toLocaleString('en-US');

export const rpm = (n: number) => '$' + Number(n).toFixed(2);

export const lbs = (n: number) => n.toLocaleString('en-US') + ' lb';

export const miles = (n: number) => n.toLocaleString('en-US');

export const dims = (l: Load) => `${l.len_in} × ${l.wid_in} × ${l.hgt_in} in`;

export const cityOf = (city: string, state: string) => `${city}, ${state}`;

export const withZip = (city: string, state: string, zip: string) =>
  `${city}, ${state} ${zip}`;

/** Great-circle distance with the same 1.15 road factor the database uses. */
export function roadMiles(
  lat1: number, lng1: number, lat2: number, lng2: number,
): number {
  const R = 3958.8;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)) * 1.15);
}

/** Miles from where the driver is sitting to the load's pickup. */
export function deadhead(load: Load, from: { lat: number; lng: number } | null): number | null {
  if (!from) return null;
  return roadMiles(from.lat, from.lng, load.origin_lat, load.origin_lng);
}

export function deadheadLabel(mi: number | null): string {
  if (mi === null) return 'Set your location';
  return mi === 0 ? 'In town' : `${miles(mi)} mi out`;
}

export function etaLabel(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function dateLabel(iso: string | null): string {
  if (!iso) return 'TBD';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'TBD';
  return d.toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

export function timeAgo(iso: string): string {
  const secs = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 90) return 'just now';
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.round(hrs / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

/** Matches a load's city against typed text — city name, partial name, or ZIP. */
function matchPlace(city: string, state: string, zip: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (/^\d+$/.test(q)) return zip.startsWith(q);
  return `${city}, ${state}`.toLowerCase().includes(q);
}

export function filterLoads(
  loads: Load[],
  f: LoadFilters,
  origin: { lat: number; lng: number } | null,
): Load[] {
  return loads.filter((l) => {
    if (!matchPlace(l.origin_city, l.origin_state, l.origin_zip, f.from)) return false;
    if (!matchPlace(l.dest_city, l.dest_state, l.dest_zip, f.to)) return false;
    if (f.equipment) {
      if (f.equipment === 'box') {
        if (!l.equipment.startsWith('box')) return false;
      } else if (l.equipment !== f.equipment) return false;
    }
    if (f.minRpm && Number(l.rate_per_mile) < Number(f.minRpm)) return false;
    if (f.trip === 's' && l.miles >= 250) return false;
    if (f.trip === 'm' && (l.miles < 250 || l.miles > 600)) return false;
    if (f.trip === 'l' && l.miles <= 600) return false;
    if (f.maxDeadhead) {
      const dh = deadhead(l, origin);
      if (dh === null || dh > Number(f.maxDeadhead)) return false;
    }
    return true;
  });
}

export function sortLoads(
  loads: Load[],
  key: SortKey,
  origin: { lat: number; lng: number } | null,
): Load[] {
  const out = [...loads];
  out.sort((a, b) => {
    switch (key) {
      case 'rpm':
        return Number(b.rate_per_mile) - Number(a.rate_per_mile);
      case 'rate':
        return Number(b.rate) - Number(a.rate);
      case 'deadhead': {
        const da = deadhead(a, origin) ?? Number.MAX_SAFE_INTEGER;
        const db = deadhead(b, origin) ?? Number.MAX_SAFE_INTEGER;
        return da - db;
      }
      case 'newest':
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      default:
        return 0;
    }
  });
  return out;
}

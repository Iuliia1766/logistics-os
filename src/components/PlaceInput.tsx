'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Place } from '@/lib/types';

/**
 * City-or-ZIP box. 41,000 ZIPs is far too many to ship to the browser, so
 * suggestions come from search_places() as you type, debounced.
 */
export function PlaceInput({
  name, label, value, onChange, onResolve, placeholder, required,
}: {
  name: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  /** Fires with the ZIP once the text matches a real place, null when it stops matching. */
  onResolve?: (place: Place | null) => void;
  placeholder?: string;
  required?: boolean;
}) {
  const listId = useId();
  const [places, setPlaces] = useState<Place[]>([]);
  const supabase = useRef(createClient());

  useEffect(() => {
    const q = value.trim();
    if (q.length < 2) {
      setPlaces([]);
      onResolve?.(null);
      return;
    }

    let cancelled = false;
    const t = setTimeout(async () => {
      const { data } = await supabase.current.rpc('search_places', { q });
      if (cancelled) return;
      const rows = (data ?? []) as Place[];
      setPlaces(rows);

      // Resolved when the text is an exact ZIP, or names exactly one place.
      const exactZip = rows.find((p) => p.zip === q);
      const exactCity = rows.filter(
        (p) => `${p.city}, ${p.state}`.toLowerCase() === q.toLowerCase(),
      );
      onResolve?.(exactZip ?? (exactCity.length ? exactCity[0] : null));
    }, 180);

    return () => { cancelled = true; clearTimeout(t); };
    // onResolve is a render-stable callback from the parent
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <input
        className="input"
        id={name}
        name={name}
        list={listId}
        value={value}
        required={required}
        placeholder={placeholder ?? 'City or ZIP'}
        autoComplete="off"
        onChange={(e) => onChange(e.target.value)}
      />
      <datalist id={listId}>
        {places.map((p) => (
          <option key={p.zip} value={p.zip} label={`${p.city}, ${p.state}`} />
        ))}
      </datalist>
    </div>
  );
}

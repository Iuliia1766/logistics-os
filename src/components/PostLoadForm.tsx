'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from './Icons';
import { Toast } from './Toast';
import { PlaceInput } from './PlaceInput';
import { postLoad } from '@/app/actions/loads';
import { EQUIPMENT_LABELS, EQUIPMENT_ORDER, type Place } from '@/lib/types';
import { roadMiles } from '@/lib/format';

export function PostLoadForm() {
  const router = useRouter();
  const [fromText, setFromText] = useState('');
  const [toText, setToText] = useState('');
  const [from, setFrom] = useState<Place | null>(null);
  const [to, setTo] = useState<Place | null>(null);
  const [fromGeo, setFromGeo] = useState<{ lat: number; lng: number } | null>(null);
  const [toGeo, setToGeo] = useState<{ lat: number; lng: number } | null>(null);
  const [rate, setRate] = useState('700');
  const [pieces, setPieces] = useState('4');
  const [len, setLen] = useState('48');
  const [wid, setWid] = useState('40');
  const [hgt, setHgt] = useState('48');
  const [toast, setToast] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Preview only. post_load() recomputes mileage server-side before it inserts.
  const estMiles = fromGeo && toGeo
    ? roadMiles(fromGeo.lat, fromGeo.lng, toGeo.lat, toGeo.lng)
    : null;
  const estRpm = estMiles && Number(rate) > 0 ? Number(rate) / estMiles : null;
  const cube = [pieces, len, wid, hgt].every((v) => Number(v) > 0)
    ? (Number(len) * Number(wid) * Number(hgt) * Number(pieces)) / 1728
    : null;

  async function resolveGeo(place: Place | null, which: 'from' | 'to') {
    const setPlace = which === 'from' ? setFrom : setTo;
    const setGeo = which === 'from' ? setFromGeo : setToGeo;
    setPlace(place);
    if (!place) { setGeo(null); return; }
    const { createClient } = await import('@/lib/supabase/client');
    const { data } = await createClient()
      .from('zips').select('lat, lng').eq('zip', place.zip).maybeSingle();
    setGeo(data ? { lat: data.lat as number, lng: data.lng as number } : null);
  }

  function onSubmit(formData: FormData) {
    if (!from || !to) {
      setToast('Pick a pickup and delivery point from the suggestions.');
      return;
    }
    formData.set('origin_zip', from.zip);
    formData.set('dest_zip', to.zip);
    startTransition(async () => {
      const res = await postLoad(formData);
      setToast(res.message);
      if (res.ok) { router.push('/shipper'); router.refresh(); }
    });
  }

  return (
    <>
      <div className="page-head">
        <h1 className="h1">Post a load</h1>
        <p className="sub">
          Distance and rate per mile calculate as you type — the same numbers a driver judges it by.
        </p>
      </div>

      <div style={{ maxWidth: '44rem' }}>
        <form className="card" action={onSubmit}>
          <div className="form-grid">
            <PlaceInput name="origin_display" label="Pick up in — city or ZIP" value={fromText}
              onChange={setFromText} onResolve={(p) => resolveGeo(p, 'from')}
              placeholder="e.g. Dallas, TX or 75201" required />
            <PlaceInput name="dest_display" label="Deliver to — city or ZIP" value={toText}
              onChange={setToText} onResolve={(p) => resolveGeo(p, 'to')}
              placeholder="e.g. 38103" required />

            <div className="field">
              <label htmlFor="pickup_at">Pickup window</label>
              <input className="input" id="pickup_at" name="pickup_at" type="datetime-local" />
            </div>
            <div className="field">
              <label htmlFor="deliver_by">Delivery window</label>
              <input className="input" id="deliver_by" name="deliver_by" type="datetime-local" />
            </div>

            <div className="field full">
              <label htmlFor="commodity">Commodity</label>
              <input className="input" id="commodity" name="commodity" placeholder="What is it?"
                defaultValue="CNC machine parts" />
            </div>

            <div className="field">
              <label htmlFor="equipment">Equipment needed</label>
              <select className="input" id="equipment" name="equipment" defaultValue="sprinter_van">
                {EQUIPMENT_ORDER.map((e) => (
                  <option key={e} value={e}>{EQUIPMENT_LABELS[e]}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="weight_lb">Total weight (lb)</label>
              <input className="input" id="weight_lb" name="weight_lb" type="number" min={1}
                defaultValue={2400} required />
            </div>
            <div className="field">
              <label htmlFor="pieces">Pieces / pallets</label>
              <input className="input" id="pieces" name="pieces" type="number" min={1}
                value={pieces} onChange={(e) => setPieces(e.target.value)} />
            </div>
            <div className="field">
              <label>Each piece — L × W × H (in)</label>
              <div className="dims">
                <input className="input" name="len_in" type="number" min={1} aria-label="Length in inches"
                  value={len} onChange={(e) => setLen(e.target.value)} />
                <input className="input" name="wid_in" type="number" min={1} aria-label="Width in inches"
                  value={wid} onChange={(e) => setWid(e.target.value)} />
                <input className="input" name="hgt_in" type="number" min={1} aria-label="Height in inches"
                  value={hgt} onChange={(e) => setHgt(e.target.value)} />
              </div>
            </div>
            <div className="field full">
              <label htmlFor="rate">Rate you’re offering ($)</label>
              <input className="input" id="rate" name="rate" type="number" min={1} required
                value={rate} onChange={(e) => setRate(e.target.value)} />
            </div>
          </div>

          <div className="calc">
            <div>
              <div className="l">Distance</div>
              <div className="v">{estMiles ? `${estMiles.toLocaleString()} mi` : '—'}</div>
            </div>
            <div>
              <div className="l">Rate / mile</div>
              <div className="v">{estRpm ? `$${estRpm.toFixed(2)}` : '—'}</div>
            </div>
            <div>
              <div className="l">Total cube</div>
              <div className="v">{cube ? `${cube.toFixed(1)} ft³` : '—'}</div>
            </div>
          </div>

          <button className="btn btn-primary" style={{ marginTop: 14 }} type="submit" disabled={pending}>
            <Icon name="plus" size={15} /> Post to the load board
          </button>
        </form>
      </div>

      <Toast message={toast} onDismiss={() => setToast(null)} />
    </>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Icon } from './Icons';
import { ManifestTracker } from './ManifestTracker';
import { FreightCard } from './FreightCard';
import { ActivityFeed } from './MyLoads';
import { EQUIPMENT_LABELS, STAGES, type Load, type LoadEvent } from '@/lib/types';
import { lbs, miles, rpm, usd } from '@/lib/format';

export function Shipments({ loads, events }: { loads: Load[]; events: LoadEvent[] }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(loads[0]?.id ?? null);

  // A driver booking or advancing this load updates the page live.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('my-shipments')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'loads' }, () => router.refresh())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [router]);

  if (!loads.length) {
    return (
      <>
        <div className="page-head"><h1 className="h1">My shipments</h1></div>
        <div className="empty">
          <div className="e-t">No shipments yet</div>
          Post a load and it appears here the moment it goes live.{' '}
          <a className="link-btn" href="/shipper/post">Post a load</a>
        </div>
      </>
    );
  }

  const sel = loads.find((l) => l.id === selectedId) ?? loads[0];

  return (
    <>
      <div className="page-head">
        <h1 className="h1">My shipments</h1>
        <p className="sub">Every stage updates itself. Nothing to call and ask about.</p>
      </div>

      <div className="split">
        <div className="list">
          {loads.map((l) => (
            <button key={l.id} className={'item' + (l.id === sel.id ? ' on' : '')}
              onClick={() => setSelectedId(l.id)}>
              <div className="item-top">
                <span className="item-id">{l.ref}</span>
                <span className="mono" style={{ fontSize: '.72rem', color: 'var(--ink-2)' }}>
                  {usd(l.rate)} · {rpm(l.rate_per_mile)}/mi
                </span>
              </div>
              <div className="item-route">
                {l.origin_city}, {l.origin_state} → {l.dest_city}, {l.dest_state}
              </div>
              <div className="item-meta">
                {miles(l.miles)} mi · {lbs(l.weight_lb)} · {EQUIPMENT_LABELS[l.equipment]}
              </div>
              <div className="item-stage">{STAGES[l.stage]}</div>
            </button>
          ))}
          <a className="btn btn-ghost" style={{ width: '100%', borderStyle: 'dashed', marginTop: 4 }}
            href="/shipper/post">
            <Icon name="plus" size={15} /> Post a new load
          </a>
        </div>

        <div>
          <ManifestTracker load={sel} />
          <div style={{ height: 12 }} />
          <div className="stat-row">
            <div className="stat"><div className="l">Distance</div><div className="v">{miles(sel.miles)}</div></div>
            <div className="stat"><div className="l">Rate</div><div className="v">{usd(sel.rate)}</div></div>
            <div className="stat"><div className="l">Per mile</div><div className="v">{rpm(sel.rate_per_mile)}</div></div>
            <div className="stat"><div className="l">Weight</div><div className="v">{miles(sel.weight_lb)}</div></div>
          </div>

          <div className="card" style={{ marginTop: 12 }}>
            <div className="dt-label">Carrier &amp; broker</div>
            <dl className="kv">
              <dt>Broker of record</dt><dd className="txt">{sel.broker_company ?? '—'}</dd>
              <dt>Booked by</dt><dd className="txt">{sel.broker_rep ?? '—'}</dd>
              <dt>Carrier</dt><dd className="txt">{sel.carrier_company ?? 'Awaiting a driver'}</dd>
              <dt>Driver</dt><dd className="txt">{sel.driver_name ?? '—'}</dd>
            </dl>
            {sel.stage === 0 && (
              <div style={{ marginTop: 12, fontSize: '.78rem', color: 'var(--ink-3)', lineHeight: 1.6 }}>
                This load is live on the driver board right now. Sign in as a driver to see it
                exactly as they do.
              </div>
            )}
            <a className="btn btn-ghost" style={{ width: '100%', marginTop: 12 }} href="/shipper/messages">
              <Icon name="msg" size={15} /> Message dispatch about this shipment
            </a>
          </div>

          <div style={{ height: 12 }} />
          <FreightCard load={sel} />
        </div>
      </div>

      <ActivityFeed events={events} />
    </>
  );
}

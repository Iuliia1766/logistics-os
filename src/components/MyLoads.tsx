'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from './Icons';
import { Toast } from './Toast';
import { ManifestTracker } from './ManifestTracker';
import { FreightCard } from './FreightCard';
import { advanceLoad } from '@/app/actions/loads';
import { ADVANCE_LABELS, EQUIPMENT_LABELS, STAGES, type Load, type LoadEvent } from '@/lib/types';
import { rpm, usd } from '@/lib/format';

export function MyLoads({ loads, events }: { loads: Load[]; events: LoadEvent[] }) {
  const router = useRouter();
  const active = loads.filter((l) => l.stage < 6);
  const [selectedId, setSelectedId] = useState(active[0]?.id ?? loads[0]?.id ?? null);
  const [pod, setPod] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const load = loads.find((l) => l.id === selectedId) ?? loads[0] ?? null;

  if (!load) {
    return (
      <>
        <div className="page-head"><h1 className="h1">My loads</h1></div>
        <div className="empty">
          <div className="e-t">Nothing booked yet</div>
          Book something from the board and it lands here.{' '}
          <a className="link-btn" href="/driver">Find loads</a>
        </div>
      </>
    );
  }

  function onAdvance() {
    if (!load) return;
    startTransition(async () => {
      const res = await advanceLoad(load.id);
      setToast(res.message);
      if (res.ok) { setPod(false); router.refresh(); }
    });
  }

  const others = loads.filter((l) => l.id !== load.id);
  const needsPod = load.stage === 5 && !pod;

  return (
    <>
      <div className="page-head">
        <h1 className="h1">My loads</h1>
        <p className="sub">Every tap updates the shipper and dispatch instantly — no status calls.</p>
      </div>

      <ManifestTracker load={load} />
      <div style={{ height: 14 }} />

      <div className="split">
        <div>
          <div className="card">
            {load.stage < 6 ? (
              <>
                {load.stage === 5 && (
                  <label style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    fontSize: '.8rem', color: 'var(--ink-2)', marginBottom: 10,
                  }}>
                    <input type="checkbox" checked={pod} style={{ accentColor: 'var(--accent)' }}
                      onChange={(e) => setPod(e.target.checked)} />
                    <Icon name="camera" size={14} /> Photo and <Icon name="pen" size={14} /> signature captured
                  </label>
                )}
                <button className="btn btn-primary" style={{ width: '100%' }}
                  disabled={pending || needsPod} onClick={onAdvance}>
                  {ADVANCE_LABELS[load.stage] ?? 'Continue'}
                </button>
              </>
            ) : (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                color: 'var(--good)', fontSize: '.85rem', fontWeight: 600, padding: 10,
              }}>
                <Icon name="shield" size={16} /> Delivered — POD on file
              </div>
            )}
            <a className="btn btn-ghost" style={{ width: '100%', marginTop: 8 }} href="/driver/messages">
              <Icon name="msg" size={15} /> Message dispatch
            </a>
          </div>

          {others.length > 0 && (
            <>
              <div style={{ height: 12 }} />
              <div className="dt-label" style={{ marginBottom: 8 }}>Other loads</div>
              <div className="list">
                {others.map((o) => (
                  <button key={o.id} className="item" onClick={() => setSelectedId(o.id)}>
                    <div className="item-top">
                      <span className="item-id">{o.ref}</span>
                      <span className="mono" style={{ fontSize: '.75rem', color: 'var(--ink-2)' }}>
                        {usd(o.rate)}
                      </span>
                    </div>
                    <div className="item-route">
                      {o.origin_city}, {o.origin_state} → {o.dest_city}, {o.dest_state}
                    </div>
                    <div className="item-meta">
                      {o.miles} mi · {rpm(o.rate_per_mile)}/mi · {EQUIPMENT_LABELS[o.equipment]}
                    </div>
                    <div className="item-stage">{STAGES[o.stage]}</div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div>
          <FreightCard load={load} />
          <div className="card">
            <div className="dt-label">Pay</div>
            <div className="stat-row" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="stat"><div className="l">Line haul</div><div className="v">{usd(load.rate)}</div></div>
              <div className="stat"><div className="l">Per mile</div><div className="v">{rpm(load.rate_per_mile)}</div></div>
            </div>
          </div>
        </div>
      </div>

      <ActivityFeed events={events} />
      <Toast message={toast} onDismiss={() => setToast(null)} />
    </>
  );
}

export function ActivityFeed({ events }: { events: LoadEvent[] }) {
  if (!events.length) return null;
  return (
    <div className="activity">
      <h2 className="h2">
        <Icon name="trend" size={15} style={{ color: 'var(--accent)' }} /> Shared ledger activity
      </h2>
      {events.map((e) => (
        <div key={e.id} className="act-row">
          <span className="t">
            {new Date(e.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          </span>
          <span className="m">{e.note}</span>
        </div>
      ))}
    </div>
  );
}

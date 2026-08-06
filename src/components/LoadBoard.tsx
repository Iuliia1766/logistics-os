'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Icon } from './Icons';
import { Toast } from './Toast';
import { bookLoad } from '@/app/actions/loads';
import { setHomeZip } from '@/app/actions/account';
import {
  EMPTY_FILTERS, EQUIPMENT_LABELS, EQUIPMENT_ORDER,
  type Broker, type Load, type LoadFilters, type Profile, type SortKey,
} from '@/lib/types';
import {
  dateLabel, deadhead, deadheadLabel, dims, filterLoads, lbs, miles,
  rpm, sortLoads, timeAgo, usd, withZip,
} from '@/lib/format';

type Origin = { lat: number; lng: number } | null;

export function LoadBoard({
  initialLoads, brokers, profile, origin, originLabel,
}: {
  initialLoads: Load[];
  brokers: Record<string, Broker>;
  profile: Profile;
  origin: Origin;
  originLabel: string;
}) {
  const router = useRouter();
  const [loads, setLoads] = useState(initialLoads);
  const [filters, setFilters] = useState<LoadFilters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<SortKey>('rpm');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zipDraft, setZipDraft] = useState(profile.home_zip ?? '');
  const [toast, setToast] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => setLoads(initialLoads), [initialLoads]);

  // The board is shared: a load booked or posted elsewhere shows up here.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('open-board')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'loads' }, () => {
        router.refresh();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [router]);

  const visible = useMemo(
    () => sortLoads(filterLoads(loads, filters, origin), sort, origin),
    [loads, filters, sort, origin],
  );

  const selected = visible.find((l) => l.id === selectedId)
    ?? loads.find((l) => l.id === selectedId)
    ?? null;

  const set = (k: keyof LoadFilters, v: string) => setFilters((f) => ({ ...f, [k]: v }));

  function onBook(id: string) {
    startTransition(async () => {
      const res = await bookLoad(id);
      setToast(res.message);
      if (res.ok) { setSelectedId(null); router.refresh(); }
    });
  }

  function onSaveZip() {
    startTransition(async () => {
      const res = await setHomeZip(zipDraft.trim());
      setToast(res.message);
      if (res.ok) router.refresh();
    });
  }

  return (
    <>
      <div className="page-head">
        <h1 className="h1">Find loads</h1>
        <p className="sub">
          Every rate with its miles, its deadhead from where you sit, and who posted it.
        </p>
      </div>

      <div className="search">
        <div className="search-grid">
          <div className="sf">
            <label htmlFor="f-from">From — city or ZIP</label>
            <input className="input" id="f-from" placeholder="Any origin" autoComplete="off"
              value={filters.from} onChange={(e) => set('from', e.target.value)} />
          </div>
          <div className="sf">
            <label htmlFor="f-to">To — city or ZIP</label>
            <input className="input" id="f-to" placeholder="Any destination" autoComplete="off"
              value={filters.to} onChange={(e) => set('to', e.target.value)} />
          </div>
          <div className="sf">
            <label htmlFor="f-dh">Max deadhead</label>
            <select className="input" id="f-dh" value={filters.maxDeadhead}
              onChange={(e) => set('maxDeadhead', e.target.value)}>
              <option value="">Any</option>
              <option value="50">Under 50 mi</option>
              <option value="100">Under 100 mi</option>
              <option value="200">Under 200 mi</option>
              <option value="300">Under 300 mi</option>
            </select>
          </div>
          <div className="sf">
            <label htmlFor="f-trip">Trip length</label>
            <select className="input" id="f-trip" value={filters.trip}
              onChange={(e) => set('trip', e.target.value)}>
              <option value="">Any</option>
              <option value="s">Under 250 mi</option>
              <option value="m">250 – 600 mi</option>
              <option value="l">Over 600 mi</option>
            </select>
          </div>
          <div className="sf">
            <label htmlFor="f-eq">Equipment</label>
            <select className="input" id="f-eq" value={filters.equipment}
              onChange={(e) => set('equipment', e.target.value)}>
              <option value="">Any equipment</option>
              <option value="sprinter_van">Sprinter Van</option>
              <option value="box">Box Truck (any)</option>
              {EQUIPMENT_ORDER.filter((e) => e.startsWith('box')).map((e) => (
                <option key={e} value={e}>{EQUIPMENT_LABELS[e]}</option>
              ))}
            </select>
          </div>
          <div className="sf">
            <label htmlFor="f-rpm">Min $/mi</label>
            <select className="input" id="f-rpm" value={filters.minRpm}
              onChange={(e) => set('minRpm', e.target.value)}>
              <option value="">Any</option>
              <option value="2">$2.00+</option>
              <option value="2.5">$2.50+</option>
              <option value="2.75">$2.75+</option>
              <option value="3">$3.00+</option>
            </select>
          </div>
          <div className="sf sf-sort">
            <label htmlFor="f-sort">Sort loads by</label>
            <select className="input" id="f-sort" value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}>
              <option value="rpm">Best $/mi</option>
              <option value="rate">Highest total pay</option>
              <option value="deadhead">Shortest deadhead</option>
              <option value="newest">Latest added</option>
            </select>
          </div>
        </div>

        <div className="search-foot">
          <span className="result-count">
            <b>{visible.length}</b> of {loads.length} loads · deadhead from <b>{originLabel}</b>
          </span>
          <button type="button" className="link-btn" onClick={() => setFilters(EMPTY_FILTERS)}>
            Clear filters
          </button>
          <span className="sort-wrap">
            <span>Running out of</span>
            <input className="input" style={{ width: 96 }} value={zipDraft} inputMode="numeric"
              placeholder="ZIP" aria-label="Your home ZIP"
              onChange={(e) => setZipDraft(e.target.value)} />
            <button type="button" className="link-btn" onClick={onSaveZip} disabled={pending}>
              Update
            </button>
          </span>
        </div>
      </div>

      <div className="board">
        <div className="results">
          {visible.length === 0 ? (
            <div className="empty">
              <div className="e-t">No loads match that search</div>
              Try widening the deadhead radius or clearing the destination.{' '}
              <button type="button" className="link-btn" onClick={() => setFilters(EMPTY_FILTERS)}>
                Clear all filters
              </button>
            </div>
          ) : (
            visible.map((l) => (
              <LoadRow key={l.id} load={l} broker={l.broker_id ? brokers[l.broker_id] : undefined}
                origin={origin} selected={l.id === selectedId} onSelect={setSelectedId} />
            ))
          )}
        </div>

        <LoadDetail
          load={selected} broker={selected?.broker_id ? brokers[selected.broker_id] : undefined}
          origin={origin} pending={pending} onBook={onBook}
          best={visible[0] ?? null} onSelect={setSelectedId}
        />
      </div>

      <Toast message={toast} onDismiss={() => setToast(null)} />
    </>
  );
}

function eqIcon(e: string) {
  return e === 'sprinter_van' ? 'van' : 'truck';
}

function ReliabilityPill({ broker }: { broker?: Broker }) {
  if (!broker) return null;
  if (!broker.unlocked || broker.reliability_score === null) {
    return (
      <a className="rel rel-lock" href="/driver/premium" onClick={(e) => e.stopPropagation()}>
        <Icon name="lock" size={11} /> Rating locked
      </a>
    );
  }
  const s = broker.reliability_score;
  const cls = s >= 90 ? 'rel-good' : s >= 75 ? 'rel-mid' : 'rel-low';
  return (
    <span className={`rel ${cls}`} title="Broker reliability score">
      <Icon name={s < 75 ? 'alert' : 'shield'} size={11} /> {s}
    </span>
  );
}

function LoadRow({
  load, broker, origin, selected, onSelect,
}: {
  load: Load; broker?: Broker; origin: Origin; selected: boolean;
  onSelect: (id: string) => void;
}) {
  const dh = deadhead(load, origin);
  return (
    <div
      className={'load' + (selected ? ' on' : '')}
      role="button" tabIndex={0} aria-pressed={selected}
      onClick={() => onSelect(load.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(load.id); }
      }}
    >
      <div className="load-main">
        <div className="load-top">
          <span className="load-id">{load.ref}</span>
          <span className="eq-tag">
            <Icon name={eqIcon(load.equipment)} size={13} /> {EQUIPMENT_LABELS[load.equipment]}
          </span>
        </div>
        <div className="route">
          {load.origin_city}, {load.origin_state}
          <span className="arrow"><Icon name="arrow" size={15} /></span>
          {load.dest_city}, {load.dest_state}
        </div>
        <div className="load-commodity">
          {load.commodity} · picks up {dateLabel(load.pickup_at)}
        </div>
        <div className="specs">
          <span className="spec"><Icon name="route" size={13} /><b>{miles(load.miles)}</b> mi</span>
          <span className="spec"><Icon name="scale" size={13} /><b>{miles(load.weight_lb)}</b> lb</span>
          <span className="spec">
            <Icon name="ruler" size={13} /><b>{load.pieces}</b> pcs · {dims(load)}
          </span>
          <span className="spec"><Icon name="clock" size={13} /> Posted {timeAgo(load.created_at)}</span>
        </div>
        <div className="broker-line">
          <span className="broker-name">
            <Icon name="building" size={12} /> <b>{broker?.company ?? load.broker_company}</b>
            {broker?.rep_name ? ` · ${broker.rep_name}` : ''}
          </span>
          <ReliabilityPill broker={broker} />
        </div>
      </div>
      <div className="load-rate">
        <div>
          <div className="rate-big">{usd(load.rate)}</div>
          <div className="rate-per">
            {rpm(load.rate_per_mile)}<span style={{ fontSize: '.7rem', color: 'var(--ink-4)' }}>/mi</span>
          </div>
        </div>
        <span className="deadhead"><Icon name="mapPin" size={11} />{deadheadLabel(dh)}</span>
      </div>
    </div>
  );
}

function LoadDetail({
  load, broker, origin, pending, onBook, best, onSelect,
}: {
  load: Load | null; broker?: Broker; origin: Origin; pending: boolean;
  onBook: (id: string) => void; best: Load | null; onSelect: (id: string) => void;
}) {
  if (!load) {
    return (
      <div className="detail">
        <div className="dt-body">
          <div className="empty" style={{ border: 'none', padding: '26px 8px' }}>
            <div className="e-t">Pick a load</div>
            Full measurements, schedule, broker history and booking live here.
            {best && (
              <>
                <br /><br />
                <button type="button" className="link-btn" onClick={() => onSelect(best.id)}>
                  Open the best-paying match ({rpm(best.rate_per_mile)}/mi)
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  const dh = deadhead(load, origin);
  const allIn = dh !== null ? load.rate / (load.miles + dh) : null;

  return (
    <div className="detail">
      <div className="dt-head">
        <div className="load-top">
          <span className="load-id">{load.ref}</span>
          <span className="eq-tag">
            <Icon name={eqIcon(load.equipment)} size={13} /> {EQUIPMENT_LABELS[load.equipment]}
          </span>
        </div>
        <div className="route" style={{ fontSize: '1rem' }}>
          {load.origin_city}, {load.origin_state}
          <span className="arrow"><Icon name="arrow" size={15} /></span>
          {load.dest_city}, {load.dest_state}
        </div>
        <div className="dt-rate">
          <span className="big">{usd(load.rate)}</span>
          <span className="per">{rpm(load.rate_per_mile)}/mi</span>
        </div>
        <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span className="deadhead"><Icon name="route" size={11} /><b>{miles(load.miles)}</b> mi loaded</span>
          <span className="deadhead"><Icon name="mapPin" size={11} />{deadheadLabel(dh)} deadhead</span>
          {allIn !== null && (
            <span className="deadhead"><Icon name="trend" size={11} /><b>{rpm(allIn)}</b>/mi all-in</span>
          )}
        </div>
      </div>

      <div className="dt-body">
        <div className="dt-sec">
          <div className="dt-label">Schedule</div>
          <div className="leg">
            <div className="leg-rail">
              <span className="leg-dot" /><span className="leg-line" /><span className="leg-dot end" />
            </div>
            <div className="leg-stops">
              <div>
                <div className="leg-city">{withZip(load.origin_city, load.origin_state, load.origin_zip)}</div>
                <div className="leg-when">Pick up {dateLabel(load.pickup_at)}</div>
              </div>
              <div>
                <div className="leg-city">{withZip(load.dest_city, load.dest_state, load.dest_zip)}</div>
                <div className="leg-when">Deliver {dateLabel(load.deliver_by)}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="dt-sec">
          <div className="dt-label">Freight</div>
          <dl className="kv">
            <dt>Commodity</dt><dd className="txt">{load.commodity}</dd>
            <dt>Weight</dt><dd>{lbs(load.weight_lb)}</dd>
            <dt>Pieces</dt><dd>{load.pieces}</dd>
            <dt>Each piece</dt><dd>{dims(load)}</dd>
            <dt>Total cube</dt><dd>{load.cube_ft} ft³</dd>
            <dt>Equipment</dt><dd className="txt">{EQUIPMENT_LABELS[load.equipment]}</dd>
          </dl>
        </div>

        <div className="dt-sec">
          <div className="dt-label">Posted by</div>
          <div style={{ fontSize: '.85rem', color: 'var(--ink)', fontWeight: 600 }}>
            {broker?.company ?? load.broker_company}
          </div>
          <div style={{ fontSize: '.78rem', color: 'var(--ink-3)', marginBottom: 12 }}>
            {broker?.rep_name ?? load.broker_rep} · broker of record
          </div>
          <BrokerPanel broker={broker} />
        </div>

        <div className="dt-actions">
          <button className="btn btn-primary" disabled={pending} onClick={() => onBook(load.id)}>
            <Icon name="check" size={15} /> Book this load — {usd(load.rate)}
          </button>
          <a className="btn btn-ghost" href="/driver/messages">
            <Icon name="msg" size={15} /> Message dispatch
          </a>
        </div>
      </div>
    </div>
  );
}

function ScoreRing({ score }: { score: number }) {
  const color = score >= 90 ? 'var(--good)' : score >= 75 ? 'var(--accent)' : 'var(--warn)';
  const r = 20;
  const circ = 2 * Math.PI * r;
  return (
    <svg className="score-ring" viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="24" r={r} fill="none" stroke="var(--line)" strokeWidth="4" />
      <circle
        cx="24" cy="24" r={r} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round"
        strokeDasharray={circ.toFixed(1)} strokeDashoffset={(circ * (1 - score / 100)).toFixed(1)}
        transform="rotate(-90 24 24)"
      />
    </svg>
  );
}

function BrokerPanel({ broker }: { broker?: Broker }) {
  if (!broker) return null;

  if (!broker.unlocked || broker.reliability_score === null) {
    return (
      <div className="premium-box">
        <div className="pb-head"><Icon name="lock" size={14} /> Broker reliability · Premium</div>
        <p className="pb-copy">
          See how {broker.company} actually pays — on-time rate, average days to pay and dispute
          history — before you haul for them.
        </p>
        <a className="btn btn-gold" style={{ width: '100%' }} href="/driver/premium">
          <Icon name="star" size={14} /> Unlock with Premium
        </a>
      </div>
    );
  }

  const s = broker.reliability_score;
  return (
    <div className="premium-box">
      <div className="pb-head"><Icon name="star" size={14} /> Broker reliability · Premium</div>
      <div className="score-row">
        <ScoreRing score={s} />
        <div className="score-txt">
          <div className="s">{s} / 100</div>
          <div className="d">
            {s >= 90 ? 'Consistently pays on time. Safe to run.'
              : s >= 75 ? 'Reliable, but watch the pay window.'
                : 'Slow pay and a high dispute rate — get a rate con in writing.'}
          </div>
        </div>
      </div>
      <div className="rel-grid">
        <div className="rel-cell"><div className="n">{broker.on_time_pct}%</div><div className="l">Paid on time</div></div>
        <div className="rel-cell"><div className="n">{broker.avg_days_to_pay} days</div><div className="l">Avg days to pay</div></div>
        <div className="rel-cell"><div className="n">{broker.dispute_pct}%</div><div className="l">Loads disputed</div></div>
        <div className="rel-cell">
          <div className="n">{broker.loads_posted?.toLocaleString()}</div>
          <div className="l">Loads posted since {broker.member_since}</div>
        </div>
      </div>
      <div style={{ marginTop: 10, fontSize: '.75rem', color: 'var(--ink-3)' }}>
        Payment terms: <b style={{ color: 'var(--ink-2)' }}>{broker.payment_terms}</b>
      </div>
    </div>
  );
}

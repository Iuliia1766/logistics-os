import { Icon } from './Icons';
import { STAGES, type Load } from '@/lib/types';
import { etaLabel, miles, rpm, usd, dateLabel } from '@/lib/format';

/** The signature element: one shipment's whole life, same view on both portals. */
export function ManifestTracker({ load }: { load: Load }) {
  const idx = load.stage;
  const pct = Math.round((idx / (STAGES.length - 1)) * 100);
  const done = idx === 6;

  return (
    <div className="manifest">
      <span className="notch l" />
      <span className="notch r" />
      <div className="mf-head">
        <span className="mf-id">
          {load.ref} · {load.origin_city}, {load.origin_state} → {load.dest_city}, {load.dest_state}
        </span>
        <span className="mf-pct">{pct}% complete</span>
      </div>

      <div className="stages">
        {STAGES.map((label, i) => (
          <span key={label} style={{ display: 'contents' }}>
            <div className="stage">
              {i < idx ? (
                <span className="stage-ico" style={{ color: 'var(--accent)' }}>
                  <Icon name="checkC" size={18} />
                </span>
              ) : i === idx ? (
                <span className="ping">
                  <span className="ping-r" />
                  <span className="ping-c" />
                </span>
              ) : (
                <span className="stage-ico" style={{ color: 'var(--ink-4)', opacity: 0.55 }}>
                  <Icon name="circle" size={18} />
                </span>
              )}
              <span className={'stage-lb' + (i <= idx ? ' on' : '')}>{label}</span>
            </div>
            {i < STAGES.length - 1 && <span className={'conn' + (i < idx ? ' done' : '')} />}
          </span>
        ))}
      </div>

      <div className="mf-meta">
        {done ? (
          <>
            <div><div className="l">Delivered</div><div className="v">{dateLabel(load.delivered_at)}</div></div>
            <div><div className="l">Total miles</div><div className="v">{miles(load.miles)}</div></div>
          </>
        ) : (
          <>
            <div><div className="l">ETA</div><div className="v">{etaLabel(load.eta)}</div></div>
            <div>
              <div className="l">Miles left</div>
              <div className="v">{load.miles_remaining !== null ? miles(load.miles_remaining) : '—'}</div>
            </div>
          </>
        )}
        <div><div className="l">Rate</div><div className="v">{usd(load.rate)}</div></div>
        <div><div className="l">Per mile</div><div className="v">{rpm(load.rate_per_mile)}</div></div>
      </div>
    </div>
  );
}

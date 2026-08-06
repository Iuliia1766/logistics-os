import { EQUIPMENT_LABELS, type Load } from '@/lib/types';
import { dims, lbs, miles, rpm, withZip } from '@/lib/format';

/** The measurements panel, shared by both portals. */
export function FreightCard({ load }: { load: Load }) {
  return (
    <div className="card">
      <div className="dt-label">Freight &amp; equipment</div>
      <dl className="kv">
        <dt>Pick up</dt>
        <dd className="txt">{withZip(load.origin_city, load.origin_state, load.origin_zip)}</dd>
        <dt>Deliver</dt>
        <dd className="txt">{withZip(load.dest_city, load.dest_state, load.dest_zip)}</dd>
        <dt>Commodity</dt><dd className="txt">{load.commodity}</dd>
        <dt>Weight</dt><dd>{lbs(load.weight_lb)}</dd>
        <dt>Pieces</dt><dd>{load.pieces}</dd>
        <dt>Each piece</dt><dd>{dims(load)}</dd>
        <dt>Total cube</dt><dd>{load.cube_ft} ft³</dd>
        <dt>Equipment</dt><dd className="txt">{EQUIPMENT_LABELS[load.equipment]}</dd>
        <dt>Distance</dt><dd>{miles(load.miles)} mi</dd>
        <dt>Rate / mile</dt><dd>{rpm(load.rate_per_mile)}</dd>
        <dt>Broker</dt>
        <dd className="txt">
          {load.broker_company ?? '—'}{load.broker_rep ? ` · ${load.broker_rep}` : ''}
        </dd>
      </dl>
    </div>
  );
}

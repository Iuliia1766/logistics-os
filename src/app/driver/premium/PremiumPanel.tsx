import { Icon } from '@/components/Icons';

const FREE = [
  'Full load board and search',
  'Rate, miles, $/mi and deadhead',
  'Weight, dimensions and equipment',
  'Broker name on every load',
];
const LOCKED = [
  'Broker reliability score',
  'On-time payment rate',
  'Average days to pay',
  'Dispute history',
];
const PRO = [
  'Everything in Free',
  'Reliability score on every broker',
  'On-time payment rate',
  'Average days to pay',
  'Dispute and chargeback history',
  'Payment terms up front',
  'Slow-pay alerts before you book',
];

export function PremiumPanel({ isPremium }: { isPremium: boolean }) {
  return (
    <>
      <div className="page-head">
        <span className="md-eyebrow"><Icon name="star" size={13} /> Premium</span>
        <h1 className="h1">Know how a broker pays before you haul for them.</h1>
        <p className="sub" style={{ maxWidth: '34rem' }}>
          Every broker on this board has a payment history. Free accounts see the load.
          Premium accounts see whether the money actually shows up.
        </p>
      </div>

      <div className="plans" style={{ padding: 0, maxWidth: '44rem' }}>
        <div className="plan">
          <div className="plan-n">Free</div>
          <div className="plan-p">$0<small> / month</small></div>
          <ul>
            {FREE.map((f) => (
              <li key={f}><Icon name="check" size={14} style={{ color: 'var(--good)' }} /><span>{f}</span></li>
            ))}
            {LOCKED.map((f) => (
              <li key={f} className="off">
                <Icon name="x" size={14} style={{ color: 'var(--ink-4)' }} /><span>{f}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="plan pro">
          <div className="plan-n">Premium</div>
          <div className="plan-p">$29<small> / month</small></div>
          <ul>
            {PRO.map((f) => (
              <li key={f}><Icon name="check" size={14} style={{ color: 'var(--good)' }} /><span>{f}</span></li>
            ))}
          </ul>
          {isPremium ? (
            <div className="acct-type" style={{ marginBottom: 0 }}>
              <span className="acct-type-ico"><Icon name="check" size={16} /></span>
              <div>
                <div className="acct-type-t">Premium is active</div>
                <div className="acct-type-d">Broker reliability is unlocked across the board.</div>
              </div>
            </div>
          ) : (
            <button className="btn btn-gold" style={{ width: '100%' }} disabled>
              <Icon name="star" size={15} /> Checkout coming soon
            </button>
          )}
        </div>
      </div>

      <p className="md-foot" style={{ padding: '18px 0 0', maxWidth: '44rem' }}>
        No payment is taken yet, and there is deliberately no button that grants this to
        yourself — entitlement moves only from the server, through{' '}
        <code>admin_set_premium()</code>, which is where a payment provider&rsquo;s webhook
        belongs. The gate itself is real: reliability columns are withheld by a column-level
        grant in Postgres, so a free account cannot read them even by calling the API directly.
      </p>

    </>
  );
}

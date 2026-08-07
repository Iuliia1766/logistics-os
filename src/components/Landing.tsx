import Link from 'next/link';
import { Icon } from './Icons';

const CARRIER_POINTS = [
  'Search by lane, deadhead radius and $/mi',
  'See who posted the load before you commit',
  'Four taps from accepted to delivered',
];

const SHIPPER_POINTS = [
  'Post a load in under a minute',
  'Watch every stage without calling anyone',
  'Distance and rate per mile as you type',
];

export function Landing() {
  return (
    <div className="landing">
      <header className="ld-nav">
        <div className="ld-nav-inner">
          <div className="tb-brand">
            <div className="mark"><Icon name="radio" size={17} /></div>
            <div className="tb-name">
              AI Logistics OS
              <span>Load board</span>
            </div>
          </div>
          <div className="ld-nav-actions">
            <Link className="btn btn-ghost" href="/login">Sign in</Link>
            {/* Top-right is where people look for this first. It cannot go
                straight to /signup because the account type has to be chosen
                first, so it jumps to the two cards. */}
            <a className="btn btn-primary" href="#signup">Sign up</a>
          </div>
        </div>
      </header>

      <main className="ld-main">
        <section className="ld-hero">
          <svg className="ld-route" viewBox="0 0 1200 300" preserveAspectRatio="none" aria-hidden="true">
            <path d="M-20 250 C 200 250, 260 90, 480 90 S 820 210, 1020 60 S 1180 20, 1220 30"
              fill="none" stroke="var(--accent)" strokeWidth="1.5" opacity=".18" />
            <path className="ld-trace"
              d="M-20 250 C 200 250, 260 90, 480 90 S 820 210, 1020 60 S 1180 20, 1220 30"
              fill="none" stroke="var(--accent)" strokeWidth="2" opacity=".5" />
          </svg>

          <p className="ld-eyebrow">Freight, without the phone calls</p>
          <h1 className="ld-head">One ledger. Two sides of the same load.</h1>
          <p className="ld-sub">
            Carriers see the rate, the miles, the deadhead and who posted it before they
            commit. Shippers see exactly where their freight is. Both are reading the same
            record, so nobody has to ring anybody to ask.
          </p>
        </section>

        {/* The choice is the page. Two accounts, two different apps. */}
        <section className="ld-doors" id="signup" aria-label="Create an account">
          <article className="ld-door">
            <div className="ld-door-top">
              <span className="ld-door-ico"><Icon name="truck" size={22} /></span>
              <div>
                <h2 className="ld-door-t">Carrier</h2>
                <p className="ld-door-d">I haul freight</p>
              </div>
            </div>
            <ul className="ld-points">
              {CARRIER_POINTS.map((p) => (
                <li key={p}><Icon name="check" size={14} /><span>{p}</span></li>
              ))}
            </ul>
            <Link className="btn btn-primary ld-door-cta" href="/signup?role=carrier">
              Sign up as a Carrier <Icon name="arrow" size={15} />
            </Link>
          </article>

          <article className="ld-door">
            <div className="ld-door-top">
              <span className="ld-door-ico"><Icon name="building" size={22} /></span>
              <div>
                <h2 className="ld-door-t">Shipper</h2>
                <p className="ld-door-d">I have freight to move</p>
              </div>
            </div>
            <ul className="ld-points">
              {SHIPPER_POINTS.map((p) => (
                <li key={p}><Icon name="check" size={14} /><span>{p}</span></li>
              ))}
            </ul>
            <Link className="btn btn-primary ld-door-cta" href="/signup?role=shipper">
              Sign up as a Shipper <Icon name="arrow" size={15} />
            </Link>
          </article>
        </section>

        <p className="ld-signin">
          Already have an account? <Link className="link-btn" href="/login">Sign in</Link>
        </p>

        <section className="ld-facts">
          <div className="ld-fact">
            <span className="ld-fact-ico"><Icon name="trend" size={16} /></span>
            <h3>Rate per mile, not just a rate</h3>
            <p>
              Every load carries its loaded miles, its $/mi and the deadhead from where
              you are sitting right now — so the number you compare is the one you get paid.
            </p>
          </div>
          <div className="ld-fact">
            <span className="ld-fact-ico"><Icon name="shield" size={16} /></span>
            <h3>Broker payment history</h3>
            <p>
              On-time rate, average days to pay and dispute history, measured from settled
              invoices rather than typed in by hand. Included with Premium.
            </p>
          </div>
          <div className="ld-fact">
            <span className="ld-fact-ico"><Icon name="route" size={16} /></span>
            <h3>One shared record</h3>
            <p>
              When a driver marks a load delivered, the shipper&rsquo;s tracker moves in the
              same moment. There is no second system to reconcile.
            </p>
          </div>
        </section>
      </main>

      <footer className="ld-foot">
        <span>AI Logistics OS</span>
        <span>ZIP geography from GeoNames, CC BY 4.0</span>
      </footer>
    </div>
  );
}

import Link from 'next/link';
import { Icon } from './Icons';

const FEATURES = [
  {
    icon: 'mapPin',
    title: 'Live Shipment Tracking',
    body: 'Follow every load in real time, from "en route to pickup" through delivery — with ETA, delay risk, and milestone updates, automatically.',
  },
  {
    icon: 'trend',
    title: 'AI-Driven Pricing',
    body: 'Fair, data-backed rates for every load — built from real market and lane history, not guesswork.',
  },
  {
    icon: 'shield',
    title: 'No Double Brokering',
    body: 'Verified carriers and transparent chain of custody, so shippers always know exactly who’s hauling their freight.',
  },
  {
    icon: 'msg',
    title: 'Proactive Communication',
    body: 'Automatic updates at every milestone — pickup, in-transit, delays, delivery — so no one has to ask "where’s my load?"',
  },
];

const STEPS = [
  {
    icon: 'file',
    title: 'Post a Load',
    body: 'Shippers and brokers post shipment details in minutes.',
  },
  {
    icon: 'trend',
    title: 'AI Matches & Prices',
    body: 'The system recommends the right carrier and a fair rate based on historical data.',
  },
  {
    icon: 'route',
    title: 'Track Every Mile',
    body: 'Live tracking from dispatch to delivery, with automatic milestone updates.',
  },
  {
    icon: 'checkC',
    title: 'Delivered, Documented',
    body: 'Photo/signature proof of delivery and instant invoicing — no paperwork chase.',
  },
];

const SHIPPER_POINTS = [
  'Post a load and get a data-backed rate in minutes',
  'Watch every stage without calling anyone',
  'Proof of delivery and invoicing the moment it lands',
];

const CARRIER_POINTS = [
  'Loads matched to the lanes you already run',
  'Transparent pricing before you commit',
  'Accept, navigate, upload, done',
];

export function Landing() {
  return (
    <div className="landing">
      <header className="ld-nav">
        <div className="ld-nav-inner">
          <div className="tb-brand">
            <div className="mark"><Icon name="radio" size={17} /></div>
            <div className="tb-name">
              FreightForward Co.
              <span>Transparent freight</span>
            </div>
          </div>
          <nav className="ld-nav-links" aria-label="Sections">
            <a href="#how">How it works</a>
            <a href="#mission">Why we built it</a>
            <a href="#carriers">For carriers</a>
          </nav>
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

          <h1 className="ld-head">Freight, Finally Transparent.</h1>
          <p className="ld-sub">
            The AI-powered logistics platform connecting shippers, brokers, and carriers —
            with real-time visibility from pickup to delivery, and no surprises along the way.
          </p>
          <div className="ld-hero-cta">
            <Link className="btn btn-primary" href="/signup?role=shipper">
              Get a Quote <Icon name="arrow" size={15} />
            </Link>
            <a className="btn btn-ghost" href="#how">See How It Works</a>
          </div>
        </section>

        <p className="ld-trust">
          Trusted by manufacturers, warehouses, and energy companies moving critical
          freight across the U.S.
        </p>

        <section className="ld-sec">
          <p className="ld-eyebrow">The Old Way</p>
          <h2 className="ld-h2">Logistics shouldn&rsquo;t feel like a black box.</h2>
          <p className="ld-body">
            Endless calls. Status updates that never come. Double brokering that erodes
            trust. Shippers left wondering where their freight is — and carriers underpaid
            for the risk they take on.
          </p>
          <p className="ld-body ld-body-lead">
            We built this platform because that&rsquo;s not good enough.
          </p>
        </section>

        <section className="ld-sec">
          <p className="ld-eyebrow">The Better Way</p>
          <h2 className="ld-h2">One platform. Full visibility. Zero guesswork.</h2>
          <p className="ld-body">
            From the moment a load is posted to the moment it&rsquo;s delivered, every party —
            shipper, broker, carrier, dispatcher, and driver — sees the same real-time
            picture. AI handles the busywork: matching the right carrier, recommending fair
            pricing, and sending proactive updates automatically. No more chasing down
            status by phone or email.
          </p>

          <div className="ld-features">
            {FEATURES.map((f) => (
              <article className="ld-feature" key={f.title}>
                <span className="ld-feature-ico"><Icon name={f.icon} size={18} /></span>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="ld-sec" id="how">
          <p className="ld-eyebrow">From Post to POD</p>
          <h2 className="ld-h2">A shipment&rsquo;s journey, made simple.</h2>

          {/* Numbered because the order is the point — each step hands off to the next. */}
          <ol className="ld-steps">
            {STEPS.map((s, i) => (
              <li className="ld-step" key={s.title}>
                <span className="ld-step-n">{i + 1}</span>
                <div className="ld-step-body">
                  <h3><Icon name={s.icon} size={15} />{s.title}</h3>
                  <p>{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="ld-mission" id="mission">
          <p className="ld-eyebrow">Why We Built This</p>
          <h2 className="ld-h2">Built on honesty. Delivered with integrity.</h2>
          <p className="ld-body">
            This company started with a simple belief, passed down from a father who built
            his own business on hard work and honesty: do right by the people you serve, and
            the trust follows. We&rsquo;re bringing that same principle to freight — replacing
            the stress and static of traditional logistics with clarity, fairness, and
            communication you can count on. Every shipment, every mile, no surprises.
          </p>
        </section>

        <section className="ld-sec ld-sec-split">
          <div>
            <p className="ld-eyebrow">Built For High-Stakes Freight</p>
            <h2 className="ld-h2">When the load can&rsquo;t afford to go wrong.</h2>
            <p className="ld-body">
              Manufacturers, warehouses, and energy companies trust us to move critical and
              high-value components across the country — the kind of freight where a missed
              update or a late delivery isn&rsquo;t an option.
            </p>
          </div>
          <div className="ld-serve-art" aria-hidden="true">
            <Icon name="building" size={26} />
            <Icon name="box" size={26} />
            <Icon name="truck" size={26} />
          </div>
        </section>

        <section className="ld-carriers" id="carriers">
          <span className="ld-carriers-ico"><Icon name="truck" size={24} /></span>
          <p className="ld-eyebrow">For Carriers</p>
          <h2 className="ld-h2">Better loads. Fairer pay. Less hassle.</h2>
          <p className="ld-body">
            No more chasing brokers for rate confirmations or status calls. Get matched to
            loads that fit your lanes, see transparent pricing upfront, and get paid what
            the freight is actually worth — with a driver app that keeps things simple:
            accept, navigate, upload, done.
          </p>
          <Link className="btn btn-primary ld-carriers-cta" href="/signup?role=carrier">
            Join as a Carrier <Icon name="arrow" size={15} />
          </Link>
        </section>

        {/* The final CTA and the account choice are one block: "Get Started" has to
            resolve to a role before /signup can do anything with it. */}
        <section className="ld-final" id="signup" aria-label="Get started">
          <h2 className="ld-final-h">Ready to move freight without the friction?</h2>
          <p className="ld-final-sub">
            See what full visibility looks like — from your first quote to final delivery.
          </p>

          <div className="ld-doors">
            <article className="ld-door">
              <div className="ld-door-top">
                <span className="ld-door-ico"><Icon name="building" size={22} /></span>
                <div>
                  <h3 className="ld-door-t">Shipper</h3>
                  <p className="ld-door-d">I have freight to move</p>
                </div>
              </div>
              <ul className="ld-points">
                {SHIPPER_POINTS.map((p) => (
                  <li key={p}><Icon name="check" size={14} /><span>{p}</span></li>
                ))}
              </ul>
              <Link className="btn btn-primary ld-door-cta" href="/signup?role=shipper">
                Get Started <Icon name="arrow" size={15} />
              </Link>
            </article>

            <article className="ld-door">
              <div className="ld-door-top">
                <span className="ld-door-ico"><Icon name="truck" size={22} /></span>
                <div>
                  <h3 className="ld-door-t">Carrier</h3>
                  <p className="ld-door-d">I haul freight</p>
                </div>
              </div>
              <ul className="ld-points">
                {CARRIER_POINTS.map((p) => (
                  <li key={p}><Icon name="check" size={14} /><span>{p}</span></li>
                ))}
              </ul>
              <Link className="btn btn-primary ld-door-cta" href="/signup?role=carrier">
                Get Started <Icon name="arrow" size={15} />
              </Link>
            </article>
          </div>

          <p className="ld-signin">
            Already have an account? <Link className="link-btn" href="/login">Sign in</Link>
          </p>
        </section>
      </main>

      <footer className="ld-foot">
        <div className="ld-foot-top">
          <div className="tb-brand">
            <div className="mark"><Icon name="radio" size={16} /></div>
            <div className="tb-name">
              FreightForward Co.
              <span>Transparent freight. From pickup to delivery.</span>
            </div>
          </div>
          <nav className="ld-foot-links" aria-label="Footer">
            <a href="#how">How it works</a>
            <a href="#carriers">For carriers</a>
            <a href="#signup">Get started</a>
            <Link href="/privacy">Privacy Policy</Link>
            <Link href="/login">Sign in</Link>
          </nav>
        </div>
        <div className="ld-foot-contact">
          <a href="mailto:ops@freightforwardco.com">
            <Icon name="msg" size={14} /> ops@freightforwardco.com
          </a>
          <a href="tel:+17472412929">
            <Icon name="phone" size={14} /> (747) 241-2929
          </a>
        </div>
        <div className="ld-foot-bot">
          <span>freightforwardco.com</span>
          <span>ZIP geography from GeoNames, CC BY 4.0</span>
        </div>
      </footer>
    </div>
  );
}

import Link from 'next/link';
import { Icon } from './Icons';
import { signOut } from '@/app/actions/auth';
import type { Profile } from '@/lib/types';

type Tab = { href: string; label: string; icon: string; badge?: number };

/** Top bar + tabs. The two portals share the shell and nothing else. */
export function PortalChrome({
  profile, tabs, current, locationLabel,
}: {
  profile: Profile;
  tabs: Tab[];
  current: string;
  locationLabel?: string;
}) {
  const isDriver = profile.role === 'driver';
  const initials = (profile.full_name || profile.company || '?')
    .split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

  return (
    <header className="topbar">
      <div className="tb-row">
        <div className="tb-brand">
          <div className="mark"><Icon name="radio" size={17} /></div>
          <div className="tb-name">
            AI Logistics OS
            <span>{isDriver ? 'Carrier portal' : 'Shipper portal'}</span>
          </div>
        </div>

        <div className="tb-spacer" />

        {isDriver && locationLabel && (
          <span className="chip" title="Deadhead is measured from here">
            <Icon name="mapPin" size={13} /> {locationLabel}
          </span>
        )}

        {isDriver && (
          profile.is_premium ? (
            <span className="chip chip-gold"><Icon name="star" size={13} /> Premium</span>
          ) : (
            <Link className="chip chip-gold chip-btn" href="/driver/premium">
              <Icon name="lock" size={13} /> Unlock broker ratings
            </Link>
          )
        )}

        {!isDriver && (
          <span className="chip"><Icon name="building" size={13} /> {profile.company || 'Shipper'}</span>
        )}

        {/* the name is the way into the profile — where people look for it */}
        <Link className="who who-link" href="/account" title="Your profile">
          <div className="avatar">{initials}</div>
          <div>
            <div className="who-t">{profile.full_name || 'Add your name'}</div>
            <div className="who-d">
              {profile.company || 'Complete your profile'}
              {isDriver && profile.mc_number ? ` · ${profile.mc_number}` : ''}
            </div>
          </div>
        </Link>

        <form action={signOut}>
          <button className="chip chip-btn" type="submit" title="Sign out">
            <Icon name="logout" size={13} /> Sign out
          </button>
        </form>
      </div>

      <nav className="tabs">
        {tabs.map((t) => {
          const on = current === t.href;
          return (
            <Link key={t.href} href={t.href} className={'tab' + (on ? ' on' : '')}
              aria-current={on ? 'page' : undefined}>
              <Icon name={t.icon} size={15} /> {t.label}
              {t.badge ? <span className="badge">{t.badge}</span> : null}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}

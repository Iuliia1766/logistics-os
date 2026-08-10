import { getAccount } from '@/lib/session';
import { PortalChrome } from '@/components/PortalChrome';
import { AccountForm } from '@/components/AccountForm';
import { Icon } from '@/components/Icons';
import { signOut } from '@/app/actions/auth';

export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const { email, profile } = await getAccount();

  // No profile yet: the signup trigger missed, so there is no portal to
  // frame this with. Show the form on its own so they can get unstuck.
  if (!profile) {
    return (
      <div className="app">
        <header className="topbar">
          <div className="tb-row">
            <div className="tb-brand">
              <div className="mark"><Icon name="radio" size={17} /></div>
              <div className="tb-name">AI Logistics OS<span>Account setup</span></div>
            </div>
            <div className="tb-spacer" />
            <form action={signOut}>
              <button className="chip chip-btn" type="submit">
                <Icon name="logout" size={13} /> Sign out
              </button>
            </form>
          </div>
        </header>
        <div className="page"><AccountForm profile={null} email={email} /></div>
      </div>
    );
  }

  const isCarrier = profile.role === 'driver';
  const tabs = isCarrier
    ? [
        { href: '/driver', label: 'Find Loads', icon: 'search' },
        { href: '/driver/loads', label: 'My Loads', icon: 'truck' },
        { href: '/driver/messages', label: 'Messages', icon: 'msg' },
      ]
    : [
        { href: '/shipper', label: 'My Shipments', icon: 'box' },
        { href: '/shipper/post', label: 'Post a Load', icon: 'plus' },
        { href: '/shipper/messages', label: 'Messages', icon: 'msg' },
      ];

  return (
    <div className="app">
      <PortalChrome profile={profile} tabs={tabs} current="/account" />
      <div className="page"><AccountForm profile={profile} email={email} /></div>
    </div>
  );
}

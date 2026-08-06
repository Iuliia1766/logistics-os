import { requireProfile } from '@/lib/session';
import { PortalChrome } from '@/components/PortalChrome';
import { PremiumPanel } from './PremiumPanel';

export const dynamic = 'force-dynamic';

export default async function PremiumPage() {
  const profile = await requireProfile('driver');
  return (
    <>
      <PortalChrome
        profile={profile}
        current="/driver/premium"
        tabs={[
          { href: '/driver', label: 'Find Loads', icon: 'search' },
          { href: '/driver/loads', label: 'My Loads', icon: 'truck' },
          { href: '/driver/messages', label: 'Messages', icon: 'msg' },
        ]}
      />
      <div className="page"><PremiumPanel isPremium={profile.is_premium} /></div>
    </>
  );
}

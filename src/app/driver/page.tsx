import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/session';
import { PortalChrome } from '@/components/PortalChrome';
import { LoadBoard } from '@/components/LoadBoard';
import type { Broker, Load } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function DriverBoard() {
  const profile = await requireProfile('driver');
  const supabase = await createClient();

  const [{ data: loads }, { data: brokerRows }, { data: home }, { count: mine }] = await Promise.all([
    supabase.from('v_loads').select('*').eq('stage', 0).order('created_at', { ascending: false }),
    supabase.from('v_brokers').select('*'),
    profile.home_zip
      ? supabase.from('zips').select('zip, city, state, lat, lng').eq('zip', profile.home_zip).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from('loads').select('id', { count: 'exact', head: true })
      .eq('carrier_id', profile.id).lt('stage', 6),
  ]);

  const brokers: Record<string, Broker> = {};
  for (const b of (brokerRows ?? []) as Broker[]) brokers[b.id] = b;

  const origin = home ? { lat: home.lat as number, lng: home.lng as number } : null;
  const originLabel = home ? `${home.city}, ${home.state} ${home.zip}` : 'Set your ZIP';

  return (
    <>
      <PortalChrome
        profile={profile}
        current="/driver"
        locationLabel={originLabel}
        tabs={[
          { href: '/driver', label: 'Find Loads', icon: 'search' },
          { href: '/driver/loads', label: 'My Loads', icon: 'truck', badge: mine ?? 0 },
          { href: '/driver/messages', label: 'Messages', icon: 'msg' },
        ]}
      />
      <div className="page">
        <LoadBoard
          initialLoads={(loads ?? []) as Load[]}
          brokers={brokers}
          profile={profile}
          origin={origin}
          originLabel={originLabel}
        />
      </div>
    </>
  );
}

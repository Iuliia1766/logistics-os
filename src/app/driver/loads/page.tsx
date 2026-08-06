import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/session';
import { PortalChrome } from '@/components/PortalChrome';
import { MyLoads } from '@/components/MyLoads';
import type { Load, LoadEvent } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function DriverLoads() {
  const profile = await requireProfile('driver');
  const supabase = await createClient();

  const { data: loads } = await supabase
    .from('v_loads').select('*').eq('carrier_id', profile.id)
    .order('stage', { ascending: true }).order('booked_at', { ascending: false });

  const ids = (loads ?? []).map((l) => l.id);
  const { data: events } = ids.length
    ? await supabase.from('load_events').select('*').in('load_id', ids)
        .order('created_at', { ascending: false }).limit(8)
    : { data: [] };

  return (
    <>
      <PortalChrome
        profile={profile}
        current="/driver/loads"
        tabs={[
          { href: '/driver', label: 'Find Loads', icon: 'search' },
          { href: '/driver/loads', label: 'My Loads', icon: 'truck',
            badge: (loads ?? []).filter((l) => l.stage < 6).length },
          { href: '/driver/messages', label: 'Messages', icon: 'msg' },
        ]}
      />
      <div className="page">
        <MyLoads loads={(loads ?? []) as Load[]} events={(events ?? []) as LoadEvent[]} />
      </div>
    </>
  );
}

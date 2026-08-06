import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/session';
import { PortalChrome } from '@/components/PortalChrome';
import { Shipments } from '@/components/Shipments';
import type { Load, LoadEvent } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function ShipperHome() {
  const profile = await requireProfile('shipper');
  const supabase = await createClient();

  const { data: loads } = await supabase
    .from('v_loads').select('*').eq('shipper_id', profile.id)
    .order('created_at', { ascending: false });

  const ids = (loads ?? []).map((l) => l.id);
  const { data: events } = ids.length
    ? await supabase.from('load_events').select('*').in('load_id', ids)
        .order('created_at', { ascending: false }).limit(8)
    : { data: [] };

  return (
    <>
      <PortalChrome
        profile={profile}
        current="/shipper"
        tabs={[
          { href: '/shipper', label: 'My Shipments', icon: 'box',
            badge: (loads ?? []).filter((l) => l.stage < 6).length },
          { href: '/shipper/post', label: 'Post a Load', icon: 'plus' },
          { href: '/shipper/messages', label: 'Messages', icon: 'msg' },
        ]}
      />
      <div className="page">
        <Shipments loads={(loads ?? []) as Load[]} events={(events ?? []) as LoadEvent[]} />
      </div>
    </>
  );
}

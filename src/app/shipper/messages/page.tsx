import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/session';
import { PortalChrome } from '@/components/PortalChrome';
import { MessageThread } from '@/components/MessageThread';
import type { Message } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function ShipperMessages() {
  const profile = await requireProfile('shipper');
  const supabase = await createClient();

  const { data: messages } = await supabase
    .from('messages').select('*').order('created_at', { ascending: true }).limit(100);

  return (
    <>
      <PortalChrome
        profile={profile}
        current="/shipper/messages"
        tabs={[
          { href: '/shipper', label: 'My Shipments', icon: 'box' },
          { href: '/shipper/post', label: 'Post a Load', icon: 'plus' },
          { href: '/shipper/messages', label: 'Messages', icon: 'msg' },
        ]}
      />
      <div className="page">
        <MessageThread initial={(messages ?? []) as Message[]} role="shipper" userId={profile.id} />
      </div>
    </>
  );
}

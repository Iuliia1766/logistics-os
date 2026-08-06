import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/session';
import { PortalChrome } from '@/components/PortalChrome';
import { MessageThread } from '@/components/MessageThread';
import type { Message } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function DriverMessages() {
  const profile = await requireProfile('driver');
  const supabase = await createClient();

  const { data: messages } = await supabase
    .from('messages').select('*').order('created_at', { ascending: true }).limit(100);

  return (
    <>
      <PortalChrome
        profile={profile}
        current="/driver/messages"
        tabs={[
          { href: '/driver', label: 'Find Loads', icon: 'search' },
          { href: '/driver/loads', label: 'My Loads', icon: 'truck' },
          { href: '/driver/messages', label: 'Messages', icon: 'msg' },
        ]}
      />
      <div className="page">
        <MessageThread initial={(messages ?? []) as Message[]} role="driver" userId={profile.id} />
      </div>
    </>
  );
}

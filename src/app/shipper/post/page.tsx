import { requireProfile } from '@/lib/session';
import { PortalChrome } from '@/components/PortalChrome';
import { PostLoadForm } from '@/components/PostLoadForm';

export const dynamic = 'force-dynamic';

export default async function PostLoadPage() {
  const profile = await requireProfile('shipper');
  return (
    <>
      <PortalChrome
        profile={profile}
        current="/shipper/post"
        tabs={[
          { href: '/shipper', label: 'My Shipments', icon: 'box' },
          { href: '/shipper/post', label: 'Post a Load', icon: 'plus' },
          { href: '/shipper/messages', label: 'Messages', icon: 'msg' },
        ]}
      />
      <div className="page"><PostLoadForm /></div>
    </>
  );
}

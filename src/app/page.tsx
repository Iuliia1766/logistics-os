import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Landing } from '@/components/Landing';

export const dynamic = 'force-dynamic';

/**
 * The front door. Signed-out visitors get the landing page and its two
 * sign-up routes; anyone already signed in goes straight to their portal.
 */
export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).maybeSingle();

    if (profile) redirect(profile.role === 'driver' ? '/driver' : '/shipper');
    // signed in but the profile never got created — let them finish signing up
    redirect('/login?no_profile=1');
  }

  return <Landing />;
}

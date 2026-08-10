import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Landing } from '@/components/Landing';

export const dynamic = 'force-dynamic';

/**
 * The front door. Signed-out visitors get the marketing homepage and its two
 * sign-up routes; anyone already signed in goes straight to their portal.
 */
export default async function Home() {
  // Work out where a signed-in visitor belongs, but never let that decide
  // whether the page renders: this is the public homepage, so if Supabase is
  // unreachable or unconfigured it has to fall back to the marketing page
  // rather than 500 at everyone who lands on the domain.
  let destination: string | null = null;

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase
        .from('profiles').select('role').eq('id', user.id).maybeSingle();

      destination = profile
        ? (profile.role === 'driver' ? '/driver' : '/shipper')
        // signed in but the profile never got created — let them finish signing up
        : '/login?no_profile=1';
    }
  } catch {
    destination = null;
  }

  // outside the try: redirect() signals by throwing, and a catch would eat it
  if (destination) redirect(destination);

  return <Landing />;
}

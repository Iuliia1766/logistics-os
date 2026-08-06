import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Profile, UserRole } from '@/lib/types';

/**
 * Loads the signed-in user's profile and enforces which portal they belong in.
 * A shipper who lands on /driver gets sent to their own portal, not a 403.
 */
export async function requireProfile(role: UserRole): Promise<Profile> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, full_name, company, mc_number, equipment, home_zip, is_premium')
    .eq('id', user.id)
    .single();

  if (!profile) redirect('/login?no_profile=1');
  if (profile.role !== role) redirect(profile.role === 'driver' ? '/driver' : '/shipper');

  return profile as Profile;
}

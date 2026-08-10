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

  // no profile means the signup trigger missed; /account can rebuild it
  if (!profile) redirect('/account');
  if (profile.role !== role) redirect(profile.role === 'driver' ? '/driver' : '/shipper');

  return profile as Profile;
}

/**
 * The signed-in user and their profile, without forcing a portal.
 * profile is null when the signup trigger never created one — the
 * /account page uses that to offer the recovery form instead of
 * bouncing them to a dead end.
 */
export async function getAccount(): Promise<{ userId: string; email: string; profile: Profile | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, full_name, company, mc_number, equipment, home_zip, is_premium')
    .eq('id', user.id)
    .maybeSingle();

  return { userId: user.id, email: user.email ?? '', profile: (profile as Profile) ?? null };
}

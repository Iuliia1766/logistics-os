'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { ActionResult } from './loads';

export async function sendMessage(body: string): Promise<ActionResult> {
  const text = body.trim();
  if (!text) return { ok: false, message: 'Message is empty.' };

  const supabase = await createClient();
  const { error } = await supabase.rpc('send_message', { p_body: text });
  if (error) return { ok: false, message: error.message };

  revalidatePath('/driver/messages');
  revalidatePath('/shipper/messages');
  return { ok: true, message: 'Sent.' };
}

/**
 * Premium is a flag on the profile. When you take real money, point your
 * payment provider's webhook at set_premium() and stop calling this from
 * the client — nothing else in the app has to change.
 */
export async function setPremium(on: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('set_premium', { p_on: on });
  if (error) return { ok: false, message: error.message };

  revalidatePath('/', 'layout');
  return {
    ok: true,
    message: on
      ? 'Premium active — broker reliability unlocked across the board.'
      : 'Premium switched off.',
  };
}

/** Deadhead is measured from here, so drivers change it as they move. */
export async function setHomeZip(zip: string): Promise<ActionResult> {
  if (!/^\d{5}$/.test(zip)) return { ok: false, message: 'Enter a 5-digit ZIP.' };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: 'Not signed in.' };

  const { data: place } = await supabase
    .from('zips').select('zip, city, state').eq('zip', zip).maybeSingle();
  if (!place) return { ok: false, message: `We do not recognise ZIP ${zip}.` };

  const { error } = await supabase.from('profiles').update({ home_zip: zip }).eq('id', user.id);
  if (error) return { ok: false, message: error.message };

  revalidatePath('/driver');
  return { ok: true, message: `Now running out of ${place.city}, ${place.state}.` };
}

/**
 * Create or edit the signed-in user's profile.
 *
 * Goes through upsert_my_profile() rather than a table write so that
 * `role` and `is_premium` stay unreachable — role decides which portal
 * you get, is_premium is the paid tier.
 */
export async function saveProfile(formData: FormData): Promise<ActionResult> {
  const str = (k: string) => String(formData.get(k) ?? '').trim();

  const fullName = str('full_name');
  if (!fullName) return { ok: false, message: 'Enter your name.' };

  const role = str('role');
  const homeZip = str('home_zip');
  if (role === 'driver' && homeZip && !/^\d{5}$/.test(homeZip)) {
    return { ok: false, message: 'A home ZIP is five digits.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('upsert_my_profile', {
    p_full_name: fullName,
    p_company: str('company'),
    p_mc_number: str('mc_number'),
    p_equipment: str('equipment'),
    p_home_zip: homeZip,
    p_role: role || null,
  });
  if (error) return { ok: false, message: error.message };

  const profile = Array.isArray(data) ? data[0] : data;
  revalidatePath('/', 'layout');
  return { ok: true, message: 'Profile saved.', ref: profile?.role };
}

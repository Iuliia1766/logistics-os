'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type ActionResult = { ok: boolean; message: string; ref?: string };

/** Claim an open load. The database decides who wins if two drivers tap at once. */
export async function bookLoad(loadId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('book_load', { p_load: loadId });
  if (error) return { ok: false, message: error.message };

  const load = Array.isArray(data) ? data[0] : data;
  revalidatePath('/driver');
  revalidatePath('/driver/loads');
  revalidatePath('/shipper');
  return {
    ok: true,
    ref: load?.ref,
    message: `Booked ${load?.ref ?? 'load'} — rate confirmation sent.`,
  };
}

/** Move a load to its next stage. The stage machine lives in the database. */
export async function advanceLoad(loadId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('advance_load', { p_load: loadId });
  if (error) return { ok: false, message: error.message };

  const load = Array.isArray(data) ? data[0] : data;
  revalidatePath('/driver/loads');
  revalidatePath('/shipper');
  return { ok: true, ref: load?.ref, message: `${load?.ref ?? 'Load'} updated.` };
}

export async function postLoad(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();

  const originZip = String(formData.get('origin_zip') ?? '').trim();
  const destZip = String(formData.get('dest_zip') ?? '').trim();
  if (!/^\d{5}$/.test(originZip) || !/^\d{5}$/.test(destZip)) {
    return { ok: false, message: 'Pick a pickup and delivery point from the suggestions.' };
  }

  const num = (k: string, fallback = 0) => {
    const v = Number(formData.get(k));
    return Number.isFinite(v) && v > 0 ? Math.round(v) : fallback;
  };
  const rate = Number(formData.get('rate'));
  if (!Number.isFinite(rate) || rate <= 0) {
    return { ok: false, message: 'Enter the rate you are offering.' };
  }

  const toIso = (k: string) => {
    const v = String(formData.get(k) ?? '').trim();
    if (!v) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  };

  const { data, error } = await supabase.rpc('post_load', {
    p_origin_zip: originZip,
    p_dest_zip: destZip,
    p_commodity: String(formData.get('commodity') ?? '').trim(),
    p_weight: num('weight_lb'),
    p_pieces: num('pieces', 1),
    p_len: num('len_in', 48),
    p_wid: num('wid_in', 40),
    p_hgt: num('hgt_in', 48),
    p_equipment: String(formData.get('equipment') ?? 'sprinter_van'),
    p_rate: rate,
    p_pickup: toIso('pickup_at'),
    p_deliver: toIso('deliver_by'),
  });
  if (error) return { ok: false, message: error.message };

  const load = Array.isArray(data) ? data[0] : data;
  revalidatePath('/shipper');
  revalidatePath('/driver');
  return {
    ok: true,
    ref: load?.ref,
    message: `${load?.ref ?? 'Load'} is live on the board — ${load?.miles} mi at $${load?.rate_per_mile}/mi.`,
  };
}

/** A shipper can pull a load back only while nobody has booked it. */
export async function cancelLoad(loadId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from('loads').delete().eq('id', loadId).eq('stage', 0);
  if (error) return { ok: false, message: error.message };
  revalidatePath('/shipper');
  revalidatePath('/driver');
  return { ok: true, message: 'Load pulled from the board.' };
}

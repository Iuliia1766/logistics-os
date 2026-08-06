'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { UserRole } from '@/lib/types';

export type FormState = { error?: string };

const HOME: Record<UserRole, string> = { driver: '/driver', shipper: '/shipper' };

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const role = String(formData.get('role') ?? 'driver') as UserRole;

  if (!email || !password) return { error: 'Enter your email and password.' };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', data.user.id).single();

  if (!profile) {
    await supabase.auth.signOut();
    return { error: 'That account has no profile yet. Sign up to finish setting it up.' };
  }

  // Signing in on the wrong tab is a common slip — say so rather than
  // silently dropping them into the other portal.
  if (profile.role !== role) {
    await supabase.auth.signOut();
    const other = profile.role === 'driver' ? 'Driver' : 'Shipper';
    return { error: `That is a ${other.toLowerCase()} account — pick ${other} above and try again.` };
  }

  revalidatePath('/', 'layout');
  redirect(HOME[profile.role as UserRole]);
}

export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const role = String(formData.get('role') ?? 'driver') as UserRole;
  const full_name = String(formData.get('full_name') ?? '').trim();
  const company = String(formData.get('company') ?? '').trim();
  const mc_number = String(formData.get('mc_number') ?? '').trim();
  const equipment = String(formData.get('equipment') ?? '').trim();
  const home_zip = String(formData.get('home_zip') ?? '').trim();

  if (!email || !password) return { error: 'Enter an email and a password.' };
  if (password.length < 8) return { error: 'Use at least 8 characters for your password.' };
  if (!full_name) return { error: 'Enter your name.' };
  if (role === 'driver' && !/^\d{5}$/.test(home_zip)) {
    return { error: 'Enter the 5-digit ZIP you run out of — deadhead is measured from there.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // handle_new_user() turns this metadata into the profile row
      data: { role, full_name, company, mc_number, equipment: role === 'driver' ? equipment : '', home_zip },
    },
  });
  if (error) return { error: error.message };

  // With email confirmation on, there is no session yet.
  if (!data.session) {
    redirect('/login?check_email=1&role=' + role);
  }

  revalidatePath('/', 'layout');
  redirect(HOME[role]);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/login');
}

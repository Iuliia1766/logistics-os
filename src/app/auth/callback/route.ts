import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/** Where Supabase sends people after they confirm their email address. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) return NextResponse.redirect(`${origin}/login`);

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single();

  return NextResponse.redirect(`${origin}${profile?.role === 'driver' ? '/driver' : '/shipper'}`);
}

import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../../lib/supabase/server';

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/onboarding';

  if (!code) {
    return NextResponse.redirect(`${origin}/onboarding?error=missing_code`);
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.redirect(`${origin}/onboarding?error=supabase_not_configured`);
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/onboarding?error=${encodeURIComponent(error.message)}`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}

import { NextRequest, NextResponse } from "next/server";

/**
 * OAuth callback: Google (via Supabase) redirects here with a `code`. We
 * exchange it for a session — which sets the auth cookies through the
 * @supabase/ssr cookie adapter (route handlers may set cookies) — then send
 * the user into the app. The proxy lets `/auth/*` through unauthenticated so
 * this can run before a session exists.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const { createServerSupabase } = await import("@/lib/supabase/server");
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  // No code, or the exchange failed — back to login with a hint.
  return NextResponse.redirect(`${origin}/login?error=oauth`);
}

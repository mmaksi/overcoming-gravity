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
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      await recordSignupSource(searchParams.get("source"), data.user);
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // No code, or the exchange failed — back to login with a hint.
  return NextResponse.redirect(`${origin}/login?error=oauth`);
}

/**
 * Signup attribution: `/login?source=instagram` rides through the OAuth
 * round trip as a callback query param (see signInWithGoogle). Only a
 * just-created account is attributed — an existing user following a
 * campaign link keeps a null source — and the store's write-once rule
 * backstops that. Never blocks the login itself.
 */
async function recordSignupSource(
  rawSource: string | null,
  user: { id: string; created_at: string } | null,
) {
  const { normalizeSignupSource } = await import("@/lib/domain/schemas");
  const source = normalizeSignupSource(rawSource);
  if (!source || !user) return;
  const isNewSignup =
    Date.now() - new Date(user.created_at).getTime() < 10 * 60_000;
  if (!isNewSignup) return;
  try {
    // Service store: the profile row was created by a DB trigger in this
    // same request — don't depend on the fresh session cookies for RLS.
    const { getServiceStore } = await import("@/lib/data");
    await (await getServiceStore()).setProfileSignupSource(user.id, source);
  } catch (error) {
    console.error("signup source write failed:", error);
  }
}

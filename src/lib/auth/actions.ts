"use server";

import { redirect } from "next/navigation";
import { dataBackend } from "@/lib/data";
import { normalizeSignupSource } from "@/lib/domain/schemas";

/**
 * Auth server actions — the only place the app talks to the auth provider.
 * UI components call these and stay provider-agnostic; swapping Supabase for
 * another provider means reimplementing this file (and the proxy session
 * refresh), nothing else.
 *
 * Sign-in is Google OAuth only. `signInWithGoogle` returns a URL for the
 * client to navigate to rather than calling `redirect()` itself: for Supabase
 * that's Google's consent page (an external URL), and returning it keeps the
 * client in control of the hand-off.
 */

export type AuthResult = { error?: string; url?: string };

export async function signInWithGoogle(source?: string): Promise<AuthResult> {
  // Dev (JSON backend) is always "signed in" — skip OAuth, land on the app.
  if (dataBackend() === "json") return { url: "/" };

  const { headers } = await import("next/headers");
  const origin =
    (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";

  // An acquisition source (`/login?source=instagram`) rides through the
  // OAuth round trip as a callback query param — same channel as `next`.
  // The callback stores it on brand-new profiles (signup attribution).
  const signupSource = normalizeSignupSource(source);
  const callbackUrl = `${origin}/auth/callback${
    signupSource ? `?source=${signupSource}` : ""
  }`;

  const { createServerSupabase } = await import("@/lib/supabase/server");
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    // Google sends the user back here with a code; the callback route
    // exchanges it for a session cookie (src/app/(auth)/auth/callback).
    options: { redirectTo: callbackUrl },
  });
  if (error) return { error: error.message };
  if (!data.url) return { error: "Could not start Google sign-in." };
  return { url: data.url };
}

export async function signOut(): Promise<void> {
  if (dataBackend() === "supabase") {
    const { createServerSupabase } = await import("@/lib/supabase/server");
    const supabase = await createServerSupabase();
    await supabase.auth.signOut();
  }
  redirect("/login");
}

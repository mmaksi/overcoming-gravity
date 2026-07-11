"use server";

import { redirect } from "next/navigation";
import { dataBackend } from "@/lib/data";

/**
 * Auth server actions — the only place the app talks to the auth provider.
 * UI components call these and stay provider-agnostic; swapping Supabase for
 * another provider means reimplementing this file (and the middleware
 * session refresh), nothing else.
 */

export type AuthResult = { error?: string; message?: string };

export async function signInWithPassword(
  email: string,
  password: string,
): Promise<AuthResult> {
  if (dataBackend() === "json") redirect("/"); // dev: always signed in

  const { createServerSupabase } = await import("@/lib/supabase/server");
  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) return { error: error.message };
  redirect("/");
}

export async function signUpWithPassword(
  email: string,
  password: string,
  name: string,
): Promise<AuthResult> {
  if (dataBackend() === "json") redirect("/");

  const { createServerSupabase } = await import("@/lib/supabase/server");
  const supabase = await createServerSupabase();
  // The handle_new_user trigger copies `name` into the profile row.
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name: name.trim() } },
  });
  if (error) return { error: error.message };
  // Every new signup is a normal user (profiles.is_admin defaults to false);
  // admin rights are granted manually in the database.
  if (data.session) redirect("/"); // email confirmation disabled
  return {
    message:
      "Account created — check your inbox to confirm your email, then sign in.",
  };
}

export async function signOut(): Promise<void> {
  if (dataBackend() === "supabase") {
    const { createServerSupabase } = await import("@/lib/supabase/server");
    const supabase = await createServerSupabase();
    await supabase.auth.signOut();
  }
  redirect("/login");
}

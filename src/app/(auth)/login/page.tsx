"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { signInWithGoogle } from "@/lib/auth/actions";
import { Logo } from "@/components/shell/logo";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/** Google's four-colour "G" mark. */
function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}

export default function LoginPage() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function signIn() {
    setMessage(null);
    startTransition(async () => {
      const result = await signInWithGoogle();
      if (result.error) setMessage(result.error);
      // Hand off to Google's consent page (prod) or the app (dev). A full
      // navigation, not router.push — we're leaving the app or restarting it.
      else if (result.url) window.location.href = result.url;
    });
  }

  // The landing page links here as /login?provider=google: start the Google
  // flow immediately so signing up from the marketing site is one hop. The
  // OAuth (PKCE) flow must begin and end on this app's domain — that's why
  // the landing page can't call Supabase itself.
  const autoStarted = useRef(false);
  useEffect(() => {
    if (autoStarted.current) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("provider") === "google") {
      autoStarted.current = true;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      signIn();
    }
  }, []);

  return (
    <div className="relative flex min-h-dvh w-full flex-col items-center justify-center px-4">
      {/* Full-bleed hero photo with a legibility scrim behind the card. */}
      <div
        className="absolute inset-0 -z-10 bg-cover bg-center"
        style={{ backgroundImage: "url('/handstand.jpg')" }}
      />
      <div className="absolute inset-0 -z-10 bg-black/40" />

      {/* Translucent card: the hero photo stays visible, blurred through it. */}
      <Card className="w-full max-w-md border-white/15 bg-card/55 backdrop-blur-lg">
        <CardHeader className="text-center">
          <Logo className="mx-auto size-20" />
          <CardTitle className="text-xl">Strong Journal</CardTitle>
          <CardDescription>
            Sign in to build and track your calisthenics programs.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            variant="outline"
            className="w-full"
            disabled={pending}
            onClick={signIn}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                <GoogleIcon /> Continue with Google
              </>
            )}
          </Button>
          {message && (
            <p className="text-center text-sm text-destructive">{message}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

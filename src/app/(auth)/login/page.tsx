"use client";

import { useState, useTransition } from "react";
import { Dumbbell, Loader2 } from "lucide-react";
import { signInWithPassword, signUpWithPassword } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function LoginPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result =
        mode === "signin"
          ? await signInWithPassword(email, password)
          : await signUpWithPassword(email, password, name);
      if (result?.error) setMessage(result.error);
      else if (result?.message) {
        setMessage(result.message);
        setMode("signin");
      }
    });
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4">
      <Card>
        <CardHeader className="text-center">
          <Dumbbell className="mx-auto size-10 text-primary" />
          <CardTitle className="text-xl">Cali Pro</CardTitle>
          <CardDescription>
            {mode === "signin"
              ? "Sign in to your account"
              : "Create your account"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="name">Your name</Label>
                <Input
                  id="name"
                  autoComplete="name"
                  required
                  maxLength={60}
                  placeholder="How should we greet you?"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete={
                  mode === "signin" ? "current-password" : "new-password"
                }
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {message && (
              <p className="text-sm text-muted-foreground">{message}</p>
            )}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : mode === "signin" ? (
                "Sign in"
              ) : (
                "Sign up"
              )}
            </Button>
            <button
              type="button"
              className="w-full text-center text-sm text-muted-foreground underline"
              onClick={() => {
                setMessage(null);
                setMode(mode === "signin" ? "signup" : "signin");
              }}
            >
              {mode === "signin"
                ? "No account? Sign up"
                : "Have an account? Sign in"}
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

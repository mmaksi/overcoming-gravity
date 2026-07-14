"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Check, Loader2, Send } from "lucide-react";
import { FEEDBACK_TYPE_LABELS, FEEDBACK_TYPES, FeedbackType } from "@/lib/domain/types";
import { submitFeedback } from "@/lib/actions/feedback";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/** Sends feedback to the database (tagged by type) — no mail app needed. */
export function FeedbackForm() {
  const [type, setType] = useState<FeedbackType>("idea");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sendMutation = useMutation({
    mutationFn: () => submitFeedback({ type, message: message.trim() }),
    onSuccess: () => {
      setMessage("");
      setSent(true);
    },
    onError: (e) =>
      setError(e instanceof Error ? e.message : "Couldn't send — try again"),
  });
  const pending = sendMutation.isPending;

  function send() {
    setError(null);
    sendMutation.mutate();
  }

  if (sent) {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-primary/10 p-4 text-sm font-medium text-primary">
        <Check className="size-5" /> Thanks! Your feedback was sent.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>Type</Label>
        <div className="grid grid-cols-2 gap-2">
          {FEEDBACK_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              aria-pressed={type === t}
              className={cn(
                "rounded-lg border py-2 text-sm font-medium transition-colors",
                type === t
                  ? "border-primary bg-primary text-primary-foreground"
                  : "hover:border-foreground/30",
              )}
            >
              {FEEDBACK_TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="feedback">Tell us what to improve</Label>
        <Textarea
          id="feedback"
          placeholder="Ideas, bugs, missing exercises…"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button className="w-full" disabled={!message.trim() || pending} onClick={send}>
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <>
            <Send className="size-4" /> Send feedback
          </>
        )}
      </Button>
    </div>
  );
}

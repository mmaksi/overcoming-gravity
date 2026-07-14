"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Check, Loader2, Send } from "lucide-react";
import {
  FEEDBACK_TYPE_LABELS,
  FEEDBACK_TYPES,
  FeedbackType,
} from "@/lib/domain/types";
import { submitFeedback } from "@/lib/actions/feedback";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
        <Label htmlFor="feedback-type">Type</Label>
        <Select
          value={type}
          onValueChange={(v) => setType(v as FeedbackType)}
        >
          <SelectTrigger id="feedback-type" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FEEDBACK_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {FEEDBACK_TYPE_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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

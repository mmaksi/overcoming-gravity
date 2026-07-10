"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const FEEDBACK_EMAIL = "hello@freestylehuman.com";

/**
 * Opens the user's mail app with the message prefilled — no backend needed,
 * and the sender's address rides along automatically.
 */
export function FeedbackForm() {
  const [message, setMessage] = useState("");

  function send() {
    const subject = encodeURIComponent("Cali Pro feedback");
    const body = encodeURIComponent(message);
    window.location.href = `mailto:${FEEDBACK_EMAIL}?subject=${subject}&body=${body}`;
  }

  return (
    <div className="space-y-3">
      <Label htmlFor="feedback">Tell us what to improve</Label>
      <Textarea
        id="feedback"
        placeholder="Ideas, bugs, missing exercises…"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      <Button
        className="w-full"
        disabled={!message.trim()}
        onClick={send}
      >
        <Send className="size-4" /> Send feedback
      </Button>
    </div>
  );
}

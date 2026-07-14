import { requireAdmin } from "@/lib/auth";
import { getStore } from "@/lib/data";
import { FEEDBACK_TYPE_LABELS, FeedbackType } from "@/lib/domain/types";
import { Badge } from "@/components/ui/badge";

/** Admin inbox: every piece of feedback users have submitted, newest first. */
export default async function AdminFeedbackPage() {
  await requireAdmin();
  const store = await getStore();
  const feedback = await store.listFeedback();

  // Resolve the submitter of each item so admins can follow up. One lookup per
  // distinct user (feedback is short — this stays cheap).
  const userIds = [...new Set(feedback.map((f) => f.userId))];
  const profiles = await Promise.all(userIds.map((id) => store.getProfile(id)));
  const profileById = new Map(
    userIds.map((id, i) => [id, profiles[i]] as const),
  );

  if (feedback.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No feedback yet. When users send feedback from Settings, it shows up
        here.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {feedback.map((f) => {
        const profile = profileById.get(f.userId);
        return (
          <div key={f.id} className="space-y-1.5 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-2">
              <Badge variant="secondary">
                {FEEDBACK_TYPE_LABELS[f.type as FeedbackType]}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {new Date(f.createdAt).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">
                {profile?.name ?? "Unknown user"}
              </span>
              {profile?.email ? ` · ${profile.email}` : ""}
            </div>
            <p className="whitespace-pre-wrap text-sm">{f.message}</p>
          </div>
        );
      })}
    </div>
  );
}

import { requireAdmin } from "@/lib/auth";
import { getStore } from "@/lib/data";
import { FEEDBACK_TYPE_LABELS, FeedbackType } from "@/lib/domain/types";
import { Badge } from "@/components/ui/badge";

/** Admin inbox: every piece of feedback users have submitted, newest first. */
export default async function AdminFeedbackPage() {
  await requireAdmin();
  const store = await getStore();
  const feedback = await store.listFeedback();

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
      {feedback.map((f) => (
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
          <p className="whitespace-pre-wrap text-sm">{f.message}</p>
        </div>
      ))}
    </div>
  );
}

import { cn } from "@/lib/utils";

/** A rounded pill toggle used in filter rows (exercise library, picker). */
export function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-sm transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "text-muted-foreground hover:border-foreground/30",
      )}
    >
      {label}
    </button>
  );
}

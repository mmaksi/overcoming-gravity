"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/admin", label: "Exercises" },
  { href: "/admin/defaults", label: "Defaults" },
  { href: "/admin/feedback", label: "Feedback" },
  { href: "/admin/vouchers", label: "Vouchers" },
];

export function AdminTabs() {
  const pathname = usePathname();
  return (
    <div className="flex gap-1 overflow-x-auto">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={cn(
            "shrink-0 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
            pathname === t.href
              ? "border-primary bg-primary text-primary-foreground"
              : "hover:border-foreground/30",
          )}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}

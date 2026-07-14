"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarIcon,
  HomeIcon,
  ProgramsIcon,
  ShieldIcon,
} from "@/components/shell/nav-icons";
import { cn } from "@/lib/utils";

// Settings lives at the home top-right corner, not in the nav bar.
const items = [
  { href: "/", label: "Home", icon: HomeIcon },
  { href: "/programs", label: "Programs", icon: ProgramsIcon },
  { href: "/calendar", label: "Calendar", icon: CalendarIcon },
];

export function BottomNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const navItems = isAdmin
    ? [...items, { href: "/admin", label: "Admin", icon: ShieldIcon }]
    : items;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex max-w-lg items-stretch justify-around pb-[env(safe-area-inset-bottom)]">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          // Icon-forward: the active tab also shows its label, inactive tabs
          // are icon-only. The bar is taller with larger touch targets.
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-1 py-4 transition-colors",
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-7" strokeWidth={active ? 2.4 : 1.8} />
              {active && (
                <span className="text-[13px] font-semibold leading-none">
                  {label}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

import * as React from "react";

import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { NavItem } from "@/config/site";
import { cn } from "@/lib/utils";

interface MobileNavProps {
  items: NavItem[];
  /** Astro.url.pathname, passed in so the island can mark the active link */
  pathname: string;
  label: string;
}

const normalize = (href: string) => href.replace(/\/$/, "") || "/";

export default function MobileNav({ items, pathname, label }: MobileNavProps) {
  const [open, setOpen] = React.useState(false);
  const current = normalize(pathname);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label="Open menu"
        className="rounded-lg p-2 text-star transition-colors hover:bg-nebula focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          className="size-6"
        >
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </SheetTrigger>

      <SheetContent side="right" aria-describedby={undefined}>
        <SheetTitle>{label}</SheetTitle>

        <nav aria-label="Mobile navigation">
          <ul className="flex flex-col gap-1">
            {items.map((item) => {
              const active = current === normalize(item.href);
              return (
                <li key={item.href}>
                  <SheetClose asChild>
                    <a
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "block rounded-xl px-4 py-3 text-base font-semibold transition-colors",
                        active
                          ? "bg-nebula text-yolk"
                          : "text-dust hover:bg-nebula hover:text-star",
                      )}
                    >
                      {item.label}
                    </a>
                  </SheetClose>
                </li>
              );
            })}
          </ul>
        </nav>
      </SheetContent>
    </Sheet>
  );
}

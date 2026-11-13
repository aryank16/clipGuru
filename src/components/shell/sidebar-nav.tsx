"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { NAV, isActive } from "./nav";

/** Desktop sidebar links; the current section is filled espresso. */
export function SidebarNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex flex-col gap-1.5">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-12 items-center gap-3.5 rounded-xl px-4 text-[15px]",
              active
                ? "bg-espresso-deep font-semibold text-surface shadow-sm"
                : "text-espresso/80 hover:bg-surface-warm/60 hover:text-espresso",
            )}
          >
            <Icon className="size-5" strokeWidth={1.6} aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

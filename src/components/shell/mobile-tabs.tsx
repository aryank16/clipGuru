"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { NAV, isActive } from "./nav";

/** Phone bottom tab bar: the three sections with a raised "new video" button in the middle. */
export function MobileTabs() {
  const pathname = usePathname();
  const [videos, scheduled, settings] = NAV;
  const tab = ({ href, label, icon: Icon }: (typeof NAV)[number]) => {
    const active = isActive(pathname, href);
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex flex-1 flex-col items-center gap-1 py-2 text-[11px]",
          active ? "font-semibold text-espresso" : "text-taupe",
        )}
      >
        <Icon className="size-5" strokeWidth={active ? 2 : 1.6} aria-hidden />
        {label}
      </Link>
    );
  };
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-hairline bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <div className="mx-auto flex max-w-md items-end px-2">
        {tab(videos)}
        {tab(scheduled)}
        <div className="flex flex-1 justify-center">
          <Link
            href="/new"
            aria-label="New video"
            className="-mt-6 mb-2 flex size-14 items-center justify-center rounded-full bg-espresso-deep text-surface shadow-[0_8px_20px_-6px_rgba(32,30,28,0.5)] ring-4 ring-paper"
          >
            <Plus className="size-6" aria-hidden />
          </Link>
        </div>
        {tab(settings)}
      </div>
    </nav>
  );
}

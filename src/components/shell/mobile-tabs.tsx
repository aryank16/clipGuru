"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { NAV, isActive } from "./nav";

/** Phone bottom tab bar: My videos and Scheduled either side of a raised "new video" button, so it sits dead centre. Settings is the avatar in the header. */
export function MobileTabs() {
  return <MobileTabsView pathname={usePathname()} />;
}

/** Pure view; the layout also renders it with an empty path while a dynamic route streams in. */
export function MobileTabsView({ pathname }: { pathname: string }) {
  const [videos, scheduled] = NAV;
  const tab = ({ href, label, icon: Icon }: (typeof NAV)[number]) => {
    const active = isActive(pathname, href);
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex flex-col items-center gap-1 py-2 text-[11px]",
          active ? "font-semibold text-ink" : "text-muted",
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
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <div className="mx-auto grid max-w-md grid-cols-3 items-end px-2">
        {tab(videos)}
        <div className="flex justify-center">
          <Link
            href="/new"
            aria-label="New video"
            className="-mt-6 mb-2 flex size-14 items-center justify-center rounded-full bg-ink-strong text-on-ink shadow-fab ring-4 ring-canvas"
          >
            <Plus className="size-6" aria-hidden />
          </Link>
        </div>
        {tab(scheduled)}
      </div>
    </nav>
  );
}

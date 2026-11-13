import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/brand/logo";
import { HeaderAccount, SidebarAccount } from "@/components/shell/account";
import { InstagramCard } from "@/components/shell/instagram-card";
import { MobileTabs, MobileTabsView } from "@/components/shell/mobile-tabs";
import { SidebarNav, SidebarNavView } from "@/components/shell/sidebar-nav";

/** Signed-in shell: sidebar on desktop, top bar + bottom tabs on phones. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[288px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col justify-between border-r border-hairline bg-surface px-5 py-8 lg:flex">
        <div className="flex flex-col gap-10">
          <Link href="/videos" className="px-2">
            <Logo />
          </Link>
          <Suspense fallback={<SidebarNavView pathname="" />}>
            <SidebarNav />
          </Suspense>
        </div>
        <div className="flex flex-col gap-5">
          <InstagramCard />
          <Suspense fallback={<div className="h-9" />}>
            <SidebarAccount />
          </Suspense>
        </div>
      </aside>

      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-hairline bg-paper/95 px-4 py-3 backdrop-blur sm:px-6 lg:hidden">
        <Link href="/videos">
          <Logo />
        </Link>
        <Suspense fallback={<div className="size-9" />}>
          <HeaderAccount />
        </Suspense>
      </header>

      <main className="min-w-0 px-4 pt-6 pb-28 sm:px-8 lg:px-14 lg:pt-12 lg:pb-16">{children}</main>
      <Suspense fallback={<MobileTabsView pathname="" />}>
        <MobileTabs />
      </Suspense>
    </div>
  );
}

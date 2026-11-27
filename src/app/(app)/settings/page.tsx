import type { Metadata } from "next";
import { Suspense } from "react";
import { LegalLinks } from "@/components/legal/legal-links";
import { SettingsForm } from "@/components/settings/settings-form";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { instagramSvc } from "@/lib/instagram";
import { isConnectError } from "@/lib/instagram/types";
import { googleEnabled } from "@/lib/env";
import { toMe } from "@/lib/me";
import { requirePageSession } from "@/lib/session";
import { timeZoneOptions } from "@/lib/timezones";
import { VOICES } from "@/lib/voices";

export const metadata: Metadata = { title: "Settings" };

type Search = Promise<{ instagram?: string; reason?: string }>;

export default function SettingsPage({ searchParams }: { searchParams: Search }) {
  return (
    <div className="flex flex-col gap-10">
      <PageHeader title="Settings" />
      <Suspense fallback={<Card className="h-96 max-w-3xl animate-pulse" />}>
        <Settings searchParams={searchParams} />
      </Suspense>
      <LegalLinks className="border-t border-line pt-6" />
    </div>
  );
}

async function Settings({ searchParams }: { searchParams: Search }) {
  const { user } = await requirePageSession();
  const q = await searchParams;
  const instagramResult =
    q.instagram === "connected"
      ? ({ ok: true } as const)
      : q.instagram === "error"
        ? ({ ok: false, reason: isConnectError(q.reason) ? q.reason : "UNKNOWN" } as const)
        : null;
  const ctx = await auth().$context;
  const accounts = await ctx.internalAdapter.findAccounts(user.id);
  const me = toMe(user);
  return (
    <SettingsForm
      me={me}
      voices={VOICES}
      timeZones={timeZoneOptions(me.timeZone)}
      hasPassword={accounts.some((a) => a.providerId === "credential")}
      google={{ enabled: googleEnabled(), linked: accounts.some((a) => a.providerId === "google") }}
      instagram={await instagramSvc().status(user.id)}
      instagramResult={instagramResult}
    />
  );
}

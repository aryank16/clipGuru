import type { Metadata } from "next";
import { Suspense } from "react";
import { SettingsForm } from "@/components/settings/settings-form";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { toMe } from "@/lib/me";
import { requirePageSession } from "@/lib/session";
import { timeZoneOptions } from "@/lib/timezones";
import { VOICES } from "@/lib/voices";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-10">
      <PageHeader title="Settings" />
      <Suspense fallback={<Card className="h-96 max-w-3xl animate-pulse" />}>
        <Settings />
      </Suspense>
    </div>
  );
}

async function Settings() {
  const { user } = await requirePageSession();
  const ctx = await auth().$context;
  const accounts = await ctx.internalAdapter.findAccounts(user.id);
  const me = toMe(user);
  return (
    <SettingsForm
      me={me}
      voices={VOICES}
      timeZones={timeZoneOptions(me.timeZone)}
      hasPassword={accounts.some((a) => a.providerId === "credential")}
    />
  );
}

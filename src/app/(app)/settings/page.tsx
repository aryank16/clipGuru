import type { Metadata } from "next";
import { Suspense } from "react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { PageHeader } from "@/components/shell/page-header";
import { Card, SectionHeader } from "@/components/ui/card";
import { requirePageSession } from "@/lib/session";

export const metadata: Metadata = { title: "Settings" };

/** Settings. Editing voice, time zone and name, plus Instagram, arrive with F4 and F12. */
export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-10">
      <PageHeader title="Settings" />
      <div className="flex max-w-3xl flex-col gap-6">
        <Suspense fallback={<Card className="h-56 animate-pulse" />}>
          <AccountCard />
        </Suspense>
        <Card className="flex flex-col gap-5 p-6 sm:p-8">
          <SectionHeader index="02" eyebrow="Instagram" title="Instagram account" />
          <p className="text-taupe">Not connected. Connecting your account comes in a later update.</p>
        </Card>
      </div>
    </div>
  );
}

async function AccountCard() {
  const { user } = await requirePageSession();
  const rows = [
    ["Name", user.name],
    ["Email", user.email],
    ["Time zone", user.timeZone],
    ["Default voice", "George (British male)"],
  ];
  return (
    <Card className="flex flex-col gap-5 p-6 sm:p-8">
      <SectionHeader index="01" eyebrow="Account" title="Your account" aside={<SignOutButton />} />
      <dl className="grid gap-4 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="eyebrow">{label}</dt>
            <dd className="mt-1 truncate">{value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

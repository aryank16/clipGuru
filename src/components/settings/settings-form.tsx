"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { patchMe, Status, useSaver } from "@/components/account/save";
import { VoicePicker } from "@/components/account/voice-picker";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Button } from "@/components/ui/button";
import { Card, SectionHeader } from "@/components/ui/card";
import type { Me } from "@/lib/me";
import { NAME_MAX } from "@/lib/me";
import type { TimeZoneOption } from "@/lib/timezones";
import type { Voice } from "@/lib/voices";

const noopSubscribe = () => () => {};

export function SettingsForm({
  me,
  voices,
  timeZones,
  hasPassword,
}: {
  me: Me;
  voices: Voice[];
  timeZones: TimeZoneOption[];
  hasPassword: boolean;
}) {
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <AccountSection me={me} hasPassword={hasPassword} />
      <VoiceSection current={me.defaultVoiceId ?? voices[0].id} voices={voices} />
      <TimeZoneSection current={me.timeZone} options={timeZones} />
      <Card className="flex flex-col gap-5 p-6 sm:p-8">
        <SectionHeader index="04" eyebrow="Instagram" title="Instagram account" />
        <p className="text-taupe">Not connected. Connecting your Instagram account comes in a later update.</p>
      </Card>
      <DeleteSection email={me.email} />
    </div>
  );
}

function AccountSection({ me, hasPassword }: { me: Me; hasPassword: boolean }) {
  const router = useRouter();
  const [name, setName] = useState(me.name);
  const [saved, setSaved] = useState(me.name);
  const { state, error, run } = useSaver();
  const dirty = name.trim() !== saved;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!dirty) return;
    const out = await run(() => patchMe({ name }));
    if (out) {
      setSaved(out.name);
      setName(out.name);
      router.refresh(); // the sidebar shows the name too
    }
  }

  return (
    <Card className="flex flex-col gap-6 p-6 sm:p-8">
      <SectionHeader index="01" eyebrow="Account" title="Profile" aside={<SignOutButton />} />
      <form onSubmit={save} className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label htmlFor="display-name" className="text-sm font-medium">
            Name
          </label>
          {/* The browser must not fill this with the name saved in its own profile: the field shows
              the account's saved name, and a filled-in value would look saved when it isn't. */}
          <input
            id="display-name"
            autoComplete="off"
            data-1p-ignore
            data-lpignore="true"
            value={name}
            maxLength={NAME_MAX}
            onChange={(e) => setName(e.target.value)}
            className="h-12 rounded-lg border border-hairline bg-paper/40 px-4 text-[15px] focus:border-sand-gold focus:ring-2 focus:ring-sand-gold/40 focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Email</span>
          <p className="flex h-12 items-center truncate rounded-lg border border-hairline bg-surface-warm/40 px-4 text-[15px] text-taupe">
            {me.email}
          </p>
        </div>
        <div className="flex min-h-9 items-center gap-4 sm:col-span-2">
          <Button type="submit" size="sm" disabled={!dirty || state === "saving"}>
            Save name
          </Button>
          <Status state={state} error={error} />
        </div>
      </form>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-hairline px-4 py-3.5">
        <div>
          <p className="text-sm font-medium">Password</p>
          <p className="text-sm text-taupe">
            {hasPassword ? "Change it with a reset link sent to your email." : "You sign in with Google."}
          </p>
        </div>
        {hasPassword ? (
          <a href="/forgot-password" className="text-sm font-medium underline underline-offset-4">
            Change password
          </a>
        ) : null}
      </div>
    </Card>
  );
}

function VoiceSection({ current, voices }: { current: string; voices: Voice[] }) {
  const { state, error, run } = useSaver();
  return (
    <Card className="flex flex-col gap-5 p-6 sm:p-8">
      <SectionHeader index="02" eyebrow="Narrator" title="Default voice" aside={<Status state={state} error={error} />} />
      <p className="text-taupe">New videos start with this voice. You can still change it on each video.</p>
      <VoicePicker
        current={current}
        voices={voices}
        onPick={async (id) => Boolean(await run(() => patchMe({ defaultVoiceId: id })))}
      />
    </Card>
  );
}

function TimeZoneSection({ current, options }: { current: string; options: TimeZoneOption[] }) {
  const [tz, setTz] = useState(current);
  const { state, error, run } = useSaver();
  const browserTz = useSyncExternalStore(
    noopSubscribe,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => null,
  );

  async function change(next: string) {
    const before = tz;
    setTz(next);
    const out = await run(() => patchMe({ timeZone: next }));
    if (!out) setTz(before);
  }

  return (
    <Card className="flex flex-col gap-5 p-6 sm:p-8">
      <SectionHeader index="03" eyebrow="Scheduling" title="Time zone" aside={<Status state={state} error={error} />} />
      <p className="text-taupe">Scheduled Instagram posts go out at the time you pick in this zone.</p>
      <label htmlFor="tz" className="sr-only">
        Time zone
      </label>
      <select
        id="tz"
        value={tz}
        onChange={(e) => change(e.target.value)}
        className="h-12 w-full rounded-lg border border-hairline bg-paper/40 px-3 text-[15px] focus:border-sand-gold focus:ring-2 focus:ring-sand-gold/40 focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
      {browserTz && browserTz !== tz && options.some((o) => o.id === browserTz) ? (
        <button
          type="button"
          onClick={() => change(browserTz)}
          className="self-start text-sm font-medium underline underline-offset-4"
        >
          Use this device&apos;s time zone ({browserTz.replaceAll("_", " ")})
        </button>
      ) : null}
    </Card>
  );
}

function DeleteSection({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Card className="flex flex-col gap-5 border-danger/25 p-6 sm:p-8">
      <SectionHeader index="05" eyebrow="Danger zone" title="Delete account" />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-lg text-taupe">
          Deletes your account and all your videos for good. This can&apos;t be undone.
        </p>
        <Button variant="danger" size="sm" onClick={() => setOpen(true)}>
          Delete account
        </Button>
      </div>
      {open ? <DeleteDialog email={email} onClose={() => setOpen(false)} /> : null}
    </Card>
  );
}

function DeleteDialog({ email, onClose }: { email: string; onClose: () => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/me", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ confirm: text }),
    }).catch(() => null);
    if (res?.ok) {
      // A full page load drops every page Next kept in memory for the deleted account.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/sign-in");
      return;
    }
    setBusy(false);
    setError("Couldn't delete the account. Try again.");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-espresso/30 p-4 sm:items-center" onMouseDown={() => !busy && onClose()}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-title"
        onSubmit={confirm}
        onMouseDown={(e) => e.stopPropagation()}
        className="flex w-full max-w-md flex-col gap-5 rounded-2xl border border-hairline bg-surface p-6 shadow-xl"
      >
        <h2 id="delete-title" className="text-lg font-semibold">
          Delete your account?
        </h2>
        <p className="text-taupe">
          This deletes <span className="font-medium text-espresso">{email}</span> and every video in it. Type{" "}
          <span className="font-mono font-semibold text-espresso">DELETE</span> to confirm.
        </p>
        <input
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label="Type DELETE to confirm"
          autoComplete="off"
          className="h-12 rounded-lg border border-hairline bg-paper/40 px-4 font-mono text-[15px] focus:border-danger/60 focus:ring-2 focus:ring-danger/20 focus:outline-none"
        />
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" variant="danger" disabled={text !== "DELETE" || busy}>
            {busy ? "Deleting…" : "Delete for good"}
          </Button>
        </div>
      </form>
    </div>
  );
}

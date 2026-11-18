"use client";

import { AlertTriangle, AtSign, Check, Loader2, RotateCcw } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card, SectionHeader } from "@/components/ui/card";
import type { ConnectError, InstagramStatus } from "@/lib/instagram/types";
import { CONNECT_ERROR_TEXT } from "./messages";

export type ConnectResult = { ok: true } | { ok: false; reason: ConnectError } | null;

const connectHref = (returnTo: string) => `/api/instagram/connect?returnTo=${encodeURIComponent(returnTo)}`;

/** Settings → Instagram account (design 15): connect, see the linked account, disconnect. */
export function InstagramSection({ status, result }: { status: InstagramStatus; result: ConnectResult }) {
  const router = useRouter();
  const pathname = usePathname();
  const [shown, setShown] = useState(result);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const card = useRef<HTMLDivElement>(null);
  const cancelBtn = useRef<HTMLButtonElement>(null);
  const disconnectBtn = useRef<HTMLButtonElement>(null);
  const reopen = useRef(false);

  // Keep keyboard focus with the choice: Cancel when the question opens, Disconnect after Cancel.
  useEffect(() => {
    if (confirming) cancelBtn.current?.focus();
    else if (reopen.current) {
      reopen.current = false;
      disconnectBtn.current?.focus();
    }
  }, [confirming]);
  const cancel = () => {
    reopen.current = true;
    setConfirming(false);
  };
  // Coming back from Instagram: show this section (it's below the fold), then drop ?instagram=…
  // from the address so a reload doesn't repeat the message.
  useEffect(() => {
    if (!result) return;
    card.current?.scrollIntoView({ block: "start" });
    card.current?.focus({ preventScroll: true });
    router.replace(pathname, { scroll: false });
  }, [result, router, pathname]);

  async function disconnect() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/instagram", { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error?.message ?? "Couldn't disconnect. Try again.");
      setConfirming(false);
      setShown(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof TypeError ? "Couldn’t reach ClipGuru. Check your connection and try again." : (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const failure = shown && !shown.ok ? CONNECT_ERROR_TEXT[shown.reason] : null;
  const badge = status.connected ? (
    status.status === "connected" ? (
      <Badge tone="success">Connected</Badge>
    ) : (
      <Badge tone="danger">Reconnect needed</Badge>
    )
  ) : failure ? (
    <Badge tone="muted">Action needed</Badge>
  ) : (
    <Badge tone="muted">Not connected</Badge>
  );

  return (
    <Card ref={card} tabIndex={-1} className="flex scroll-mt-24 flex-col gap-5 p-6 outline-none sm:p-8" id="instagram">
      <SectionHeader index="04" eyebrow="Instagram" title="Instagram account" aside={badge} />

      {shown?.ok && status.connected && (
        <p role="status" className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm">
          <Check className="size-4 text-success" aria-hidden /> Instagram is connected.
        </p>
      )}

      {failure && (
        <div role="alert" className="flex flex-col gap-3 rounded-xl border border-sand-gold bg-sand-gold/15 p-4 sm:p-5">
          <p className="flex items-center gap-2 font-medium">
            <AlertTriangle className="size-4 shrink-0" aria-hidden /> {failure.title}
          </p>
          <p className="text-sm text-espresso/80">{failure.text}</p>
          {failure.steps && (
            <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm text-espresso/80">
              {failure.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          )}
        </div>
      )}

      {status.connected ? (
        <>
          <div className="flex items-center gap-4 rounded-xl border border-hairline bg-paper/40 p-4">
            {status.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- Instagram's own image link
              <img src={status.avatarUrl} alt="" className="size-12 shrink-0 rounded-full border border-hairline object-cover" />
            ) : (
              <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-sand-gold/40" aria-hidden>
                <AtSign className="size-5" />
              </span>
            )}
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-medium">@{status.username}</span>
              <span className="text-sm text-taupe">
                {status.status === "connected" ? "Videos you post go to this account." : "Instagram stopped accepting ClipGuru’s access."}
              </span>
            </div>
          </div>
          {status.status === "reconnect_needed" && (
            <p className="text-sm text-taupe">Connect again to keep posting. Your scheduled posts wait until you do.</p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            {status.status === "reconnect_needed" && (
              <a href={connectHref(pathname)} className={buttonClasses("primary", "md")}>
                <RotateCcw className="size-4" aria-hidden /> Connect again
              </a>
            )}
            {confirming ? (
              <div
                className="flex flex-wrap items-center gap-3"
                role="group"
                aria-label="Confirm disconnect"
                aria-describedby="ig-confirm"
                onKeyDown={(e) => {
                  if (e.key === "Escape" && !busy) cancel();
                }}
              >
                <span className="text-sm" id="ig-confirm">
                  Disconnect @{status.username}?
                </span>
                <Button variant="danger" onClick={disconnect} disabled={busy} aria-busy={busy}>
                  {busy && <Loader2 className="size-4 animate-spin" aria-hidden />} Disconnect
                </Button>
                <Button ref={cancelBtn} variant="secondary" onClick={cancel} disabled={busy}>
                  Cancel
                </Button>
              </div>
            ) : (
              <Button ref={disconnectBtn} variant="secondary" onClick={() => setConfirming(true)}>
                Disconnect
              </Button>
            )}
            {status.status === "connected" && (
              <a href={connectHref(pathname)} className="text-sm text-taupe underline-offset-4 hover:text-espresso hover:underline">
                Use a different account
              </a>
            )}
          </div>
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
        </>
      ) : (
        <>
          <p className="text-taupe">
            Connect the Instagram Business or Creator account you want to post to. You log in with Instagram (or Facebook)
            and choose the account; ClipGuru only asks to publish to it.
          </p>
          {status.available ? (
            <a href={connectHref(pathname)} className={buttonClasses("primary", "md", "w-fit")}>
              {failure ? <RotateCcw className="size-4" aria-hidden /> : <AtSign className="size-4" aria-hidden />}
              {failure ? "Try again" : "Connect Instagram"}
            </a>
          ) : (
            <p className="text-sm text-taupe">Instagram isn’t set up on this server yet.</p>
          )}
        </>
      )}
    </Card>
  );
}

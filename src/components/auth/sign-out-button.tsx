"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth-client";

/** Signs out and returns to /sign-in. `compact` shows just the icon (sidebar, phone header). */
export function SignOutButton({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant={compact ? "ghost" : "secondary"}
      // md is 44px tall; cn() doesn't merge classes, so the compact width and padding are forced.
      size="md"
      className={compact ? "w-11 px-0! text-muted hover:text-ink" : undefined}
      aria-label={compact ? "Sign out" : undefined}
      title={compact ? "Sign out" : undefined}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await signOut();
        router.replace("/sign-in");
        router.refresh();
      }}
    >
      <LogOut className="size-4" />
      {compact ? null : busy ? "Signing out…" : "Sign out"}
    </Button>
  );
}

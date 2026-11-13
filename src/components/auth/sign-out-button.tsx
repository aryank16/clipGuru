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
      size={compact ? "sm" : "md"}
      className={compact ? "size-9 px-0 text-taupe hover:text-espresso" : undefined}
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

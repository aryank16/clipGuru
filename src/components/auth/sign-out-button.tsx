"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="secondary"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await signOut();
        router.replace("/sign-in");
        router.refresh();
      }}
    >
      <LogOut className="size-4" /> {busy ? "Signing out…" : "Sign out"}
    </Button>
  );
}

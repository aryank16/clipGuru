import Link from "next/link";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { initials } from "@/lib/initials";
import { requirePageSession } from "@/lib/session";

function Avatar({ name }: { name: string }) {
  return (
    <span
      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent font-mono text-xs font-medium text-on-accent"
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

/** Sidebar footer: who is signed in, with a sign-out icon button. */
export async function SidebarAccount() {
  const { user } = await requirePageSession();
  return (
    <div className="flex items-center gap-3 px-1">
      <Avatar name={user.name} />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">{user.name}</span>
        <span className="truncate text-xs text-muted">{user.email}</span>
      </div>
      <SignOutButton compact />
    </div>
  );
}

/** Phone header: sign-out icon, and the avatar opens Settings (the bottom bar keeps only the two main sections around New). */
export async function HeaderAccount() {
  const { user } = await requirePageSession();
  return (
    <div className="flex items-center gap-2">
      <SignOutButton compact />
      <Link
        href="/settings"
        aria-label="Settings"
        className="flex size-11 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <Avatar name={user.name} />
      </Link>
    </div>
  );
}

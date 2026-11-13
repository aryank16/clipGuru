import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getSession } from "@/lib/session";

/**
 * Sends a visitor with a valid session from sign-in, sign-up and forgot password to My videos.
 * A stale or invalid cookie fails this check, so the visitor stays and can sign in again.
 */
export function RedirectIfSignedIn() {
  return (
    <Suspense fallback={null}>
      <Check />
    </Suspense>
  );
}

async function Check() {
  if (await getSession()) redirect("/videos");
  return null;
}

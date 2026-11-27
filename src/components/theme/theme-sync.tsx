import { toMe } from "@/lib/me";
import { requirePageSession } from "@/lib/session";
import { ThemeSyncClient } from "./theme-sync-client";

/**
 * Keeps this browser's remembered theme in step with the account's. The boot script paints with the
 * remembered one; on a new device (or after a change elsewhere) this corrects it once and remembers it.
 */
export async function ThemeSync() {
  const { user } = await requirePageSession();
  return <ThemeSyncClient theme={toMe(user).theme} />;
}

import "server-only";
import { env, instagramDriver } from "../env";
import { fakeClient, metaClient, type InstagramClient } from "./client";
import { open } from "./crypto";
import { instagramRepo } from "./repo";
import { instagramService } from "./service";
import { toStatus } from "./types";

export const instagramRedirectUri = () => `${env().APP_URL}/api/instagram/callback`;

/** The Meta client, the local fake, or null when Instagram isn't set up here. */
export function instagramClient(): InstagramClient | null {
  const d = instagramDriver();
  return d === "meta" ? metaClient() : d === "fake" ? fakeClient() : null;
}

export function instagramSvc() {
  return instagramService({ repo: instagramRepo(), client: instagramClient, redirectUri: instagramRedirectUri });
}

export type Publisher = { igUserId: string; username: string; token: string };

/**
 * What posting needs: the linked account and its token. `null` with a reason when there is no
 * usable account (none linked, or Meta refused the token and the person must connect again).
 */
export async function publisherFor(
  userId: string,
): Promise<{ ok: true; publisher: Publisher } | { ok: false; reason: "not_connected" | "reconnect_needed" }> {
  const r = await instagramRepo().get(userId);
  const status = toStatus(r, true);
  if (!r || !status.connected) return { ok: false, reason: "not_connected" };
  if (status.status === "reconnect_needed") return { ok: false, reason: "reconnect_needed" };
  try {
    return { ok: true, publisher: { igUserId: r.igUserId, username: r.username, token: open(r.tokenEnc) } };
  } catch (err) {
    console.error("[instagram] stored token can't be read", err);
    return { ok: false, reason: "reconnect_needed" };
  }
}

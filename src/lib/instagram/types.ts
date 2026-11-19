/** A linked Instagram professional account (one per person). */
export type InstagramAccountRecord = {
  userId: string;
  /** The Instagram professional account id (used in publishing paths). */
  igUserId: string;
  username: string;
  avatarUrl: string | null;
  /** The access token, encrypted (see crypto.ts). Never sent to the browser. */
  tokenEnc: string;
  tokenExpiresAt: Date | null;
  /** Meta's id for the person's business, needed to refresh tokens later. */
  clientBusinessId: string | null;
  /** Set when Meta refuses the token, so the person is asked to connect again. */
  reconnectNeeded: boolean;
  connectedAt: Date;
  updatedAt: Date;
};

export type InstagramStatus =
  | { connected: false; available: boolean }
  | { connected: true; username: string; avatarUrl: string | null; status: "connected" | "reconnect_needed" };

/** Why connecting failed (API Design → GET /api/instagram/callback). */
export const CONNECT_ERRORS = ["PERSONAL_ACCOUNT", "PERMISSION_DENIED", "NOT_A_TESTER", "ACCOUNT_IN_USE", "CANCELLED", "UNKNOWN"] as const;
export type ConnectError = (typeof CONNECT_ERRORS)[number];

export const isConnectError = (v: unknown): v is ConnectError => CONNECT_ERRORS.includes(v as ConnectError);

export function toStatus(r: InstagramAccountRecord | null, available: boolean, now = new Date()): InstagramStatus {
  if (!r) return { connected: false, available };
  const expired = r.tokenExpiresAt !== null && r.tokenExpiresAt.getTime() <= now.getTime();
  return {
    connected: true,
    username: r.username,
    avatarUrl: r.avatarUrl,
    status: r.reconnectNeeded || expired ? "reconnect_needed" : "connected",
  };
}

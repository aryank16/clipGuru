import { describe, expect, it } from "vitest";
import { dropUnconfirmedPassword } from "./auth-link";

function fakeDb(emailVerified: boolean, providers: string[]) {
  const accounts = providers.map((providerId, i) => ({ id: `a${i}`, providerId }));
  const calls = { deleted: [] as string[], sessionsCleared: false };
  return {
    calls,
    accounts,
    findUserById: async () => ({ emailVerified }),
    findAccounts: async () => accounts.filter((a) => !calls.deleted.includes(a.id)),
    deleteAccount: async (id: string) => void calls.deleted.push(id),
    deleteUserSessions: async () => void (calls.sessionsCleared = true),
  };
}

describe("Google linking to an existing account", () => {
  it("removes an unconfirmed password and signs out older sessions", async () => {
    const db = fakeDb(false, ["credential", "google"]);
    expect(await dropUnconfirmedPassword("u1", db)).toBe(true);
    expect(db.calls.deleted).toEqual(["a0"]);
    expect(db.calls.sessionsCleared).toBe(true);
  });

  it("keeps the password when the email was confirmed", async () => {
    const db = fakeDb(true, ["credential", "google"]);
    expect(await dropUnconfirmedPassword("u1", db)).toBe(false);
    expect(db.calls.deleted).toEqual([]);
    expect(db.calls.sessionsCleared).toBe(false);
  });

  it("does nothing for a Google-only account", async () => {
    const db = fakeDb(false, ["google"]);
    expect(await dropUnconfirmedPassword("u1", db)).toBe(false);
    expect(db.calls.sessionsCleared).toBe(false);
  });
});

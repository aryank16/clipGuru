type Adapter = {
  findUserById(id: string): Promise<{ emailVerified: boolean } | null>;
  findAccounts(userId: string): Promise<{ id: string; providerId: string }[]>;
  deleteAccount(id: string): Promise<void>;
  deleteUserSessions(userId: string): Promise<void>;
};

/**
 * Google was just linked to an account. If that account's email was never confirmed, anyone could have
 * made its password (signing up with someone else's email). Google has now proved who owns the email,
 * so the unconfirmed password is removed and older sessions are signed out. The owner signs in with
 * Google from now on, or sets a new password with "Forgot password" (that link goes to their inbox).
 * Runs just before the Google account row is saved: the email is not yet marked confirmed and the new
 * Google session doesn't exist yet, so only older sessions are signed out.
 */
export async function dropUnconfirmedPassword(userId: string, db: Adapter): Promise<boolean> {
  const user = await db.findUserById(userId);
  if (!user || user.emailVerified) return false;
  const passwords = (await db.findAccounts(userId)).filter((a) => a.providerId === "credential");
  if (passwords.length === 0) return false;
  for (const a of passwords) await db.deleteAccount(a.id);
  await db.deleteUserSessions(userId);
  return true;
}

import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ApiError } from "./api/errors";
import { auth, type Session } from "./auth";

/** Current session for a server component, or null. */
export async function getSession(): Promise<Session | null> {
  const h = await headers();
  return auth().api.getSession({ headers: h });
}

/** For pages: the signed-in user, or a redirect to sign-in. */
export async function requirePageSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  return session;
}

/** For /api route handlers: the signed-in user, or 401 UNAUTHENTICATED. */
export async function requireApiSession(req: Request): Promise<Session> {
  const session = await auth().api.getSession({ headers: req.headers });
  if (!session) throw new ApiError("UNAUTHENTICATED");
  return session;
}

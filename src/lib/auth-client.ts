"use client";

import { inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import type { auth } from "./auth";

/** Browser-side Better Auth client (same origin, so no baseURL needed). */
export const authClient = createAuthClient({
  plugins: [inferAdditionalFields<ReturnType<typeof auth>>()],
});

export const { signIn, signUp, signOut, useSession, requestPasswordReset, resetPassword } = authClient;

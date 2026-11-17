import "server-only";
import { Inngest } from "inngest";

/**
 * Background jobs (System Design → Inngest). Keys come from the Inngest integration on Vercel
 * (INNGEST_EVENT_KEY, INNGEST_SIGNING_KEY); Inngest calls back into /api/inngest to run each step.
 */
export const inngest = new Inngest({ id: "clipguru" });

export type RenderRequested = { renderId: string; userId: string };

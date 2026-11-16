import { z } from "zod";
import { isValidTimeZone } from "./defaults";
import { isVoiceId } from "./voices";

export const NAME_MAX = 80;

/** PATCH /api/me body (API Design → Account). */
export const patchMeBody = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Enter your name.")
      .max(NAME_MAX, `Keep your name under ${NAME_MAX} characters.`)
      .optional(),
    timeZone: z.string().refine(isValidTimeZone, "Pick a time zone from the list.").optional(),
    defaultVoiceId: z.string().refine(isVoiceId, "Pick one of the listed voices.").optional(),
    onboarded: z.literal(true).optional(),
  })
  .strict();

export const deleteMeBody = z.object({ confirm: z.literal("DELETE", { message: 'Type "DELETE" to confirm.' }) });

type UserLike = {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  timeZone?: string | null;
  defaultVoiceId?: string | null;
  onboardedAt?: Date | string | null;
};

/** The `user` object the API returns. */
export function toMe(u: UserLike) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    image: u.image ?? null,
    timeZone: u.timeZone ?? "Europe/London",
    defaultVoiceId: u.defaultVoiceId ?? null,
    onboarded: Boolean(u.onboardedAt),
  };
}
export type Me = ReturnType<typeof toMe>;

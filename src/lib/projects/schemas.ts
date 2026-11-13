import { z } from "zod";
import { PROJECT_FILTERS, TITLE_MAX } from "./types";

export const listQuery = z.object({
  filter: z.enum(PROJECT_FILTERS).default("all"),
  q: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((v) => v || undefined),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().max(500).optional(),
});

export const patchBody = z
  .object({
    rev: z.number().int().min(0),
    title: z
      .string()
      .trim()
      .min(1, "Give the video a title.")
      .max(TITLE_MAX, `Keep the title under ${TITLE_MAX} characters.`)
      .optional(),
    brief: z.record(z.string(), z.unknown()).nullable().optional(),
    voiceId: z.string().min(1).max(64).optional(),
  })
  .strict();

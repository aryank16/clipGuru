import { z } from "zod";
import { ApiError } from "../api/errors";
import { cap3d, storyboardSchema, type Storyboard } from "./types";

const rev = z.number().int().min(0);

export const generateBody = z.object({ rev }).strict();
export const undoBody = z.object({ rev }).strict();
export const regenerateBody = z
  .object({ rev, instruction: z.string().trim().max(500, "Keep it under 500 characters.").optional() })
  .strict();
export const saveBody = z.object({ rev, baseVersion: z.number().int().min(1), storyboard: z.unknown() }).strict();
export const versionQuery = z.object({ version: z.coerce.number().int().min(1).optional() });
export const sceneIndex = z.coerce.number().int().min(0).max(99);

/** The edited storyboard (with at most two 3D scenes), or 400 STORYBOARD_INVALID naming what's wrong. */
export function parseStoryboard(raw: unknown): Storyboard {
  const r = storyboardSchema.safeParse(raw);
  if (r.success) return { ...r.data, scenes: cap3d(r.data.scenes) };
  const details: Record<string, string> = {};
  for (const i of r.error.issues) details[i.path.join(".") || "_"] = i.message;
  throw new ApiError("STORYBOARD_INVALID", Object.values(details)[0] ?? "The storyboard isn't valid.", details);
}

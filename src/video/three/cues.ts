/** Fewest frames between two 3D beats, so each panel, planet or block gets its own moment. */
export const MIN_BEAT = 10;

/**
 * Cue frames made strictly increasing, at least `gap` frames apart. In a short scene, or when
 * cues are close together, several can land on the same frame; the shots need them in order.
 */
export function spreadCues(cues: number[], gap = MIN_BEAT): number[] {
  const out: number[] = [];
  for (const c of cues) out.push(out.length ? Math.max(c, out[out.length - 1] + gap) : c);
  return out;
}

/** Keyframes made strictly increasing (each at least 1 after the one before), as interpolate() needs. */
export function increasing(keys: number[]): number[] {
  const out: number[] = [];
  for (const k of keys) out.push(out.length ? Math.max(k, out[out.length - 1] + 1) : k);
  return out;
}

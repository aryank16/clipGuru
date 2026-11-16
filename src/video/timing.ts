import type { Scene, SceneTiming, Word } from "./types";

export const normalize = (s: string) =>
  s.toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9%]+/g, "");

export const splitWords = (s: string) => s.trim().split(/\s+/).filter(Boolean);

// The voiceover is the scenes' narration joined in order, so the TTS words
// line up 1:1 with the storyboard words. Each scene takes its slice.
export function computeSceneTimings(
  scenes: Scene[],
  words: Word[],
  durationSec: number,
): SceneTiming[] {
  const timings: SceneTiming[] = [];
  let idx = 0;
  for (const scene of scenes) {
    const n = splitWords(scene.narration).length;
    const sw = words.slice(idx, idx + n);
    idx += n;
    timings.push({ startSec: 0, endSec: 0, words: sw });
  }
  for (let i = 0; i < timings.length; i++) {
    const first = timings[i].words[0];
    timings[i].startSec = i === 0 ? 0 : Math.max(0, (first?.start ?? 0) - 0.25);
  }
  for (let i = 0; i < timings.length; i++) {
    timings[i].endSec = i < timings.length - 1 ? timings[i + 1].startSec : durationSec;
  }
  return timings;
}

// Find when a cue phrase is spoken inside a scene. Returns seconds relative
// to the scene start. Falls back to spreading cues evenly if not found.
export function cueTimes(
  timing: SceneTiming,
  cues: string[],
): number[] {
  const words = timing.words.map((w) => normalize(w.text));
  const sceneLen = timing.endSec - timing.startSec;
  const out: number[] = [];
  let from = 0;
  cues.forEach((cue, k) => {
    const tokens = splitWords(cue).map(normalize).filter(Boolean);
    let found = -1;
    if (tokens.length) {
      for (let i = from; i < words.length && found < 0; i++) {
        if (matches(words[i], tokens[0])) {
          let ok = true;
          for (let j = 1; j < tokens.length; j++) {
            if (!words[i + j] || !matches(words[i + j], tokens[j])) ok = false;
          }
          if (ok || tokens.length === 1) found = i;
        }
      }
      if (found < 0) {
        // retry, first token only
        for (let i = from; i < words.length && found < 0; i++) {
          if (matches(words[i], tokens[0])) found = i;
        }
      }
    }
    if (found >= 0) {
      from = found + 1;
      out.push(Math.max(0, timing.words[found].start - timing.startSec));
    } else {
      const prev = out[out.length - 1] ?? 0;
      const even = (sceneLen * (k + 1)) / (cues.length + 1);
      out.push(Math.max(prev + 0.4, even));
    }
  });
  return out;
}

const matches = (word: string, token: string) =>
  word === token ||
  (token.length >= 4 && (word.startsWith(token) || token.startsWith(word)) && word.length >= 3);

// Placeholder timings when no TTS is available: ~155 words per minute
// with short pauses at punctuation and between scenes.
export function estimateWords(scenes: Scene[]): { words: Word[]; durationSec: number } {
  const words: Word[] = [];
  let t = 0.4;
  for (const scene of scenes) {
    for (const w of splitWords(scene.narration)) {
      const len = 0.18 + Math.min(w.length, 12) * 0.032;
      words.push({ text: w, start: t, end: t + len });
      t += len + 0.06;
      if (/[.!?]$/.test(w)) t += 0.35;
      else if (/[,;:]$/.test(w)) t += 0.18;
    }
    t += 0.4;
  }
  return { words, durationSec: t + 0.8 };
}

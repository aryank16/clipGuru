import type { Word } from "@/video/types";

export type { Word };

/** One recorded narration (Database Design → voiceovers). Reused while the narration and voice stay the same. */
export type VoiceoverRecord = {
  id: string;
  userId: string;
  projectId: string;
  /** SHA-256 of voice id + model + speed + full narration. */
  hash: string;
  voiceId: string;
  model: string;
  speed: number;
  audioKey: string;
  contentType: string;
  /** Seconds from the start of the audio, one per narration word. */
  words: Word[];
  durationSec: number;
  /** Script words minus audio words; 0 is ideal. */
  wordMismatch: number;
  chars: number;
  costUsd: number;
  createdAt: Date;
};

/** What the browser gets. */
export type Voiceover = {
  id: string;
  voiceId: string;
  voiceName: string;
  speed: number;
  words: Word[];
  durationSec: number;
  audioUrl: string;
  createdAt: string;
};

export const toVoiceover = (r: VoiceoverRecord, voiceName: string): Voiceover => ({
  id: r.id,
  voiceId: r.voiceId,
  voiceName,
  speed: r.speed,
  words: r.words,
  durationSec: r.durationSec,
  audioUrl: `/api/voiceovers/${r.id}/audio`,
  createdAt: r.createdAt.toISOString(),
});

/** New recordings a user can make per 24 hours (reused ones don't count). */
export const VOICEOVERS_PER_DAY = 30;
/** Longest video before the narration is sped up (to at most MAX_SPEED). */
export const MAX_SECONDS = 90;
export const MAX_SPEED = 1.1;
/** ElevenLabs price per character, roughly (Creator plan). Only for cost tracking. */
export const USD_PER_CHAR = 0.0003;
/** Pause kept after the last word. */
export const TAIL_SEC = 0.9;

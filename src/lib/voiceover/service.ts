import { createHash } from "node:crypto";
import { ApiError } from "../api/errors";
import type { ProjectsRepo } from "../projects/repo";
import type { StoryboardRepo } from "../storyboard/repo";
import { WORDS_PER_SECOND, type Storyboard } from "../storyboard/types";
import type { Storage } from "../storage";
import { VOICES } from "../voices";
import type { VoiceoverRepo } from "./repo";
import { VoiceQuotaError, type Tts } from "./tts";
import {
  MAX_SECONDS,
  MAX_SPEED,
  TAIL_SEC,
  toVoiceover,
  USD_PER_CHAR,
  VOICEOVERS_PER_DAY,
  type Voiceover,
  type VoiceoverRecord,
} from "./types";

type Deps = {
  projects: ProjectsRepo;
  storyboards: StoryboardRepo;
  voiceovers: VoiceoverRepo;
  /** Lazy, so a missing setup is an error only when a recording is actually needed. */
  storage: () => Storage;
  tts: () => Tts;
  now?: () => Date;
};

const DAY_MS = 24 * 3600 * 1000;

/** The whole narration, scene by scene, as one text (so audio words line up with storyboard words). */
export const narrationOf = (sb: Storyboard) => sb.scenes.map((s) => s.narration.trim().replace(/\s+/g, " ")).join(" ");

/** 1.0, or a little faster (at most 1.1) when the narration would run past 90 seconds. */
export function speedFor(text: string): number {
  const est = text.split(/\s+/).filter(Boolean).length / WORDS_PER_SECOND;
  return est <= MAX_SECONDS ? 1 : Math.min(MAX_SPEED, Math.ceil((est / MAX_SECONDS) * 100) / 100);
}

export const hashOf = (voiceId: string, model: string, speed: number, text: string) =>
  createHash("sha256").update(`${voiceId}\n${model}\n${speed}\n${text}`).digest("hex");

const voiceName = (id: string) => VOICES.find((v) => v.id === id)?.name ?? "Narrator";

/**
 * The voiceover for a storyboard version in the project's voice (Database Design → voiceovers):
 * ElevenLabs reads the whole narration once, the MP3 goes to R2, and the result is reused for as
 * long as the narration, voice, model and speed stay the same.
 */
export function voiceoverService({ projects, storyboards, voiceovers, storage, tts, now = () => new Date() }: Deps) {
  async function target(userId: string, projectId: string, version?: number) {
    const p = await projects.get(userId, projectId);
    if (!p) throw new ApiError("NOT_FOUND");
    const v = version ?? p.currentVersion;
    const sb = v > 0 ? await storyboards.get(userId, projectId, v) : null;
    if (!sb) throw new ApiError("NOT_FOUND", "This video doesn't have a storyboard yet.");
    const text = narrationOf(sb.storyboard);
    const speed = speedFor(text);
    return { p, text, speed };
  }

  return {
    /** GET: the existing recording for this version and voice, or null. Never records. */
    async find(userId: string, projectId: string, version?: number): Promise<Voiceover | null> {
      const { p, text, speed } = await target(userId, projectId, version);
      let model: string;
      try {
        model = tts().model;
      } catch {
        return null;
      }
      const r = await voiceovers.findByHash(userId, projectId, hashOf(p.voiceId, model, speed, text));
      return r ? toVoiceover(r, voiceName(r.voiceId)) : null;
    },

    /** POST: the recording, made now if there isn't one yet. */
    async create(userId: string, projectId: string, version?: number): Promise<{ voiceover: Voiceover; reused: boolean }> {
      const { p, text, speed } = await target(userId, projectId, version);
      const voice = tts();
      const hash = hashOf(p.voiceId, voice.model, speed, text);
      const existing = await voiceovers.findByHash(userId, projectId, hash);
      if (existing) return { voiceover: toVoiceover(existing, voiceName(existing.voiceId)), reused: true };

      const t = now();
      if ((await voiceovers.countSince(userId, new Date(t.getTime() - DAY_MS))) >= VOICEOVERS_PER_DAY) {
        throw new ApiError("LIMIT_REACHED", "You've recorded a lot of voiceovers today. Try again tomorrow.", {
          limit: "voiceovers_per_day",
          max: VOICEOVERS_PER_DAY,
          retryAfterSec: 3600,
        });
      }
      const files = storage();

      let rec;
      try {
        rec = await voice.synthesize(text, p.voiceId, speed);
      } catch (err) {
        console.error("[voiceover] recording failed", err);
        if (err instanceof VoiceQuotaError) {
          throw new ApiError(
            "VOICE_CREDITS_USED_UP",
            "ClipGuru's voice credits for this month are used up, so new voiceovers can't be recorded yet. Videos you already made still work.",
          );
        }
        throw new ApiError("VOICE_UNAVAILABLE", "Couldn't record the voice just now. Try again in a minute.");
      }
      if (!rec.words.length) throw new ApiError("VOICE_UNAVAILABLE", "The recording came back empty. Try again.");

      const ext = rec.contentType === "audio/mpeg" ? "mp3" : "wav";
      const audioKey = `users/${userId}/projects/${projectId}/voice/${hash}.${ext}`;
      try {
        await files.put(audioKey, rec.audio, rec.contentType);
      } catch (err) {
        console.error("[voiceover] saving the audio failed", err);
        throw new ApiError("VOICE_UNAVAILABLE", "The voice was recorded but couldn't be saved. Try again in a minute.");
      }

      const record: VoiceoverRecord = {
        id: voiceovers.newId(),
        userId,
        projectId,
        hash,
        voiceId: p.voiceId,
        model: voice.model,
        speed,
        audioKey,
        contentType: rec.contentType,
        words: rec.words,
        durationSec: Math.round((rec.durationSec + TAIL_SEC) * 1000) / 1000,
        wordMismatch: text.split(/\s+/).filter(Boolean).length - rec.words.length,
        chars: text.length,
        costUsd: Math.round(text.length * USD_PER_CHAR * 10000) / 10000,
        createdAt: t,
      };
      if (record.wordMismatch !== 0) {
        console.warn(`[voiceover] ${record.wordMismatch} word(s) differ between script and audio`, projectId);
      }
      if (!(await voiceovers.insert(record))) {
        // Another request recorded the same narration first; use that one.
        const winner = await voiceovers.findByHash(userId, projectId, hash);
        if (winner) return { voiceover: toVoiceover(winner, voiceName(winner.voiceId)), reused: true };
      }
      return { voiceover: toVoiceover(record, voiceName(record.voiceId)), reused: false };
    },

    /** The stored audio's record, for the audio route. */
    get: (userId: string, id: string) => voiceovers.get(userId, id),
  };
}

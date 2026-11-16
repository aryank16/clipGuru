import { VOICE_ALICE, VOICE_GEORGE } from "./defaults";

/** Narrator voices (API Design → GET /api/voices). Server config, not a database collection. */
export type Voice = {
  id: string;
  name: string;
  gender: "male" | "female";
  accent: string;
  description: string;
  previewUrl: string;
  default?: true;
};

export const VOICES: Voice[] = [
  {
    id: VOICE_GEORGE,
    name: "George",
    gender: "male",
    accent: "British",
    description: "Warm and steady, good for most explainers",
    previewUrl: "/voices/george.mp3",
    default: true,
  },
  {
    id: VOICE_ALICE,
    name: "Alice",
    gender: "female",
    accent: "British",
    description: "Clear and bright, a touch quicker",
    previewUrl: "/voices/alice.mp3",
  },
];

export const isVoiceId = (id: unknown): id is string => VOICES.some((v) => v.id === id);

export const voiceLabel = (id: string | null | undefined): string => {
  const v = VOICES.find((x) => x.id === id) ?? VOICES[0];
  return `${v.name} (${v.accent} ${v.gender})`;
};

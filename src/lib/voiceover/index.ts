import "server-only";
import { env, voiceDriver } from "../env";
import { ApiError } from "../api/errors";
import { projectsRepo } from "../projects/repo";
import { storage } from "../storage";
import { storyboardRepo } from "../storyboard/repo";
import { voiceoverRepo } from "./repo";
import { voiceoverService } from "./service";
import { elevenLabs, fakeTts, type Tts } from "./tts";

export function tts(): Tts {
  const d = voiceDriver();
  if (d === "fake") return fakeTts;
  if (d === "elevenlabs") return elevenLabs(env().ELEVENLABS_API_KEY!, env().ELEVENLABS_MODEL);
  throw new ApiError("VOICE_UNAVAILABLE", "The voiceover isn't set up yet.", { reason: "not_configured" });
}

/** The voiceover service wired to the configured database, storage and voice. */
export function voiceoverSvc() {
  return voiceoverService({
    projects: projectsRepo(),
    storyboards: storyboardRepo(),
    voiceovers: voiceoverRepo(),
    storage,
    tts,
  });
}

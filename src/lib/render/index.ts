import "server-only";
import { ApiError } from "../api/errors";
import { env, renderDriver } from "../env";
import { inngest } from "../inngest/client";
import { projectsRepo } from "../projects/repo";
import { storage } from "../storage";
import { storyboardRepo } from "../storyboard/repo";
import { voiceoverSvc } from "../voiceover";
import { voiceoverRepo } from "../voiceover/repo";
import { inlineSteps, markFailed, renderJob, type JobDeps } from "./job";
import { renderRepo } from "./repo";
import { fakeRenderer, sandboxRenderer, type Renderer } from "./renderer";
import { renderService } from "./service";
import type { RenderRecord } from "./types";

export function renderer(): Renderer {
  const d = renderDriver();
  if (d === "sandbox") return sandboxRenderer();
  if (d === "fake") return fakeRenderer();
  throw new ApiError("RENDER_UNAVAILABLE", "Video rendering isn't set up here yet.", { reason: "not_configured" });
}

/** The job's dependencies, wired to the configured database, storage, voice and renderer. */
export function jobDeps(): JobDeps {
  return {
    renders: renderRepo(),
    projects: projectsRepo(),
    storyboards: storyboardRepo(),
    recordVoice: async (userId, projectId, version) => (await voiceoverSvc().create(userId, projectId, version)).voiceover,
    voiceoverRecord: (userId, id) => voiceoverRepo().get(userId, id),
    storage,
    renderer,
    // The fake renderer finishes in seconds, so check often.
    pollMs: renderDriver() === "fake" ? 700 : undefined,
  };
}

/** Sends the render to Inngest, or runs it in this process for local tests. */
async function dispatch(r: RenderRecord) {
  const d = renderDriver();
  if (!d) throw new ApiError("RENDER_UNAVAILABLE", "Video rendering isn't set up here yet.");
  if (d === "fake") {
    const deps = jobDeps();
    void renderJob(inlineSteps(), r.id, deps).catch((err) => {
      console.error("[render] job failed", r.id, err);
      return markFailed(deps, r.id, { code: "RENDER_FAILED", message: "Something went wrong while making the video. Try again." });
    });
    return;
  }
  await inngest.send({ name: "render/requested", data: { renderId: r.id, userId: r.userId } });
}

export function renderSvc() {
  return renderService({
    renders: renderRepo(),
    projects: projectsRepo(),
    storyboards: storyboardRepo(),
    dispatch,
    videosPerMonth: env().VIDEOS_PER_MONTH,
  });
}

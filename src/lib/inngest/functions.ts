import "server-only";
import { jobDeps } from "../render";
import { markFailed, renderJob } from "../render/job";
import { inngest, type RenderRequested } from "./client";

/** render/requested → the render job, one step per request. */
export const renderVideo = inngest.createFunction(
  {
    id: "render-video",
    triggers: [{ event: "render/requested" }],
    retries: 2,
    // The API allows 3 running per user; this keeps Inngest to the same.
    concurrency: [{ key: "event.data.userId", limit: 3 }],
    onFailure: async ({ event, error }) => {
      const data = (event.data as { event?: { data?: RenderRequested } }).event?.data;
      if (!data?.renderId) return;
      console.error("[render] job gave up", data.renderId, error);
      await markFailed(jobDeps(), data.renderId, {
        code: "RENDER_FAILED",
        message: "Something went wrong while making the video. Try again.",
      });
    },
  },
  async ({ event, step }) => {
    const { renderId } = event.data as RenderRequested;
    return renderJob(
      {
        run: (name, fn) => step.run(name, fn) as never,
        sleep: (name, ms) => step.sleep(name, ms),
      },
      renderId,
      jobDeps(),
    );
  },
);

export const functions = [renderVideo];

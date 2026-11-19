import "server-only";
import { jobDeps } from "../render";
import { markFailed, renderJob } from "../render/job";
import { publishDeps } from "../posts";
import { markPostFailed, publishJob, type PostRequested } from "../posts/job";
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

/** post/requested → waits for the post's time, then publishes it to Instagram. */
export const publishPost = inngest.createFunction(
  {
    id: "publish-post",
    triggers: [{ event: "post/requested" }],
    retries: 3,
    // Cancelling a scheduled post stops its sleeping run (the run also re-checks when it wakes).
    cancelOn: [{ event: "post/cancelled", match: "data.postId" }],
    concurrency: [{ key: "event.data.userId", limit: 2 }],
    onFailure: async ({ event, error }) => {
      const data = (event.data as { event?: { data?: PostRequested } }).event?.data;
      if (!data?.postId) return;
      console.error("[post] job gave up", data.postId, error);
      await markPostFailed(
        publishDeps(),
        data.postId,
        { code: "IG_UNAVAILABLE", message: "Instagram didn't respond. Try again in a few minutes." },
        data.runToken,
      );
    },
  },
  async ({ event, step }) => {
    return publishJob(
      {
        run: (name, fn) => step.run(name, fn) as never,
        sleep: (name, ms) => step.sleep(name, ms),
        sleepUntil: (name, at) => step.sleepUntil(name, at),
      },
      event.data as PostRequested,
      publishDeps(),
    );
  },
);

export const functions = [renderVideo, publishPost];

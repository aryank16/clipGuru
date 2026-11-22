import "server-only";
import { jobDeps } from "../render";
import { markFailed, renderJob } from "../render/job";
import { publishDeps } from "../posts";
import { markPostFailed, publishJob, type PostRequested } from "../posts/job";
import { chatRepo } from "../chat/repo";
import { instagramClient } from "../instagram";
import { open, seal } from "../instagram/crypto";
import { instagramRepo } from "../instagram/repo";
import { checkInstagramConnections, purgeDeletedProjects } from "../maintenance";
import { dbDriver } from "../env";
import { pendingDeletions } from "../pending-deletions";
import { postSvc } from "../posts";
import { postsRepo } from "../posts/repo";
import { projectsRepo } from "../projects/repo";
import { renderSvc } from "../render";
import { renderRepo } from "../render/repo";
import { storageIfConfigured } from "../storage";
import { storyboardRepo } from "../storyboard/repo";
import { voiceoverRepo } from "../voiceover/repo";
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

/** Every 15 minutes: fails renders and posts that got stuck, even when nobody has the page open. */
export const watchdog = inngest.createFunction(
  { id: "watchdog", triggers: [{ cron: "*/15 * * * *" }], retries: 1, concurrency: [{ limit: 1 }] },
  async ({ step }) => {
    const renders = await step.run("stuck-renders", () => renderSvc().sweep());
    const posts = await step.run("stuck-posts", () => postSvc().sweep());
    return { renders, posts };
  },
);

/** Daily at 03:00 UTC: permanently removes videos deleted more than 30 days ago, with their files. */
export const purgeTrash = inngest.createFunction(
  { id: "purge-trash", triggers: [{ cron: "0 3 * * *" }], retries: 2, concurrency: [{ limit: 1 }] },
  async ({ step }) => {
    const purged = await step.run("purge", () =>
      purgeDeletedProjects({
        projects: projectsRepo(),
        posts: postsRepo(),
        chat: chatRepo(),
        storyboards: storyboardRepo(),
        voiceovers: voiceoverRepo(),
        renders: renderRepo(),
        storage: storageIfConfigured(),
        storageRequired: dbDriver() !== "memory",
        pending: pendingDeletions(),
      }),
    );
    return { purged };
  },
);

/** Daily at 04:00 UTC: flags Instagram connections that stopped working, so the app asks to reconnect early. */
export const instagramHealth = inngest.createFunction(
  { id: "instagram-health", triggers: [{ cron: "0 4 * * *" }], retries: 1, concurrency: [{ limit: 1 }] },
  async ({ step }) => {
    const flagged = await step.run("check", () =>
      checkInstagramConnections({ instagram: instagramRepo(), client: instagramClient(), open, seal }),
    );
    return { flagged };
  },
);

export const functions = [renderVideo, publishPost, watchdog, purgeTrash, instagramHealth];

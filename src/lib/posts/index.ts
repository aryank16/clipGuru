import "server-only";
import { instagramDriver } from "../env";
import { inngest } from "../inngest/client";
import { instagramClient, publisherFor } from "../instagram";
import { instagramRepo } from "../instagram/repo";
import { projectsRepo } from "../projects/repo";
import { renderRepo } from "../render/repo";
import { storage } from "../storage";
import { storyboardRepo } from "../storyboard/repo";
import { inlinePostSteps, markPostFailed, publishJob, type PublishDeps } from "./job";
import { postsRepo } from "./repo";
import { postService } from "./service";
import type { PostRecord } from "./types";

/** The job's dependencies, wired to the configured database, storage and Instagram client. */
export function publishDeps(): PublishDeps {
  return {
    posts: postsRepo(),
    projects: projectsRepo(),
    renders: renderRepo(),
    storage,
    client: instagramClient,
    publisher: publisherFor,
    markReconnectNeeded: (userId, at) => instagramRepo().markReconnectNeeded(userId, at),
    // The fake Instagram processes at once, so check often.
    pollMs: instagramDriver() === "fake" ? 800 : undefined,
  };
}

/** Sends the post to Inngest, or runs it in this process for local tests. */
async function dispatch(p: PostRecord) {
  const data = { postId: p.id, userId: p.userId, runToken: p.runToken };
  if (instagramDriver() === "fake") {
    const deps = publishDeps();
    void publishJob(inlinePostSteps(), data, deps).catch((err) => {
      console.error("[post] job failed", p.id, err);
      return markPostFailed(deps, p.id, { code: "IG_UNAVAILABLE", message: "Instagram didn't respond. Try again in a few minutes." }, p.runToken);
    });
    return;
  }
  await inngest.send({ name: "post/requested", data });
}

async function cancelRun(p: PostRecord) {
  if (instagramDriver() === "fake") return; // the in-process run sees the cancellation when it wakes
  await inngest.send({ name: "post/cancelled", data: { postId: p.id } });
}

export function postSvc() {
  return postService({
    posts: postsRepo(),
    projects: projectsRepo(),
    renders: renderRepo(),
    storyboards: storyboardRepo(),
    publisher: publisherFor,
    dispatch,
    cancelRun,
  });
}

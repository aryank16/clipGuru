import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { PostStep } from "@/components/post/post-step";
import { instagramSvc } from "@/lib/instagram";
import { isConnectError } from "@/lib/instagram/types";
import { postSvc } from "@/lib/posts";
import { projectsRepo } from "@/lib/projects/repo";
import { toProject } from "@/lib/projects/types";
import { renderSvc } from "@/lib/render";
import { requirePageSession } from "@/lib/session";
import { DEFAULT_TIME_ZONE, isValidTimeZone } from "@/lib/defaults";

export const metadata: Metadata = { title: "Post" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Step 4: caption, then post now or schedule (design: 10 and 16). Only for a made video. */
export default function PostStepPage(props: Props) {
  return (
    <Suspense fallback={null}>
      <Post {...props} />
    </Suspense>
  );
}

async function Post({ params, searchParams }: Props) {
  const { user } = await requirePageSession();
  const { id } = await params;
  const q = await searchParams;
  const project = await projectsRepo().get(user.id, id);
  if (!project) notFound();
  const render = await renderSvc().latest(user.id, id);
  if (!render || render.status !== "ready") redirect(`/videos/${id}/video`);
  const [post, instagram] = await Promise.all([postSvc().latest(user.id, id), instagramSvc().status(user.id)]);
  const tz = (user as { timeZone?: string }).timeZone;
  const reason = typeof q.reason === "string" ? q.reason : null;
  const result = q.instagram === "connected" ? { ok: true as const } : q.instagram === "error" ? { ok: false as const, reason: isConnectError(reason) ? reason : ("UNKNOWN" as const) } : null;
  return (
    <PostStep
      project={toProject(project)}
      render={render}
      initialPost={post}
      instagram={instagram}
      timeZone={tz && isValidTimeZone(tz) ? tz : DEFAULT_TIME_ZONE}
      connectResult={result}
    />
  );
}

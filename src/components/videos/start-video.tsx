"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { buttonClasses } from "@/components/ui/button";
import { projectsApi } from "./api";

/**
 * Creates a project each time /new is shown, then replaces /new with it.
 *
 * Next keeps a visited page mounted (hidden) and re-runs its effects when it's shown again, so this must
 * not remember "already started" across visits. The short timer is cancelled by React's dev double-mount,
 * so development doesn't create two videos.
 */
export function StartVideo() {
  const router = useRouter();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      setFailed(false);
      projectsApi
        .create()
        .then((p) => active && router.replace(`/videos/${p.id}`))
        .catch(() => active && setFailed(true));
    }, 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [router]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
      {failed ? (
        <>
          <p className="text-taupe">Couldn&apos;t start a new video.</p>
          <Link href="/videos" className={buttonClasses("secondary", "md")}>
            Back to My videos
          </Link>
        </>
      ) : (
        <>
          <Loader2 className="size-6 animate-spin text-taupe" aria-hidden />
          <p className="text-taupe">Starting a new video…</p>
        </>
      )}
    </div>
  );
}

"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { buttonClasses } from "@/components/ui/button";
import { projectsApi } from "./api";

/** Creates the project once (even under React's double effects) and replaces /new with it. */
export function StartVideo() {
  const router = useRouter();
  const started = useRef(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    projectsApi
      .create()
      .then((p) => router.replace(`/videos/${p.id}`))
      .catch(() => setFailed(true));
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

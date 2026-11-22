"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { Button, buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

/** Shown inside the app shell when a page crashes, so the person keeps the menu and a way back. */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // The server already logged the details under this digest (see instrumentation.ts).
    console.error("[page] crashed", error.digest ?? error.message);
  }, [error]);
  return (
    <EmptyState
      icon={<TriangleAlert className="size-5" />}
      title="Something went wrong"
      action={
        <div className="flex flex-wrap justify-center gap-3">
          <Button onClick={reset}>
            <RotateCcw className="size-4" aria-hidden /> Try again
          </Button>
          <Link href="/videos" className={buttonClasses("secondary")}>
            Go to My videos
          </Link>
        </div>
      }
    >
      This page hit a problem. Your videos are safe. Try again, and if it keeps happening, tell us what you were doing
      {error.digest ? ` and quote code ${error.digest}` : ""}.
    </EmptyState>
  );
}

"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import "./globals.css";

/** Last resort when the root layout itself fails: a plain page with a way to reload. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[app] crashed", error.digest ?? error.message);
  }, [error]);
  return (
    <html lang="en">
      <body className="flex min-h-dvh items-center justify-center bg-canvas p-6 text-ink">
        <main className="flex max-w-md flex-col items-center gap-4 text-center">
          <h1 className="text-2xl font-bold">ClipGuru hit a problem</h1>
          <p className="text-muted">
            Your videos are safe. Reload the page to carry on{error.digest ? ` (code ${error.digest})` : ""}.
          </p>
          <Button onClick={reset}>Reload</Button>
        </main>
      </body>
    </html>
  );
}

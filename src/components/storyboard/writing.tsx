import { Loader2 } from "lucide-react";

/** Shown while Gemini writes version 1 (design: 14-writing-storyboard), and while step 2 loads. */
export function WritingStoryboard({ loading = false }: { loading?: boolean }) {
  return (
    <section aria-live="polite" aria-busy className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <span className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-muted">
          <Loader2 className="size-4 animate-spin" aria-hidden /> {loading ? "Opening the storyboard…" : "Writing your storyboard…"}
        </span>
        {!loading && <p className="text-muted">This takes about 20 seconds. The script and scenes are written together.</p>}
      </div>
      <ol className="flex flex-col gap-4" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <li key={i} className="flex animate-pulse flex-col gap-4 rounded-xl border border-line bg-surface p-5">
            <div className="flex items-center gap-3">
              <span className="h-7 w-14 rounded bg-surface-sunken" />
              <span className="h-4 w-16 rounded bg-surface-sunken/70" />
              <span className="h-5 w-48 rounded bg-surface-sunken" />
            </div>
            <span className="h-4 w-full rounded bg-surface-sunken/70" />
            <span className="h-4 w-4/5 rounded bg-surface-sunken/70" />
          </li>
        ))}
      </ol>
    </section>
  );
}

import { cn } from "@/lib/cn";

/** "CG" monogram tile. */
export function Monogram({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex size-9 items-center justify-center rounded-lg bg-ink-strong font-display text-sm font-black tracking-tight text-on-ink shadow-sm",
        className,
      )}
      aria-hidden
    >
      CG
    </div>
  );
}

/** Monogram + wordmark, with an optional mono caption under it (sidebar). */
export function Logo({ caption }: { caption?: string }) {
  return (
    <div className="flex items-center gap-3">
      <Monogram />
      <div className="flex flex-col">
        <span className="font-display text-base font-black uppercase leading-tight tracking-tight text-ink">
          ClipGuru
        </span>
        {caption ? <span className="eyebrow text-[10px]">{caption}</span> : null}
      </div>
    </div>
  );
}

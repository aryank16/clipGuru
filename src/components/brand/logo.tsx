import { cn } from "@/lib/cn";

/** "CG" monogram tile. */
export function Monogram({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex size-9 items-center justify-center rounded-lg bg-espresso-deep font-display text-sm font-black tracking-tight text-surface shadow-sm",
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
        <span className="font-display text-base font-black uppercase leading-tight tracking-tight text-espresso">
          ClipGuru
        </span>
        {caption ? <span className="eyebrow text-[10px]">{caption}</span> : null}
      </div>
    </div>
  );
}

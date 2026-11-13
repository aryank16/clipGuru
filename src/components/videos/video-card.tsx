"use client";

import { Copy, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import type { Project } from "@/lib/projects/types";
import { clock, relativeTime } from "@/lib/time";
import { STATUS_BADGE } from "./status";
import { Thumbnail } from "./thumbnail";

function metaLine(p: Project): string {
  if (p.status === "generating") return "Rendering…";
  if (p.status === "attention") return "Needs attention";
  return `Edited ${relativeTime(p.updatedAt)}`;
}

export function VideoCard({
  project,
  onRename,
  onDuplicate,
  onDelete,
}: {
  project: Project;
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const badge = STATUS_BADGE[project.status];
  return (
    <article className="group relative flex flex-col gap-3 rounded-xl border border-hairline bg-surface p-3 shadow-[0_1px_2px_rgba(32,30,28,0.04)] transition-shadow hover:shadow-[0_8px_24px_-12px_rgba(32,30,28,0.25)] sm:p-4">
      <Link
        href={`/videos/${project.id}`}
        className="relative block aspect-[9/16] overflow-hidden rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sand-gold"
        aria-label={project.title}
      >
        {project.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={project.thumbnailUrl} alt="" className="size-full object-cover" />
        ) : (
          <Thumbnail seed={project.id} />
        )}
        <div className="absolute inset-x-2 top-2 flex items-start justify-between gap-2 sm:inset-x-3 sm:top-3">
          <Badge tone={badge.tone} className="bg-surface">
            {badge.label}
          </Badge>
          {project.durationSec ? <Badge tone="dark">{clock(project.durationSec)}</Badge> : null}
        </div>
      </Link>
      <div className="flex items-start justify-between gap-1 px-0.5 sm:gap-2 sm:px-1">
        <div className="min-w-0">
          <h3 className="line-clamp-2 text-[15px] leading-snug font-semibold break-words text-espresso sm:text-base" title={project.title}>
            <Link href={`/videos/${project.id}`}>{project.title}</Link>
          </h3>
          <p
            className={cn("mt-1 truncate text-[13px] sm:text-sm", project.status === "generating" ? "text-render-orange" : "text-taupe")}
            suppressHydrationWarning
          >
            {metaLine(project)}
          </p>
        </div>
        <CardMenu title={project.title} onRename={onRename} onDuplicate={onDuplicate} onDelete={onDelete} />
      </div>
    </article>
  );
}

function CardMenu({
  title,
  onRename,
  onDuplicate,
  onDelete,
}: {
  title: string;
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const item = (label: string, Icon: typeof Pencil, run: () => void, danger = false) => (
    <button
      type="button"
      role="menuitem"
      onClick={() => {
        setOpen(false);
        run();
      }}
      className={cn(
        "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-[15px] hover:bg-surface-warm/60",
        danger ? "text-danger" : "text-espresso",
      )}
    >
      <Icon className="size-4" aria-hidden />
      {label}
    </button>
  );

  return (
    <div ref={ref} className="relative -mt-1 -mr-1 shrink-0">
      <button
        type="button"
        aria-label={`More actions for ${title}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex size-8 items-center justify-center rounded-md sm:size-9 text-taupe hover:bg-surface-warm/70 hover:text-espresso",
          open && "bg-surface-warm/70 text-espresso",
        )}
      >
        <MoreHorizontal className="size-5" />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 bottom-11 z-20 w-48 rounded-lg border border-hairline bg-surface p-1.5 shadow-[0_12px_32px_-12px_rgba(32,30,28,0.35)]"
        >
          {item("Rename", Pencil, onRename)}
          {item("Duplicate", Copy, onDuplicate)}
          <div className="my-1 border-t border-hairline" />
          {item("Delete", Trash2, onDelete, true)}
        </div>
      ) : null}
    </div>
  );
}

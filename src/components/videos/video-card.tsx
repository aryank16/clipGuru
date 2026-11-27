"use client";

import { Copy, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { IconButton } from "@/components/ui/icon-button";
import { Menu, MenuDivider, MenuItem } from "@/components/ui/menu";
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
    <article className="group relative flex flex-col gap-3 rounded-xl border border-line bg-surface p-3 shadow-card transition-shadow hover:shadow-raised sm:p-4">
      <Link
        href={`/videos/${project.id}`}
        className="relative block aspect-[9/16] overflow-hidden rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
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
          <h3 className="line-clamp-2 text-[15px] leading-snug font-semibold break-words text-ink sm:text-base" title={project.title}>
            <Link href={`/videos/${project.id}`}>{project.title}</Link>
          </h3>
          <p
            className={cn("mt-1 truncate text-[13px] sm:text-sm", project.status === "generating" ? "text-progress" : "text-muted")}
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
    <MenuItem
      icon={Icon}
      danger={danger}
      onClick={() => {
        setOpen(false);
        run();
      }}
    >
      {label}
    </MenuItem>
  );

  return (
    <div ref={ref} className="relative -mt-1 -mr-1 shrink-0">
      <IconButton
        label={`More actions for ${title}`}
        icon={<MoreHorizontal className="size-5" />}
        tone="muted"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn("rounded-md hover:bg-surface-sunken/70 sm:size-9", open && "bg-surface-sunken/70 text-ink")}
      />
      {open ? (
        <Menu className="right-0 bottom-11">
          {item("Rename", Pencil, onRename)}
          {item("Duplicate", Copy, onDuplicate)}
          <MenuDivider />
          {item("Delete", Trash2, onDelete, true)}
        </Menu>
      ) : null}
    </div>
  );
}

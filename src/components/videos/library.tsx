"use client";

import { ArrowRight, Play, Plus, Search, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/shell/page-header";
import { Button, buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/cn";
import {
  FILTER_LABELS,
  PROJECT_FILTERS,
  TITLE_MAX,
  type FilterCounts,
  type Project,
  type ProjectFilter,
} from "@/lib/projects/types";
import { projectsApi, type ListPage } from "./api";
import { VideoCard } from "./video-card";

const UNDO_MS = 10_000;

type Undo = { project: Project; timer: ReturnType<typeof setTimeout> };

/** My videos: filter tabs, search, the card grid and the card actions. */
export function VideoLibrary({ initial, initialCounts }: { initial: ListPage; initialCounts: FilterCounts }) {
  const [filter, setFilter] = useState<ProjectFilter>("all");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState(initial.items);
  const [cursor, setCursor] = useState(initial.nextCursor);
  const [counts, setCounts] = useState(initialCounts);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<Project | null>(null);
  const [undo, setUndo] = useState<Undo | null>(null);
  const firstRun = useRef(true);
  const requestId = useRef(0);

  const refresh = useCallback(async (f: ProjectFilter, q: string) => {
    const id = ++requestId.current;
    setLoading(true);
    try {
      const [page, c] = await Promise.all([projectsApi.list(f, q), projectsApi.counts()]);
      if (id !== requestId.current) return;
      setItems(page.items);
      setCursor(page.nextCursor);
      setCounts(c);
      setError(null);
    } catch {
      if (id === requestId.current) setError("Couldn't load your videos. Check your connection and try again.");
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  // Refetch when the tab or the (debounced) search changes.
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const t = setTimeout(() => refresh(filter, query.trim()), query ? 250 : 0);
    return () => clearTimeout(t);
  }, [filter, query, refresh]);

  useEffect(() => {
    if (!undo) return;
    return () => clearTimeout(undo.timer);
  }, [undo]);

  async function loadMore() {
    if (!cursor) return;
    setLoading(true);
    try {
      const page = await projectsApi.list(filter, query.trim(), cursor);
      setItems((prev) => [...prev, ...page.items.filter((p) => !prev.some((x) => x.id === p.id))]);
      setCursor(page.nextCursor);
    } catch {
      setError("Couldn't load more videos.");
    } finally {
      setLoading(false);
    }
  }

  async function duplicate(p: Project) {
    try {
      await projectsApi.duplicate(p.id);
      await refresh(filter, query.trim());
    } catch {
      setError("Couldn't duplicate that video.");
    }
  }

  async function remove(p: Project) {
    setItems((prev) => prev.filter((x) => x.id !== p.id));
    try {
      await projectsApi.remove(p.id);
      setUndo({ project: p, timer: setTimeout(() => setUndo(null), UNDO_MS) });
      setCounts(await projectsApi.counts());
    } catch {
      setError("Couldn't delete that video.");
      await refresh(filter, query.trim());
    }
  }

  async function restore() {
    if (!undo) return;
    clearTimeout(undo.timer);
    setUndo(null);
    try {
      await projectsApi.restore(undo.project.id);
      await refresh(filter, query.trim());
    } catch {
      setError("Couldn't bring that video back.");
    }
  }

  const total = counts.all;
  const hasAny = total > 0;
  const searching = query.trim().length > 0;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="My videos"
        count={`${total} ${total === 1 ? "video" : "videos"}`}
        actions={
          <div className="hidden items-center gap-3 lg:flex">
            {hasAny ? <SearchBox value={query} onChange={setQuery} /> : null}
            <Link href="/new" className={buttonClasses("primary", "md")}>
              <Plus className="size-4" /> New video
            </Link>
          </div>
        }
      />

      {hasAny ? (
        <div className="flex flex-col gap-4">
          <div className="lg:hidden">
            <SearchBox value={query} onChange={setQuery} />
          </div>
          <div role="tablist" aria-label="Filter videos" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
            {PROJECT_FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                role="tab"
                aria-selected={filter === f}
                onClick={() => setFilter(f)}
                className={cn(
                  "flex h-10 shrink-0 items-center gap-2 rounded-lg border px-4 text-[15px] transition-colors",
                  filter === f
                    ? "border-espresso-deep bg-espresso-deep text-surface"
                    : "border-hairline bg-surface text-espresso hover:border-taupe/40",
                )}
              >
                {f === "rendering" ? <span className="size-1.5 rounded-full bg-render-orange" aria-hidden /> : null}
                {FILTER_LABELS[f]}
                <span className={cn("font-mono text-xs", filter === f ? "text-sand-gold" : "text-taupe")}>{counts[f]}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {items.length > 0 ? (
        <>
          <div
            className={cn(
              "grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 xl:grid-cols-4",
              loading && "opacity-60 transition-opacity",
            )}
            aria-busy={loading}
          >
            {items.map((p) => (
              <VideoCard
                key={p.id}
                project={p}
                onRename={() => setRenaming(p)}
                onDuplicate={() => duplicate(p)}
                onDelete={() => remove(p)}
              />
            ))}
          </div>
          {cursor ? (
            <div className="flex justify-center">
              <Button variant="secondary" onClick={loadMore} disabled={loading}>
                Show more
              </Button>
            </div>
          ) : null}
        </>
      ) : hasAny ? (
        <EmptyState icon={<Search className="size-5" />} title={searching ? "No matches" : "Nothing here yet"}>
          {searching
            ? `No videos with “${query.trim()}” in the title.`
            : `You have no ${FILTER_LABELS[filter].toLowerCase()} videos right now.`}
        </EmptyState>
      ) : (
        <EmptyState
          icon={<Play className="size-5" />}
          title="No videos yet"
          action={
            <Link href="/new" className={buttonClasses("primary", "lg")}>
              New video <ArrowRight className="size-4" />
            </Link>
          }
        >
          Start with an idea and ClipGuru writes, voices and animates it.
        </EmptyState>
      )}

      {renaming ? (
        <RenameDialog
          project={renaming}
          onClose={() => setRenaming(null)}
          onSaved={(p) => {
            setItems((prev) => prev.map((x) => (x.id === p.id ? p : x)));
            setRenaming(null);
          }}
        />
      ) : null}

      {undo ? (
        <div
          role="status"
          className="fixed inset-x-4 bottom-24 z-40 mx-auto flex max-w-md items-center justify-between gap-4 rounded-xl bg-espresso-deep px-5 py-3.5 text-surface shadow-lg lg:bottom-8"
        >
          <span className="truncate text-[15px]">Deleted “{undo.project.title}”</span>
          <button type="button" onClick={restore} className="shrink-0 font-semibold text-sand-gold hover:underline">
            Undo
          </button>
        </div>
      ) : null}
    </div>
  );
}

function SearchBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="relative flex items-center lg:w-80">
      <span className="sr-only">Search videos</span>
      <Search className="pointer-events-none absolute left-3.5 size-4 text-taupe" aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search by title"
        className="h-11 w-full rounded-lg border border-hairline bg-surface pr-10 pl-10 text-[15px] text-espresso placeholder:text-taupe/70 focus:border-sand-gold focus:ring-2 focus:ring-sand-gold/40 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      {value ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange("")}
          className="absolute right-2 flex size-7 items-center justify-center rounded text-taupe hover:text-espresso"
        >
          <X className="size-4" />
        </button>
      ) : null}
    </label>
  );
}

function RenameDialog({
  project,
  onClose,
  onSaved,
}: {
  project: Project;
  onClose: () => void;
  onSaved: (p: Project) => void;
}) {
  const [title, setTitle] = useState(project.title);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const next = title.trim();
    if (!next) return setError("Give the video a title.");
    if (next === project.title) return onClose();
    setSaving(true);
    try {
      onSaved(await projectsApi.rename(project, next));
    } catch (err) {
      const code = (err as { code?: string }).code;
      setError(
        code === "REV_CONFLICT"
          ? "This video changed in another tab. Close this and try again."
          : (err as { message?: string }).message ?? "Couldn't rename it.",
      );
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-espresso/30 p-4 sm:items-center" onMouseDown={onClose}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="rename-title"
        onSubmit={save}
        onMouseDown={(e) => e.stopPropagation()}
        className="flex w-full max-w-md flex-col gap-5 rounded-2xl border border-hairline bg-surface p-6 shadow-xl"
      >
        <h2 id="rename-title" className="text-lg font-semibold">
          Rename video
        </h2>
        <div className="flex flex-col gap-2">
          <label htmlFor="rename-input" className="sr-only">
            Title
          </label>
          <input
            id="rename-input"
            autoFocus
            maxLength={TITLE_MAX}
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setError(null);
            }}
            onFocus={(e) => e.currentTarget.select()}
            aria-invalid={Boolean(error)}
            className="h-12 w-full rounded-lg border border-hairline bg-paper/40 px-4 text-[15px] focus:border-sand-gold focus:ring-2 focus:ring-sand-gold/40 focus:outline-none aria-[invalid=true]:border-danger/60"
          />
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </div>
  );
}

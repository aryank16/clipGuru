"use client";

import { ArrowRight, ChevronDown, Clock, Lock, Plus, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Status, type SaveState } from "@/components/account/save";
import { Button, buttonClasses } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { IconButton } from "@/components/ui/icon-button";
import { Input, Textarea } from "@/components/ui/input";
import { TextButton } from "@/components/ui/text-button";
import {
  BRIEF_LIMITS,
  briefComplete,
  TONE_PRESETS,
  VIDEO_LENGTH_IDS,
  VIDEO_LENGTHS,
  type Brief,
  type VideoLength,
} from "@/lib/brief";
import { cn } from "@/lib/cn";

const fieldBox = "flex flex-col gap-2 rounded-lg border border-line bg-canvas/40 px-4 py-3";

/**
 * The brief beside the chat. The chat fills it in; every field can be edited by hand and saves on
 * blur. Disabled while a reply is streaming, so the two can't overwrite each other, and read-only
 * once the storyboard exists (`storyboardHref`).
 */
export function BriefPanel({
  brief,
  locked,
  save,
  saveState,
  saveError,
  storyboardHref,
  onWrite,
  writeError,
}: {
  brief: Brief;
  locked: boolean;
  save: (next: Brief) => void;
  saveState: SaveState;
  saveError: string | null;
  storyboardHref: string | null;
  onWrite: () => void;
  writeError: string | null;
}) {
  const [open, setOpen] = useState(false);
  const ready = briefComplete(brief);
  const done = storyboardHref !== null;
  locked = locked || done;

  return (
    <section
      aria-labelledby="brief-heading"
      className="flex flex-col gap-5 rounded-xl border border-line bg-surface p-5 shadow-card sm:p-6"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="eyebrow">Brief</span>
          <h2 id="brief-heading" className="font-display text-xl font-black uppercase tracking-tight">
            What we&apos;re making
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <Status state={saveState} error={saveError} />
          <IconButton
            label={open ? "Hide brief" : "Show brief"}
            icon={<ChevronDown className={cn("size-5 transition-transform", open && "rotate-180")} />}
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="brief-fields"
            className="text-muted lg:hidden"
          />
        </div>
      </div>

      {!open && <BriefSummary brief={brief} className="lg:hidden" />}

      <div id="brief-fields" className={cn("flex-col gap-3", open ? "flex" : "hidden lg:flex")}>
        <TextField
          id="brief-title"
          label="Topic"
          value={brief.title}
          max={BRIEF_LIMITS.title}
          placeholder="What is the video about?"
          disabled={locked}
          onSave={(title) => save({ ...brief, title })}
        />
        <TextField
          id="brief-audience"
          label="Audience"
          value={brief.audience}
          max={BRIEF_LIMITS.audience}
          placeholder="Who is it for?"
          disabled={locked}
          onSave={(audience) => save({ ...brief, audience })}
        />
        <KeyPoints points={brief.keyPoints} disabled={locked} onSave={(keyPoints) => save({ ...brief, keyPoints })} />
        <Tone value={brief.tone} disabled={locked} onSave={(tone) => save({ ...brief, tone })} />
        <TextField
          id="brief-angle"
          label="Angle or visual idea"
          value={brief.angle}
          max={BRIEF_LIMITS.angle}
          placeholder="The hook that makes it click, e.g. follow one raindrop"
          multiline
          disabled={locked}
          onSave={(angle) => save({ ...brief, angle })}
        />
        <Length value={brief.length} disabled={locked} onSave={(length) => save({ ...brief, length })} />
        <div className={cn(fieldBox, "flex-row items-center justify-between")}>
          <span className="eyebrow">Format</span>
          <span className="w-fit rounded bg-ink-strong px-2 py-0.5 font-mono text-xs uppercase tracking-wide text-on-ink">
            9:16 vertical
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {done ? (
          <>
            <Link href={storyboardHref} className={buttonClasses("primary", "lg", "w-full uppercase tracking-wide")}>
              Open storyboard <ArrowRight className="size-4" />
            </Link>
            <p className="flex items-center justify-center gap-1.5 text-center text-sm text-muted">
              <Lock className="size-3.5" aria-hidden /> The brief is locked now that the storyboard exists.
            </p>
          </>
        ) : (
          <>
            <Button
              size="lg"
              disabled={!ready || locked}
              onClick={onWrite}
              className="w-full uppercase tracking-wide"
            >
              Write storyboard <ArrowRight className="size-4" />
            </Button>
            {writeError ? (
              <p role="alert" className="text-center text-sm text-danger">
                {writeError}
              </p>
            ) : (
              <p className="text-center text-sm text-muted">
                {ready
                  ? "Your brief is ready. The brief locks once the storyboard is written."
                  : "Add a topic and at least one key point to continue."}
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function BriefSummary({ brief, className }: { brief: Brief; className?: string }) {
  const rows = [
    ["Topic", brief.title],
    ["Audience", brief.audience],
    ["Key point", brief.keyPoints[0] ?? ""],
  ].filter(([, v]) => v);
  if (!rows.length) return <p className={cn("text-sm text-muted", className)}>Fills in as you chat.</p>;
  return (
    <dl className={cn("grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[15px]", className)}>
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="font-medium">{k}</dt>
          <dd className="break-words text-ink/90">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A text field that keeps its own draft and saves on blur when the text changed. */
function TextField({
  id,
  label,
  value,
  max,
  placeholder,
  multiline,
  disabled,
  onSave,
}: {
  id: string;
  label: string;
  value: string;
  max: number;
  placeholder: string;
  multiline?: boolean;
  disabled: boolean;
  onSave: (v: string) => void;
}) {
  const [draft, setDraft] = useDraft(value);
  const commit = () => {
    const v = draft.trim();
    if (v !== value) onSave(v);
  };
  const props = {
    id,
    value: draft,
    maxLength: max,
    placeholder,
    disabled,
    onBlur: commit,
    bare: true,
    className: cn(multiline && "min-h-16 resize-none"),
  };
  return (
    <div className={fieldBox}>
      <label htmlFor={id} className="eyebrow">
        {label}
      </label>
      {multiline ? (
        <Textarea {...props} rows={2} onChange={(e) => setDraft(e.target.value)} />
      ) : (
        <Input
          {...props}
          autoComplete="off"
          data-1p-ignore
          data-lpignore="true"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        />
      )}
    </div>
  );
}

/** Local edit state that follows the saved value whenever that changes (e.g. the chat updated it). */
function useDraft<T>(value: T): [T, (v: T) => void] {
  const [draft, setDraft] = useState(value);
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    setDraft(value);
  }
  return [draft, setDraft];
}

function KeyPoints({ points, disabled, onSave }: { points: string[]; disabled: boolean; onSave: (p: string[]) => void }) {
  const [drafts, setDrafts] = useDraft(points);
  const commit = (next: string[]) => {
    const clean = next.map((p) => p.trim()).filter(Boolean);
    if (clean.join("\u0000") !== points.join("\u0000")) onSave(clean);
  };
  return (
    <fieldset className={fieldBox}>
      <legend className="sr-only">Key points</legend>
      <span className="eyebrow" aria-hidden>
        Key points
      </span>
      {drafts.length === 0 && <p className="text-sm text-muted">What should viewers remember?</p>}
      <ol className="flex flex-col gap-1.5">
        {drafts.map((p, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="pt-0.5 font-mono text-xs text-muted">{String(i + 1).padStart(2, "0")}</span>
            <Textarea
              bare
              aria-label={`Key point ${i + 1}`}
              value={p}
              rows={1}
              maxLength={BRIEF_LIMITS.point}
              disabled={disabled}
              onChange={(e) => setDrafts(drafts.map((d, j) => (j === i ? e.target.value : d)))}
              onBlur={() => commit(drafts)}
              className="field-sizing-content resize-none"
            />
            <IconButton
              size="sm"
              tone="muted"
              label={`Remove key point ${i + 1}`}
              icon={<X className="size-4" />}
              disabled={disabled}
              onClick={() => commit(drafts.filter((_, j) => j !== i))}
              className="-my-2 -mr-2 rounded-md hover:bg-surface-sunken/70"
            />
          </li>
        ))}
      </ol>
      {drafts.length < BRIEF_LIMITS.points && (
        <TextButton
          disabled={disabled || drafts.some((d) => !d.trim())}
          onClick={() => setDrafts([...drafts, ""])}
          className="flex items-center gap-1.5 rounded-md py-1 font-normal hover:no-underline"
        >
          <Plus className="size-4" /> Add a point
        </TextButton>
      )}
    </fieldset>
  );
}

const LENGTH_HINTS: Record<VideoLength, string> = {
  auto: "ClipGuru sizes it to the idea, up to 90 s.",
  short: "A quick one-idea clip, under 30 s.",
  medium: "A short explainer, 30 to 60 s.",
  long: "A full explainer, 60 to 90 s.",
};

/** Auto or one of three ranges. Saves at once, like the tone chips. */
function Length({ value, disabled, onSave }: { value: VideoLength; disabled: boolean; onSave: (v: VideoLength) => void }) {
  return (
    <fieldset className={fieldBox}>
      <legend className="sr-only">Length</legend>
      <span className="eyebrow flex items-center gap-1.5" aria-hidden>
        <Clock className="size-3.5" /> Length
      </span>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {VIDEO_LENGTH_IDS.map((id) => (
          <Chip
            key={id}
            selected={value === id}
            disabled={disabled}
            onClick={() => value !== id && onSave(id)}
            className="whitespace-nowrap px-2 font-mono text-xs sm:text-sm"
          >
            {VIDEO_LENGTHS[id].label}
          </Chip>
        ))}
      </div>
      <p className="text-xs text-muted">{LENGTH_HINTS[value]}</p>
    </fieldset>
  );
}

function Tone({ value, disabled, onSave }: { value: string; disabled: boolean; onSave: (v: string) => void }) {
  const custom = value && !(TONE_PRESETS as readonly string[]).includes(value);
  return (
    <fieldset className={fieldBox}>
      <legend className="sr-only">Tone</legend>
      <span className="eyebrow" aria-hidden>
        Tone
      </span>
      <div className="flex flex-wrap gap-2">
        {TONE_PRESETS.map((t) => (
          <Chip key={t} selected={value === t} disabled={disabled} onClick={() => onSave(value === t ? "" : t)}>
            {t}
          </Chip>
        ))}
        {custom && (
          <span className="flex min-h-9 items-center rounded-md border border-accent bg-accent/30 px-3 text-sm font-medium">
            {value}
          </span>
        )}
      </div>
    </fieldset>
  );
}

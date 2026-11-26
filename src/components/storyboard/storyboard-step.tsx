"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Check,
  Eye,
  Loader2,
  Mic,
  Pencil,
  Play,
  RefreshCw,
  Sparkles,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Status, useSaver } from "@/components/account/save";
import { describeError } from "@/components/idea/idea-step";
import { StepTabs } from "@/components/idea/step-tabs";
import { Button } from "@/components/ui/button";
import { lengthRange, toBrief, VIDEO_LENGTHS } from "@/lib/brief";
import { CHAT_TEXT_MAX, type ChatMessage } from "@/lib/chat/types";
import { cn } from "@/lib/cn";
import { canPost, type Project } from "@/lib/projects/types";
import {
  cueMarks,
  editableHeading,
  formatDuration,
  MIN_SCENES,
  SCENE_LABELS,
  sceneSeconds,
  sceneVisual,
  withHeading,
  type Scene,
  type Storyboard,
  type StoryboardVersion,
} from "@/lib/storyboard/types";
import type { Voiceover } from "@/lib/voiceover/types";
import { VOICES } from "@/lib/voices";
import type { PreviewHandle } from "./preview-player";

// The player and the scenes only run in the browser.
const PreviewPlayer = dynamic(() => import("./preview-player"), {
  ssr: false,
  loading: () => <div className="aspect-[9/16] w-full animate-pulse rounded-lg bg-paper" />,
});

type Saved = { version: StoryboardVersion; rev: number; warnings: string[]; project?: Project };
type SbMessage = UIMessage<{ failed?: boolean }, { storyboard: Saved }>;

const EXAMPLES = ["Make it simpler for 10 year olds", "Make scene 2 shorter", "Add a real-world example"];

function toUiMessages(items: ChatMessage[]): SbMessage[] {
  return items.map((m) => ({
    id: m.id,
    role: m.role,
    parts: m.text ? [{ type: "text", text: m.text }] : [],
    metadata: m.status === "failed" ? { failed: true } : undefined,
  }));
}

/** The video changed somewhere else (another tab); the page loads the latest version. */
class Conflict extends Error {
  constructor() {
    super("Changed in another tab.");
  }
}

/** Sends a storyboard change; resolves with the saved version or throws a sentence for the person. */
async function send(url: string, method: string, body: unknown): Promise<Saved> {
  const res = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => {
    throw new Error("Couldn't reach ClipGuru. Check your connection and try again.");
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (data?.error?.code === "REV_CONFLICT") throw new Conflict();
    throw new Error(data?.error?.message ?? "Couldn't save. Try again.");
  }
  return data as Saved;
}

export function StoryboardStep({
  project,
  initialVersion,
  initialMessages,
  videosLeft = null,
  testVoice = false,
}: {
  project: Project;
  initialVersion: StoryboardVersion;
  initialMessages: ChatMessage[];
  /** Videos the person can still make this month; null when there is no limit. */
  videosLeft?: number | null;
  /** The dev preview's free test voice is on: the video gets soft ticks instead of speech. */
  testVoice?: boolean;
}) {
  const [version, setVersion] = useState(initialVersion);
  const [storyboard, setStoryboard] = useState<Storyboard>(initialVersion.storyboard);
  const [voiceId, setVoiceId] = useState(project.voiceId);
  const [action, setAction] = useState<{ kind: "regen"; index: number } | { kind: "undo" } | null>(null);
  const rev = useRef(project.rev);
  const saved = useRef(initialVersion);
  const preview = useRef<PreviewHandle | null>(null);
  const previewBox = useRef<HTMLElement>(null);
  // Phones: the Generate button sits below every scene, so a slim copy floats above the tab bar until the real one is on screen.
  const generateBox = useRef<HTMLDivElement>(null);
  const [generateInView, setGenerateInView] = useState(true);
  useEffect(() => {
    const el = generateBox.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    // The bottom margin leaves out the strip behind the tab bar, so the floating bar stays until the real button is tappable.
    const io = new IntersectionObserver(([e]) => setGenerateInView(e.isIntersecting || e.boundingClientRect.top < 0), {
      rootMargin: "0px 0px -96px 0px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const [playing, setPlaying] = useState(0);
  const onScene = useCallback((i: number) => setPlaying(i), []);
  const pendingScene = useRef<number | null>(null);
  const onPreviewReady = useCallback(() => {
    if (pendingScene.current !== null) preview.current?.playScene(pendingScene.current);
    pendingScene.current = null;
  }, []);
  function playScene(i: number) {
    if (preview.current) preview.current.playScene(i);
    else pendingScene.current = i;
    // On phones the preview sits below the scenes.
    const box = previewBox.current?.getBoundingClientRect();
    if (box && window.innerWidth < 1024 && (box.top < 80 || box.bottom > window.innerHeight)) previewBox.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  const saver = useSaver();
  const base = `/api/projects/${project.id}`;
  const router = useRouter();
  const [making, setMaking] = useState(false);
  const [makeError, setMakeError] = useState<string | null>(null);
  const generating = project.status === "generating";

  /** Starts the render once pending edits are saved, then opens step 3, where its progress shows. */
  function makeVideo() {
    setMaking(true);
    setMakeError(null);
    void afterSaves(async () => {
      const res = await fetch(`${base}/renders`, { method: "POST" });
      const data = await res.json().catch(() => null);
      // One is already running for this video: show that one.
      if (!res.ok && data?.error?.code !== "RENDER_RUNNING") throw new Error(data?.error?.message ?? "Couldn't start the video. Try again.");
    })
      .then(() => router.push(`/videos/${project.id}/video`))
      .catch((err: unknown) => {
        setMaking(false);
        setMakeError(err instanceof Error ? err.message : "Couldn't start the video. Try again.");
      });
  }

  // The recorded voice for one storyboard version in one voice; the preview uses it while both match.
  const [voiced, setVoiced] = useState<{ key: string; voiceover: Voiceover } | null>(null);
  const [recording, setRecording] = useState(false);
  const [voiceError, setVoiceError] = useState<{ key: string; text: string } | null>(null);
  const voiceKey = `${version.version}:${voiceId}`;

  // Changes run one at a time, so each carries the rev and version the one before returned.
  const pending = useRef<Promise<unknown>>(Promise.resolve());
  function afterSaves<T>(fn: () => Promise<T>): Promise<T> {
    const run = pending.current.then(fn);
    pending.current = run.catch(() => undefined);
    return run;
  }

  const [notice, setNotice] = useState<string | null>(null);

  /** After a conflict: load what the other tab saved and say why the change didn't stick. */
  async function loadLatest() {
    const res = await fetch(base).catch(() => null);
    const data = res?.ok ? ((await res.json()) as { project: Project; storyboard: StoryboardVersion | null }) : null;
    if (!data?.storyboard) {
      setNotice("This video changed in another tab. Reload the page to see the latest version.");
      return;
    }
    accept({ version: data.storyboard, rev: data.project.rev, warnings: [] });
    setVoiceId(data.project.voiceId);
    setNotice("This video changed in another tab, so your last change wasn't saved. The latest version is shown now.");
  }

  /** Runs a save; a conflict loads the latest version instead of showing an error. */
  async function save<T>(fn: () => Promise<T>): Promise<T | undefined> {
    setNotice(null);
    let conflict = false;
    const out = await saver.run(async () => {
      try {
        return await fn();
      } catch (e) {
        if (e instanceof Conflict) conflict = true;
        throw e;
      }
    });
    if (conflict) await loadLatest();
    return out;
  }

  function accept(s: Saved) {
    saved.current = s.version;
    rev.current = s.rev;
    setVersion(s.version);
    setStoryboard(s.version.storyboard);
  }

  const [transport] = useState(
    () =>
      new DefaultChatTransport<SbMessage>({
        api: `${base}/chat`,
        prepareSendMessagesRequest: ({ messages, body }) => {
          const last = messages[messages.length - 1];
          const text = last.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
          return { body: { rev: body?.rev, step: "storyboard", text } };
        },
      }),
  );
  const { messages, sendMessage, status, error, clearError } = useChat<SbMessage>({
    id: `${project.id}-storyboard`,
    messages: toUiMessages(initialMessages),
    transport,
    onData: (part) => {
      if (part.type === "data-storyboard") accept(part.data);
    },
    onError: (e) => {
      if (e.message.includes("REV_CONFLICT")) void afterSaves(loadLatest);
    },
  });
  const chatBusy = status === "submitted" || status === "streaming";
  const busy = chatBusy || action !== null;

  function ask(text: string) {
    const t = text.trim();
    if (!t || busy) return;
    clearError();
    void afterSaves(() => sendMessage({ text: t }, { body: { rev: rev.current } }));
  }

  /** A direct edit: shown at once, saved as a new version, put back if the save fails. */
  function edit(next: Storyboard) {
    setStoryboard(next);
    void afterSaves(async () => {
      const out = await save(() =>
        send(`${base}/storyboard`, "PUT", { rev: rev.current, baseVersion: saved.current.version, storyboard: next }),
      );
      if (out) accept(out);
      else setStoryboard(saved.current.storyboard);
    });
  }

  function run(kind: "undo" | { regen: number }) {
    if (busy) return;
    setAction(kind === "undo" ? { kind } : { kind: "regen", index: kind.regen });
    void afterSaves(async () => {
      const out = await save(() =>
        kind === "undo"
          ? send(`${base}/storyboard/undo`, "POST", { rev: rev.current })
          : send(`${base}/storyboard/scenes/${kind.regen}/regenerate`, "POST", { rev: rev.current }),
      );
      if (out) accept(out);
      setAction(null);
    });
  }

  function pickVoice(id: string) {
    if (id === voiceId) return;
    const prev = voiceId;
    setVoiceId(id);
    void afterSaves(async () => {
      const out = await save(async () => {
        const res = await fetch(base, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ rev: rev.current, voiceId: id }),
        }).catch(() => {
          throw new Error("Couldn't reach ClipGuru. Check your connection and try again.");
        });
        const data = await res.json().catch(() => null);
        if (data?.error?.code === "REV_CONFLICT") throw new Conflict();
        if (!res.ok) throw new Error(data?.error?.message ?? "Couldn't save.");
        return data as Project;
      });
      if (out) rev.current = out.rev;
      else setVoiceId(prev);
    });
  }

  // A recording made earlier for this version and voice shows up without recording again.
  useEffect(() => {
    let live = true;
    void afterSaves(async () => {
      const res = await fetch(`${base}/voiceover?version=${version.version}`).catch(() => null);
      const data = res?.ok ? ((await res.json()) as { voiceover: Voiceover | null }) : null;
      if (live && data?.voiceover && data.voiceover.voiceId === voiceId) {
        setVoiced({ key: `${version.version}:${voiceId}`, voiceover: data.voiceover });
      }
    });
    return () => {
      live = false;
    };
    // afterSaves and base are stable for the page's life.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version.version, voiceId]);

  function recordVoice() {
    if (recording || busy) return;
    setRecording(true);
    setVoiceError(null);
    const key = voiceKey;
    const v = version.version;
    // Waits for saves already queued (such as a voice change), but edits made while it records
    // don't wait behind it: it records the version it was asked for.
    const before = pending.current;
    void (async () => {
      await before;
      try {
        const res = await fetch(`${base}/voiceover`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ version: v }),
        }).catch(() => {
          throw new Error("Couldn't reach ClipGuru. Check your connection and try again.");
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error?.message ?? "Couldn't record the voice. Try again.");
        setVoiced({ key, voiceover: (data as { voiceover: Voiceover }).voiceover });
      } catch (e) {
        setVoiceError({ key, text: e instanceof Error ? e.message : "Couldn't record the voice. Try again." });
      } finally {
        setRecording(false);
      }
    })();
  }

  // Only while the cards show exactly the saved version (not an edit on its way).
  const voice = voiced && voiced.key === voiceKey && storyboard === version.storyboard ? voiced.voiceover : null;
  const previewVoice = useMemo(
    () => (voice ? { audioSrc: voice.audioUrl, words: voice.words, durationSec: voice.durationSec } : null),
    [voice],
  );
  const voiceName = VOICES.find((v) => v.id === voiceId)?.name ?? "the narrator";

  const scenes = storyboard.scenes;
  const seconds = scenes.reduce((n, s) => n + sceneSeconds(s), 0);
  const length = toBrief(project.brief).length;
  const range = lengthRange({ length });
  const outOfRange = seconds < range.min || seconds > range.max;
  const rangeNote =
    length === "auto"
      ? seconds < range.min ? `Shorter than ${range.min} s` : `Longer than ${range.max} s`
      : `${seconds < range.min ? "Shorter" : "Longer"} than the ${VIDEO_LENGTHS[length].label} you picked`;
  // Version 1 is all new, so nothing is marked; later versions mark what they changed.
  const changed = new Set(version.version > 1 && version.storyboard === storyboard ? version.changedScenes : []);

  const update = (i: number, scene: Scene) => edit({ ...storyboard, scenes: scenes.map((s, j) => (j === i ? scene : s)) });
  const move = (i: number, d: -1 | 1) => {
    const next = [...scenes];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    edit({ ...storyboard, scenes: next });
  };
  const remove = (i: number) => edit({ ...storyboard, scenes: scenes.filter((_, j) => j !== i) });

  return (
    <div className="flex flex-col gap-6 lg:gap-10">
      <StepTabs current="storyboard" projectId={project.id} hasStoryboard hasVideo={project.step === "generate" || project.step === "post"} canPost={canPost(project)} />

      <header className="flex flex-col gap-3 border-b border-hairline pb-6">
        <span className="eyebrow">
          Step 2 · Storyboard · {scenes.length} scenes · about {formatDuration(seconds)}
        </span>
        <h1 className="break-words font-display text-3xl font-black uppercase leading-[0.95] tracking-tight sm:text-5xl">
          {project.title}
        </h1>
        <p className="max-w-2xl text-taupe">
          Read it through. Edit any line, get a fresh take on a scene, or ask for changes below.
        </p>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs uppercase tracking-wide text-taupe">
          <span>
            Version {version.version} · {version.createdBy === "ai" ? "written by ClipGuru" : "edited by you"}
          </span>
          {outOfRange && (
            <span className="text-danger" role="status">
              {rangeNote}
            </span>
          )}
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,360px)] lg:items-start lg:gap-10">
        <div className="flex min-w-0 flex-col gap-6">
          {notice && (
            <div
              role="alert"
              className="flex items-start justify-between gap-3 rounded-lg border border-sand-gold bg-sand-gold/15 px-4 py-3 text-sm text-espresso"
            >
              <span>{notice}</span>
              <button
                type="button"
                onClick={() => setNotice(null)}
                className="-my-2 -mr-2 inline-flex size-10 shrink-0 items-center justify-center rounded-md text-taupe hover:text-espresso"
              >
                <X className="size-4" />
                <span className="sr-only">Dismiss</span>
              </button>
            </div>
          )}
          <ol className="flex flex-col gap-4" aria-label="Scenes">
            {scenes.map((scene, i) => (
              <SceneCard
                // Content in the key resets local drafts when a version replaces the scene.
                key={`${i}:${JSON.stringify(scene)}`}
                scene={scene}
                index={i}
                count={scenes.length}
                changed={changed.has(i)}
                playing={playing === i}
                onPlay={() => playScene(i)}
                busy={busy}
                regenerating={action?.kind === "regen" && action.index === i}
                onChange={(s) => update(i, s)}
                onMove={(d) => move(i, d)}
                onRemove={() => remove(i)}
                onRegenerate={() => run({ regen: i })}
              />
            ))}
          </ol>

          <ChatPanel
            messages={messages}
            busy={busy}
            waiting={status === "submitted"}
            error={describeError(error)}
            onSend={ask}
            canUndo={version.canUndo}
            undoing={action?.kind === "undo"}
            onUndo={() => run("undo")}
            saveStatus={<Status state={saver.state} error={saver.error} />}
          />
        </div>

        <aside className="flex flex-col gap-6 lg:sticky lg:top-8">
          <section
            ref={previewBox}
            aria-label="Preview"
            className="scroll-mt-24 flex flex-col gap-3 rounded-xl border border-hairline bg-surface-warm/60 p-4"
          >
            <div className="flex items-center justify-between gap-2 font-mono text-xs uppercase tracking-wider text-taupe">
              <span>9:16 reel preview</span>
              <span>Scene {String(playing + 1).padStart(2, "0")}</span>
            </div>
            {/* On phones the player fits between the header and the tab bar. */}
            <div className="mx-auto w-full max-w-72 max-lg:max-w-[max(11rem,min(18rem,calc((100dvh-15rem)*9/16)))]">
              <PreviewPlayer
                storyboard={storyboard}
                voice={previewVoice}
                onScene={onScene}
                onReady={onPreviewReady}
                control={preview}
              />
            </div>
            {voice ? (
              <p className="flex items-center justify-center gap-1.5 text-center text-xs text-taupe" role="status">
                <Mic className="size-3.5 text-sand-gold" aria-hidden />
                With {voice.voiceName}&rsquo;s voice · {formatDuration(Math.floor(voice.durationSec))}. Press play to listen.
              </p>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Button
                  variant="secondary"
                  onClick={recordVoice}
                  disabled={recording || busy}
                  aria-busy={recording}
                  className="w-full"
                >
                  {recording ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Mic className="size-4" aria-hidden />}
                  {recording ? `Recording ${voiceName}…` : `Listen with ${voiceName}’s voice`}
                </Button>
                <p className="text-center text-xs text-taupe" role="status">
                  {voiceError?.key === voiceKey ? (
                    <span className="text-danger">{voiceError.text}</span>
                  ) : recording ? (
                    "This takes about 20 seconds."
                  ) : (
                    "Silent preview with estimated timing until you add the voice."
                  )}
                </p>
              </div>
            )}
          </section>
          <VoicePicker value={voiceId} disabled={busy || recording} onPick={pickVoice} />
          <div ref={generateBox} className="flex flex-col gap-2">
            <Button
              size="lg"
              onClick={generating ? () => router.push(`/videos/${project.id}/video`) : makeVideo}
              disabled={making || busy}
              aria-busy={making}
              className="w-full uppercase tracking-wide"
            >
              {making ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              {generating ? "See video progress" : "Generate video"} {!making && <ArrowRight className="size-4" />}
            </Button>
            <p className="text-center text-sm text-taupe" role="status">
              {makeError ? (
                <span className="text-danger">{makeError}</span>
              ) : generating ? (
                "Your video is being made."
              ) : (
                <>
                  {testVoice
                    ? "Makes the MP4 with the test voice (soft ticks, no speech). Takes a few minutes."
                    : `Makes the MP4 with ${voiceName}’s voice. Takes a few minutes.`}
                  {videosLeft !== null && (
                    <span className="block">
                      {videosLeft === 0
                        ? "You’ve used this month’s videos."
                        : `${videosLeft} ${videosLeft === 1 ? "video" : "videos"} left this month.`}
                    </span>
                  )}
                </>
              )}
            </p>
          </div>
        </aside>
      </div>

      {!generateInView ? (
        <div className="fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 px-4 lg:hidden">
          <div className="mx-auto flex max-w-md items-center gap-3 rounded-xl border border-hairline bg-surface/95 p-2 pl-4 shadow-[0_8px_24px_-12px_rgba(32,30,28,0.35)] backdrop-blur">
            <p className="min-w-0 flex-1 truncate text-sm text-taupe">
              {generating ? "Your video is being made." : `${scenes.length} scenes · ${voiceName}’s voice`}
            </p>
            <Button
              size="sm"
              onClick={generating ? () => router.push(`/videos/${project.id}/video`) : makeVideo}
              disabled={making || busy}
              aria-busy={making}
              className="shrink-0"
            >
              {making ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
              {generating ? "See progress" : "Generate video"} {!making && <ArrowRight className="size-3.5" aria-hidden />}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SceneCard({
  scene,
  index,
  count,
  changed,
  busy,
  regenerating,
  playing,
  onPlay,
  onChange,
  onMove,
  onRemove,
  onRegenerate,
}: {
  scene: Scene;
  index: number;
  count: number;
  changed: boolean;
  busy: boolean;
  regenerating: boolean;
  playing: boolean;
  onPlay: () => void;
  onChange: (s: Scene) => void;
  onMove: (d: -1 | 1) => void;
  onRemove: () => void;
  onRegenerate: () => void;
}) {
  const n = index + 1;
  const [heading, setHeading] = useState(editableHeading(scene));
  const [editing, setEditing] = useState(false);
  const [narration, setNarration] = useState(scene.narration);
  const headingMax = scene.type === "title" || scene.type === "stat" ? 80 : 60;

  function saveHeading() {
    const v = heading.trim();
    if (!v) return setHeading(editableHeading(scene));
    if (v !== editableHeading(scene)) onChange(withHeading(scene, v));
  }
  function saveNarration() {
    setEditing(false);
    const v = narration.trim().replace(/\s+/g, " ");
    if (!v) return setNarration(scene.narration);
    if (v !== scene.narration) onChange({ ...scene, narration: v });
  }

  const icon = "inline-flex size-10 items-center justify-center rounded-md text-taupe hover:bg-surface-warm/70 hover:text-espresso disabled:opacity-40 disabled:hover:bg-transparent";

  return (
    <li
      aria-label={`Scene ${n}`}
      className={cn(
        "relative flex flex-col rounded-xl border bg-surface shadow-[0_1px_2px_rgba(32,30,28,0.04)]",
        changed ? "border-sand-gold" : "border-hairline",
        regenerating && "opacity-70",
      )}
    >
      {changed && (
        <span className="absolute -top-3 right-4 rounded-full bg-espresso-deep px-3 py-0.5 font-mono text-[11px] uppercase tracking-wider text-surface">
          Updated
        </span>
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-hairline px-4 py-3 sm:px-5">
        <button
          type="button"
          onClick={onPlay}
          title="Play this scene in the preview"
          className={cn(
            "inline-flex h-10 items-center gap-1.5 rounded px-2 font-mono text-xs font-semibold hover:ring-2 hover:ring-sand-gold/50",
            playing ? "bg-espresso-deep text-surface" : changed ? "bg-sand-gold/50 text-espresso" : "bg-surface-warm text-espresso",
          )}
        >
          <Play className="size-3" aria-hidden />
          SC {String(n).padStart(2, "0")}
          <span className="sr-only">: play scene {n} in the preview</span>
        </button>
        <span className="font-mono text-xs uppercase tracking-wider text-taupe">{SCENE_LABELS[scene.type]}</span>
        {scene.type === "stat" && <span className="font-display text-lg font-black">{scene.value}</span>}
        <label htmlFor={`scene-${n}-heading`} className="sr-only">
          Scene {n} heading
        </label>
        <input
          id={`scene-${n}-heading`}
          value={heading}
          maxLength={headingMax}
          disabled={busy}
          onChange={(e) => setHeading(e.target.value)}
          onBlur={saveHeading}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          autoComplete="off"
          className="min-w-40 flex-1 basis-40 rounded-md bg-transparent px-1 py-1 text-[17px] font-semibold text-espresso focus:outline-none focus-visible:ring-2 focus-visible:ring-sand-gold/50 disabled:opacity-100"
        />
        <span className="ml-auto font-mono text-sm text-taupe">{sceneSeconds(scene).toFixed(1)} s</span>
        <div className="-mr-2 flex items-center">
          <button type="button" className={icon} disabled={busy} onClick={onRegenerate} title="New take on this scene">
            {regenerating ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            <span className="sr-only">New take on scene {n}</span>
          </button>
          <button type="button" className={icon} disabled={busy || index === 0} onClick={() => onMove(-1)} title="Move up">
            <ArrowUp className="size-4" />
            <span className="sr-only">Move scene {n} up</span>
          </button>
          <button type="button" className={icon} disabled={busy || index === count - 1} onClick={() => onMove(1)} title="Move down">
            <ArrowDown className="size-4" />
            <span className="sr-only">Move scene {n} down</span>
          </button>
          <button
            type="button"
            className={icon}
            disabled={busy || count <= MIN_SCENES}
            onClick={onRemove}
            title={count <= MIN_SCENES ? `A storyboard needs at least ${MIN_SCENES} scenes` : "Delete scene"}
          >
            <Trash2 className="size-4" />
            <span className="sr-only">Delete scene {n}</span>
          </button>
        </div>
      </div>

      <div className="px-4 py-4 sm:px-5">
        {regenerating ? (
          <p className="flex items-center gap-2 text-[15px] text-taupe">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Writing a new take…
          </p>
        ) : editing ? (
          <>
            <label htmlFor={`scene-${n}-narration`} className="sr-only">
              Scene {n} narration
            </label>
            <textarea
              id={`scene-${n}-narration`}
              autoFocus
              value={narration}
              maxLength={600}
              onChange={(e) => setNarration(e.target.value)}
              onBlur={saveNarration}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setNarration(scene.narration);
                  setEditing(false);
                }
              }}
              className="field-sizing-content min-h-16 w-full resize-none rounded-md bg-paper/60 px-2 py-1.5 text-[16px] leading-relaxed text-espresso focus:outline-none focus-visible:ring-2 focus-visible:ring-sand-gold/50"
            />
          </>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => setEditing(true)}
            className="group -mx-2 w-[calc(100%+1rem)] rounded-md px-2 py-1.5 text-left text-[16px] leading-relaxed text-espresso hover:bg-paper/60 disabled:hover:bg-transparent"
          >
            <span className="sr-only">Edit the narration of scene {n}: </span>
            &ldquo;
            {cueMarks(scene).map((w, i) => (
              <span key={i}>
                {i > 0 && " "}
                {w.cue ? <span className="underline decoration-sand-gold decoration-2 underline-offset-4">{w.word}</span> : w.word}
              </span>
            ))}
            &rdquo;
            <Pencil className="ml-2 inline size-3.5 text-taupe opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden />
          </button>
        )}
      </div>

      <div className="flex items-start gap-2 border-t border-hairline px-4 py-3 font-mono text-xs text-taupe sm:px-5">
        <Eye className="mt-px size-4 shrink-0" aria-hidden />
        <span className="flex-1 break-words">{sceneVisual(scene)}</span>
        <span className="hidden whitespace-nowrap uppercase tracking-wider sm:inline">
          Beat {n} of {count}
        </span>
      </div>
    </li>
  );
}

function ChatPanel({
  messages,
  busy,
  waiting,
  error,
  onSend,
  canUndo,
  undoing,
  onUndo,
  saveStatus,
}: {
  messages: SbMessage[];
  busy: boolean;
  waiting: boolean;
  error: string | null;
  onSend: (text: string) => void;
  canUndo: boolean;
  undoing: boolean;
  onUndo: () => void;
  saveStatus: React.ReactNode;
}) {
  const [draft, setDraft] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const count = messages.length;
  const lastLength = messages[count - 1]?.parts.length ?? 0;

  useEffect(() => {
    if (count > 0) end.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [count, lastLength, waiting]);

  function submit() {
    if (busy || !draft.trim()) return;
    onSend(draft);
    setDraft("");
  }
  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <section aria-label="Ask for changes" className="flex flex-col gap-4">
      {(count > 0 || waiting) && (
        <ol className="flex flex-col gap-3" aria-live="polite" aria-busy={busy}>
          {messages.map((m) => {
            const text = m.parts.map((p) => (p.type === "text" ? p.text : "")).join("").trim();
            const updated = m.parts.find((p) => p.type === "data-storyboard");
            if (!text && !updated) return null;
            const mine = m.role === "user";
            return (
              <li key={m.id} className={cn("flex", mine && "justify-end")}>
                <div
                  className={cn(
                    "flex max-w-[85%] flex-col gap-1 rounded-xl px-4 py-3 text-[15px] leading-relaxed",
                    mine ? "bg-espresso-deep text-surface" : "border border-hairline bg-surface text-espresso",
                  )}
                >
                  <span className={cn("font-mono text-[11px] uppercase tracking-wider", mine ? "text-sand-gold" : "text-taupe")}>
                    {mine ? "You" : "ClipGuru"}
                  </span>
                  {text && <p className="whitespace-pre-wrap break-words">{text}</p>}
                  {updated?.type === "data-storyboard" && (
                    <span className="flex items-center gap-1.5 text-sm text-success">
                      <Check className="size-4" aria-hidden /> Saved as version {updated.data.version.version}
                    </span>
                  )}
                  {m.metadata?.failed && <span className={cn("text-xs", mine ? "text-sand-gold" : "text-danger")}>Didn&apos;t get a reply. Try again.</span>}
                </div>
              </li>
            );
          })}
          {waiting && (
            <li className="flex items-center gap-2 text-sm text-taupe">
              <Loader2 className="size-4 animate-spin" aria-hidden /> Thinking…
            </li>
          )}
        </ol>
      )}
      <div ref={end} />

      {error && (
        <p role="alert" className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      {count === 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="eyebrow mr-1">Try</span>
          {EXAMPLES.map((s) => (
            <button
              key={s}
              type="button"
              disabled={busy}
              onClick={() => onSend(s)}
              className="flex min-h-10 items-center gap-1.5 rounded-lg border border-hairline bg-surface px-3 text-sm text-espresso hover:border-taupe/40 disabled:opacity-60"
            >
              <Sparkles className="size-4 text-taupe" aria-hidden /> {s}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-xl border border-hairline bg-surface p-3 shadow-[0_8px_24px_-12px_rgba(32,30,28,0.25)] lg:sticky lg:bottom-6">
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <label htmlFor="storyboard-chat-input" className="sr-only">
            Ask for changes
          </label>
          <Sparkles className="mb-3.5 ml-1 hidden size-4 shrink-0 text-taupe sm:block" aria-hidden />
          <textarea
            id="storyboard-chat-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            maxLength={CHAT_TEXT_MAX}
            rows={1}
            placeholder="Ask for changes, e.g. make scene 3 simpler…"
            className="field-sizing-content max-h-40 min-h-11 w-full resize-none bg-transparent px-2 py-2.5 text-[15px] placeholder:text-taupe/70 focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy || !draft.trim()}
            className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-lg bg-espresso-deep px-4 text-sm font-medium text-surface hover:bg-espresso disabled:opacity-50"
          >
            Send {busy && !undoing ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
          </button>
        </form>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-hairline pt-2">
          <button
            type="button"
            disabled={busy || !canUndo}
            onClick={onUndo}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 font-mono text-xs uppercase tracking-wide text-taupe hover:text-espresso disabled:opacity-50"
          >
            {undoing ? <Loader2 className="size-4 animate-spin" /> : <Undo2 className="size-4" />} Undo last change
          </button>
          <div className="px-2">{saveStatus}</div>
        </div>
      </div>
    </section>
  );
}

function VoicePicker({ value, disabled, onPick }: { value: string; disabled: boolean; onPick: (id: string) => void }) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="eyebrow mb-3">Narrator voice</legend>
      {VOICES.map((v) => {
        const on = v.id === value;
        return (
          <label
            key={v.id}
            className={cn(
              "flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border bg-surface px-4 py-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-sand-gold/50",
              on ? "border-sand-gold" : "border-hairline hover:border-taupe/40",
              disabled && "cursor-not-allowed opacity-70",
            )}
          >
            <input
              type="radio"
              name="voice"
              value={v.id}
              checked={on}
              disabled={disabled}
              onChange={() => onPick(v.id)}
              className="sr-only"
            />
            <span className="flex size-10 items-center justify-center rounded-full bg-surface-warm text-taupe" aria-hidden>
              <Mic className="size-4" />
            </span>
            <span className="flex flex-1 flex-col">
              <span className="font-medium">{v.name}</span>
              <span className="text-sm text-taupe">
                {v.accent} {v.gender} · {v.description}
              </span>
            </span>
            <span
              className={cn(
                "flex size-5 items-center justify-center rounded-full border",
                on ? "border-espresso-deep bg-espresso-deep text-surface" : "border-hairline",
              )}
              aria-hidden
            >
              {on && <Check className="size-3" />}
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}

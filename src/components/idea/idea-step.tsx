"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { ArrowUp, Lightbulb, Loader2, Sparkles } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useSaver } from "@/components/account/save";
import { toBrief, type Brief } from "@/lib/brief";
import { CHAT_TEXT_MAX, type ChatMessage, type Idea } from "@/lib/chat/types";
import { cn } from "@/lib/cn";
import { DEFAULT_TITLE, type Project } from "@/lib/projects/types";
import { BriefPanel } from "./brief-panel";
import { StepTabs } from "./step-tabs";

type BriefData = { brief: Brief; rev: number; title: string };
type IdeaMessage = UIMessage<{ failed?: boolean }, { brief: BriefData; ideas: { ideas: Idea[] } }>;

const GREETING =
  "What would you like to explain? Tell me a topic in a few words, or ask me for ideas and I'll suggest some.";
const STARTERS = ["Give me 5 ideas", "Explain how compound interest works", "Why is the sky blue?"];

/** Saved messages → the chat's message shape (ideas come back as cards after a reload). */
function toUiMessages(items: ChatMessage[]): IdeaMessage[] {
  return items.map((m) => {
    const parts: IdeaMessage["parts"] = [];
    if (m.text) parts.push({ type: "text", text: m.text });
    if (m.toolResult?.ideas) parts.push({ type: "data-ideas", data: { ideas: m.toolResult.ideas } });
    return { id: m.id, role: m.role, parts, metadata: m.status === "failed" ? { failed: true } : undefined };
  });
}

/** Turns a failed chat request into words: the server's JSON error, or a connection problem. */
function describeError(err: Error | undefined): string | null {
  if (!err) return null;
  try {
    const body = JSON.parse(err.message) as { error?: { code?: string; message?: string } };
    if (body.error?.code === "REV_CONFLICT") return "This video changed in another tab. Reload the page to carry on.";
    if (body.error?.message) return body.error.message;
  } catch {
    // Not JSON: a network error or a message from the stream.
  }
  if (err instanceof TypeError || /fetch/i.test(err.message)) {
    return "Couldn't reach ClipGuru. Check your connection and try again.";
  }
  return err.message || "Something went wrong. Try again.";
}

export function IdeaStep({ project, initialMessages }: { project: Project; initialMessages: ChatMessage[] }) {
  const [title, setTitle] = useState(project.title);
  const [brief, setBrief] = useState<Brief>(() => toBrief(project.brief));
  const rev = useRef(project.rev);
  const saver = useSaver();
  // Made once; each send passes the latest rev in its body.
  const [transport] = useState(
    () =>
      new DefaultChatTransport<IdeaMessage>({
        api: `/api/projects/${project.id}/chat`,
        prepareSendMessagesRequest: ({ messages, body }) => {
          const last = messages[messages.length - 1];
          const text = last.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
          return { body: { rev: body?.rev, step: "idea", text } };
        },
      }),
  );

  const { messages, sendMessage, status, error, clearError } = useChat<IdeaMessage>({
    id: project.id,
    messages: toUiMessages(initialMessages),
    transport,
    onData: (part) => {
      if (part.type === "data-brief") {
        rev.current = part.data.rev;
        setBrief(part.data.brief);
        setTitle(part.data.title);
      }
    },
  });

  const busy = status === "submitted" || status === "streaming";

  // Brief saves run one at a time, and a chat message waits for them, so each request
  // carries the rev the previous save returned (on a slow database they would otherwise 409).
  const pending = useRef<Promise<unknown>>(Promise.resolve());
  function afterSaves<T>(fn: () => Promise<T>): Promise<T> {
    const run = pending.current.then(fn);
    pending.current = run.catch(() => undefined);
    return run;
  }

  function send(text: string) {
    const t = text.trim();
    if (!t || busy) return;
    clearError();
    void afterSaves(() => sendMessage({ text: t }, { body: { rev: rev.current } }));
  }

  function saveBrief(next: Brief) {
    const prev = brief;
    const prevTitle = title;
    // Like the chat, the video's name follows the topic until the person renames the video.
    const followTitle = next.title && next.title !== title && (title === DEFAULT_TITLE || title === brief.title);
    setBrief(next);
    if (followTitle) setTitle(next.title);
    void afterSaves(async () => {
      const saved = await saver.run(async () => {
        const res = await fetch(`/api/projects/${project.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ rev: rev.current, brief: next, ...(followTitle ? { title: next.title } : {}) }),
        }).catch(() => {
          throw new Error("Couldn't reach ClipGuru. Check your connection and try again.");
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          if (data?.error?.code === "REV_CONFLICT") throw new Error("Changed in another tab. Reload to see the latest.");
          throw new Error((Object.values(data?.error?.details ?? {})[0] as string) ?? data?.error?.message ?? "Couldn't save.");
        }
        return data as Project;
      });
      if (saved) rev.current = saved.rev;
      else {
        setBrief(prev);
        setTitle(prevTitle);
      }
    });
  }

  return (
    <div className="flex flex-col gap-6 lg:gap-10">
      <StepTabs current="idea" />

      <header className="flex flex-col gap-3 border-b border-hairline pb-6">
        <span className="eyebrow">Step 1 · Idea</span>
        <h1 className="break-words font-display text-3xl font-black uppercase leading-[0.95] tracking-tight sm:text-5xl">
          {title}
        </h1>
        <p className="max-w-2xl text-taupe">
          Talk it through. The brief fills in as you go, and you can edit it any time.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,400px)] lg:items-start lg:gap-10">
        <div className="lg:sticky lg:top-8 lg:order-2">
          <BriefPanel
            brief={brief}
            locked={busy}
            save={saveBrief}
            saveState={saver.state}
            saveError={saver.error}
          />
        </div>
        <Chat
          messages={messages}
          busy={busy}
          waiting={status === "submitted"}
          error={describeError(error)}
          onSend={send}
        />
      </div>
    </div>
  );
}

function Chat({
  messages,
  busy,
  waiting,
  error,
  onSend,
}: {
  messages: IdeaMessage[];
  busy: boolean;
  waiting: boolean;
  error: string | null;
  onSend: (text: string) => void;
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
    <section aria-label="Idea chat" className="flex min-w-0 flex-col gap-5 lg:order-1">
      <ol className="flex flex-col gap-4" aria-live="polite" aria-busy={busy}>
        <Bubble role="assistant">{GREETING}</Bubble>
        {messages.map((m) => (
          <MessageView key={m.id} message={m} busy={busy} onPick={onSend} />
        ))}
        {waiting && (
          <li className="flex items-center gap-2 pl-14 text-sm text-taupe">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Thinking…
          </li>
        )}
      </ol>
      <div ref={end} />

      {error && (
        <p role="alert" className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      {count === 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="eyebrow mr-1">Try</span>
          {STARTERS.map((s) => (
            <button
              key={s}
              type="button"
              disabled={busy}
              onClick={() => onSend(s)}
              className="flex min-h-10 items-center gap-1.5 rounded-lg border border-hairline bg-surface px-3 text-sm text-espresso hover:border-taupe/40 disabled:opacity-60"
            >
              {s.startsWith("Give") ? <Sparkles className="size-4 text-taupe" /> : <Lightbulb className="size-4 text-taupe" />}
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        className="rounded-xl border border-hairline bg-surface p-3 shadow-[0_1px_2px_rgba(32,30,28,0.04)] focus-within:border-sand-gold"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label htmlFor="chat-input" className="sr-only">
          Message
        </label>
        <div className="flex items-end gap-2">
          <textarea
            id="chat-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            maxLength={CHAT_TEXT_MAX}
            rows={2}
            placeholder="Describe your idea, or ask for changes…"
            className="field-sizing-content max-h-48 min-h-12 w-full resize-none bg-transparent px-2 py-1.5 text-[15px] placeholder:text-taupe/70 focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy || !draft.trim()}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg bg-espresso-deep text-surface hover:bg-espresso disabled:opacity-50"
          >
            {busy ? <Loader2 className="size-5 animate-spin" /> : <ArrowUp className="size-5" />}
            <span className="sr-only">Send</span>
          </button>
        </div>
        <p className="hidden px-2 pt-2 text-right font-mono text-[11px] uppercase tracking-wide text-taupe sm:block">
          Enter to send · Shift + Enter for a new line
        </p>
      </form>
    </section>
  );
}

function MessageView({ message, busy, onPick }: { message: IdeaMessage; busy: boolean; onPick: (t: string) => void }) {
  const text = message.parts.map((p) => (p.type === "text" ? p.text : "")).join("").trim();
  const ideas = message.parts.flatMap((p) => (p.type === "data-ideas" ? p.data.ideas : []));
  const role = message.role === "user" ? "user" : "assistant";
  return (
    <>
      {text && (
        <Bubble role={role} failed={message.metadata?.failed}>
          {text}
        </Bubble>
      )}
      {ideas.length > 0 && (
        <li className="sm:pl-14">
          <ul className="grid gap-2 sm:grid-cols-2" aria-label="Ideas">
            {ideas.map((idea) => (
              <li key={idea.title}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onPick(`Let's go with "${idea.title}": ${idea.hook}`)}
                  className="flex h-full w-full flex-col gap-1 rounded-lg border border-hairline bg-surface px-4 py-3 text-left transition-colors hover:border-sand-gold hover:bg-white disabled:opacity-60"
                >
                  <span className="font-medium text-espresso">{idea.title}</span>
                  <span className="text-sm text-taupe">{idea.hook}</span>
                </button>
              </li>
            ))}
          </ul>
        </li>
      )}
    </>
  );
}

function Bubble({ role, failed, children }: { role: "user" | "assistant"; failed?: boolean; children: React.ReactNode }) {
  const mine = role === "user";
  return (
    <li className={cn("flex items-start gap-3", mine && "flex-row-reverse")}>
      <span
        aria-hidden
        className={cn(
          "hidden size-11 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-bold sm:flex",
          mine ? "bg-sand-gold/60 text-espresso" : "bg-espresso-deep text-surface",
        )}
      >
        {mine ? "YOU" : "CG"}
      </span>
      <div
        className={cn(
          "flex max-w-[85%] flex-col gap-1.5 rounded-xl px-4 py-3 sm:px-5 sm:py-4",
          mine ? "bg-espresso-deep text-surface" : "border border-hairline bg-surface text-espresso",
        )}
      >
        <span className={cn("font-mono text-[11px] uppercase tracking-wider", mine ? "text-sand-gold" : "text-taupe")}>
          {mine ? "You" : "ClipGuru"}
        </span>
        <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">{children}</p>
        {failed && <span className={cn("text-xs", mine ? "text-sand-gold" : "text-danger")}>Didn&apos;t get a reply. Try again.</span>}
      </div>
    </li>
  );
}

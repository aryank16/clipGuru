import type { LanguageModelV4, LanguageModelV4StreamPart } from "@ai-sdk/provider";

/**
 * A scripted stand-in for Gemini (AI_DRIVER=fake with the memory database), so the idea chat
 * can be tested end to end without a key. It mimics the real flow: first a tool call, then a
 * short text reply once the tool result comes back.
 *   - a message containing "idea" → suggestIdeas with five ideas
 *   - "fail" → a provider error
 *   - anything else → updateBrief with a title and key points from the message
 */
const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 10, text: 10, reasoning: 0 },
};

function stream(parts: LanguageModelV4StreamPart[]): ReadableStream<LanguageModelV4StreamPart> {
  return new ReadableStream({
    async start(controller) {
      for (const p of parts) {
        controller.enqueue(p);
        await new Promise((r) => setTimeout(r, 15));
      }
      controller.close();
    },
  });
}

function textParts(text: string): LanguageModelV4StreamPart[] {
  const words = text.split(/(?<= )/);
  return [
    { type: "text-start", id: "t1" },
    ...words.map((delta): LanguageModelV4StreamPart => ({ type: "text-delta", id: "t1", delta })),
    { type: "text-end", id: "t1" },
  ];
}

function finish(unified: "stop" | "tool-calls"): LanguageModelV4StreamPart {
  return { type: "finish", usage, finishReason: { unified, raw: unified } };
}

export const fakeChatModel: LanguageModelV4 = {
  specificationVersion: "v4",
  provider: "fake",
  modelId: "fake-chat",
  supportedUrls: {},
  async doGenerate({ prompt }) {
    // The storyboard and caption writers call generate; both ask for JSON.
    const text = textOf(prompt[prompt.length - 1]);
    const system = prompt[0]?.role === "system" ? prompt[0].content : "";
    await new Promise((r) => setTimeout(r, 1200));
    if (/\bfail\b/i.test(text)) throw new Error("fake outage");
    if (system.includes("You write Instagram captions for ClipGuru")) {
      const title = /Video title: (.*)/.exec(text)?.[1] ?? "this idea";
      const json = JSON.stringify({
        caption: `Ever wondered how ${title.toLowerCase()} really works?\nIn about a minute you'll see the idea step by step, with one clear picture to remember.\nFollow for more short explainers.`,
        hashtags: ["explainer", "learnsomethingnew", "science", "#edu cation", "explainer"],
      });
      return { content: [{ type: "text", text: json }], finishReason: { unified: "stop", raw: "stop" }, usage, warnings: [] };
    }
    const json = JSON.stringify(fakeStoryboard(text));
    return {
      content: [{ type: "text", text: json }],
      finishReason: { unified: "stop", raw: "stop" },
      usage,
      warnings: [],
    };
  },
  async doStream({ prompt }) {
    const last = prompt[prompt.length - 1];
    const system = prompt[0]?.role === "system" ? prompt[0].content : "";
    if (system.includes("storyboard assistant")) return storyboardChat(last);
    if (last.role === "tool") {
      const wasIdeas = last.content.some((c) => c.type === "tool-result" && c.toolName === "suggestIdeas");
      const reply = wasIdeas
        ? "Here are five ideas. Pick one and I'll shape the brief around it."
        : "I've updated the brief. Who is this video for, and what should they remember?";
      return { stream: stream([{ type: "stream-start", warnings: [] }, ...textParts(reply), finish("stop")]) };
    }
    const userText = textOf(last);
    if (/\bfail\b/i.test(userText)) {
      return { stream: stream([{ type: "stream-start", warnings: [] }, { type: "error", error: new Error("fake outage") }]) };
    }
    const isIdeas = /idea/i.test(userText);
    const input = isIdeas
      ? {
          ideas: [
            { title: "How rainbows form", hook: "Follow one beam of sunlight through a raindrop." },
            { title: "Why the sky is blue", hook: "Short waves scatter; long waves slip through." },
            { title: "Compound interest", hook: "A snowball that grows as it rolls." },
            { title: "How vaccines train you", hook: "A wanted poster for your immune system." },
            { title: "Binary search", hook: "Find a word in a dictionary in 17 steps." },
          ],
        }
      : {
          title: userText.slice(0, 60),
          keyPoints: ["What it is", "How it works", "Why it matters"],
          tone: "Calm and clear",
        };
    return {
      stream: stream([
        { type: "stream-start", warnings: [] },
        {
          type: "tool-call",
          toolCallId: `call-${Date.now()}`,
          toolName: isIdeas ? "suggestIdeas" : "updateBrief",
          input: JSON.stringify(input),
        },
        finish("tool-calls"),
      ]),
    };
  },
};

type Message = Parameters<LanguageModelV4["doStream"]>[0]["prompt"][number];

function textOf(m: Message | undefined): string {
  if (!m || m.role !== "user") return "";
  return m.content
    .map((c) => (c.type === "text" ? c.text : ""))
    .join(" ")
    .trim();
}

/** Storyboard chat: a revise tool call, then a short confirmation. */
function storyboardChat(last: Message) {
  if (last.role === "tool") {
    const reply = "Done. I've updated the storyboard; the changed scenes are marked.";
    return { stream: stream([{ type: "stream-start", warnings: [] }, ...textParts(reply), finish("stop")]) };
  }
  const userText = textOf(last);
  if (/\bfail\b/i.test(userText)) {
    return { stream: stream([{ type: "stream-start", warnings: [] }, { type: "error", error: new Error("fake outage") }]) };
  }
  if (/\?$/.test(userText)) {
    const reply = "Good question. The storyboard has a title, a few explaining scenes and a summary to close.";
    return { stream: stream([{ type: "stream-start", warnings: [] }, ...textParts(reply), finish("stop")]) };
  }
  return {
    stream: stream([
      { type: "stream-start", warnings: [] },
      { type: "tool-call", toolCallId: `call-${Date.now()}`, toolName: "reviseStoryboard", input: JSON.stringify({ instruction: userText }) },
      finish("tool-calls"),
    ]),
  };
}

type RawScene = { type: string; narration: string; heading: string; [k: string]: unknown };

/**
 * The writer's three prompts: a fixed six-scene storyboard for a brief, a whole storyboard with
 * scene 2's heading changed for a revision, or one scene reworded for "Rewrite scene N".
 */
function fakeStoryboard(prompt: string): { title: string; scenes: RawScene[] } {
  const current = prompt.match(/^\{"title".*$/m);
  if (current) {
    const sb = JSON.parse(current[0]) as { title: string; scenes: RawScene[] };
    const rewrite = prompt.match(/Rewrite scene (\d+)/);
    if (rewrite) {
      const s = sb.scenes[Number(rewrite[1]) - 1];
      if (s) {
        s.narration = `Put another way, ${s.narration.charAt(0).toLowerCase()}${s.narration.slice(1)}`;
        s.heading = `${s.heading} (new take)`.slice(0, 60);
      }
    } else if (/shorter|remove/i.test(prompt) && sb.scenes.length > 4) {
      sb.scenes.splice(sb.scenes.length - 2, 1);
    } else if (sb.scenes[1]) {
      sb.scenes[1].heading = `Revised: ${sb.scenes[1].heading.replace(/^Revised: /, "")}`.slice(0, 60);
    }
    return sb;
  }
  const topic = prompt.match(/^Topic: (.*)$/m)?.[1]?.trim() || "this idea";
  return {
    title: topic,
    scenes: [
      {
        type: "title",
        heading: topic,
        subtitle: "What it is, how it works, why it matters",
        icon: "Sparkles",
        narration: `Let's explore ${topic}. In the next minute you will see what it is, how it works, and why it matters to you every single day.`,
      },
      {
        type: "focus",
        heading: "What it is",
        icon: "Lightbulb",
        items: [
          { label: "Simple idea", cue: "simple" },
          { label: "Big effect", cue: "effect" },
        ],
        narration:
          "At its heart, this is a simple idea. One small cause leads to a surprisingly big effect, and once you see the pattern, you start noticing it everywhere around you.",
      },
      {
        type: "flow",
        heading: "How it works",
        items: [
          { icon: "Play", label: "Start", cue: "starts" },
          { icon: "RefreshCw", label: "Change", cue: "changes" },
          { icon: "Check", label: "Result", cue: "result" },
        ],
        narration:
          "Here is how it works. Everything starts with a single input. That input changes as it moves through the system, step by step. The result is something new, built from those small steps.",
      },
      {
        type: "stat",
        value: "3",
        heading: "Steps to remember",
        icon: "ListOrdered",
        items: [{ label: "3", cue: "three" }],
        narration:
          "In fact, you only need to remember three steps. Start, change, result. Hold on to those, and the whole idea falls neatly into place for you.",
      },
      {
        type: "iconList",
        heading: "Why it matters",
        items: [
          { icon: "Sun", label: "Daily life", cue: "daily" },
          { icon: "Target", label: "Better choices", cue: "choices" },
          { icon: "Brain", label: "Clear thinking", cue: "thinking" },
        ],
        narration:
          "Why does it matter? It shapes your daily life in quiet ways. It helps you make better choices. And it trains clear thinking you can use anywhere.",
      },
      {
        type: "summary",
        heading: "Key takeaways",
        items: [
          { label: "A simple cause", cue: "simple" },
          { label: "Step by step", cue: "step" },
          { label: "Seen everywhere", cue: "everywhere" },
        ],
        narration:
          "So, to sum up. A simple cause, working step by step, creates effects you can see everywhere. Now you will never look at it the same way again.",
      },
    ],
  };
}

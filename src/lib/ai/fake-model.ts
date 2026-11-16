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
  async doGenerate() {
    throw new Error("The fake chat model only streams.");
  },
  async doStream({ prompt }) {
    const last = prompt[prompt.length - 1];
    if (last.role === "tool") {
      const wasIdeas = last.content.some((c) => c.type === "tool-result" && c.toolName === "suggestIdeas");
      const reply = wasIdeas
        ? "Here are five ideas. Pick one and I'll shape the brief around it."
        : "I've updated the brief. Who is this video for, and what should they remember?";
      return { stream: stream([{ type: "stream-start", warnings: [] }, ...textParts(reply), finish("stop")]) };
    }
    const userText =
      last.role === "user"
        ? last.content
            .map((c) => (c.type === "text" ? c.text : ""))
            .join(" ")
            .trim()
        : "";
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

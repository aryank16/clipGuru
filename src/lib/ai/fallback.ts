import { APICallError, type LanguageModelV4 } from "@ai-sdk/provider";

/** Busy (503), rate-limited or out of quota (429) and server errors move on to the next model. */
export function isBusy(err: unknown): boolean {
  return APICallError.isInstance(err) && [429, 500, 502, 503, 504].includes(err.statusCode ?? 0);
}

/**
 * One model that tries each of `models` in turn while the one before is busy (Gemini Flash on the
 * free tier often answers "high demand"). A failure that isn't about load is passed straight on.
 */
export function withFallback(models: LanguageModelV4[]): LanguageModelV4 {
  const [first] = models;
  async function attempt<T>(call: (m: LanguageModelV4) => PromiseLike<T>): Promise<T> {
    let last: unknown;
    for (const [i, m] of models.entries()) {
      try {
        return await call(m);
      } catch (err) {
        if (!isBusy(err) || i === models.length - 1) throw err;
        last = err;
        console.warn(`[ai] ${m.modelId} is busy (${(err as APICallError).statusCode}), trying ${models[i + 1].modelId}`);
      }
    }
    throw last;
  }
  return {
    specificationVersion: "v4",
    provider: first.provider,
    modelId: first.modelId,
    supportedUrls: first.supportedUrls,
    doGenerate: (options) => attempt((m) => m.doGenerate(options)),
    doStream: (options) => attempt((m) => m.doStream(options)),
  };
}

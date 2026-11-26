import type { Word } from "./types";

/** Text to speech with word timings. ElevenLabs in the app; a fake one in tests. */
export type Tts = {
  model: string;
  synthesize(text: string, voiceId: string, speed: number): Promise<Recording>;
};

/** The voice service has no credits left this month (ElevenLabs "quota_exceeded"). Retrying won't help. */
export class VoiceQuotaError extends Error {
  constructor(detail: string) {
    super(`Voice credits used up: ${detail}`);
    this.name = "VoiceQuotaError";
  }
}

export type Recording = { audio: Uint8Array; contentType: string; words: Word[]; durationSec: number };

type Alignment = {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
};

/** ElevenLabs gives a time per character; words are the runs between whitespace. */
export function alignmentToWords(a: Alignment): Word[] {
  const words: Word[] = [];
  let cur = "";
  let start = 0;
  let end = 0;
  a.characters.forEach((ch, i) => {
    if (/\s/.test(ch)) {
      if (cur) words.push({ text: cur, start, end });
      cur = "";
      return;
    }
    if (!cur) start = a.character_start_times_seconds[i];
    cur += ch;
    end = a.character_end_times_seconds[i];
  });
  if (cur) words.push({ text: cur, start, end });
  return words.map((w) => ({ text: w.text, start: round(w.start), end: round(w.end) }));
}

const round = (n: number) => Math.round(n * 1000) / 1000;

/** The ElevenLabs "with timestamps" endpoint (as in the prototype, plus speed and a timeout). */
export function elevenLabs(apiKey: string, model: string): Tts {
  return {
    model,
    async synthesize(text, voiceId, speed) {
      const res = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/with-timestamps?output_format=mp3_44100_128`,
        {
          method: "POST",
          headers: { "content-type": "application/json", "xi-api-key": apiKey },
          body: JSON.stringify({
            text,
            model_id: model,
            voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.15, use_speaker_boost: true, speed },
          }),
          signal: AbortSignal.timeout(50_000),
        },
      );
      if (!res.ok) {
        const body = (await res.text()).slice(0, 300);
        if (body.includes("quota_exceeded")) throw new VoiceQuotaError(body);
        throw new Error(`ElevenLabs ${res.status}: ${body}`);
      }
      const json = (await res.json()) as { audio_base64: string; alignment: Alignment };
      const words = alignmentToWords(json.alignment);
      const last = words[words.length - 1]?.end ?? 0;
      return {
        audio: new Uint8Array(Buffer.from(json.audio_base64, "base64")),
        contentType: "audio/mpeg",
        words,
        durationSec: last,
      };
    },
  };
}

/**
 * A stand-in voice for local end-to-end tests: a quiet WAV with one soft tick per word at about
 * 2.45 words a second. "fail" in the text simulates an outage.
 */
export const fakeTts: Tts = {
  model: "fake",
  async synthesize(text, _voiceId, speed) {
    await new Promise((r) => setTimeout(r, 600));
    if (/\bfail\b/i.test(text)) throw new Error("fake voice outage");
    return placeholder(text, speed);
  },
};

/**
 * The free test voice for the dev preview (VOICE_DRIVER=test): the same quiet track with a soft tick per
 * word, so the whole flow can be tried without spending voice credits. Its own model name keeps its
 * recordings apart from real ones.
 */
export const testTts: Tts = {
  model: "test-voice",
  async synthesize(text, _voiceId, speed) {
    return placeholder(text, speed);
  },
};

function placeholder(text: string, speed: number): Recording {
  const step = 1 / (2.45 * speed);
  const words: Word[] = text
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((t, i) => ({ text: t, start: round(0.2 + i * step), end: round(0.2 + i * step + step * 0.8) }));
  const durationSec = words[words.length - 1]?.end ?? 0;
  return { audio: wav(durationSec + 1, words), contentType: "audio/wav", words, durationSec };
}

function wav(seconds: number, words: Word[]): Uint8Array {
  const rate = 8000;
  const n = Math.ceil(seconds * rate);
  const buf = Buffer.alloc(44 + n, 128);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + n, 4);
  buf.write("WAVEfmt ", 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate, 28);
  buf.writeUInt16LE(1, 32);
  buf.writeUInt16LE(8, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(n, 40);
  for (const w of words) {
    const at = Math.floor(w.start * rate);
    for (let i = 0; i < 400 && at + i < n; i++) buf[44 + at + i] = 128 + Math.round(12 * Math.sin((i / rate) * 2 * Math.PI * 440));
  }
  return new Uint8Array(buf);
}

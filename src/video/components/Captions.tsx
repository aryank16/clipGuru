import React, { useMemo } from "react";
import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import type { Word } from "../types";
import { theme, zones } from "../theme";

type Chunk = { words: Word[]; start: number; end: number };

// Group words into short caption lines: max ~4 words / 22 chars,
// and always break after sentence punctuation.
export function chunkWords(words: Word[]): Chunk[] {
  const chunks: Chunk[] = [];
  let cur: Word[] = [];
  const flush = () => {
    if (cur.length) chunks.push({ words: cur, start: cur[0].start, end: cur[cur.length - 1].end });
    cur = [];
  };
  for (const w of words) {
    const chars = cur.reduce((n, x) => n + x.text.length + 1, 0) + w.text.length;
    const gap = cur.length ? w.start - cur[cur.length - 1].end : 0;
    if (cur.length && (cur.length >= 4 || chars > 22 || gap > 0.5)) flush();
    cur.push(w);
    if (/[.!?;:,]$/.test(w.text) && cur.length >= 2) flush();
    else if (/[.!?]$/.test(w.text)) flush();
  }
  flush();
  return chunks;
}

// Burned-in captions in the lower third. The spoken word lights up in the accent colour.
export const Captions: React.FC<{ words: Word[] }> = ({ words }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const chunks = useMemo(() => chunkWords(words), [words]);
  const idx = chunks.findIndex((c, i) => {
    const next = chunks[i + 1];
    const until = next ? Math.min(next.start, c.end + 0.6) : c.end + 0.6;
    return t >= c.start - 0.05 && t < until;
  });
  if (idx < 0) return null;
  const chunk = chunks[idx];
  const enter = interpolate(t, [chunk.start - 0.05, chunk.start + 0.12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        position: "absolute",
        left: 70,
        right: 70,
        top: zones.captionCenterY,
        transform: `translateY(-50%) translateY(${(1 - enter) * 12}px)`,
        opacity: enter,
        textAlign: "center",
        fontFamily: theme.font,
        fontWeight: 700,
        fontSize: 66,
        lineHeight: 1.2,
        letterSpacing: -0.5,
      }}
    >
      {chunk.words.map((w, i) => {
        const active = t >= w.start - 0.03 && t < (chunk.words[i + 1]?.start ?? w.end + 0.33) - 0.03;
        const spoken = t >= w.start - 0.03;
        return (
          <span
            key={i}
            style={{
              color: active ? theme.white : spoken ? theme.ink : "rgba(31,35,40,0.45)",
              background: active ? theme.accent : "transparent",
              borderRadius: 14,
              padding: "2px 12px",
              margin: "0 2px",
              display: "inline-block",
            }}
          >
            {w.text.replace(/[,;:]$/, "")}
          </span>
        );
      })}
    </div>
  );
};

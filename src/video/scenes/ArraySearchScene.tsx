import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, Easing } from "remotion";
import type { ArraySearchScene as T } from "../types";
import { theme } from "../theme";
import { Heading } from "../components/Text";
import { DrawIcon } from "../components/DrawIcon";
import { useEnter } from "../components/anim";
import { useCueFrames, type SceneProps } from "./common";

type Step = { lo: number; hi: number; mid: number; cmp: -1 | 0 | 1 };

export function binarySteps(values: number[], target: number): Step[] {
  const steps: Step[] = [];
  let lo = 0;
  let hi = values.length - 1;
  while (lo <= hi && steps.length < 8) {
    const mid = Math.floor((lo + hi) / 2);
    const v = values[mid];
    const cmp = v === target ? 0 : v < target ? -1 : 1;
    steps.push({ lo, hi, mid, cmp });
    if (cmp === 0) break;
    if (cmp < 0) lo = mid + 1;
    else hi = mid - 1;
  }
  return steps;
}

const ROW_Y = 760;
const ELIM = 22; // frames after a comparison before the discarded half fades

export const ArraySearchScene: React.FC<SceneProps<T>> = ({ scene, timing }) => {
  const frame = useCurrentFrame();
  const values = [...scene.values].sort((a, b) => a - b);
  const steps = binarySteps(values, scene.target);
  const raw = useCueFrames(timing, steps.map((_, k) => scene.steps[k]?.cue ?? ""));
  // keep steps at least 1s apart so each comparison can be read
  const at: number[] = [];
  raw.forEach((f, k) => at.push(k === 0 ? Math.max(f, 24) : Math.max(f, at[k - 1] + 30)));
  const n = values.length;
  const gap = 12;
  const box = Math.min(104, (960 - gap * (n - 1)) / n);
  const rowW = n * box + (n - 1) * gap;
  const x0 = (1080 - rowW) / 2;
  const cx = (i: number) => x0 + i * (box + gap) + box / 2;

  const intro = useEnter(4, 18);
  let k = -1;
  at.forEach((f, i) => {
    if (frame >= f) k = i;
  });
  const found = steps.length > 0 && steps[steps.length - 1].cmp === 0 && k === steps.length - 1;

  // pointer keyframes: low/high move when the discarded half fades
  const keyT = [0, ...at.map((f) => f + ELIM)];
  const loKeys = [0, ...steps.map((s) => (s.cmp < 0 ? s.mid + 1 : s.lo))];
  const hiKeys = [n - 1, ...steps.map((s) => (s.cmp > 0 ? s.mid - 1 : s.hi))];
  const ptr = (keys: number[]) => {
    let pos = cx(keys[0]);
    for (let i = 1; i < keyT.length; i++) {
      pos = interpolate(frame, [keyT[i], keyT[i] + 12], [pos, cx(keys[i])], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.inOut(Easing.cubic),
      });
    }
    return pos;
  };
  const loX = ptr(loKeys);
  const hiX = ptr(hiKeys);
  let midX = cx(steps[0]?.mid ?? 0);
  at.forEach((f, i) => {
    midX = interpolate(frame, [f - 8, f], [midX, cx(steps[i].mid)], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.cubic),
    });
  });
  const midVis = interpolate(frame, [at[0] - 8, at[0]], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // when is each box ruled out?
  const elimAt = values.map((_, i) => {
    for (let s = 0; s < steps.length; s++) {
      const st = steps[s];
      if (st.cmp === 0) break;
      const nlo = st.cmp < 0 ? st.mid + 1 : st.lo;
      const nhi = st.cmp > 0 ? st.mid - 1 : st.hi;
      if (i < nlo || i > nhi) return at[s] + ELIM;
    }
    return Infinity;
  });

  const cur = k >= 0 ? steps[k] : null;
  const cmpText = cur
    ? cur.cmp === 0
      ? `${values[cur.mid]} = ${scene.target}  Found it!`
      : cur.cmp < 0
        ? `${values[cur.mid]} < ${scene.target}  Go right`
        : `${values[cur.mid]} > ${scene.target}  Go left`
    : "";
  const cmpIn = k >= 0 ? interpolate(frame, [at[k] + 4, at[k] + 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 0;
  const remaining = values.filter((_, i) => frame < elimAt[i] + 6).length;

  const pointer = ({ x, label, y, color, opacity = 1 }: { x: number; label: string; y: number; color: string; opacity?: number }) => (
    <div style={{ position: "absolute", left: x - 70, top: y, width: 140, textAlign: "center", opacity: opacity * intro }}>
      <svg width={28} height={22} viewBox="0 0 28 22" style={{ display: "block", margin: "0 auto" }}>
        <path d="M14 2 L26 20 L2 20 Z" fill={color} />
      </svg>
      <div style={{ fontFamily: theme.font, fontWeight: 600, fontSize: 30, color, marginTop: 4 }}>{label}</div>
    </div>
  );

  return (
    <AbsoluteFill>
      <Heading text={scene.heading} />
      {/* target pill */}
      <div style={{ position: "absolute", top: 500, left: 0, right: 0, display: "flex", justifyContent: "center", opacity: intro }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            fontFamily: theme.font,
            fontWeight: 600,
            fontSize: 40,
            color: theme.ink,
            background: theme.white,
            border: `3px solid ${theme.line}`,
            borderRadius: 999,
            padding: "12px 34px",
          }}
        >
          <DrawIcon name="Search" size={40} at={6} color={theme.accent} strokeWidth={2.4} drawFrames={16} />
          Looking for <span style={{ color: theme.accent, fontWeight: 700 }}>{scene.target}</span>
        </div>
      </div>
      {/* array */}
      {values.map((v, i) => {
        const appear = interpolate(frame, [6 + i * 2, 16 + i * 2], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const gone = Number.isFinite(elimAt[i])
          ? interpolate(frame, [elimAt[i], elimAt[i] + 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
          : 0;
        const isMid = cur && cur.mid === i;
        const isFound = found && cur!.mid === i;
        const pulse = isFound ? 1 + 0.08 * Math.sin(Math.min(1, (frame - at[k]) / 12) * Math.PI) : 1;
        return (
          <div key={i}>
            <div
              style={{
                position: "absolute",
                left: cx(i) - box / 2,
                top: ROW_Y - box / 2 + (1 - appear) * 30 + gone * 18,
                width: box,
                height: box,
                borderRadius: 18,
                background: isMid ? theme.accent : theme.white,
                border: `3px solid ${isMid ? theme.accent : theme.line}`,
                boxShadow: isMid ? "0 12px 28px rgba(47,125,225,0.30)" : "0 4px 12px rgba(31,35,40,0.06)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: theme.font,
                fontWeight: 700,
                fontSize: box * 0.4,
                color: isMid ? theme.white : theme.ink,
                opacity: appear * (1 - 0.78 * gone),
                transform: `scale(${(isMid ? 1.08 : 1) * pulse * (1 - 0.1 * gone)})`,
              }}
            >
              {v}
            </div>
            <div
              style={{
                position: "absolute",
                left: cx(i) - 30,
                width: 60,
                top: ROW_Y - box / 2 - 46,
                textAlign: "center",
                fontFamily: theme.font,
                fontWeight: 500,
                fontSize: 24,
                color: theme.muted,
                opacity: appear * (1 - 0.7 * gone),
              }}
            >
              {i}
            </div>
          </div>
        );
      })}
      {/* pointers */}
      {!found && pointer({ x: loX, y: ROW_Y + box / 2 + 18, label: "low", color: theme.muted })}
      {!found && pointer({ x: hiX, y: ROW_Y + box / 2 + 18, label: "high", color: theme.muted })}
      {pointer({ x: midX, y: ROW_Y + box / 2 + (found ? 18 : 92), label: found ? "found" : "mid", color: theme.accent, opacity: midVis })}
      {/* comparison read-out */}
      <div
        style={{
          position: "absolute",
          top: 1090,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: theme.font,
          fontWeight: 700,
          fontSize: 50,
          color: cur?.cmp === 0 ? theme.accent : theme.ink,
          opacity: cmpIn,
          transform: `translateY(${(1 - cmpIn) * 14}px)`,
          whiteSpace: "pre",
        }}
      >
        {cmpText}
      </div>
      <div
        style={{
          position: "absolute",
          top: 1175,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: theme.font,
          fontWeight: 500,
          fontSize: 32,
          color: theme.muted,
          opacity: k >= 0 ? 1 : 0,
        }}
      >
        {found ? `Found in ${steps.length} checks` : `${remaining} of ${n} left to check`}
      </div>
    </AbsoluteFill>
  );
};

import { describe, expect, it, vi } from "vitest";

// The video theme loads Poppins from /fonts when imported; there is no server in unit tests.
vi.mock("@remotion/fonts", () => ({ loadFont: () => Promise.resolve() }));
import { keyWordIndex } from "./components/Text";
import { transitionAfter } from "./components/motion";
import { increasing, MIN_BEAT, spreadCues } from "./three/cues";
import { MODELS } from "./three/models";
import { timeline } from "./three/Highway";
import { headingLines } from "./scenes/Scene3DScene";
import { PRESETS_3D } from "@/lib/storyboard/types";

describe("3D model library", () => {
  it("has a shot for every preset the writer can pick", () => {
    const readyMade = ["impact", "orbit", "globe", "molecule", "stack"];
    for (const p of PRESETS_3D) expect(readyMade.includes(p) || p in MODELS).toBe(true);
  });

  it("times bullet time so the bullet hits on the second cue and holds until the third", () => {
    const tl = timeline(420, [60, 150, 300]);
    const hit = tl.sim.findIndex((t) => t - tl.fireSim >= tl.toHit);
    expect(Math.abs(hit - 150)).toBeLessThanOrEqual(3);
    expect(tl.backAt).toBeGreaterThanOrEqual(300);
    // Simulated time never runs backwards.
    expect(tl.sim.every((t, i) => i === 0 || t > tl.sim[i - 1])).toBe(true);
  });

  it("estimates how many lines a 3D heading wraps to", () => {
    expect(headingLines("Inside a cell")).toBe(1);
    expect(headingLines("The pump that never stops")).toBe(2);
    expect(headingLines("A much longer heading that runs to three full lines here")).toBe(3);
  });

  it("lands the hit inside a short scene with one late cue", () => {
    const tl = timeline(120, [100]);
    const hit = tl.sim.findIndex((t) => t - tl.fireSim >= tl.toHit);
    expect(hit).toBeGreaterThan(0);
    expect(hit).toBeLessThanOrEqual(120 - 40);
  });

  it("still works with a single cue", () => {
    const tl = timeline(200, [40]);
    expect(Number.isFinite(tl.backAt)).toBe(true);
    expect(tl.sim.findIndex((t) => t - tl.fireSim >= tl.toHit)).toBeGreaterThan(40);
  });
});

describe("3D cue timing", () => {
  it("spreads cues that land on the same frame, keeping their order", () => {
    expect(spreadCues([6, 6, 6])).toEqual([6, 6 + MIN_BEAT, 6 + 2 * MIN_BEAT]);
    expect(spreadCues([10, 40, 42, 100])).toEqual([10, 40, 40 + MIN_BEAT, 100]);
    expect(spreadCues([])).toEqual([]);
  });

  it("makes keyframes strictly increasing for interpolate", () => {
    // The short-impact case: max(0, 6 - 40), three cues on frame 6, then 46.
    const keys = increasing([0, 6, 6, 6, 46]);
    expect(keys).toEqual([0, 6, 7, 8, 46]);
    expect(keys.every((k, i) => i === 0 || k > keys[i - 1])).toBe(true);
  });
});

describe("kinetic headings", () => {
  it("marks the longest word of four letters or more, the later one on a tie", () => {
    expect(keyWordIndex("Types of precipitation".split(" "))).toBe(2);
    expect(keyWordIndex("The journey of water".split(" "))).toBe(1);
    expect(keyWordIndex("Rising into the sky".split(" "))).toBe(0);
    expect(keyWordIndex("Why so hot?".split(" "))).toBe(-1);
  });
});

describe("scene transitions", () => {
  it("varies the transition between scenes, the same way every render", () => {
    expect([0, 1, 2, 3, 4].map(transitionAfter)).toEqual(["push", "zoom", "wipe", "rise", "push"]);
  });
});

import { describe, expect, it, vi } from "vitest";

// The video theme loads Poppins from /fonts when imported; there is no server in unit tests.
vi.mock("@remotion/fonts", () => ({ loadFont: () => Promise.resolve() }));
import { keyWordIndex } from "./components/Text";
import { transitionAfter } from "./components/motion";
import { increasing, MIN_BEAT, spreadCues } from "./three/cues";

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

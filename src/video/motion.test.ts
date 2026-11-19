import { describe, expect, it } from "vitest";
import { keyWordIndex } from "./components/Text";
import { transitionAfter } from "./components/motion";

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

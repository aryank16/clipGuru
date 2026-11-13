import { describe, expect, it } from "vitest";
import { NAV, isActive } from "@/components/shell/nav";
import { initials } from "./initials";

describe("initials", () => {
  it("uses first and last word", () => expect(initials("Aryan K Test")).toBe("AT"));
  it("uses two letters of a single word", () => expect(initials("aryan")).toBe("AR"));
  it("handles empty names", () => expect(initials("   ")).toBe("?"));
});

describe("isActive", () => {
  it("matches the section and pages inside it", () => {
    expect(isActive("/videos", "/videos")).toBe(true);
    expect(isActive("/videos/abc", "/videos")).toBe(true);
  });
  it("does not match a different section with the same prefix", () => {
    expect(isActive("/videos-old", "/videos")).toBe(false);
    expect(isActive("/settings", "/videos")).toBe(false);
  });
  it("lists the three sections in order", () => {
    expect(NAV.map((n) => n.href)).toEqual(["/videos", "/scheduled", "/settings"]);
  });
});

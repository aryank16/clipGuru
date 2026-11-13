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

import { canonicalRedirect } from "./canonical";

describe("canonicalRedirect", () => {
  const app = "https://clip-guru.vercel.app";
  it("leaves the main address alone", () => expect(canonicalRedirect("clip-guru.vercel.app", "/sign-in", app)).toBeNull());
  it("sends a one-off deploy address to the main one, keeping path and query", () =>
    expect(canonicalRedirect("clip-guru-b6hcs3uij-aryan-1674.vercel.app", "/sign-in?next=%2Fvideos", app)).toBe(
      "https://clip-guru.vercel.app/sign-in?next=%2Fvideos",
    ));
  it("does nothing without a host", () => expect(canonicalRedirect(null, "/", app)).toBeNull());
});

import { describe, expect, it } from "vitest";
import { cn } from "./cn";

describe("cn", () => {
  it("lets a later class override an earlier one, token names included", () => {
    expect(cn("text-accent", "text-danger")).toBe("text-danger");
    expect(cn("text-muted", "text-ink")).toBe("text-ink");
    expect(cn("shadow-card", "shadow-pop")).toBe("shadow-pop");
    expect(cn("bg-surface", "bg-danger/10")).toBe("bg-danger/10");
  });
  it("keeps leading-* next to a text size, as Tailwind does", () => {
    expect(cn("leading-[0.95]", "text-5xl")).toBe("leading-[0.95] text-5xl");
  });
  it("does not treat token colours as font sizes", () => {
    expect(cn("text-sm", "text-on-ink")).toBe("text-sm text-on-ink");
  });
});

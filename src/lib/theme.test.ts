import { describe, expect, it } from "vitest";
import { patchMeBody, toMe } from "./me";
import { isThemePref, THEME_PREFS, themeBootScript } from "./theme";

const user = { id: "u1", name: "A", email: "a@x.test" };

describe("theme preference", () => {
  it("offers every theme plus Match my device", () => {
    expect(THEME_PREFS).toEqual(["atelier-light", "atelier-dark", "blueprint", "grove", "system"]);
  });
  it("defaults to Atelier Light, and ignores unknown stored values", () => {
    expect(toMe(user).theme).toBe("atelier-light");
    expect(toMe({ ...user, theme: "neon" }).theme).toBe("atelier-light");
    expect(toMe({ ...user, theme: "grove" }).theme).toBe("grove");
  });
  it("PATCH /api/me accepts only listed themes", () => {
    expect(patchMeBody.safeParse({ theme: "system" }).success).toBe(true);
    expect(patchMeBody.safeParse({ theme: "neon" }).success).toBe(false);
    expect(isThemePref("blueprint")).toBe(true);
  });
  it("boot script applies a remembered theme and ignores junk", () => {
    const run = (cookie: string) => {
      const attrs: Record<string, string> = {};
      const document = { cookie, documentElement: { setAttribute: (k: string, v: string) => (attrs[k] = v) } };
      new Function("document", themeBootScript)(document);
      return attrs["data-theme"];
    };
    expect(run("a=1; cg-theme=atelier-dark")).toBe("atelier-dark");
    expect(run("cg-theme=neon")).toBeUndefined();
    expect(run("")).toBeUndefined();
  });
});

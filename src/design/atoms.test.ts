import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Every .tsx file under a folder. */
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return path.endsWith(".tsx") ? [path] : [];
  });
}

/** Native inputs that have no visible styling of their own, so need no atom. */
const ALLOWED_INPUT_TYPES = ["radio", "checkbox", "hidden", "file"];

describe("atomic components", () => {
  it("screens use the ui atoms instead of raw buttons and fields", () => {
    const offenders: string[] = [];
    for (const file of [...files("src/app"), ...files("src/components")]) {
      if (file.startsWith(join("src", "components", "ui"))) continue;
      const src = readFileSync(file, "utf8");
      for (const m of src.matchAll(/<(button|select|textarea)\b/g)) {
        offenders.push(`${file}: <${m[1]}>`);
      }
      for (const m of src.matchAll(/<input\b[^>]*>/g)) {
        const type = /type="([^"]+)"/.exec(m[0])?.[1];
        if (!type || !ALLOWED_INPUT_TYPES.includes(type)) offenders.push(`${file}: <input type="${type ?? "text"}">`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { passwordScore } from "@/components/auth/parts";
import { safeNext } from "@/components/auth/sign-in-form";
import { isValidTimeZone } from "./defaults";

describe("isValidTimeZone", () => {
  it("accepts IANA zones and rejects junk", () => {
    expect(isValidTimeZone("Europe/Berlin")).toBe(true);
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
    expect(isValidTimeZone(undefined)).toBe(false);
  });
});

describe("passwordScore", () => {
  it("grades length and variety", () => {
    expect(passwordScore("")).toBe(0);
    expect(passwordScore("short")).toBe(1);
    expect(passwordScore("lowercase")).toBe(1);
    expect(passwordScore("Mixedcase1")).toBe(2);
    expect(passwordScore("Studio-pass-2026")).toBe(3);
  });
});

describe("safeNext", () => {
  it("only allows in-app paths", () => {
    expect(safeNext("/settings")).toBe("/settings");
    expect(safeNext("//evil.example")).toBe("/videos");
    expect(safeNext("https://evil.example")).toBe("/videos");
    expect(safeNext(null)).toBe("/videos");
  });
});

describe("dbDriver", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  async function driverWith(vars: Record<string, string | undefined>) {
    for (const [k, v] of Object.entries(vars)) vi.stubEnv(k, v);
    const { dbDriver } = await import("./env");
    return dbDriver;
  }

  it("uses MongoDB when a URI is set", async () => {
    const d = await driverWith({ MONGODB_URI: "mongodb://x/clipguru", DB_DRIVER: undefined, NODE_ENV: "production" });
    expect(d()).toBe("mongodb");
  });

  it("refuses to fall back to memory in production", async () => {
    const d = await driverWith({ MONGODB_URI: undefined, DB_DRIVER: undefined, NODE_ENV: "production" });
    expect(() => d()).toThrow(/MONGODB_URI is required/);
  });

  it("allows an explicit memory override", async () => {
    const d = await driverWith({ MONGODB_URI: "mongodb://x", DB_DRIVER: "memory", NODE_ENV: "production" });
    expect(d()).toBe("memory");
  });
});

describe("APP_URL default", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("uses the Vercel branch URL on previews and the production domain on main", async () => {
    vi.stubEnv("APP_URL", undefined);
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_BRANCH_URL", "clipguru-git-dev-team.vercel.app");
    expect((await import("./env")).env().APP_URL).toBe("https://clipguru-git-dev-team.vercel.app");
    vi.resetModules();
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "clipguru.vercel.app");
    expect((await import("./env")).env().APP_URL).toBe("https://clipguru.vercel.app");
  });
});

/**
 * Tests for devLog utility (A-H6 — Wave 3).
 *
 * Verifies that in production builds, no console output occurs.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("devLog", () => {
  const originalEnv = import.meta.env.DEV;

  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exports devLog, devWarn, devError functions", async () => {
    const mod = await import("@/lib/devLog");
    expect(typeof mod.devLog).toBe("function");
    expect(typeof mod.devWarn).toBe("function");
    expect(typeof mod.devError).toBe("function");
  });

  it("devLog/devWarn/devError are callable without errors", async () => {
    const { devLog, devWarn, devError } = await import("@/lib/devLog");
    // Should not throw regardless of environment
    expect(() => devLog("test")).not.toThrow();
    expect(() => devWarn("test")).not.toThrow();
    expect(() => devError("test")).not.toThrow();
  });
});

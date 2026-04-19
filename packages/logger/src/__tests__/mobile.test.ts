import { describe, expect, it, vi } from "vitest";

import { createMobileLogger } from "../mobile.js";

describe("createMobileLogger", () => {
  function makeConsole() {
    return {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
  }

  it("forwards info/warn/error messages with JSON-serialized payloads", () => {
    const captured = makeConsole();
    const logger = createMobileLogger({ console: captured });

    logger.info("booted", { memberCount: 3 });
    logger.warn("slow", { ms: 1200 });
    logger.error("boom", { reason: "x" });

    expect(captured.info).toHaveBeenCalledWith('booted {"memberCount":3}');
    expect(captured.warn).toHaveBeenCalledWith('slow {"ms":1200}');
    expect(captured.error).toHaveBeenCalledWith('boom {"reason":"x"}');
  });

  it("forwards bare messages when no payload is supplied", () => {
    const captured = makeConsole();
    const logger = createMobileLogger({ console: captured });

    logger.info("ready");

    expect(captured.info).toHaveBeenCalledWith("ready");
  });

  it("applies the redact hook before serialization", () => {
    const captured = makeConsole();
    const logger = createMobileLogger({
      console: captured,
      redact: (payload) => ({ ...payload, email: "[REDACTED]" }),
    });

    logger.info("signup", { email: "u@example.com", plan: "free" });

    expect(captured.info).toHaveBeenCalledWith('signup {"email":"[REDACTED]","plan":"free"}');
  });

  it("defaults console to globalThis.console when unspecified", () => {
    const spy = vi.spyOn(globalThis.console, "info").mockImplementation(() => undefined);
    const logger = createMobileLogger();

    logger.info("default-console");

    expect(spy).toHaveBeenCalledWith("default-console");
    spy.mockRestore();
  });
});

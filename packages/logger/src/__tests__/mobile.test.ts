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

  it("redacts top-level PII keys by default (no redact option)", () => {
    const captured = makeConsole();
    const logger = createMobileLogger({ console: captured });

    logger.info("signup", { email: "u@example.com", plan: "free" });

    expect(captured.info).toHaveBeenCalledWith('signup {"email":"[redacted]","plan":"free"}');
  });

  it("redacts PII in nested objects", () => {
    const captured = makeConsole();
    const logger = createMobileLogger({ console: captured });

    logger.info("req", { user: { email: "u@example.com", name: "ok" }, status: 200 });

    expect(captured.info).toHaveBeenCalledWith(
      'req {"user":{"email":"[redacted]","name":"ok"},"status":200}',
    );
  });

  it("redacts PII inside arrays", () => {
    const captured = makeConsole();
    const logger = createMobileLogger({ console: captured });

    logger.info("batch", {
      users: [{ email: "a@x.com" }, { email: "b@x.com" }],
    });

    expect(captured.info).toHaveBeenCalledWith(
      'batch {"users":[{"email":"[redacted]"},{"email":"[redacted]"}]}',
    );
  });

  it("matches PII keys case-insensitively via substring", () => {
    const captured = makeConsole();
    const logger = createMobileLogger({ console: captured });

    logger.info("tokens", {
      userEmail: "u@x.com",
      AccessToken: "abc",
      apiKeyRef: "k-1",
      safeField: "visible",
    });

    expect(captured.info).toHaveBeenCalledWith(
      'tokens {"userEmail":"[redacted]","AccessToken":"[redacted]","apiKeyRef":"[redacted]","safeField":"visible"}',
    );
  });

  it("allows opting out with redact: null", () => {
    const captured = makeConsole();
    const logger = createMobileLogger({ console: captured, redact: null });

    logger.info("raw", { email: "u@x.com" });

    expect(captured.info).toHaveBeenCalledWith('raw {"email":"u@x.com"}');
  });

  it("survives circular payloads without throwing", () => {
    const captured = makeConsole();
    const logger = createMobileLogger({ console: captured });

    const cyclic: Record<string, unknown> = { a: 1 };
    cyclic["self"] = cyclic;

    expect(() => {
      logger.info("cycle", cyclic);
    }).not.toThrow();
    // Implementation breaks the cycle during redaction and the stringified
    // output still reports the scalar field.
    const call = captured.info.mock.calls[0]?.[0] as string;
    expect(call.startsWith("cycle ")).toBe(true);
  });

  it("survives BigInt payloads without throwing", () => {
    const captured = makeConsole();
    const logger = createMobileLogger({ console: captured });

    expect(() => {
      logger.info("bigint", { n: 9_007_199_254_740_993n });
    }).not.toThrow();
    expect(captured.info).toHaveBeenCalledWith("bigint [unserializable]");
  });
});

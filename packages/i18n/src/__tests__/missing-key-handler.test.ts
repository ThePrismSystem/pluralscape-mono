import { describe, expect, it, vi } from "vitest";

import { createMissingKeyHandler } from "../missing-key-handler.js";

describe("createMissingKeyHandler", () => {
  describe("warn mode", () => {
    it("logs a warning via the provided logger", () => {
      const warnFn = vi.fn();
      const handler = createMissingKeyHandler("warn", { warn: warnFn });

      handler("greeting", "common");

      expect(warnFn).toHaveBeenCalledWith("Missing translation key: common:greeting");
    });

    it("does not throw", () => {
      const handler = createMissingKeyHandler("warn", { warn: vi.fn() });

      expect(() => {
        handler("greeting", "common");
      }).not.toThrow();
    });

    it("throws when mode is 'warn' and no logger provided", () => {
      expect(() => {
        // @ts-expect-error Testing runtime guard — overload requires logger for "warn" mode
        createMissingKeyHandler("warn");
      }).toThrow("Logger is required when missingKeyMode is 'warn'");
    });
  });

  describe("throw mode", () => {
    it("throws an error with the missing key details", () => {
      const handler = createMissingKeyHandler("throw");

      expect(() => {
        handler("greeting", "common");
      }).toThrow("Missing translation key: common:greeting");
    });

    it("includes namespace and key in the error message", () => {
      const handler = createMissingKeyHandler("throw");

      expect(() => {
        handler("loginButton", "auth");
      }).toThrow("Missing translation key: auth:loginButton");
    });

    it("does not require logger when mode is 'throw'", () => {
      expect(() => {
        createMissingKeyHandler("throw");
      }).not.toThrow();
    });
  });
});

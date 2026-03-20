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

    it("is a no-op when no logger is provided", () => {
      const handler = createMissingKeyHandler("warn");

      expect(() => {
        handler("greeting", "common");
      }).not.toThrow();
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
  });
});

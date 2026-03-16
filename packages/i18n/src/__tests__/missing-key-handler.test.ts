import { describe, expect, it, vi } from "vitest";

import { createMissingKeyHandler } from "../missing-key-handler.js";

describe("createMissingKeyHandler", () => {
  describe("warn mode", () => {
    it("logs a warning with the missing key details", () => {
      const handler = createMissingKeyHandler("warn");
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      handler("greeting", "common");

      expect(warnSpy).toHaveBeenCalledWith("Missing translation key: common:greeting");
    });

    it("does not throw", () => {
      const handler = createMissingKeyHandler("warn");
      vi.spyOn(console, "warn").mockImplementation(() => {});

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

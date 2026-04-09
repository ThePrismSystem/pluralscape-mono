import { afterEach, describe, expect, it } from "vitest";


import * as secureStore from "../../../__tests__/expo-secure-store-mock.js";
import { createSpTokenStorage } from "../sp-token-storage.js";

import type { SystemId } from "@pluralscape/types";

const SYSTEM_A = "sys_aaaaaaaaaaaaaaaaaaaaaaaaa" as SystemId;
const SYSTEM_B = "sys_bbbbbbbbbbbbbbbbbbbbbbbbb" as SystemId;

afterEach(() => {
  secureStore.__reset();
});

describe("sp-token-storage", () => {
  describe("get", () => {
    it("returns null when no token has been stored", async () => {
      const storage = createSpTokenStorage();
      const result = await storage.get(SYSTEM_A);
      expect(result).toBeNull();
    });

    it("returns the stored token value", async () => {
      const storage = createSpTokenStorage();
      await storage.set(SYSTEM_A, "sp-token-abc123");
      const result = await storage.get(SYSTEM_A);
      expect(result).toBe("sp-token-abc123");
    });

    it("propagates errors thrown by getItemAsync", async () => {
      const storage = createSpTokenStorage();
      const err = new Error("keychain unavailable");
      secureStore.__throwOnNext("getItemAsync", err);
      await expect(storage.get(SYSTEM_A)).rejects.toThrow("keychain unavailable");
    });
  });

  describe("set", () => {
    it("stores the token under the system-scoped key", async () => {
      const storage = createSpTokenStorage();
      await storage.set(SYSTEM_A, "stored-value");
      expect(secureStore.__snapshot()).toMatchObject({
        [`pluralscape_sp_token_${SYSTEM_A}`]: "stored-value",
      });
    });

    it("propagates errors thrown by setItemAsync", async () => {
      const storage = createSpTokenStorage();
      const err = new Error("write failed");
      secureStore.__throwOnNext("setItemAsync", err);
      await expect(storage.set(SYSTEM_A, "some-token")).rejects.toThrow("write failed");
    });
  });

  describe("clear", () => {
    it("removes only the target system's token", async () => {
      const storage = createSpTokenStorage();
      await storage.set(SYSTEM_A, "token-a");
      await storage.set(SYSTEM_B, "token-b");
      await storage.clear(SYSTEM_A);
      expect(await storage.get(SYSTEM_A)).toBeNull();
      expect(await storage.get(SYSTEM_B)).toBe("token-b");
    });

    it("succeeds when no token exists", async () => {
      const storage = createSpTokenStorage();
      await expect(storage.clear(SYSTEM_A)).resolves.toBeUndefined();
    });

    it("propagates errors thrown by deleteItemAsync", async () => {
      const storage = createSpTokenStorage();
      const err = new Error("delete failed");
      secureStore.__throwOnNext("deleteItemAsync", err);
      await expect(storage.clear(SYSTEM_A)).rejects.toThrow("delete failed");
    });
  });

  describe("hasToken", () => {
    it("returns false before any token is stored", async () => {
      const storage = createSpTokenStorage();
      expect(await storage.hasToken(SYSTEM_A)).toBe(false);
    });

    it("returns true after set", async () => {
      const storage = createSpTokenStorage();
      await storage.set(SYSTEM_A, "abc");
      expect(await storage.hasToken(SYSTEM_A)).toBe(true);
    });

    it("returns false after clear", async () => {
      const storage = createSpTokenStorage();
      await storage.set(SYSTEM_A, "abc");
      await storage.clear(SYSTEM_A);
      expect(await storage.hasToken(SYSTEM_A)).toBe(false);
    });

    it("is scoped per system", async () => {
      const storage = createSpTokenStorage();
      await storage.set(SYSTEM_A, "abc");
      expect(await storage.hasToken(SYSTEM_A)).toBe(true);
      expect(await storage.hasToken(SYSTEM_B)).toBe(false);
    });
  });
});

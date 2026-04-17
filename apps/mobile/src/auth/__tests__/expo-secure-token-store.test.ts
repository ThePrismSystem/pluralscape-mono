import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as secureStore from "../../__tests__/expo-secure-store-mock";
import { createExpoSecureTokenStore } from "../expo-secure-token-store";

// React Native's runtime exposes __DEV__ as a global — vitest (Node) does not.
// Stub it truthy so the DEV-only diagnostic warn in getToken's catch runs.
interface GlobalWithDev {
  __DEV__: boolean;
}

beforeEach(() => {
  (globalThis as Partial<GlobalWithDev>).__DEV__ = true;
});

afterEach(() => {
  secureStore.__reset();
  delete (globalThis as Partial<GlobalWithDev>).__DEV__;
});

describe("expo-secure-token-store", () => {
  describe("getToken", () => {
    it("returns null when no token has been stored", async () => {
      const store = createExpoSecureTokenStore();
      const result = await store.getToken();
      expect(result).toBeNull();
    });

    it("returns the stored token value", async () => {
      const store = createExpoSecureTokenStore();
      await store.setToken("test-token-abc123");
      const result = await store.getToken();
      expect(result).toBe("test-token-abc123");
    });

    it("returns null when getItemAsync throws so boot path treats session as absent", async () => {
      const store = createExpoSecureTokenStore();
      const err = new Error("keychain unavailable");
      secureStore.__throwOnNext("getItemAsync", err);
      await expect(store.getToken()).resolves.toBeNull();
    });

    it("logs a warning when getItemAsync throws (dev only) so keychain failures leave a support breadcrumb", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      const err = new Error("keychain corrupt");
      secureStore.__throwOnNext("getItemAsync", err);
      const store = createExpoSecureTokenStore();
      await expect(store.getToken()).resolves.toBeNull();
      expect(warnSpy).toHaveBeenCalledOnce();
      const firstArg = warnSpy.mock.calls[0]?.[0];
      expect(String(firstArg)).toContain("token-store");
      warnSpy.mockRestore();
    });
  });

  describe("setToken", () => {
    it("stores the token so subsequent getToken returns it", async () => {
      const store = createExpoSecureTokenStore();
      await store.setToken("stored-value-xyz");
      expect(secureStore.__snapshot()).toMatchObject({
        pluralscape_session_token: "stored-value-xyz",
      });
    });

    it("persists with WHEN_UNLOCKED_THIS_DEVICE_ONLY so the token does not travel in device backups", async () => {
      const store = createExpoSecureTokenStore();
      await store.setToken("accessibility-check");
      const opts = secureStore.__lastOptions("pluralscape_session_token");
      expect(opts?.keychainAccessible).toBe(secureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY);
    });

    it("propagates errors thrown by setItemAsync", async () => {
      const store = createExpoSecureTokenStore();
      const err = new Error("write failed");
      secureStore.__throwOnNext("setItemAsync", err);
      await expect(store.setToken("some-token")).rejects.toThrow("write failed");
    });
  });

  describe("clearToken", () => {
    it("removes the stored token", async () => {
      const store = createExpoSecureTokenStore();
      await store.setToken("token-to-clear");
      await store.clearToken();
      const result = await store.getToken();
      expect(result).toBeNull();
    });

    it("succeeds when no token exists", async () => {
      const store = createExpoSecureTokenStore();
      await expect(store.clearToken()).resolves.toBeUndefined();
    });

    it("propagates errors thrown by deleteItemAsync", async () => {
      const store = createExpoSecureTokenStore();
      const err = new Error("delete failed");
      secureStore.__throwOnNext("deleteItemAsync", err);
      await expect(store.clearToken()).rejects.toThrow("delete failed");
    });
  });
});

import { afterEach, describe, expect, it } from "vitest";

import * as secureStore from "../../__tests__/expo-secure-store-mock";
import { createExpoSecureTokenStore } from "../expo-secure-token-store";

afterEach(() => {
  secureStore.__reset();
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

    it("propagates errors thrown by getItemAsync", async () => {
      const store = createExpoSecureTokenStore();
      const err = new Error("keychain unavailable");
      secureStore.__throwOnNext("getItemAsync", err);
      await expect(store.getToken()).rejects.toThrow("keychain unavailable");
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

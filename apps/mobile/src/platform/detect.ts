import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { Platform } from "react-native";

import { createIndexedDbOfflineQueueAdapter } from "./drivers/indexeddb-offline-queue-adapter.js";
import { createIndexedDbStorageAdapter } from "./drivers/indexeddb-storage-adapter.js";

import type { PlatformContext } from "./types.js";
import type { NativeMemzero } from "@pluralscape/crypto";

function hasOpfsSupport(): boolean {
  try {
    return typeof navigator !== "undefined" && typeof navigator.storage.getDirectory === "function";
  } catch {
    return false;
  }
}

async function detectWeb(): Promise<PlatformContext> {
  const crypto = new WasmSodiumAdapter();
  await crypto.init();

  if (hasOpfsSupport()) {
    const { createOpfsSqliteDriver } = await import("./drivers/opfs-sqlite-driver.js");
    const driver = await createOpfsSqliteDriver();
    return {
      capabilities: {
        hasSecureStorage: false,
        hasBiometric: false,
        hasBackgroundSync: false,
        hasNativeMemzero: false,
        storageBackend: "sqlite",
      },
      storage: { backend: "sqlite", driver },
      crypto,
    };
  }

  const storageAdapter = createIndexedDbStorageAdapter();
  const offlineQueueAdapter = createIndexedDbOfflineQueueAdapter();

  return {
    capabilities: {
      hasSecureStorage: false,
      hasBiometric: false,
      hasBackgroundSync: false,
      hasNativeMemzero: false,
      storageBackend: "indexeddb",
    },
    storage: { backend: "indexeddb", storageAdapter, offlineQueueAdapter },
    crypto,
  };
}

async function detectNative(): Promise<PlatformContext> {
  const { ReactNativeSodiumAdapter } = await import("@pluralscape/crypto/react-native");

  let nativeMemzero: NativeMemzero | undefined;
  try {
    const mod = (await import("../../modules/native-memzero/src/index")) as {
      nativeMemzeroFn?: (buffer: Uint8Array) => void;
    };
    if (mod.nativeMemzeroFn) {
      nativeMemzero = { memzero: mod.nativeMemzeroFn };
    }
  } catch {
    // Native memzero module not available — fallback to buffer.fill(0)
  }

  const crypto = new ReactNativeSodiumAdapter(nativeMemzero);
  await crypto.init();

  const { createExpoSqliteDriver } = await import("./drivers/expo-sqlite-driver.js");
  const driver = await createExpoSqliteDriver();

  return {
    capabilities: {
      hasSecureStorage: true,
      hasBiometric: true,
      hasBackgroundSync: true,
      hasNativeMemzero: nativeMemzero !== undefined,
      storageBackend: "sqlite",
    },
    storage: { backend: "sqlite", driver },
    crypto,
  };
}

export async function detectPlatform(): Promise<PlatformContext> {
  if (Platform.OS === "web") {
    return detectWeb();
  }
  return detectNative();
}

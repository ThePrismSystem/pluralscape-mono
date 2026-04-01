import { idbRequest } from "./indexeddb-utils.js";

const DB_NAME = "pluralscape-auth";
const DB_VERSION = 1;
const STORE_TOKENS = "tokens";
const SESSION_KEY = "session";

export interface TokenStore {
  getToken(): Promise<string | null>;
  setToken(token: string): Promise<void>;
  clearToken(): Promise<void>;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_TOKENS)) {
        db.createObjectStore(STORE_TOKENS);
      }
    };
    req.onsuccess = () => {
      resolve(req.result);
    };
    req.onerror = () => {
      reject(new Error(req.error?.message ?? "Failed to open IndexedDB"));
    };
  });
}

interface TokenRecord {
  value: string;
}

/** IndexedDB-backed token store for web auth persistence. */
export function createIndexedDbTokenStore(): TokenStore {
  const dbPromise = openDb();

  return {
    async getToken(): Promise<string | null> {
      const db = await dbPromise;
      const tx = db.transaction(STORE_TOKENS, "readonly");
      const store = tx.objectStore(STORE_TOKENS);
      const result = await idbRequest<TokenRecord | undefined>(
        store.get(SESSION_KEY) as IDBRequest<TokenRecord | undefined>,
      );
      return result?.value ?? null;
    },

    async setToken(token: string): Promise<void> {
      const db = await dbPromise;
      const tx = db.transaction(STORE_TOKENS, "readwrite");
      const store = tx.objectStore(STORE_TOKENS);
      const record: TokenRecord = { value: token };
      await idbRequest(store.put(record, SESSION_KEY));
    },

    async clearToken(): Promise<void> {
      const db = await dbPromise;
      const tx = db.transaction(STORE_TOKENS, "readwrite");
      const store = tx.objectStore(STORE_TOKENS);
      await idbRequest(store.delete(SESSION_KEY));
    },
  };
}

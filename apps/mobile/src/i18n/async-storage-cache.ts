export interface CacheEntry {
  readonly etag: string;
  readonly translations: Readonly<Record<string, string>>;
  readonly fetchedAt: number;
}

export interface AsyncStorageLike {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

const KEY_PREFIX = "@pluralscape:i18n";

function storageKey(locale: string, namespace: string): string {
  return `${KEY_PREFIX}:${locale}:${namespace}`;
}

function isCacheEntry(value: unknown): value is CacheEntry {
  if (value === null || typeof value !== "object") return false;
  const record = value as { etag?: unknown; translations?: unknown; fetchedAt?: unknown };
  if (typeof record.etag !== "string") return false;
  if (typeof record.fetchedAt !== "number") return false;
  if (record.translations === null || typeof record.translations !== "object") return false;
  return true;
}

export class AsyncStorageI18nCache {
  constructor(
    private readonly storage: AsyncStorageLike,
    private readonly ttlMs: number,
  ) {}

  async read(locale: string, namespace: string): Promise<CacheEntry | null> {
    const raw = await this.storage.getItem(storageKey(locale, namespace));
    if (raw === null) return null;
    try {
      const parsed: unknown = JSON.parse(raw);
      return isCacheEntry(parsed) ? parsed : null;
    } catch (err: unknown) {
      globalThis.console.warn(`i18n cache parse failed, evicting: ${locale}/${namespace}`, err);
      await this.storage.removeItem(storageKey(locale, namespace));
      return null;
    }
  }

  async write(locale: string, namespace: string, entry: CacheEntry): Promise<void> {
    await this.storage.setItem(storageKey(locale, namespace), JSON.stringify(entry));
  }

  isFresh(entry: CacheEntry, now: number = Date.now()): boolean {
    return now - entry.fetchedAt <= this.ttlMs;
  }
}

import { trpc } from "@pluralscape/api-client/trpc";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useCallback } from "react";

import { useMasterKey } from "../providers/crypto-provider.js";
import { useActiveSystemId } from "../providers/system-provider.js";

import { DEFAULT_LIST_LIMIT } from "./types.js";
import { useLocalDb, useQuerySource } from "./use-query-source.js";

import type { DataListQuery, DataQuery, SystemIdOverride, TRPCMutation } from "./types.js";
import type { QuerySource } from "./use-query-source.js";
import type { LocalDatabase } from "../data/local-database.js";
import type { KdfMasterKey } from "@pluralscape/crypto";
import type { SystemId } from "@pluralscape/types";
import type { InfiniteData } from "@tanstack/react-query";

/** Allowlist pattern for SQLite table names — lowercase letters and underscores only. */
const VALID_TABLE_NAME = /^[a-z_]+$/;

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

type AppUtils = ReturnType<typeof trpc.useUtils>;

interface OfflineFirstSetup {
  readonly source: QuerySource;
  readonly localDb: LocalDatabase | null;
  readonly systemId: SystemId;
  readonly masterKey: KdfMasterKey | null;
}

/** Page shape returned by every tRPC list procedure. */
interface RawPage<TRaw> {
  readonly data: TRaw[];
  readonly nextCursor: string | null;
}

/** Page shape after decryption / identity transform. */
interface DecPage<TDec> {
  readonly data: TDec[];
  readonly nextCursor: string | null;
}

// ---------------------------------------------------------------------------
// Query config types
// ---------------------------------------------------------------------------

interface UseRemoteGetArgs<TRaw, TDecrypted> {
  readonly systemId: SystemId;
  readonly enabled: boolean;
  readonly select: ((raw: TRaw) => TDecrypted) | undefined;
}

interface OfflineFirstQueryConfigBase<TRaw, TDecrypted> {
  /** React Query cache key segments (e.g. ["members", memberId]). */
  readonly queryKey: readonly unknown[];
  /** SQLite table name for the default local query. */
  readonly table: string;
  /** Primary key column value for single-entity lookup. */
  readonly entityId: string;
  /** Transforms a raw SQLite row into the local domain type. */
  readonly rowTransform: (row: Record<string, unknown>) => TDecrypted;
  /** Override the default `SELECT * FROM <table> WHERE id = ?` query. */
  readonly localQueryFn?: (localDb: LocalDatabase, systemId: SystemId) => TDecrypted;
  readonly systemIdOverride?: SystemIdOverride;
  /**
   * Consumer-provided hook call. The factory cannot call tRPC hooks directly
   * because each entity has unique procedure types.
   */
  readonly useRemote: (args: UseRemoteGetArgs<TRaw, TDecrypted>) => DataQuery<TDecrypted>;
}

/** Config for encrypted entities — decrypt is required. */
interface OfflineFirstQueryConfigEncrypted<TRaw, TDecrypted> extends OfflineFirstQueryConfigBase<
  TRaw,
  TDecrypted
> {
  readonly decrypt: (raw: TRaw, masterKey: KdfMasterKey) => TDecrypted;
}

/** Config for plaintext entities — no decrypt. */
interface OfflineFirstQueryConfigPlain<TRaw, TDecrypted> extends OfflineFirstQueryConfigBase<
  TRaw,
  TDecrypted
> {
  readonly decrypt?: undefined;
}

type OfflineFirstQueryConfig<TRaw, TDecrypted> =
  | OfflineFirstQueryConfigEncrypted<TRaw, TDecrypted>
  | OfflineFirstQueryConfigPlain<TRaw, TDecrypted>;

interface UseRemoteListArgs<TRaw, TDecrypted> {
  readonly systemId: SystemId;
  readonly enabled: boolean;
  readonly select:
    | ((data: InfiniteData<RawPage<TRaw>>) => InfiniteData<DecPage<TDecrypted>>)
    | undefined;
}

interface OfflineFirstInfiniteQueryConfigBase<TRaw, TDecrypted> {
  readonly queryKey: readonly unknown[];
  readonly table: string;
  /** Transforms a raw SQLite row into the local domain type. */
  readonly rowTransform: (row: Record<string, unknown>) => TDecrypted;
  readonly includeArchived?: boolean;
  /** Override the default list SQL. Must apply LIMIT/OFFSET from pagination. */
  readonly localQueryFn?: (
    localDb: LocalDatabase,
    systemId: SystemId,
    pagination: { readonly offset: number; readonly limit: number },
  ) => readonly TDecrypted[];
  readonly systemIdOverride?: SystemIdOverride;
  /** Whether to auto-append resolved systemId to queryKey. Defaults to true. Set false for account-scoped queries. */
  readonly injectSystemId?: boolean;
  readonly useRemote: (args: UseRemoteListArgs<TRaw, TDecrypted>) => DataListQuery<TDecrypted>;
}

interface OfflineFirstInfiniteQueryConfigEncrypted<
  TRaw,
  TDecrypted,
> extends OfflineFirstInfiniteQueryConfigBase<TRaw, TDecrypted> {
  readonly decrypt: (raw: TRaw, masterKey: KdfMasterKey) => TDecrypted;
}

interface OfflineFirstInfiniteQueryConfigPlain<
  TRaw,
  TDecrypted,
> extends OfflineFirstInfiniteQueryConfigBase<TRaw, TDecrypted> {
  readonly decrypt?: undefined;
}

type OfflineFirstInfiniteQueryConfig<TRaw, TDecrypted> =
  | OfflineFirstInfiniteQueryConfigEncrypted<TRaw, TDecrypted>
  | OfflineFirstInfiniteQueryConfigPlain<TRaw, TDecrypted>;

interface DomainMutationConfig<TData, TVars> {
  /** Consumer-provided hook call wrapping the tRPC mutation. */
  readonly useMutation: (opts: {
    onSuccess: (data: TData, vars: TVars) => void;
  }) => TRPCMutation<TData, TVars>;
  /** Cache invalidation callback fired on mutation success. */
  readonly onInvalidate: (utils: AppUtils, systemId: SystemId, data: TData, vars: TVars) => void;
}

// ---------------------------------------------------------------------------
// Remote-only query config types
// ---------------------------------------------------------------------------

interface RemoteOnlyQueryConfig<TResult> {
  readonly systemIdOverride?: SystemIdOverride;
  /**
   * Consumer-provided hook call. The factory resolves systemId and passes it
   * to the consumer's tRPC hook.
   */
  readonly useRemote: (args: { systemId: SystemId; enabled: boolean }) => DataQuery<TResult>;
}

interface RemoteOnlyListConfig<TResult> {
  readonly systemIdOverride?: SystemIdOverride;
  readonly useRemote: (args: { systemId: SystemId; enabled: boolean }) => DataListQuery<TResult>;
}

// ---------------------------------------------------------------------------
// Internal helper — not exported
// ---------------------------------------------------------------------------

/**
 * Consolidates the 5 setup lines that every offline-first hook repeats:
 * query source detection, local database handle, active system resolution,
 * and master key retrieval.
 */
function useOfflineFirstSetup(override?: SystemIdOverride): OfflineFirstSetup {
  const source = useQuerySource();
  const localDb = useLocalDb();
  const activeSystemId = useActiveSystemId();
  const systemId = override?.systemId ?? activeSystemId;
  const masterKey = useMasterKey();
  return { source, localDb, systemId, masterKey };
}

// ---------------------------------------------------------------------------
// Encrypted select helpers — extracted to avoid `as unknown as` casts
// ---------------------------------------------------------------------------

/**
 * Builds a memoized select callback for single-entity decryption.
 * Separated from the factory so the non-null assertion is replaced by
 * a runtime guard that throws if masterKey is unexpectedly null.
 */
function useEncryptedSelect<TRaw, TDecrypted>(
  decrypt: ((raw: TRaw, masterKey: KdfMasterKey) => TDecrypted) | undefined,
  masterKey: KdfMasterKey | null,
): (raw: TRaw) => TDecrypted {
  return useCallback(
    (raw: TRaw): TDecrypted => {
      if (decrypt === undefined) throw new Error("decrypt called on plaintext entity");
      const key = masterKey;
      if (key === null) throw new Error("masterKey is null");
      return decrypt(raw, key);
    },
    [masterKey, decrypt],
  );
}

/**
 * Builds a memoized select callback for page-level list decryption.
 */
function useEncryptedListSelect<TRaw, TDecrypted>(
  decrypt: ((raw: TRaw, masterKey: KdfMasterKey) => TDecrypted) | undefined,
  masterKey: KdfMasterKey | null,
): (data: InfiniteData<RawPage<TRaw>>) => InfiniteData<DecPage<TDecrypted>> {
  return useCallback(
    (data: InfiniteData<RawPage<TRaw>>): InfiniteData<DecPage<TDecrypted>> => {
      if (decrypt === undefined) throw new Error("decrypt called on plaintext entity");
      const key = masterKey;
      if (key === null) throw new Error("masterKey is null");
      return {
        ...data,
        pages: data.pages.map((page) => ({
          data: page.data.map((item) => decrypt(item, key)),
          nextCursor: page.nextCursor,
        })),
      };
    },
    [masterKey, decrypt],
  );
}

// ---------------------------------------------------------------------------
// useOfflineFirstQuery — single-entity get
// ---------------------------------------------------------------------------

/**
 * Factory for single-entity offline-first queries.
 *
 * Handles the source-branching pattern: when offline, reads from local SQLite;
 * when online, delegates to a consumer-provided tRPC hook with optional
 * client-side decryption via `select`.
 */
export function useOfflineFirstQuery<TRaw, TDecrypted>(
  config: OfflineFirstQueryConfig<TRaw, TDecrypted>,
): DataQuery<TDecrypted> {
  if (!VALID_TABLE_NAME.test(config.table)) {
    throw new Error(`Invalid table name: ${config.table}`);
  }

  const { source, localDb, systemId, masterKey } = useOfflineFirstSetup(config.systemIdOverride);

  const encrypted = config.decrypt !== undefined;

  // Always called (rules of hooks) — result only used when encrypted.
  const encryptedSelect = useEncryptedSelect(config.decrypt, masterKey);

  const localQuery = useQuery({
    queryKey: config.queryKey,
    queryFn: () => {
      if (localDb === null) throw new Error("localDb is null");
      if (config.localQueryFn) return config.localQueryFn(localDb, systemId);
      const row = localDb.queryOne(`SELECT * FROM ${config.table} WHERE id = ?`, [config.entityId]);
      if (!row) throw new Error(`${config.table} entity not found`);
      return config.rowTransform(row);
    },
    enabled: source === "local" && localDb !== null,
  });

  const remoteQuery = config.useRemote({
    systemId,
    enabled: source === "remote" && (!encrypted || masterKey !== null),
    select: encrypted ? encryptedSelect : undefined,
  });

  return source === "local" ? localQuery : remoteQuery;
}

// ---------------------------------------------------------------------------
// useOfflineFirstInfiniteQuery — paginated list
// ---------------------------------------------------------------------------

/**
 * Factory for paginated list queries with offline-first source branching.
 *
 * Local mode returns a flat array from SQLite. Remote mode delegates to
 * a consumer-provided tRPC infinite query hook with optional page-level
 * decryption via `select`.
 */
export function useOfflineFirstInfiniteQuery<TRaw, TDecrypted>(
  config: OfflineFirstInfiniteQueryConfig<TRaw, TDecrypted>,
): DataListQuery<TDecrypted> {
  if (!VALID_TABLE_NAME.test(config.table)) {
    throw new Error(`Invalid table name: ${config.table}`);
  }

  const { source, localDb, systemId, masterKey } = useOfflineFirstSetup(config.systemIdOverride);

  const encrypted = config.decrypt !== undefined;
  const includeArchived = config.includeArchived ?? false;
  const shouldInjectSystemId = config.injectSystemId !== false;
  const scopedQueryKey = shouldInjectSystemId ? [...config.queryKey, systemId] : config.queryKey;

  // Always called (rules of hooks) — result only used when encrypted.
  const encryptedListSelect = useEncryptedListSelect(config.decrypt, masterKey);

  const localQuery = useInfiniteQuery({
    queryKey: scopedQueryKey,
    queryFn: ({ pageParam }) => {
      if (localDb === null) throw new Error("localDb is null");
      const offset = pageParam;
      const limit = DEFAULT_LIST_LIMIT;
      let rows: readonly TDecrypted[];
      if (config.localQueryFn) {
        rows = config.localQueryFn(localDb, systemId, { offset, limit });
      } else {
        const archived = includeArchived ? "" : " AND archived = 0";
        const sql = `SELECT * FROM ${config.table} WHERE system_id = ?${archived} ORDER BY created_at DESC LIMIT ${String(limit)} OFFSET ${String(offset)}`;
        rows = localDb.queryAll(sql, [systemId]).map(config.rowTransform);
      }
      return {
        data: rows,
        nextCursor: rows.length === limit ? String(offset + limit) : null,
      };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage: { nextCursor: string | null }) =>
      lastPage.nextCursor !== null ? Number(lastPage.nextCursor) : undefined,
    enabled: source === "local" && localDb !== null,
  });

  const remoteQuery = config.useRemote({
    systemId,
    enabled: source === "remote" && (!encrypted || masterKey !== null),
    select: encrypted ? encryptedListSelect : undefined,
  });

  return source === "local" ? localQuery : remoteQuery;
}

// ---------------------------------------------------------------------------
// useDomainMutation
// ---------------------------------------------------------------------------

/**
 * Factory for domain mutations that follow the standard pattern:
 * resolve systemId, grab tRPC utils, call the consumer-provided mutation
 * hook, and fire cache invalidation on success.
 *
 * For scoped cache invalidation only. Use direct tRPC for broad invalidation
 * (e.g., system purge that clears all domain caches).
 */
export function useDomainMutation<TData, TVars>(
  config: DomainMutationConfig<TData, TVars>,
): TRPCMutation<TData, TVars> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return config.useMutation({
    onSuccess: (data: TData, vars: TVars) => {
      config.onInvalidate(utils, systemId, data, vars);
    },
  });
}

// ---------------------------------------------------------------------------
// useRemoteOnlyQuery — single-entity remote-only get
// ---------------------------------------------------------------------------

/**
 * Factory for single-entity queries that are always remote (no local SQLite).
 * Resolves systemId from context or override, delegates to consumer tRPC hook.
 * The tRPC hook manages its own React Query cache key from procedure path + input.
 */
export function useRemoteOnlyQuery<TResult>(
  config: RemoteOnlyQueryConfig<TResult>,
): DataQuery<TResult> {
  const activeSystemId = useActiveSystemId();
  const systemId = config.systemIdOverride?.systemId ?? activeSystemId;

  return config.useRemote({ systemId, enabled: true });
}

// ---------------------------------------------------------------------------
// useRemoteOnlyList — paginated remote-only list
// ---------------------------------------------------------------------------

/**
 * Factory for paginated list queries that are always remote (no local SQLite).
 * Resolves systemId from context or override, delegates to consumer tRPC hook.
 * The tRPC hook manages its own React Query cache key from procedure path + input.
 */
export function useRemoteOnlyList<TResult>(
  config: RemoteOnlyListConfig<TResult>,
): DataListQuery<TResult> {
  const activeSystemId = useActiveSystemId();
  const systemId = config.systemIdOverride?.systemId ?? activeSystemId;

  return config.useRemote({ systemId, enabled: true });
}

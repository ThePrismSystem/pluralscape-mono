import { trpc } from "@pluralscape/api-client/trpc";
import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";

import { useMasterKey } from "../providers/crypto-provider.js";
import { useActiveSystemId } from "../providers/system-provider.js";

import { useLocalDb, useQuerySource } from "./use-query-source.js";

import type {
  DataListQuery,
  DataQuery,
  SystemIdOverride,
  TRPCError,
  TRPCMutation,
} from "./types.js";
import type { QuerySource } from "./use-query-source.js";
import type { LocalDatabase } from "../data/local-database.js";
import type { KdfMasterKey } from "@pluralscape/crypto";
import type { SystemId } from "@pluralscape/types";
import type { InfiniteData, UseQueryResult } from "@tanstack/react-query";

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
  readonly localQueryFn?: (localDb: LocalDatabase) => TDecrypted;
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
  /** Override the default list SQL. Receives systemId for the WHERE clause. */
  readonly localQueryFn?: (localDb: LocalDatabase, systemId: SystemId) => readonly TDecrypted[];
  readonly systemIdOverride?: SystemIdOverride;
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
  decrypt: (raw: TRaw, masterKey: KdfMasterKey) => TDecrypted,
  masterKey: KdfMasterKey | null,
): (raw: TRaw) => TDecrypted {
  return useCallback(
    (raw: TRaw): TDecrypted => {
      const key = masterKey;
      if (key === null) throw new Error("masterKey is null");
      return decrypt(raw, key);
    },
    // decrypt is a stable module-level function imported by the consumer
    [masterKey, decrypt],
  );
}

/**
 * Builds a memoized select callback for page-level list decryption.
 */
function useEncryptedListSelect<TRaw, TDecrypted>(
  decrypt: (raw: TRaw, masterKey: KdfMasterKey) => TDecrypted,
  masterKey: KdfMasterKey | null,
): (data: InfiniteData<RawPage<TRaw>>) => InfiniteData<DecPage<TDecrypted>> {
  return useCallback(
    (data: InfiniteData<RawPage<TRaw>>): InfiniteData<DecPage<TDecrypted>> => {
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
  const { source, localDb, systemId, masterKey } = useOfflineFirstSetup(config.systemIdOverride);

  const encrypted = config.decrypt !== undefined;

  // Only created when decrypt is provided; identity-returns otherwise.
  // Hooks must be called unconditionally, so we always call this — but
  // only pass the result to useRemote when encrypted.
  // Fallback is never invoked — useEncryptedSelect must always be called
  // (rules of hooks), but select is only passed to useRemote when encrypted.
  const noopDecrypt = useCallback(() => undefined as never, []) as (
    raw: TRaw,
    mk: KdfMasterKey,
  ) => TDecrypted;

  const encryptedSelect = useEncryptedSelect(config.decrypt ?? noopDecrypt, masterKey);

  const localQuery = useQuery({
    queryKey: config.queryKey,
    queryFn: () => {
      if (localDb === null) throw new Error("localDb is null");
      if (config.localQueryFn) return config.localQueryFn(localDb);
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
  const { source, localDb, systemId, masterKey } = useOfflineFirstSetup(config.systemIdOverride);

  const encrypted = config.decrypt !== undefined;
  const includeArchived = config.includeArchived ?? false;

  const noopListDecrypt = useCallback(() => undefined as never, []) as (
    raw: TRaw,
    mk: KdfMasterKey,
  ) => TDecrypted;

  const encryptedListSelect = useEncryptedListSelect(config.decrypt ?? noopListDecrypt, masterKey);

  const localQuery = useQuery({
    queryKey: config.queryKey,
    queryFn: () => {
      if (localDb === null) throw new Error("localDb is null");
      if (config.localQueryFn) return config.localQueryFn(localDb, systemId);
      const sql = includeArchived
        ? `SELECT * FROM ${config.table} WHERE system_id = ? ORDER BY created_at DESC`
        : `SELECT * FROM ${config.table} WHERE system_id = ? AND archived = 0 ORDER BY created_at DESC`;
      return localDb.queryAll(sql, [systemId]).map(config.rowTransform);
    },
    enabled: source === "local" && localDb !== null,
  });

  const remoteQuery = config.useRemote({
    systemId,
    enabled: source === "remote" && (!encrypted || masterKey !== null),
    select: encrypted ? encryptedListSelect : undefined,
  });

  return source === "local"
    ? (localQuery as UseQueryResult<readonly TDecrypted[], Error | TRPCError>)
    : remoteQuery;
}

// ---------------------------------------------------------------------------
// useDomainMutation
// ---------------------------------------------------------------------------

/**
 * Factory for domain mutations that follow the standard pattern:
 * resolve systemId, grab tRPC utils, call the consumer-provided mutation
 * hook, and fire cache invalidation on success.
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

/**
 * Shared E2E persister base for import packages.
 *
 * Creates a Persister backed by real tRPC calls to the E2E API server.
 * Encrypts all payloads with a freshly generated master key and persists
 * them through the real API, verifying the full import pipeline from
 * engine through encryption to server persistence.
 *
 * Source-specific packages provide a `handleCreate` callback that
 * dispatches entity creates to the correct tRPC procedures.
 *
 * Crypto functions and tRPC client are injected by consumers to avoid
 * a circular dependency between test-utils and @pluralscape/crypto /
 * @trpc/client / @pluralscape/api.
 */
import type {
  ImportCollectionType,
  ImportError,
  ImportSourceFormat,
  SystemId,
} from "@pluralscape/types";

/** Batch size for ref upserts (matches mobile persister). */
const REF_BATCH_SIZE = 50;

/** A ref entry queued for batch upsert. */
interface QueuedRef {
  readonly sourceEntityType: ImportCollectionType;
  readonly sourceEntityId: string;
  readonly pluralscapeEntityId: string;
}

/** A generic persistable entity from any import source. */
export interface GenericPersistableEntity {
  readonly entityType: ImportCollectionType;
  readonly sourceEntityId: string;
  readonly source: ImportSourceFormat;
  readonly payload: unknown;
}

/** Result of a persister upsert call. */
export interface PersisterUpsertResult {
  readonly action: "created" | "updated" | "skipped";
  readonly pluralscapeEntityId: string;
}

/** The persister interface consumed by import engines. */
export interface E2EPersister {
  upsertEntity(entity: GenericPersistableEntity): Promise<PersisterUpsertResult>;
  recordError(error: ImportError): Promise<void>;
  flush(): Promise<void>;
}

/**
 * Opaque master key type. Consumers provide the concrete type from
 * @pluralscape/crypto; the persister base only threads it through.
 */
export type MasterKeyBrand = Record<string, never>;

export interface E2EPersisterContext<TMasterKey = MasterKeyBrand> {
  readonly persister: E2EPersister;
  readonly masterKey: TMasterKey;
  readonly systemId: SystemId;
  /** Count of entities created during the import run. */
  readonly getCreatedCount: () => number;
  /** Drain any non-fatal errors recorded by the persister. */
  readonly drainErrors: () => readonly ImportError[];
}

/** Context passed to the source-specific `handleCreate` callback. */
export interface HandleCreateContext<TClient, TMasterKey> {
  readonly trpc: TClient;
  readonly systemId: SystemId;
  readonly masterKey: TMasterKey;
  readonly encryptForApi: (data: unknown, masterKey: TMasterKey) => string;
}

/** Source-specific callback that creates an entity via tRPC. */
export type HandleCreateFn<TClient, TMasterKey> = (
  entity: GenericPersistableEntity,
  ctx: HandleCreateContext<TClient, TMasterKey>,
) => Promise<{ id: string }>;

/** Source-specific callback that updates an entity via tRPC (optional). */
export type HandleUpdateFn<TClient, TMasterKey> = (
  entity: GenericPersistableEntity,
  existingId: string,
  ctx: HandleCreateContext<TClient, TMasterKey>,
) => Promise<PersisterUpsertResult>;

/** Injected crypto operations so test-utils does not depend on @pluralscape/crypto. */
export interface CryptoDeps<TMasterKey> {
  readonly ensureCryptoReady: () => Promise<void>;
  readonly generateMasterKey: () => TMasterKey;
  readonly encryptForApi: (data: unknown, masterKey: TMasterKey) => string;
}

/**
 * Minimal tRPC client shape required by the persister base.
 * Consumers pass the real TRPCClient; this interface captures only
 * the importEntityRef procedures used internally.
 */
/** Input shape for the importEntityRef.upsertBatch.mutate call. */
interface RefUpsertInput {
  systemId: SystemId;
  source: ImportSourceFormat;
  entries: {
    sourceEntityType: ImportCollectionType;
    sourceEntityId: string;
    pluralscapeEntityId: string;
  }[];
}

export interface PersisterTRPCClient {
  readonly importEntityRef: {
    readonly upsertBatch: {
      readonly mutate: (input: RefUpsertInput) => Promise<unknown>;
    };
  };
}

export interface CreateE2EPersisterOptions<TClient extends PersisterTRPCClient, TMasterKey> {
  readonly trpcClient: TClient;
  readonly systemId: SystemId;
  readonly source: ImportSourceFormat;
  readonly crypto: CryptoDeps<TMasterKey>;
  readonly handleCreate: HandleCreateFn<TClient, TMasterKey>;
  readonly handleUpdate?: HandleUpdateFn<TClient, TMasterKey>;
}

/**
 * Create an E2E persister backed by real tRPC calls.
 *
 * The `handleCreate` callback dispatches entity creates to the correct
 * tRPC procedures -- this is the only source-specific logic.
 */
export async function createBaseE2EPersister<TClient extends PersisterTRPCClient, TMasterKey>(
  options: CreateE2EPersisterOptions<TClient, TMasterKey>,
): Promise<E2EPersisterContext<TMasterKey>> {
  const { trpcClient, systemId, source, crypto, handleCreate, handleUpdate } = options;

  await crypto.ensureCryptoReady();
  const masterKey = crypto.generateMasterKey();

  const refQueue: QueuedRef[] = [];
  const errors: ImportError[] = [];
  let createdCount = 0;

  // ID translation: entityType:sourceEntityId -> Pluralscape entity ID
  const idMap = new Map<string, string>();

  const createCtx: HandleCreateContext<TClient, TMasterKey> = {
    trpc: trpcClient,
    systemId,
    masterKey,
    encryptForApi: crypto.encryptForApi,
  };

  async function flushRefs(): Promise<void> {
    while (refQueue.length >= REF_BATCH_SIZE) {
      const batch = refQueue.splice(0, REF_BATCH_SIZE);
      await trpcClient.importEntityRef.upsertBatch.mutate({
        systemId,
        source,
        entries: batch.map((r) => ({
          sourceEntityType: r.sourceEntityType,
          sourceEntityId: r.sourceEntityId,
          pluralscapeEntityId: r.pluralscapeEntityId,
        })),
      });
    }
  }

  async function flushAllRefs(): Promise<void> {
    await flushRefs();
    if (refQueue.length > 0) {
      const batch = refQueue.splice(0, refQueue.length);
      await trpcClient.importEntityRef.upsertBatch.mutate({
        systemId,
        source,
        entries: batch.map((r) => ({
          sourceEntityType: r.sourceEntityType,
          sourceEntityId: r.sourceEntityId,
          pluralscapeEntityId: r.pluralscapeEntityId,
        })),
      });
    }
  }

  function queueRef(entityType: ImportCollectionType, sourceEntityId: string, psId: string): void {
    refQueue.push({
      sourceEntityType: entityType,
      sourceEntityId,
      pluralscapeEntityId: psId,
    });
  }

  async function upsertEntity(entity: GenericPersistableEntity): Promise<PersisterUpsertResult> {
    const key = `${entity.entityType}:${entity.sourceEntityId}`;
    const existingId = idMap.get(key);

    if (existingId !== undefined) {
      if (handleUpdate) {
        return handleUpdate(entity, existingId, createCtx);
      }
      return { action: "updated", pluralscapeEntityId: existingId };
    }

    const result = await handleCreate(entity, createCtx);
    createdCount += 1;
    idMap.set(key, result.id);
    queueRef(entity.entityType, entity.sourceEntityId, result.id);
    await flushRefs();
    return { action: "created", pluralscapeEntityId: result.id };
  }

  const persister: E2EPersister = {
    upsertEntity,
    recordError(error: ImportError): Promise<void> {
      errors.push(error);
      return Promise.resolve();
    },
    async flush(): Promise<void> {
      await flushAllRefs();
    },
  };

  return {
    persister,
    masterKey,
    systemId,
    getCreatedCount: () => createdCount,
    drainErrors: () => errors.splice(0, errors.length),
  };
}

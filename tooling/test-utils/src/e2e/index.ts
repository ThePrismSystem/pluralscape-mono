// Docker container lifecycle
export {
  DOCKER_CONTAINER_NAME,
  DOCKER_PG_PORT,
  MINIO_CONTAINER_NAME,
  MINIO_BUCKET,
  DEFAULT_MINIO_PORT,
  getMinioPort,
  dockerIsAvailable,
  startPostgresContainer,
  waitForPostgres,
  ensureMinioContainer,
  waitForMinio,
  ensureMinioBucket,
} from "./docker.js";

// API server management
export { E2E_PORT, API_BASE_URL, pollHealth, spawnApiServer, killServer } from "./api-server.js";
export type { PollHealthOptions, SpawnedServer } from "./api-server.js";

// Env helper (VITEST stripping)
export { inheritEnvWithoutVitest } from "./api-env.js";

// Stderr classifier
export { createStderrClassifier } from "./classify-pino-stderr.js";
export type {
  StderrClassifier,
  StderrClassifierOptions,
  StderrClassifierResult,
} from "./classify-pino-stderr.js";

// Port-probe helper
export { assertPortFree } from "./assert-port-free.js";

// Account registration
export { registerTestAccount, getSystemId } from "./account.js";
export type { RegisteredAccount } from "./account.js";

// E2E persister base (crypto + tRPC injected by consumers)
export { createBaseE2EPersister } from "./e2e-persister-base.js";
export type {
  CryptoDeps,
  CreateE2EPersisterOptions,
  E2EPersister,
  E2EPersisterContext,
  GenericPersistableEntity,
  HandleCreateContext,
  HandleCreateFn,
  HandleUpdateFn,
  MasterKeyBrand,
  PersisterTRPCClient,
  PersisterUpsertResult,
} from "./e2e-persister-base.js";

// Ref lookup helpers (tRPC injected by consumers via structural typing)
export { lookupRefs, lookupSingleRef, requireRef } from "./ref-helpers.js";
export type { RefLookupTRPCClient } from "./ref-helpers.js";

// Global setup factory
export { createE2EGlobalSetup } from "./setup.js";
export type { E2EGlobalSetupOptions } from "./setup.js";

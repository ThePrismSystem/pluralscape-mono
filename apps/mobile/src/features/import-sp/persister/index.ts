/**
 * Barrel for the persister module. Consumers should only import from
 * this file — the individual `*.persister.ts` files are implementation
 * details.
 */
export { PERSISTER_DISPATCH } from "./persister-dispatch.js";
export type {
  EncryptedInput,
  EncryptedUpdate,
  EntityPersister,
  IdTranslationTable,
  PersisterApi,
  PersisterContext,
  PersisterCreateResult,
  PersisterUpdateResult,
  VersionedEntityRef,
} from "./persister.types.js";

import type { AccountId, ApiKeyId, SystemId } from "@pluralscape/types";

/**
 * DB-level actor type — aligned with the domain `AuditActor` shape so that
 * `InferSelectModel` on the `audit_log` table yields the same `actor` type
 * as `AuditLogEntryServerMetadata.actor`. The underlying PG column is
 * `jsonb` with `.$type<DbAuditActor>()` so branded IDs are preserved from
 * serialization to deserialization.
 */
export type DbAuditActor =
  | { readonly kind: "account"; readonly id: AccountId }
  | { readonly kind: "api-key"; readonly id: ApiKeyId }
  | { readonly kind: "system"; readonly id: SystemId };

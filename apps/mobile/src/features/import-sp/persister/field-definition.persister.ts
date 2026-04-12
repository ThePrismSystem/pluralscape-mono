/**
 * Field definition persister.
 *
 * SP `customFields` → Pluralscape `field_definitions`. The helper
 * encrypts the definition payload and issues `field.create` /
 * `field.update`. Note the routing: the tRPC router exposes this under
 * `field.definition.*`; the `PersisterApi` surface flattens that to
 * `field.create`/`field.update` for brevity.
 */

import { assertPayloadShape, encryptForCreate, encryptForUpdate } from "./persister-helpers.js";

import type {
  EntityPersister,
  PersisterContext,
  PersisterCreateResult,
  PersisterUpdateResult,
} from "./persister.types.js";
import type { FieldType } from "@pluralscape/types";

/**
 * Narrowed shape of `MappedFieldDefinition`. Encrypted fields (name,
 * description, options) are nested under `encrypted`; plaintext
 * structural fields live at the top level.
 */
export interface FieldDefinitionPayload {
  readonly encrypted: {
    readonly name: string;
    readonly description: string | null;
    readonly options: readonly { readonly label: string; readonly color: string | null }[];
  };
  readonly fieldType: FieldType;
  readonly required: boolean;
  readonly sortOrder: number;
}

function isFieldDefinitionPayload(value: unknown): value is FieldDefinitionPayload {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  if (typeof record["encrypted"] !== "object" || record["encrypted"] === null) return false;
  const encrypted = record["encrypted"] as Record<string, unknown>;
  return typeof encrypted["name"] === "string" && typeof record["fieldType"] === "string";
}

async function create(ctx: PersisterContext, payload: unknown): Promise<PersisterCreateResult> {
  const narrowed = assertPayloadShape(payload, isFieldDefinitionPayload, "field-definition");
  const encrypted = encryptForCreate(narrowed.encrypted, ctx.masterKey);
  const result = await ctx.api.field.create(ctx.systemId, {
    encryptedData: encrypted.encryptedData,
    fieldType: narrowed.fieldType,
    required: narrowed.required,
    sortOrder: narrowed.sortOrder,
  });
  return { pluralscapeEntityId: result.id };
}

async function update(
  ctx: PersisterContext,
  payload: unknown,
  existingId: string,
): Promise<PersisterUpdateResult> {
  const narrowed = assertPayloadShape(payload, isFieldDefinitionPayload, "field-definition");
  const encrypted = encryptForUpdate(narrowed.encrypted, 1, ctx.masterKey);
  const result = await ctx.api.field.update(ctx.systemId, existingId, encrypted);
  return { pluralscapeEntityId: result.id };
}

export const fieldDefinitionPersister: EntityPersister = { create, update };

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

/**
 * Narrowed shape of `MappedFieldDefinition`. Ordering and markdown
 * support are part of the plaintext payload, not wire metadata, so they
 * go through the same encryption as the name.
 */
export interface FieldDefinitionPayload {
  readonly name: string;
  readonly fieldType: string;
  readonly order: number;
  readonly supportMarkdown: boolean;
}

function isFieldDefinitionPayload(value: unknown): value is FieldDefinitionPayload {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record["name"] === "string" &&
    typeof record["fieldType"] === "string" &&
    typeof record["order"] === "number"
  );
}

async function create(ctx: PersisterContext, payload: unknown): Promise<PersisterCreateResult> {
  const narrowed = assertPayloadShape(payload, isFieldDefinitionPayload, "field-definition");
  const encrypted = encryptForCreate(narrowed, ctx.masterKey);
  const result = await ctx.api.field.create(ctx.systemId, encrypted);
  return { pluralscapeEntityId: result.id };
}

async function update(
  ctx: PersisterContext,
  payload: unknown,
  existingId: string,
): Promise<PersisterUpdateResult> {
  const narrowed = assertPayloadShape(payload, isFieldDefinitionPayload, "field-definition");
  const encrypted = encryptForUpdate(narrowed, 1, ctx.masterKey);
  const result = await ctx.api.field.update(ctx.systemId, existingId, encrypted);
  return { pluralscapeEntityId: result.id };
}

export const fieldDefinitionPersister: EntityPersister = { create, update };

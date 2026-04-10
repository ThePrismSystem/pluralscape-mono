/**
 * Field value persister (standalone path).
 *
 * SP encodes per-member custom-field values inline on the member
 * document; the engine already extracts them as `ExtractedFieldValue`
 * rows which the member persister fans out inline (see
 * `member.persister.ts`). This standalone helper exists so the
 * dispatch table has a `field-value` entry — in practice it is not
 * called by the engine (there is no `field-values` SP collection) but
 * the dispatch contract requires a per-type handler for exhaustiveness.
 *
 * If invoked directly (e.g. by a future runner that materialises field
 * values as standalone documents), the helper still does the right
 * thing: it resolves the field definition ID through the
 * IdTranslationTable and calls `field.setValue`.
 */

import { assertPayloadShape, encryptForCreate } from "./persister-helpers.js";

import type {
  EntityPersister,
  PersisterContext,
  PersisterCreateResult,
  PersisterUpdateResult,
} from "./persister.types.js";

export interface FieldValuePayload {
  readonly memberSourceId: string;
  readonly fieldSourceId: string;
  readonly value: string;
  /**
   * The Pluralscape member ID the field value belongs to. Resolved by
   * the caller (or the member persister that owns the fan-out) before
   * invoking this helper.
   */
  readonly memberPluralscapeId: string;
}

function isFieldValuePayload(value: unknown): value is FieldValuePayload {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record["memberSourceId"] === "string" &&
    typeof record["fieldSourceId"] === "string" &&
    typeof record["value"] === "string" &&
    typeof record["memberPluralscapeId"] === "string"
  );
}

async function create(ctx: PersisterContext, payload: unknown): Promise<PersisterCreateResult> {
  const narrowed = assertPayloadShape(payload, isFieldValuePayload, "field-value");

  const fieldDefinitionId = ctx.idTranslation.get("field-definition", narrowed.fieldSourceId);
  if (fieldDefinitionId === null) {
    throw new Error(`field-value references unresolved field-definition ${narrowed.fieldSourceId}`);
  }

  const encrypted = encryptForCreate({ value: narrowed.value }, ctx.masterKey);
  const result = await ctx.api.field.setValue(ctx.systemId, {
    memberId: narrowed.memberPluralscapeId,
    fieldDefinitionId,
    encryptedData: encrypted.encryptedData,
  });
  return { pluralscapeEntityId: result.id };
}

async function update(
  ctx: PersisterContext,
  payload: unknown,
  existingId: string,
): Promise<PersisterUpdateResult> {
  // field.setValue is upsert-semantics server-side, so update routes
  // through the same call and returns the existing ID on success.
  const result = await create(ctx, payload);
  return {
    pluralscapeEntityId:
      result.pluralscapeEntityId === "" ? existingId : result.pluralscapeEntityId,
  };
}

export const fieldValuePersister: EntityPersister = { create, update };

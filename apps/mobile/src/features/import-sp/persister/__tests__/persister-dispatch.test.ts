import { describe, expect, it } from "vitest";

import { makeTestPersisterContext } from "../../__tests__/persister-test-helpers.js";
import { PERSISTER_DISPATCH } from "../persister-dispatch.js";

import type { ImportEntityType } from "@pluralscape/types";

/**
 * The set of entity types the SP import engine actually emits. The SP
 * dependency order maps these 17 collections to Pluralscape entity
 * types — see `packages/import-sp/src/engine/dependency-order.ts` and
 * `packages/import-sp/src/engine/entity-type-map.ts`.
 */
const SP_ENGINE_EMITS: readonly ImportEntityType[] = [
  "system-profile",
  "system-settings",
  "privacy-bucket",
  "field-definition",
  "custom-front",
  "member",
  "group",
  "fronting-session",
  "fronting-comment",
  "journal-entry",
  "poll",
  "channel-category",
  "channel",
  "chat-message",
  "board-message",
  "friend",
  "field-value",
];

/**
 * Entity types the persister dispatch table still has to cover to
 * satisfy the `Record<ImportEntityType, EntityPersister>` shape, but
 * which the SP engine never actually emits.
 */
const SP_ENGINE_UNUSED: readonly ImportEntityType[] = [
  "switch",
  "custom-field",
  "note",
  "timer",
  "unknown",
];

describe("PERSISTER_DISPATCH", () => {
  it("exposes a defined entry for every entity type the SP engine emits", () => {
    for (const entityType of SP_ENGINE_EMITS) {
      expect(PERSISTER_DISPATCH[entityType]).toBeDefined();
      expect(typeof PERSISTER_DISPATCH[entityType].create).toBe("function");
      expect(typeof PERSISTER_DISPATCH[entityType].update).toBe("function");
    }
  });

  it("rejects both create and update on the unused entity types", async () => {
    const ctx = makeTestPersisterContext();
    for (const entityType of SP_ENGINE_UNUSED) {
      const helper = PERSISTER_DISPATCH[entityType];
      await expect(helper.create(ctx, {})).rejects.toThrow(/SP import does not emit entity type/);
      await expect(helper.update(ctx, {}, "existing_id")).rejects.toThrow(
        /SP import does not emit entity type/,
      );
    }
  });
});

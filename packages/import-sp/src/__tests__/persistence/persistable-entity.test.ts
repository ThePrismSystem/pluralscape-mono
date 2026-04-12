/**
 * Type-level tests for the {@link PersistableEntity} discriminated union.
 *
 * These assertions exercise the narrowing contract rather than any runtime
 * behaviour: once the engine dispatches on `entityType`, the `payload`
 * property must be typed as the matching `Mapped<Entity>` shape without any
 * casts on the consumer side.
 */
import { describe, expect, expectTypeOf, it } from "vitest";

import type { MappedGroup } from "../../mappers/group.mapper.js";
import type { MappedMember } from "../../mappers/member.mapper.js";
import type { PersistableEntity } from "../../persistence/persister.types.js";

/**
 * Narrow a persistable entity to the member variant. Exercises the
 * discriminated-union narrowing exactly once — consumers that walk the
 * engine's stream of entities rely on this shape.
 */
function narrowMember(entity: PersistableEntity): MappedMember | null {
  if (entity.entityType !== "member") return null;
  expectTypeOf(entity.payload).toEqualTypeOf<MappedMember>();
  return entity.payload;
}

describe("PersistableEntity discriminated union", () => {
  it("narrows payload by entityType", () => {
    const entity: PersistableEntity = {
      entityType: "member",
      sourceEntityId: "sp_1",
      source: "simply-plural",
      payload: {
        encrypted: {
          name: "Alex",
          description: null,
          pronouns: [],
          avatarSource: null,
          colors: [],
          saturationLevel: { kind: "known", level: "highly-elaborated" },
          tags: [],
          suppressFriendFrontNotification: false,
          boardMessageNotificationOnFront: false,
        },
        archived: false,
        fieldValues: [],
        bucketIds: [],
      },
    };
    const narrowed = narrowMember(entity);
    expect(narrowed).not.toBeNull();
    expect(narrowed?.encrypted.name).toBe("Alex");
  });

  it("rejects mismatched payload at the type level", () => {
    const groupPayload: MappedGroup = {
      encrypted: {
        name: "Pod",
        description: null,
        imageSource: null,
        color: null,
        emoji: null,
      },
      parentGroupId: null,
      sortOrder: 0,
      memberIds: [],
    };
    // @ts-expect-error - group payload cannot be assigned to a member entity
    const bad: PersistableEntity = {
      entityType: "member",
      sourceEntityId: "sp_1",
      source: "simply-plural",
      payload: groupPayload,
    };
    expect(bad).toBeDefined();
  });
});

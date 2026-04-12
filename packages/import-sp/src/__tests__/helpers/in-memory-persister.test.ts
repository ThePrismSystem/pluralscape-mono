/**
 * Unit tests for the in-memory persister helper's enhanced semantics.
 *
 * These tests pin the contract the engine relies on when driven against the
 * in-memory persister in integration tests:
 *
 * 1. A content-identical re-upsert returns `action: "skipped"` and reuses
 *    the existing `pluralscapeEntityId`.
 * 2. `pluralscapeEntityId` is deterministic per `(entityType, sourceEntityId)`
 *    across independent persister instances — tests can pin expected IDs
 *    without a running counter.
 * 3. `throwOn` injects a per-entity failure. The `fatal` flag is carried on
 *    the error itself (the engine classifies both fatal and non-fatal errors
 *    via `classifyError`), so the persister simply re-throws the supplied
 *    error and the engine reacts accordingly.
 */
import { describe, expect, it } from "vitest";

import { createInMemoryPersister } from "./in-memory-persister.js";

import type { MappedGroup } from "../../mappers/group.mapper.js";
import type { MappedMember } from "../../mappers/member.mapper.js";
import type { PersistableEntity } from "../../persistence/persister.types.js";

const MEMBER_PAYLOAD: MappedMember = {
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
};

const GROUP_PAYLOAD: MappedGroup = {
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

function memberEntity(sourceEntityId: string, payload: MappedMember): PersistableEntity {
  return {
    entityType: "member",
    sourceEntityId,
    source: "simply-plural",
    payload,
  };
}

function groupEntity(sourceEntityId: string, payload: MappedGroup): PersistableEntity {
  return {
    entityType: "group",
    sourceEntityId,
    source: "simply-plural",
    payload,
  };
}

describe("in-memory persister enhancements", () => {
  it('returns action: "skipped" on a content-identical re-upsert', async () => {
    const { persister } = createInMemoryPersister();
    const entity = memberEntity("sp_1", MEMBER_PAYLOAD);

    const first = await persister.upsertEntity(entity);
    const second = await persister.upsertEntity(entity);

    expect(first.action).toBe("created");
    expect(second.action).toBe("skipped");
    expect(first.pluralscapeEntityId).toBe(second.pluralscapeEntityId);
  });

  it('returns action: "updated" when the payload changes for the same source id', async () => {
    const { persister } = createInMemoryPersister();
    const first = await persister.upsertEntity(memberEntity("sp_1", MEMBER_PAYLOAD));
    const updatedPayload: MappedMember = {
      ...MEMBER_PAYLOAD,
      encrypted: { ...MEMBER_PAYLOAD.encrypted, name: "Alex Renamed" },
    };
    const second = await persister.upsertEntity(memberEntity("sp_1", updatedPayload));

    expect(second.action).toBe("updated");
    expect(second.pluralscapeEntityId).toBe(first.pluralscapeEntityId);
  });

  it("returns deterministic pluralscapeEntityIds per (entityType, sourceEntityId)", async () => {
    const first = createInMemoryPersister();
    const second = createInMemoryPersister();
    const entity = groupEntity("sp_g_1", GROUP_PAYLOAD);

    const r1 = await first.persister.upsertEntity(entity);
    const r2 = await second.persister.upsertEntity(entity);

    expect(r1.pluralscapeEntityId).toBe(r2.pluralscapeEntityId);
  });

  it("returns distinct ids for the same source id under different entity types", async () => {
    const { persister } = createInMemoryPersister();
    const memberResult = await persister.upsertEntity(memberEntity("sp_1", MEMBER_PAYLOAD));
    const groupResult = await persister.upsertEntity(groupEntity("sp_1", GROUP_PAYLOAD));

    expect(memberResult.pluralscapeEntityId).not.toBe(groupResult.pluralscapeEntityId);
  });

  it("respects throwOn with a fatal flag", async () => {
    const fatalErr = Object.assign(new Error("boom"), { fatal: true });
    const { persister } = createInMemoryPersister({
      throwOn: [{ entityType: "member", sourceEntityId: "sp_1", fatal: true, error: fatalErr }],
    });

    await expect(persister.upsertEntity(memberEntity("sp_1", MEMBER_PAYLOAD))).rejects.toBe(
      fatalErr,
    );
  });

  it("respects throwOn with a non-fatal flag", async () => {
    const nonFatalErr = new Error("transient");
    const { persister } = createInMemoryPersister({
      throwOn: [{ entityType: "member", sourceEntityId: "sp_1", fatal: false, error: nonFatalErr }],
    });

    await expect(persister.upsertEntity(memberEntity("sp_1", MEMBER_PAYLOAD))).rejects.toBe(
      nonFatalErr,
    );
  });

  it("only throws for the first matching (entityType, sourceEntityId) occurrence", async () => {
    const failure = new Error("first try");
    const { persister } = createInMemoryPersister({
      throwOn: [
        {
          entityType: "member",
          sourceEntityId: "sp_1",
          fatal: false,
          error: failure,
          once: true,
        },
      ],
    });

    await expect(persister.upsertEntity(memberEntity("sp_1", MEMBER_PAYLOAD))).rejects.toBe(
      failure,
    );
    const second = await persister.upsertEntity(memberEntity("sp_1", MEMBER_PAYLOAD));
    expect(second.action).toBe("created");
  });
});

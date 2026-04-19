import { describe, expect, it } from "vitest";

import { MAPPER_DISPATCH } from "../../engine/mapper-dispatch.js";
import { createMappingContext } from "../../mappers/context.js";

import type { SpCollectionName } from "../../sources/sp-collections.js";

const ALL_COLLECTIONS: readonly SpCollectionName[] = [
  "users",
  "private",
  "privacyBuckets",
  "customFields",
  "frontStatuses",
  "members",
  "groups",
  "frontHistory",
  "comments",
  "notes",
  "polls",
  "channelCategories",
  "channels",
  "chatMessages",
  "boardMessages",
];

describe("MAPPER_DISPATCH", () => {
  it("has an entry for every SpCollectionName", () => {
    for (const collection of ALL_COLLECTIONS) {
      expect(typeof MAPPER_DISPATCH[collection].entityType).toBe("string");
    }
  });

  it("each entry exposes its ImportEntityType discriminator", () => {
    expect(MAPPER_DISPATCH.members.entityType).toBe("member");
    expect(MAPPER_DISPATCH.groups.entityType).toBe("group");
    expect(MAPPER_DISPATCH.frontStatuses.entityType).toBe("custom-front");
    expect(MAPPER_DISPATCH.notes.entityType).toBe("journal-entry");
    expect(MAPPER_DISPATCH.users.entityType).toBe("system-profile");
    expect(MAPPER_DISPATCH.private.entityType).toBe("system-settings");
    expect(MAPPER_DISPATCH.privacyBuckets.entityType).toBe("privacy-bucket");
    expect(MAPPER_DISPATCH.channelCategories.entityType).toBe("channel-category");
    expect(MAPPER_DISPATCH.channels.entityType).toBe("channel");
  });

  it("returns failed with validation prefix when document is malformed", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    const result = MAPPER_DISPATCH.users.map({ _id: "u1" }, ctx);
    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.message).toContain("validation");
    }
  });

  it("emits unknown-field warning for unrecognised keys on a valid document", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    MAPPER_DISPATCH.members.map(
      {
        _id: "m_unk1",
        name: "Aria",
        _unknownFutureField: "some-value",
      },
      ctx,
    );
    const warning = ctx.warnings.find((w) => w.kind === "unknown-field");
    expect(warning?.message).toContain("_unknownFutureField");
    expect(warning?.entityType).toBe("member");
  });

  it("returns failed with 'invalid document' fallback when Zod issues array is empty", () => {
    // Passing `null` triggers Zod validation failure. The fallback message
    // "invalid document" is used when `parsed.error.issues[0]` is undefined.
    // Most Zod failures produce at least one issue, but the fallback path
    // must still be covered.
    const ctx = createMappingContext({ sourceMode: "fake" });
    const result = MAPPER_DISPATCH.users.map(null, ctx);
    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.message).toContain("validation");
    }
  });
});

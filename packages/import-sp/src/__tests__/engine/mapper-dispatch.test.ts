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
  "friends",
  "pendingFriendRequests",
];

describe("MAPPER_DISPATCH", () => {
  it("has an entry for every SpCollectionName", () => {
    for (const collection of ALL_COLLECTIONS) {
      expect(MAPPER_DISPATCH[collection]).toBeDefined();
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
    expect(MAPPER_DISPATCH.friends.entityType).toBe("friend");
    expect(MAPPER_DISPATCH.pendingFriendRequests.entityType).toBe("friend");
  });

  it("users entry maps a valid SP user to system-profile", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    const result = MAPPER_DISPATCH.users.map({ _id: "u1", username: "Aria" }, ctx);
    expect(result.status).toBe("mapped");
  });

  it("private entry maps a valid SP private doc to system-settings", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    const result = MAPPER_DISPATCH.private.map({ _id: "p1" }, ctx);
    expect(result.status).toBe("mapped");
  });

  it("privacyBuckets entry maps a valid bucket", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    const result = MAPPER_DISPATCH.privacyBuckets.map({ _id: "b1", name: "Public" }, ctx);
    expect(result.status).toBe("mapped");
  });

  it("customFields entry maps a valid field definition", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    const result = MAPPER_DISPATCH.customFields.map(
      { _id: "f1", name: "Pronouns", type: "text", order: 0 },
      ctx,
    );
    expect(result.status).toBe("mapped");
  });

  it("frontStatuses entry maps a valid custom front", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    const result = MAPPER_DISPATCH.frontStatuses.map({ _id: "fs1", name: "Dissociated" }, ctx);
    expect(result.status).toBe("mapped");
  });

  it("members entry maps a valid SP member", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    const result = MAPPER_DISPATCH.members.map({ _id: "m1", name: "Aria" }, ctx);
    expect(result.status).toBe("mapped");
  });

  it("members entry returns failed on invalid input", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    const result = MAPPER_DISPATCH.members.map({ _id: "m1" }, ctx);
    expect(result.status).toBe("failed");
  });

  it("groups entry maps a valid group with empty members", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    const result = MAPPER_DISPATCH.groups.map({ _id: "g1", name: "Littles", members: [] }, ctx);
    expect(result.status).toBe("mapped");
  });

  it("frontHistory entry returns failed when member FK is unresolved", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    const result = MAPPER_DISPATCH.frontHistory.map(
      {
        _id: "fh1",
        member: "m_unknown",
        custom: false,
        live: false,
        startTime: 0,
        endTime: 1,
      },
      ctx,
    );
    expect(result.status).toBe("failed");
  });

  it("comments entry returns failed when fronting-session FK is unresolved", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    const result = MAPPER_DISPATCH.comments.map(
      { _id: "c1", documentId: "fh_unknown", text: "hi", time: 0 },
      ctx,
    );
    expect(result.status).toBe("failed");
  });

  it("notes entry returns failed when member FK is unresolved", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    const result = MAPPER_DISPATCH.notes.map(
      { _id: "n1", title: "T", note: "body", date: 0, member: "m_unknown" },
      ctx,
    );
    expect(result.status).toBe("failed");
  });

  it("polls entry maps a valid poll", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    const result = MAPPER_DISPATCH.polls.map(
      { _id: "p1", name: "Pizza?", options: [{ id: "yes", name: "Yes" }] },
      ctx,
    );
    expect(result.status).toBe("mapped");
  });

  it("channelCategories entry maps a valid category", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    const result = MAPPER_DISPATCH.channelCategories.map({ _id: "cc1", name: "General" }, ctx);
    expect(result.status).toBe("mapped");
  });

  it("channels entry maps a valid channel with null parent", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    const result = MAPPER_DISPATCH.channels.map(
      { _id: "ch1", name: "lounge", parentCategory: null },
      ctx,
    );
    expect(result.status).toBe("mapped");
  });

  it("chatMessages entry returns failed when channel FK is unresolved", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    const result = MAPPER_DISPATCH.chatMessages.map(
      {
        _id: "cm1",
        channel: "ch_unknown",
        writer: "m_unknown",
        message: "hi",
        writtenAt: 0,
      },
      ctx,
    );
    expect(result.status).toBe("failed");
  });

  it("boardMessages entry returns failed when writer FK is unresolved", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    const result = MAPPER_DISPATCH.boardMessages.map(
      { _id: "bm1", title: "T", message: "M", writer: "m_unknown", writtenAt: 0 },
      ctx,
    );
    expect(result.status).toBe("failed");
  });

  it("friends entry maps a valid friend", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    const result = MAPPER_DISPATCH.friends.map({ _id: "fr1", frienduid: "remote-1" }, ctx);
    expect(result.status).toBe("mapped");
  });

  it("pendingFriendRequests entry maps a valid pending request", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    const result = MAPPER_DISPATCH.pendingFriendRequests.map(
      { _id: "pfr1", sender: "remote-1", receiver: "self", time: 0 },
      ctx,
    );
    expect(result.status).toBe("mapped");
  });

  it("returns failed with validation prefix when document is malformed", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    const result = MAPPER_DISPATCH.users.map({ _id: "u1" }, ctx);
    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.message).toContain("validation");
    }
  });
});

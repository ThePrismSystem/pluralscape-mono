import { describe, expect, it } from "vitest";

import { SP_COLLECTION_NAMES, isSpCollectionName } from "../../sources/sp-collections.js";

describe("SP_COLLECTION_NAMES", () => {
  it("includes every user-content collection from the design spec", () => {
    expect(SP_COLLECTION_NAMES).toContain("members");
    expect(SP_COLLECTION_NAMES).toContain("frontStatuses");
    expect(SP_COLLECTION_NAMES).toContain("groups");
    expect(SP_COLLECTION_NAMES).toContain("customFields");
    expect(SP_COLLECTION_NAMES).toContain("frontHistory");
    expect(SP_COLLECTION_NAMES).toContain("comments");
    expect(SP_COLLECTION_NAMES).toContain("notes");
    expect(SP_COLLECTION_NAMES).toContain("polls");
    expect(SP_COLLECTION_NAMES).toContain("channelCategories");
    expect(SP_COLLECTION_NAMES).toContain("channels");
    expect(SP_COLLECTION_NAMES).toContain("chatMessages");
    expect(SP_COLLECTION_NAMES).toContain("boardMessages");
    expect(SP_COLLECTION_NAMES).toContain("privacyBuckets");
    expect(SP_COLLECTION_NAMES).toContain("friends");
    expect(SP_COLLECTION_NAMES).toContain("pendingFriendRequests");
    expect(SP_COLLECTION_NAMES).toContain("users");
    expect(SP_COLLECTION_NAMES).toContain("private");
  });

  it("does NOT include skipped collections (reminders, telemetry, auth)", () => {
    expect(SP_COLLECTION_NAMES).not.toContain("automatedReminders");
    expect(SP_COLLECTION_NAMES).not.toContain("repeatedReminders");
    expect(SP_COLLECTION_NAMES).not.toContain("events");
    expect(SP_COLLECTION_NAMES).not.toContain("messages");
    expect(SP_COLLECTION_NAMES).not.toContain("tokens");
    expect(SP_COLLECTION_NAMES).not.toContain("securityLogs");
  });

  it("isSpCollectionName narrows unknown strings", () => {
    expect(isSpCollectionName("members")).toBe(true);
    expect(isSpCollectionName("nonsense")).toBe(false);
  });
});

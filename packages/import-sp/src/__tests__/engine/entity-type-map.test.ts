import { describe, expect, it } from "vitest";

import { collectionToEntityType, entityTypeToCollection } from "../../engine/entity-type-map.js";

describe("entity-type-map", () => {
  it("maps members → member", () => {
    expect(collectionToEntityType("members")).toBe("member");
  });
  it("maps frontStatuses → custom-front", () => {
    expect(collectionToEntityType("frontStatuses")).toBe("custom-front");
  });
  it("maps frontHistory → fronting-session", () => {
    expect(collectionToEntityType("frontHistory")).toBe("fronting-session");
  });
  it("maps comments → fronting-comment", () => {
    expect(collectionToEntityType("comments")).toBe("fronting-comment");
  });
  it("maps notes → journal-entry", () => {
    expect(collectionToEntityType("notes")).toBe("journal-entry");
  });
  it("maps privacyBuckets → privacy-bucket", () => {
    expect(collectionToEntityType("privacyBuckets")).toBe("privacy-bucket");
  });
  it("entityTypeToCollection inverses the mapping", () => {
    expect(entityTypeToCollection("member")).toBe("members");
    expect(entityTypeToCollection("custom-front")).toBe("frontStatuses");
  });

  it("entityTypeToCollection throws for an entity type with no SP collection mapping", () => {
    // "switch" and "timer" exist as ImportCollectionType but have no SP collection
    expect(() => entityTypeToCollection("switch")).toThrow(/No SP collection mapping/);
  });
});

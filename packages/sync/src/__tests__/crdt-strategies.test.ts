import { describe, expect, it } from "vitest";

import { ENTITY_CRDT_STRATEGIES, type CrdtStorageType } from "../strategies/crdt-strategies.js";

import type { SyncDocumentType } from "../document-types.js";

const VALID_STORAGE_TYPES: readonly CrdtStorageType[] = [
  "lww-map",
  "append-only",
  "append-lww",
  "junction-map",
  "singleton-lww",
];

const VALID_DOCUMENT_TYPES: readonly SyncDocumentType[] = [
  "system-core",
  "fronting",
  "chat",
  "journal",
  "privacy-config",
  "bucket",
];

const ALL_ENTITY_TYPES = Object.keys(ENTITY_CRDT_STRATEGIES);

describe("ENTITY_CRDT_STRATEGIES registry", () => {
  it("has entries for all expected entity types", () => {
    const expected = [
      // system-core entities
      "system",
      "system-settings",
      "member",
      "member-photo",
      "group",
      "structure-entity-type",
      "structure-entity",
      "relationship",
      "custom-front",
      "field-definition",
      "field-value",
      "innerworld-entity",
      "innerworld-region",
      "timer",
      "lifecycle-event",
      // system-core structure links
      "structure-entity-link",
      "structure-entity-member-link",
      "structure-entity-association",
      // system-core junctions
      "group-membership",
      // fronting
      "fronting-session",
      "fronting-comment",
      "check-in-record",
      // chat
      "channel",
      "message",
      "board-message",
      "poll",
      "poll-option",
      "poll-vote",
      "acknowledgement",
      // journal
      "journal-entry",
      "wiki-page",
      "note",
      // privacy-config
      "bucket",
      "bucket-content-tag",
      "friend-connection",
      "friend-code",
      "key-grant",
    ];

    for (const entityType of expected) {
      expect(ALL_ENTITY_TYPES, `Missing strategy for entity type: ${entityType}`).toContain(
        entityType,
      );
    }
  });

  it("every strategy has a valid storageType", () => {
    for (const [entityType, strategy] of Object.entries(ENTITY_CRDT_STRATEGIES)) {
      expect(
        VALID_STORAGE_TYPES,
        `Invalid storageType for ${entityType}: ${strategy.storageType}`,
      ).toContain(strategy.storageType);
    }
  });

  it("every strategy has a valid document type", () => {
    for (const [entityType, strategy] of Object.entries(ENTITY_CRDT_STRATEGIES)) {
      expect(
        VALID_DOCUMENT_TYPES,
        `Invalid document for ${entityType}: ${strategy.document}`,
      ).toContain(strategy.document);
    }
  });

  it("every strategy has a non-empty mutationSemantics description", () => {
    for (const [entityType, strategy] of Object.entries(ENTITY_CRDT_STRATEGIES)) {
      expect(
        strategy.mutationSemantics.length,
        `Empty mutationSemantics for ${entityType}`,
      ).toBeGreaterThan(0);
    }
  });

  it("junction-map strategies are all in system-core or privacy-config", () => {
    for (const [entityType, strategy] of Object.entries(ENTITY_CRDT_STRATEGIES)) {
      if (strategy.storageType === "junction-map") {
        expect(
          ["system-core", "privacy-config"],
          `Junction ${entityType} should be in system-core or privacy-config`,
        ).toContain(strategy.document);
      }
    }
  });

  it("append-only strategies have correct documents", () => {
    const appendOnly = Object.entries(ENTITY_CRDT_STRATEGIES).filter(
      ([, s]) => s.storageType === "append-only",
    );
    for (const [entityType, strategy] of appendOnly) {
      // append-only entities: lifecycle-event (system-core),
      // message, poll-vote (chat)
      expect(
        ["system-core", "fronting", "chat"],
        `append-only entity ${entityType} has unexpected document ${strategy.document}`,
      ).toContain(strategy.document);
    }
  });

  it("singleton-lww strategies are system, system-settings, or channel", () => {
    const singletons = Object.entries(ENTITY_CRDT_STRATEGIES).filter(
      ([, s]) => s.storageType === "singleton-lww",
    );
    const singletonKeys = singletons.map(([k]) => k);
    expect(singletonKeys).toContain("system");
    expect(singletonKeys).toContain("system-settings");
    expect(singletonKeys).toContain("channel");
  });

  it("topology corrections are documented in check-in-record and board-message", () => {
    const checkIn = ENTITY_CRDT_STRATEGIES["check-in-record"];
    expect(checkIn.storageType).toBe("append-lww");
    expect(checkIn.mutationSemantics).toContain("topology correction");

    const boardMsg = ENTITY_CRDT_STRATEGIES["board-message"];
    expect(boardMsg.storageType).toBe("append-lww");
    expect(boardMsg.mutationSemantics).toContain("topology correction");
  });

  it("structure entity link strategies are lww-map in system-core", () => {
    for (const key of [
      "structure-entity-link",
      "structure-entity-member-link",
      "structure-entity-association",
    ] as const) {
      const strategy = ENTITY_CRDT_STRATEGIES[key];
      expect(strategy.storageType, `${key} should be lww-map`).toBe("lww-map");
      expect(strategy.document, `${key} should be in system-core`).toBe("system-core");
    }
  });

  it("hasSortOrder is set on structure entity link and member link", () => {
    expect(ENTITY_CRDT_STRATEGIES["structure-entity-link"].hasSortOrder).toBe(true);
    expect(ENTITY_CRDT_STRATEGIES["structure-entity-member-link"].hasSortOrder).toBe(true);
    expect("hasSortOrder" in ENTITY_CRDT_STRATEGIES["structure-entity-association"]).toBe(false);
  });

  it("sortGroupField is set correctly for parent-scoped sort normalization", () => {
    expect(ENTITY_CRDT_STRATEGIES["structure-entity-link"].sortGroupField).toBe("parentEntityId");
    expect(ENTITY_CRDT_STRATEGIES["structure-entity-member-link"].sortGroupField).toBe(
      "parentEntityId",
    );
    expect("sortGroupField" in ENTITY_CRDT_STRATEGIES["structure-entity-association"]).toBe(false);
  });

  it("link strategy mutationSemantics distinguish mutable from immutable fields", () => {
    const link = ENTITY_CRDT_STRATEGIES["structure-entity-link"];
    expect(link.mutationSemantics).toContain("immutable after creation");
    expect(link.mutationSemantics).toContain("sortOrder");

    const memberLink = ENTITY_CRDT_STRATEGIES["structure-entity-member-link"];
    expect(memberLink.mutationSemantics).toContain("immutable after creation");
    expect(memberLink.mutationSemantics).toContain("sortOrder");

    const assoc = ENTITY_CRDT_STRATEGIES["structure-entity-association"];
    expect(assoc.mutationSemantics).toContain("immutable after creation");
    expect(assoc.mutationSemantics).toContain("archived");
  });
});

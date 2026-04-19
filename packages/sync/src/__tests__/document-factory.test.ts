import * as Automerge from "@automerge/automerge";
import { describe, expect, it } from "vitest";

import {
  createBucketDocument,
  createChatDocument,
  createDocument,
  createFrontingDocument,
  createJournalDocument,
  createNoteDocument,
  createPrivacyConfigDocument,
  createSystemCoreDocument,
} from "../factories/document-factory.js";

import type { SyncDocumentType } from "../document-types.js";

const ALL_DOCUMENT_TYPES: readonly SyncDocumentType[] = [
  "system-core",
  "fronting",
  "chat",
  "journal",
  "note",
  "privacy-config",
  "bucket",
];

describe("Document factories", () => {
  describe("createSystemCoreDocument", () => {
    it("produces a valid Automerge doc with all required maps", () => {
      const doc = createSystemCoreDocument();
      // All maps initialized as empty plain objects
      expect(doc.members).toEqual({});
      expect(doc.groups).toEqual({});
      expect(doc.structureEntityTypes).toEqual({});
      expect(doc.structureEntities).toEqual({});
      expect(doc.relationships).toEqual({});
      expect(doc.customFronts).toEqual({});
      expect(doc.fieldDefinitions).toEqual({});
      expect(doc.fieldValues).toEqual({});
      expect(doc.innerWorldEntities).toEqual({});
      expect(doc.innerWorldRegions).toEqual({});
      expect(doc.timers).toEqual({});
      expect(doc.lifecycleEvents).toEqual({});
    });

    it("all entity maps are initially empty", () => {
      const doc = createSystemCoreDocument();
      for (const key of [
        "members",
        "memberPhotos",
        "groups",
        "structureEntityTypes",
        "structureEntities",
        "structureEntityLinks",
        "structureEntityMemberLinks",
        "structureEntityAssociations",
        "relationships",
        "customFronts",
        "fieldDefinitions",
        "fieldValues",
        "innerWorldEntities",
        "innerWorldRegions",
        "timers",
        "lifecycleEvents",
      ] as const) {
        expect(Object.keys(doc[key])).toHaveLength(0);
      }
    });

    it("junction map groupMemberships is initially empty", () => {
      const doc = createSystemCoreDocument();
      expect(Object.keys(doc.groupMemberships)).toHaveLength(0);
    });

    it("lifecycle events map is initially empty", () => {
      const doc = createSystemCoreDocument();
      expect(Object.keys(doc.lifecycleEvents)).toHaveLength(0);
    });

    it("survives save/load roundtrip", () => {
      const doc = createSystemCoreDocument();
      const bytes = Automerge.save(doc);
      const loaded = Automerge.load<typeof doc>(bytes);
      expect(Object.keys(loaded.members)).toHaveLength(0);
    });
  });

  describe("createFrontingDocument", () => {
    it("produces a valid Automerge doc with all required collections", () => {
      const doc = createFrontingDocument();
      expect(doc.sessions).toEqual({});
      expect(doc.comments).toEqual({});
      expect(doc.checkInRecords).toEqual({});
    });

    it("all collections are initially empty", () => {
      const doc = createFrontingDocument();
      expect(Object.keys(doc.sessions)).toHaveLength(0);
      expect(Object.keys(doc.comments)).toHaveLength(0);
      expect(Object.keys(doc.checkInRecords)).toHaveLength(0);
    });

    it("survives save/load roundtrip", () => {
      const doc = createFrontingDocument();
      const bytes = Automerge.save(doc);
      const loaded = Automerge.load<typeof doc>(bytes);
      expect(Object.keys(loaded.sessions)).toHaveLength(0);
    });
  });

  describe("createChatDocument", () => {
    it("produces a valid Automerge doc with channel singleton and collections", () => {
      const doc = createChatDocument();
      // channel is a singleton object; collections start empty
      expect(typeof doc.channel).toBe("object");
      expect(doc.boardMessages).toEqual({});
      expect(doc.polls).toEqual({});
      expect(doc.pollOptions).toEqual({});
      expect(doc.acknowledgements).toEqual({});
      expect(doc.messages).toEqual([]);
      expect(doc.votes).toEqual([]);
    });

    it("all collections are initially empty", () => {
      const doc = createChatDocument();
      expect(Object.keys(doc.boardMessages)).toHaveLength(0);
      expect(Object.keys(doc.polls)).toHaveLength(0);
      expect(doc.messages).toHaveLength(0);
      expect(doc.votes).toHaveLength(0);
    });

    it("survives save/load roundtrip", () => {
      const doc = createChatDocument();
      const bytes = Automerge.save(doc);
      const loaded = Automerge.load<typeof doc>(bytes);
      expect(Object.keys(loaded.boardMessages)).toHaveLength(0);
    });
  });

  describe("createJournalDocument", () => {
    it("produces a valid Automerge doc with all required maps", () => {
      const doc = createJournalDocument();
      expect(doc.entries).toEqual({});
      expect(doc.wikiPages).toEqual({});
    });

    it("all maps are initially empty", () => {
      const doc = createJournalDocument();
      expect(Object.keys(doc.entries)).toHaveLength(0);
      expect(Object.keys(doc.wikiPages)).toHaveLength(0);
    });

    it("survives save/load roundtrip", () => {
      const doc = createJournalDocument();
      const bytes = Automerge.save(doc);
      const loaded = Automerge.load<typeof doc>(bytes);
      expect(Object.keys(loaded.entries)).toHaveLength(0);
    });
  });

  describe("createNoteDocument", () => {
    it("produces a valid Automerge doc with notes map", () => {
      const doc = createNoteDocument();
      expect(doc.notes).toEqual({});
    });

    it("notes map is initially empty", () => {
      const doc = createNoteDocument();
      expect(Object.keys(doc.notes)).toHaveLength(0);
    });

    it("survives save/load roundtrip", () => {
      const doc = createNoteDocument();
      const bytes = Automerge.save(doc);
      const loaded = Automerge.load<typeof doc>(bytes);
      expect(Object.keys(loaded.notes)).toHaveLength(0);
    });
  });

  describe("createPrivacyConfigDocument", () => {
    it("produces a valid Automerge doc with all required maps", () => {
      const doc = createPrivacyConfigDocument();
      expect(doc.buckets).toEqual({});
      expect(doc.contentTags).toEqual({});
      expect(doc.friendConnections).toEqual({});
      expect(doc.friendCodes).toEqual({});
      expect(doc.keyGrants).toEqual({});
    });

    it("initializes fieldBucketVisibility as an empty object", () => {
      const doc = createPrivacyConfigDocument();
      expect(doc.fieldBucketVisibility).toEqual({});
    });

    it("allows writing to fieldBucketVisibility after creation", () => {
      const doc = createPrivacyConfigDocument();
      const updated = Automerge.change(doc, (d) => {
        const fbv = d.fieldBucketVisibility;
        if (fbv) fbv["fieldDef1_bucket1"] = true;
      });
      const fbv = updated.fieldBucketVisibility;
      expect(fbv?.["fieldDef1_bucket1"]).toBe(true);
    });

    it("all maps are initially empty", () => {
      const doc = createPrivacyConfigDocument();
      for (const key of [
        "buckets",
        "contentTags",
        "friendConnections",
        "friendCodes",
        "keyGrants",
        "fieldBucketVisibility",
      ] as const) {
        const val = doc[key];
        expect(Object.keys(val ?? {})).toHaveLength(0);
      }
    });

    it("survives save/load roundtrip", () => {
      const doc = createPrivacyConfigDocument();
      const bytes = Automerge.save(doc);
      const loaded = Automerge.load<typeof doc>(bytes);
      expect(Object.keys(loaded.buckets)).toHaveLength(0);
    });
  });

  describe("createBucketDocument", () => {
    it("produces a valid Automerge doc with all projection maps", () => {
      const doc = createBucketDocument();
      expect(doc.members).toEqual({});
      expect(doc.memberPhotos).toEqual({});
      expect(doc.groups).toEqual({});
      expect(doc.customFronts).toEqual({});
      expect(doc.fieldDefinitions).toEqual({});
      expect(doc.fieldValues).toEqual({});
      expect(doc.frontingSessions).toEqual({});
      expect(doc.notes).toEqual({});
      expect(doc.journalEntries).toEqual({});
      expect(doc.channels).toEqual({});
      expect(doc.messages).toEqual([]);
    });

    it("all maps and lists are initially empty", () => {
      const doc = createBucketDocument();
      expect(Object.keys(doc.members)).toHaveLength(0);
      expect(doc.messages).toHaveLength(0);
    });

    it("survives save/load roundtrip", () => {
      const doc = createBucketDocument();
      const bytes = Automerge.save(doc);
      const loaded = Automerge.load<typeof doc>(bytes);
      expect(Object.keys(loaded.members)).toHaveLength(0);
    });
  });

  describe("createDocument (generic factory)", () => {
    it("produces a valid doc for every SyncDocumentType", () => {
      for (const type of ALL_DOCUMENT_TYPES) {
        const doc = createDocument(type);
        expect(typeof doc, `createDocument("${type}") should return an object`).toBe("object");
      }
    });

    it("each returned doc survives save/load roundtrip", () => {
      for (const type of ALL_DOCUMENT_TYPES) {
        const doc = createDocument(type);
        const bytes = Automerge.save(doc as Automerge.Doc<Record<string, unknown>>);
        const loaded = Automerge.load<Record<string, unknown>>(bytes);
        expect(typeof loaded, `Roundtrip failed for type: ${type}`).toBe("object");
      }
    });
  });
});

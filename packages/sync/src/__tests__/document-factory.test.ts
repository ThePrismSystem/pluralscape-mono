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
      expect(doc.members).toBeDefined();
      expect(doc.groups).toBeDefined();
      expect(doc.structureEntityTypes).toBeDefined();
      expect(doc.structureEntities).toBeDefined();
      expect(doc.relationships).toBeDefined();
      expect(doc.customFronts).toBeDefined();
      expect(doc.fieldDefinitions).toBeDefined();
      expect(doc.fieldValues).toBeDefined();
      expect(doc.innerWorldEntities).toBeDefined();
      expect(doc.innerWorldRegions).toBeDefined();
      expect(doc.timers).toBeDefined();
      expect(doc.lifecycleEvents).toBeDefined();
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
      const loaded = Automerge.load(bytes);
      expect(loaded).toBeDefined();
    });
  });

  describe("createFrontingDocument", () => {
    it("produces a valid Automerge doc with all required collections", () => {
      const doc = createFrontingDocument();
      expect(doc.sessions).toBeDefined();
      expect(doc.comments).toBeDefined();
      expect(doc.checkInRecords).toBeDefined();
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
      const loaded = Automerge.load(bytes);
      expect(loaded).toBeDefined();
    });
  });

  describe("createChatDocument", () => {
    it("produces a valid Automerge doc with channel singleton and collections", () => {
      const doc = createChatDocument();
      expect(doc.channel).toBeDefined();
      expect(doc.boardMessages).toBeDefined();
      expect(doc.polls).toBeDefined();
      expect(doc.pollOptions).toBeDefined();
      expect(doc.acknowledgements).toBeDefined();
      expect(doc.messages).toBeDefined();
      expect(doc.votes).toBeDefined();
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
      const loaded = Automerge.load(bytes);
      expect(loaded).toBeDefined();
    });
  });

  describe("createJournalDocument", () => {
    it("produces a valid Automerge doc with all required maps", () => {
      const doc = createJournalDocument();
      expect(doc.entries).toBeDefined();
      expect(doc.wikiPages).toBeDefined();
    });

    it("all maps are initially empty", () => {
      const doc = createJournalDocument();
      expect(Object.keys(doc.entries)).toHaveLength(0);
      expect(Object.keys(doc.wikiPages)).toHaveLength(0);
    });

    it("survives save/load roundtrip", () => {
      const doc = createJournalDocument();
      const bytes = Automerge.save(doc);
      const loaded = Automerge.load(bytes);
      expect(loaded).toBeDefined();
    });
  });

  describe("createNoteDocument", () => {
    it("produces a valid Automerge doc with notes map", () => {
      const doc = createNoteDocument();
      expect(doc.notes).toBeDefined();
    });

    it("notes map is initially empty", () => {
      const doc = createNoteDocument();
      expect(Object.keys(doc.notes)).toHaveLength(0);
    });

    it("survives save/load roundtrip", () => {
      const doc = createNoteDocument();
      const bytes = Automerge.save(doc);
      const loaded = Automerge.load(bytes);
      expect(loaded).toBeDefined();
    });
  });

  describe("createPrivacyConfigDocument", () => {
    it("produces a valid Automerge doc with all required maps", () => {
      const doc = createPrivacyConfigDocument();
      expect(doc.buckets).toBeDefined();
      expect(doc.contentTags).toBeDefined();
      expect(doc.friendConnections).toBeDefined();
      expect(doc.friendCodes).toBeDefined();
      expect(doc.keyGrants).toBeDefined();
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
      const loaded = Automerge.load(bytes);
      expect(loaded).toBeDefined();
    });
  });

  describe("createBucketDocument", () => {
    it("produces a valid Automerge doc with all projection maps", () => {
      const doc = createBucketDocument();
      expect(doc.members).toBeDefined();
      expect(doc.memberPhotos).toBeDefined();
      expect(doc.groups).toBeDefined();
      expect(doc.customFronts).toBeDefined();
      expect(doc.fieldDefinitions).toBeDefined();
      expect(doc.fieldValues).toBeDefined();
      expect(doc.frontingSessions).toBeDefined();
      expect(doc.notes).toBeDefined();
      expect(doc.journalEntries).toBeDefined();
      expect(doc.channels).toBeDefined();
      expect(doc.messages).toBeDefined();
    });

    it("all maps and lists are initially empty", () => {
      const doc = createBucketDocument();
      expect(Object.keys(doc.members)).toHaveLength(0);
      expect(doc.messages).toHaveLength(0);
    });

    it("survives save/load roundtrip", () => {
      const doc = createBucketDocument();
      const bytes = Automerge.save(doc);
      const loaded = Automerge.load(bytes);
      expect(loaded).toBeDefined();
    });
  });

  describe("createDocument (generic factory)", () => {
    it("produces a valid doc for every SyncDocumentType", () => {
      for (const type of ALL_DOCUMENT_TYPES) {
        const doc = createDocument(type);
        expect(doc, `createDocument("${type}") should return a doc`).toBeDefined();
      }
    });

    it("each returned doc survives save/load roundtrip", () => {
      for (const type of ALL_DOCUMENT_TYPES) {
        const doc = createDocument(type);
        const bytes = Automerge.save(doc as Automerge.Doc<Record<string, unknown>>);
        const loaded = Automerge.load(bytes);
        expect(loaded, `Roundtrip failed for type: ${type}`).toBeDefined();
      }
    });
  });
});

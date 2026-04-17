import { configureSodium, generateMasterKey, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { toUnixMillis, brandId } from "@pluralscape/types";
import { beforeAll, describe, expect, it } from "vitest";

import { encryptAndEncodeT1 } from "../decode-blob.js";
import { decryptNote, decryptNotePage, encryptNoteInput, encryptNoteUpdate } from "../note.js";

import { makeBase64Blob } from "./helpers.js";

import type { NoteEncryptedFields } from "../note.js";
import type { KdfMasterKey } from "@pluralscape/crypto";
import type {
  HexColor,
  NoteAuthorEntityType,
  NoteId,
  SystemId,
  UnixMillis,
} from "@pluralscape/types";

let masterKey: KdfMasterKey;

beforeAll(async () => {
  configureSodium(new WasmSodiumAdapter());
  await initSodium();
  masterKey = generateMasterKey();
});

function makeEncryptedFields(): NoteEncryptedFields {
  return {
    title: "My Note",
    content: "Note content goes here.",
    backgroundColor: "#ffffff" as HexColor,
  };
}

function makeServerNote(
  fields: NoteEncryptedFields = makeEncryptedFields(),
  overrides?: Partial<{
    authorEntityType: NoteAuthorEntityType | null;
    authorEntityId: string | null;
    archived: boolean;
    archivedAt: UnixMillis | null;
  }>,
) {
  return {
    id: brandId<NoteId>("note_abc123"),
    systemId: brandId<SystemId>("sys_xyz789"),
    authorEntityType: "member" as NoteAuthorEntityType | null,
    authorEntityId: "mem_author" as string | null,
    encryptedData: encryptAndEncodeT1(fields, masterKey),
    version: 1,
    createdAt: toUnixMillis(1_700_000_000_000),
    updatedAt: toUnixMillis(1_700_001_000_000),
    archived: false as boolean,
    archivedAt: null as UnixMillis | null,
    ...overrides,
  };
}

// ── decryptNote ───────────────────────────────────────────────────────

describe("decryptNote", () => {
  it("decrypts encryptedData and merges passthrough fields", () => {
    const raw = makeServerNote();
    const result = decryptNote(raw, masterKey);

    expect(result.id).toBe("note_abc123");
    expect(result.systemId).toBe("sys_xyz789");
    expect(result.version).toBe(1);
    expect(result.createdAt).toBe(1_700_000_000_000);
    expect(result.updatedAt).toBe(1_700_001_000_000);
    expect(result.archived).toBe(false);
    expect(result.title).toBe("My Note");
    expect(result.content).toBe("Note content goes here.");
    expect(result.backgroundColor).toBe("#ffffff");
  });

  it("passes through author fields when set", () => {
    const raw = makeServerNote();
    const result = decryptNote(raw, masterKey);
    expect(result.authorEntityType).toBe("member");
    expect(result.authorEntityId).toBe("mem_author");
  });

  it("passes through null author fields", () => {
    const raw = makeServerNote(makeEncryptedFields(), {
      authorEntityType: null,
      authorEntityId: null,
    });
    const result = decryptNote(raw, masterKey);
    expect(result.authorEntityType).toBeNull();
    expect(result.authorEntityId).toBeNull();
  });

  it("handles null backgroundColor", () => {
    const fields: NoteEncryptedFields = { ...makeEncryptedFields(), backgroundColor: null };
    const raw = makeServerNote(fields);
    const result = decryptNote(raw, masterKey);
    expect(result.backgroundColor).toBeNull();
  });

  it("throws when encryptedData is corrupted", () => {
    const raw = { ...makeServerNote(), encryptedData: "not-valid-base64!!!" };
    expect(() => decryptNote(raw, masterKey)).toThrow();
  });

  it("throws when archived is true but archivedAt is null", () => {
    const raw = makeServerNote(makeEncryptedFields(), { archived: true, archivedAt: null });
    expect(() => decryptNote(raw, masterKey)).toThrow("missing archivedAt");
  });

  it("returns archived variant when raw.archived is true", () => {
    const archivedAt = toUnixMillis(1_700_002_000_000);
    const raw = makeServerNote(makeEncryptedFields(), { archived: true, archivedAt });
    const result = decryptNote(raw, masterKey);

    expect(result.archived).toBe(true);
    if (result.archived) {
      expect(result.archivedAt).toBe(archivedAt);
    }
    expect(result.title).toBe("My Note");
  });
});

// ── decryptNotePage ───────────────────────────────────────────────────

describe("decryptNotePage", () => {
  it("decrypts all items and preserves cursor", () => {
    const data = [makeServerNote(), makeServerNote()];
    const result = decryptNotePage({ data, nextCursor: "cursor-token" }, masterKey);

    expect(result.data).toHaveLength(2);
    expect(result.nextCursor).toBe("cursor-token");
    result.data.forEach((n) => {
      expect(n.title).toBe("My Note");
    });
  });

  it("handles null cursor", () => {
    const result = decryptNotePage({ data: [makeServerNote()], nextCursor: null }, masterKey);
    expect(result.nextCursor).toBeNull();
  });

  it("handles empty data array", () => {
    const result = decryptNotePage({ data: [], nextCursor: null }, masterKey);
    expect(result.data).toEqual([]);
    expect(result.nextCursor).toBeNull();
  });
});

// ── encryptNoteInput ──────────────────────────────────────────────────

describe("encryptNoteInput", () => {
  it("returns an object with an encryptedData string", () => {
    const result = encryptNoteInput(makeEncryptedFields(), masterKey);
    expect(typeof result.encryptedData).toBe("string");
    expect(result.encryptedData.length).toBeGreaterThan(0);
  });

  it("round-trips: encrypt then decrypt returns original fields", () => {
    const fields = makeEncryptedFields();
    const { encryptedData } = encryptNoteInput(fields, masterKey);
    const result = decryptNote({ ...makeServerNote(), encryptedData }, masterKey);
    expect(result.title).toBe(fields.title);
    expect(result.content).toBe(fields.content);
    expect(result.backgroundColor).toBe(fields.backgroundColor);
  });
});

// ── encryptNoteUpdate ─────────────────────────────────────────────────

describe("encryptNoteUpdate", () => {
  it("includes version in the output", () => {
    const result = encryptNoteUpdate(makeEncryptedFields(), 5, masterKey);
    expect(typeof result.encryptedData).toBe("string");
    expect(result.version).toBe(5);
  });

  it("round-trips through decryptNote", () => {
    const fields = makeEncryptedFields();
    const { encryptedData } = encryptNoteUpdate(fields, 2, masterKey);
    const result = decryptNote({ ...makeServerNote(), encryptedData, version: 2 }, masterKey);
    expect(result.title).toBe(fields.title);
    expect(result.content).toBe(fields.content);
  });
});

// ── assertNoteEncryptedFields ─────────────────────────────────────────

describe("assertNoteEncryptedFields", () => {
  it("throws when decrypted blob is not an object", () => {
    const raw = { ...makeServerNote(), encryptedData: makeBase64Blob("not-an-object", masterKey) };
    expect(() => decryptNote(raw, masterKey)).toThrow("not an object");
  });

  it("throws when blob is missing title field", () => {
    const raw = {
      ...makeServerNote(),
      encryptedData: makeBase64Blob({ content: "hi" }, masterKey),
    };
    expect(() => decryptNote(raw, masterKey)).toThrow("missing required string field: title");
  });

  it("throws when blob is missing content field", () => {
    const raw = {
      ...makeServerNote(),
      encryptedData: makeBase64Blob({ title: "My Note" }, masterKey),
    };
    expect(() => decryptNote(raw, masterKey)).toThrow("missing required string field: content");
  });
});

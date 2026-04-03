import { configureSodium, generateMasterKey, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { toUnixMillis } from "@pluralscape/types";
import { beforeAll, describe, expect, it } from "vitest";

import { encryptAndEncodeT1 } from "../decode-blob.js";
import { decryptNote, decryptNotePage, encryptNoteInput, encryptNoteUpdate } from "../note.js";

import { makeBase64Blob } from "./helpers.js";

import type { NoteEncryptedFields } from "../note.js";
import type { KdfMasterKey } from "@pluralscape/crypto";
import type {
  EntityReference,
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
    author: EntityReference<NoteAuthorEntityType> | null;
    archived: boolean;
    archivedAt: UnixMillis | null;
  }>,
) {
  return {
    id: "note_abc123" as NoteId,
    systemId: "sys_xyz789" as SystemId,
    author: {
      entityType: "member" as const,
      entityId: "mem_author",
    } as EntityReference<NoteAuthorEntityType> | null,
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

  it("passes through author when set", () => {
    const raw = makeServerNote();
    const result = decryptNote(raw, masterKey);
    expect(result.author).toEqual({ entityType: "member", entityId: "mem_author" });
  });

  it("passes through null author", () => {
    const raw = makeServerNote(makeEncryptedFields(), { author: null });
    const result = decryptNote(raw, masterKey);
    expect(result.author).toBeNull();
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

  it("throws when archived is true but archivedAt is null", () => {
    const raw = makeServerNote(makeEncryptedFields(), { archived: true, archivedAt: null });
    expect(() => decryptNote(raw, masterKey)).toThrow("missing archivedAt");
  });
});

// ── decryptNotePage ───────────────────────────────────────────────────

describe("decryptNotePage", () => {
  it("decrypts all items and preserves cursor", () => {
    const data = [makeServerNote(), makeServerNote()];
    const result = decryptNotePage({ data, nextCursor: "cursor-token" }, masterKey);

    expect(result.data).toHaveLength(2);
    expect(result.nextCursor).toBe("cursor-token");
    result.data.forEach((n) => { expect(n.title).toBe("My Note"); });
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

  it("produces different ciphertext on each call", () => {
    const r1 = encryptNoteInput(makeEncryptedFields(), masterKey);
    const r2 = encryptNoteInput(makeEncryptedFields(), masterKey);
    expect(r1.encryptedData).not.toBe(r2.encryptedData);
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

  it("throws when title is not a string", () => {
    const raw = {
      ...makeServerNote(),
      encryptedData: makeBase64Blob({ title: 42, content: "hi" }, masterKey),
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

  it("throws when content is not a string", () => {
    const raw = {
      ...makeServerNote(),
      encryptedData: makeBase64Blob({ title: "My Note", content: 99 }, masterKey),
    };
    expect(() => decryptNote(raw, masterKey)).toThrow("missing required string field: content");
  });
});

import {
  configureSodium,
  encryptTier1,
  generateMasterKey,
  initSodium,
  serializeEncryptedBlob,
} from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { beforeAll, describe, expect, it } from "vitest";

import {
  decryptFrontingSession,
  decryptFrontingSessionPage,
  encryptFrontingSessionInput,
  encryptFrontingSessionUpdate,
} from "../fronting-session.js";

import type { FrontingSessionEncryptedFields } from "../fronting-session.js";
import type { KdfMasterKey } from "@pluralscape/crypto";
import type { FrontingSessionId, MemberId, PaginationCursor, SystemId } from "@pluralscape/types";

let masterKey: KdfMasterKey;

beforeAll(async () => {
  configureSodium(new WasmSodiumAdapter());
  await initSodium();
  masterKey = generateMasterKey();
});

/** Encode Uint8Array to base64 without Buffer (matches runtime in packages/data). */
function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function makeEncryptedData(fields: FrontingSessionEncryptedFields): string {
  const blob = encryptTier1(fields, masterKey);
  return toBase64(serializeEncryptedBlob(blob));
}

/** Minimal raw server response for a fronting session. */
function makeRawSession(
  overrides: Partial<{
    endTime: number | null;
    encryptedFields: FrontingSessionEncryptedFields;
  }> = {},
) {
  const fields: FrontingSessionEncryptedFields = overrides.encryptedFields ?? {
    comment: "feeling good",
    positionality: "close",
    outtrigger: "stress",
    outtriggerSentiment: "negative",
  };
  return {
    id: "fs_abc123" as FrontingSessionId,
    systemId: "sys_001" as SystemId,
    memberId: "mem_001" as MemberId,
    customFrontId: null,
    structureEntityId: null,
    startTime: 1700000000000,
    endTime: overrides.endTime !== undefined ? overrides.endTime : null,
    encryptedData: makeEncryptedData(fields),
    version: 1,
    archived: false as const,
    archivedAt: null,
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
  };
}

/** Wrap session rows into the PaginatedResult shape the router returns. */
function makePage(rows: ReturnType<typeof makeRawSession>[], nextCursor: PaginationCursor | null) {
  return { data: rows, nextCursor, hasMore: nextCursor !== null, totalCount: null };
}

describe("decryptFrontingSession", () => {
  it("decrypts an active session (endTime: null)", () => {
    const raw = makeRawSession({ endTime: null });
    const result = decryptFrontingSession(raw, masterKey);

    expect(result.endTime).toBeNull();
    expect(result.comment).toBe("feeling good");
    expect(result.positionality).toBe("close");
    expect(result.outtrigger).toBe("stress");
    expect(result.outtriggerSentiment).toBe("negative");
    expect(result.id).toBe(raw.id);
    expect(result.systemId).toBe(raw.systemId);
    expect(result.memberId).toBe(raw.memberId);
    expect(result.startTime).toBe(raw.startTime);
    expect(result.archived).toBe(false);
    expect(result.version).toBe(1);
  });

  it("decrypts a completed session (endTime: number)", () => {
    const raw = makeRawSession({ endTime: 1700001000000 });
    const result = decryptFrontingSession(raw, masterKey);

    expect(result.endTime).toBe(1700001000000);
    expect(result.comment).toBe("feeling good");
  });

  it("decrypts null encrypted fields", () => {
    const nullFields: FrontingSessionEncryptedFields = {
      comment: null,
      positionality: null,
      outtrigger: null,
      outtriggerSentiment: null,
    };
    const raw = makeRawSession({ encryptedFields: nullFields });
    const result = decryptFrontingSession(raw, masterKey);

    expect(result.comment).toBeNull();
    expect(result.positionality).toBeNull();
    expect(result.outtrigger).toBeNull();
    expect(result.outtriggerSentiment).toBeNull();
  });

  it("throws on invalid encryptedData", () => {
    const raw = makeRawSession();
    const bad = { ...raw, encryptedData: "not-valid!!!" };
    expect(() => decryptFrontingSession(bad, masterKey)).toThrow();
  });
});

describe("decryptFrontingSessionPage", () => {
  it("decrypts a page of sessions", () => {
    const cursor = "cursor_abc" as PaginationCursor;
    const page = makePage(
      [makeRawSession({ endTime: null }), makeRawSession({ endTime: 1700001000000 })],
      cursor,
    );
    const result = decryptFrontingSessionPage(page, masterKey);

    expect(result.items).toHaveLength(2);
    expect(result.items[0]?.endTime).toBeNull();
    expect(result.items[1]?.endTime).toBe(1700001000000);
    expect(result.nextCursor).toBe(cursor);
  });

  it("passes through null nextCursor", () => {
    const page = makePage([makeRawSession()], null);
    const result = decryptFrontingSessionPage(page, masterKey);
    expect(result.nextCursor).toBeNull();
  });
});

describe("encryptFrontingSessionInput", () => {
  it("encrypts fields and returns encryptedData string", () => {
    const fields: FrontingSessionEncryptedFields = {
      comment: "hello",
      positionality: null,
      outtrigger: "joy",
      outtriggerSentiment: "positive",
    };
    const result = encryptFrontingSessionInput(fields, masterKey);

    expect(typeof result.encryptedData).toBe("string");
    expect(result.encryptedData.length).toBeGreaterThan(0);
  });

  it("round-trips: encrypted data can be decrypted back", () => {
    const fields: FrontingSessionEncryptedFields = {
      comment: "round-trip",
      positionality: "far",
      outtrigger: null,
      outtriggerSentiment: null,
    };
    const { encryptedData } = encryptFrontingSessionInput(fields, masterKey);
    const rawWithData = { ...makeRawSession(), encryptedData };
    const result = decryptFrontingSession(rawWithData, masterKey);

    expect(result.comment).toBe("round-trip");
    expect(result.positionality).toBe("far");
    expect(result.outtrigger).toBeNull();
    expect(result.outtriggerSentiment).toBeNull();
  });
});

describe("encryptFrontingSessionUpdate", () => {
  it("encrypts fields and includes version", () => {
    const fields: FrontingSessionEncryptedFields = {
      comment: "updated",
      positionality: null,
      outtrigger: null,
      outtriggerSentiment: null,
    };
    const result = encryptFrontingSessionUpdate(fields, 2, masterKey);

    expect(typeof result.encryptedData).toBe("string");
    expect(result.version).toBe(2);
  });

  it("round-trips: update data can be decrypted back", () => {
    const fields: FrontingSessionEncryptedFields = {
      comment: "updated comment",
      positionality: "very close",
      outtrigger: "music",
      outtriggerSentiment: "positive",
    };
    const { encryptedData, version } = encryptFrontingSessionUpdate(fields, 3, masterKey);
    const rawWithData = { ...makeRawSession(), encryptedData, version };
    const result = decryptFrontingSession(rawWithData, masterKey);

    expect(result.comment).toBe("updated comment");
    expect(result.positionality).toBe("very close");
    expect(result.outtrigger).toBe("music");
    expect(result.outtriggerSentiment).toBe("positive");
    expect(result.version).toBe(3);
  });
});

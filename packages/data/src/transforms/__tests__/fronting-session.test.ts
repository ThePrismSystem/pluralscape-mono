import { configureSodium, generateMasterKey, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { beforeAll, describe, expect, it } from "vitest";

import {
  decryptFrontingSession,
  decryptFrontingSessionPage,
  encryptFrontingSessionInput,
  encryptFrontingSessionUpdate,
} from "../fronting-session.js";

import { makeBase64Blob } from "./helpers.js";

import type { FrontingSessionEncryptedFields } from "../fronting-session.js";
import type { KdfMasterKey } from "@pluralscape/crypto";
import type {
  FrontingSessionId,
  MemberId,
  PaginationCursor,
  SystemId,
  UnixMillis,
} from "@pluralscape/types";

let masterKey: KdfMasterKey;

beforeAll(async () => {
  configureSodium(new WasmSodiumAdapter());
  await initSodium();
  masterKey = generateMasterKey();
});

/** Minimal raw server response for a fronting session. */
function makeRawSession(
  overrides: Partial<{
    endTime: UnixMillis | null;
    encryptedFields: FrontingSessionEncryptedFields;
    archived: boolean;
    archivedAt: UnixMillis | null;
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
    startTime: 1700000000000 as UnixMillis,
    endTime: overrides.endTime !== undefined ? overrides.endTime : null,
    encryptedData: makeBase64Blob(fields, masterKey),
    version: 1,
    archived: overrides.archived ?? (false as boolean),
    archivedAt: overrides.archivedAt ?? (null as UnixMillis | null),
    createdAt: 1700000000000 as UnixMillis,
    updatedAt: 1700000000000 as UnixMillis,
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
    const raw = makeRawSession({ endTime: 1700001000000 as UnixMillis });
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

  it("returns archived active session when raw.archived is true and endTime is null", () => {
    const archivedAt = 1700002000000 as UnixMillis;
    const raw = makeRawSession({ endTime: null, archived: true, archivedAt });
    const result = decryptFrontingSession(raw, masterKey);

    expect(result.archived).toBe(true);
    expect(result.endTime).toBeNull();
    if (result.archived) {
      expect(result.archivedAt).toBe(archivedAt);
    }
  });

  it("returns archived completed session when raw.archived is true and endTime is set", () => {
    const archivedAt = 1700003000000 as UnixMillis;
    const raw = makeRawSession({
      endTime: 1700001000000 as UnixMillis,
      archived: true,
      archivedAt,
    });
    const result = decryptFrontingSession(raw, masterKey);

    expect(result.archived).toBe(true);
    expect(result.endTime).toBe(1700001000000);
    if (result.archived) {
      expect(result.archivedAt).toBe(archivedAt);
    }
  });
});

describe("decryptFrontingSessionPage", () => {
  it("decrypts a page of sessions", () => {
    const cursor = "cursor_abc" as PaginationCursor;
    const page = makePage(
      [makeRawSession({ endTime: null }), makeRawSession({ endTime: 1700001000000 as UnixMillis })],
      cursor,
    );
    const result = decryptFrontingSessionPage(page, masterKey);

    expect(result.data).toHaveLength(2);
    expect(result.data[0]?.endTime).toBeNull();
    expect(result.data[1]?.endTime).toBe(1700001000000);
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

// ── Assertion guard tests ────────────────────────────────────────────

describe("assertFrontingSessionEncryptedFields", () => {
  it("throws when decrypted blob is not an object", () => {
    const raw = { ...makeRawSession(), encryptedData: makeBase64Blob("not-an-object", masterKey) };
    expect(() => decryptFrontingSession(raw, masterKey)).toThrow("not an object");
  });

  it("throws when comment is not string or null", () => {
    const raw = {
      ...makeRawSession(),
      encryptedData: makeBase64Blob(
        { comment: 42, positionality: null, outtrigger: null, outtriggerSentiment: null },
        masterKey,
      ),
    };
    expect(() => decryptFrontingSession(raw, masterKey)).toThrow("comment must be string or null");
  });

  it("throws when positionality is not string or null", () => {
    const raw = {
      ...makeRawSession(),
      encryptedData: makeBase64Blob(
        { comment: null, positionality: 42, outtrigger: null, outtriggerSentiment: null },
        masterKey,
      ),
    };
    expect(() => decryptFrontingSession(raw, masterKey)).toThrow(
      "positionality must be string or null",
    );
  });

  it("throws when outtrigger is not string or null", () => {
    const raw = {
      ...makeRawSession(),
      encryptedData: makeBase64Blob(
        { comment: null, positionality: null, outtrigger: 42, outtriggerSentiment: null },
        masterKey,
      ),
    };
    expect(() => decryptFrontingSession(raw, masterKey)).toThrow(
      "outtrigger must be string or null",
    );
  });

  it("throws when outtriggerSentiment is invalid", () => {
    const raw = {
      ...makeRawSession(),
      encryptedData: makeBase64Blob(
        { comment: null, positionality: null, outtrigger: null, outtriggerSentiment: "invalid" },
        masterKey,
      ),
    };
    expect(() => decryptFrontingSession(raw, masterKey)).toThrow(
      "outtriggerSentiment must be a valid sentiment or null",
    );
  });

  it("accepts null blob with null encrypted fields via assertion", () => {
    const raw = {
      ...makeRawSession(),
      encryptedData: makeBase64Blob(null, masterKey),
    };
    expect(() => decryptFrontingSession(raw, masterKey)).toThrow("not an object");
  });
});

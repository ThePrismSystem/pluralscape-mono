import { configureSodium, generateMasterKey, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { beforeAll, describe, expect, it } from "vitest";

import { encryptAndEncodeT1 } from "../decode-blob.js";
import {
  decryptCheckInRecord,
  decryptCheckInRecordPage,
  decryptTimerConfig,
  decryptTimerConfigPage,
  encryptTimerConfigInput,
  encryptTimerConfigUpdate,
} from "../timer-check-in.js";

import type { TimerConfigEncryptedFields } from "../timer-check-in.js";
import type { KdfMasterKey } from "@pluralscape/crypto";
import type { CheckInRecordId, MemberId, SystemId, TimerId, UnixMillis } from "@pluralscape/types";

let masterKey: KdfMasterKey;

const TIMER_ID = "tmr_test001" as TimerId;
const SYSTEM_ID = "sys_test" as SystemId;
const NOW = 1700000000000 as UnixMillis;
const RECORD_ID = "cir_test001" as CheckInRecordId;

const ENCRYPTED_FIELDS: TimerConfigEncryptedFields = {
  promptText: "Who is fronting right now?",
};

beforeAll(async () => {
  configureSodium(new WasmSodiumAdapter());
  await initSodium();
  masterKey = generateMasterKey();
});

function makeRawTimerConfig(encryptedData: string) {
  return {
    id: TIMER_ID,
    systemId: SYSTEM_ID,
    encryptedData,
    enabled: true,
    intervalMinutes: 30,
    wakingHoursOnly: null,
    wakingStart: null,
    wakingEnd: null,
    version: 1,
    archived: false,
    archivedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function makeRawCheckInRecord(opts?: {
  respondedByMemberId?: MemberId | null;
  respondedAt?: UnixMillis | null;
  dismissed?: boolean;
}) {
  return {
    id: RECORD_ID,
    timerConfigId: TIMER_ID,
    systemId: SYSTEM_ID,
    scheduledAt: NOW,
    respondedByMemberId: opts?.respondedByMemberId ?? null,
    respondedAt: opts?.respondedAt ?? null,
    dismissed: opts?.dismissed ?? false,
    archived: false as const,
    archivedAt: null,
  };
}

describe("decryptTimerConfig", () => {
  it("decrypts promptText and merges T3 fields", () => {
    const raw = makeRawTimerConfig(encryptAndEncodeT1(ENCRYPTED_FIELDS, masterKey));
    const result = decryptTimerConfig(raw, masterKey);

    expect(result.id).toBe(TIMER_ID);
    expect(result.promptText).toBe("Who is fronting right now?");
    expect(result.enabled).toBe(true);
    expect(result.intervalMinutes).toBe(30);
  });

  it("throws with wrong key", () => {
    const raw = makeRawTimerConfig(encryptAndEncodeT1(ENCRYPTED_FIELDS, masterKey));
    expect(() => decryptTimerConfig(raw, generateMasterKey())).toThrow();
  });

  it("throws on corrupted data", () => {
    expect(() => decryptTimerConfig(makeRawTimerConfig(btoa("garbage")), masterKey)).toThrow();
  });
});

describe("decryptTimerConfigPage", () => {
  it("decrypts all items and preserves pagination", () => {
    const enc = encryptAndEncodeT1(ENCRYPTED_FIELDS, masterKey);
    const result = decryptTimerConfigPage(
      { data: [makeRawTimerConfig(enc)], nextCursor: "c1" },
      masterKey,
    );
    expect(result.items).toHaveLength(1);
    expect(result.nextCursor).toBe("c1");
  });
});

describe("encryptTimerConfigInput", () => {
  it("round-trips correctly", () => {
    const encrypted = encryptTimerConfigInput(ENCRYPTED_FIELDS, masterKey);
    const raw = makeRawTimerConfig(encrypted.encryptedData);
    expect(decryptTimerConfig(raw, masterKey).promptText).toBe("Who is fronting right now?");
  });
});

describe("encryptTimerConfigUpdate", () => {
  it("includes version", () => {
    const result = encryptTimerConfigUpdate(ENCRYPTED_FIELDS, 3, masterKey);
    expect(result.version).toBe(3);
    expect(typeof result.encryptedData).toBe("string");
  });
});

describe("decryptCheckInRecord", () => {
  it("maps a pending record", () => {
    const result = decryptCheckInRecord(makeRawCheckInRecord());
    expect(result.id).toBe(RECORD_ID);
    expect(result.dismissed).toBe(false);
    expect(result.respondedByMemberId).toBeNull();
  });

  it("maps a responded record", () => {
    const result = decryptCheckInRecord(
      makeRawCheckInRecord({
        respondedByMemberId: "mem_abc" as MemberId,
        respondedAt: NOW,
      }),
    );
    expect(result.respondedByMemberId).toBe("mem_abc");
    expect(result.respondedAt).toBe(NOW);
  });

  it("maps a dismissed record", () => {
    const result = decryptCheckInRecord(makeRawCheckInRecord({ dismissed: true }));
    expect(result.dismissed).toBe(true);
  });
});

describe("decryptCheckInRecordPage", () => {
  it("maps all items and preserves pagination", () => {
    const result = decryptCheckInRecordPage({
      data: [makeRawCheckInRecord(), makeRawCheckInRecord({ dismissed: true })],
      nextCursor: "c1",
    });
    expect(result.items).toHaveLength(2);
    expect(result.nextCursor).toBe("c1");
  });
});

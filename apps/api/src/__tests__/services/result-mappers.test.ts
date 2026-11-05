import { brandId } from "@pluralscape/types";
import { describe, expect, it, vi } from "vitest";

import { toFriendConnectionResult } from "../../services/account/friends/internal.js";
import { toCheckInRecordResult } from "../../services/check-in-record/internal.js";
import { toSystemSettingsResult } from "../../services/system-settings.service.js";
import { toTimerConfigResult } from "../../services/timer-config/internal.js";

import type { AccountId, EncryptedBlob, FriendConnectionId } from "@pluralscape/types";

vi.mock("@pluralscape/crypto", async () => {
  const { createCryptoMock } = await import("../helpers/mock-crypto.js");
  return createCryptoMock();
});

const BLOB = {} as EncryptedBlob;
const CREATED_AT = 1_000;
const NEXT_CHECK_IN_AT = 5_000;
const ARCHIVED_AT = 2_000;
const RESPONDED_AT = 3_000;

describe("toFriendConnectionResult", () => {
  it("returns the row's archive state", () => {
    const result = toFriendConnectionResult({
      id: brandId<FriendConnectionId>("fc_1"),
      accountId: brandId<AccountId>("acc_1"),
      friendAccountId: brandId<AccountId>("acc_2"),
      status: "accepted",
      encryptedData: null,
      version: 1,
      archived: true,
      archivedAt: ARCHIVED_AT,
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
    } as Parameters<typeof toFriendConnectionResult>[0]);

    expect(result.archived).toBe(true);
    expect(result.archivedAt).toBe(ARCHIVED_AT);
  });
});

describe("toTimerConfigResult", () => {
  const row = {
    id: "tmr_1",
    systemId: "sys_1",
    enabled: true,
    intervalMinutes: 30,
    wakingHoursOnly: null,
    wakingStart: null,
    wakingEnd: null,
    encryptedData: BLOB,
    version: 1,
    archived: false,
    archivedAt: null,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
  };

  it("returns the scheduled nextCheckInAt", () => {
    const result = toTimerConfigResult({ ...row, nextCheckInAt: NEXT_CHECK_IN_AT });
    expect(result.nextCheckInAt).toBe(NEXT_CHECK_IN_AT);
  });

  it("returns null when no check-in is scheduled", () => {
    const result = toTimerConfigResult({ ...row, nextCheckInAt: null });
    expect(result.nextCheckInAt).toBeNull();
  });
});

describe("toCheckInRecordResult", () => {
  const row = {
    id: "cir_1",
    systemId: "sys_1",
    timerConfigId: "tmr_1",
    scheduledAt: CREATED_AT,
    respondedByMemberId: null,
    respondedAt: null,
    dismissed: false,
    encryptedData: null,
    archived: false,
    archivedAt: null,
  };

  it("returns the documented flat shape without a derived status", () => {
    expect(toCheckInRecordResult(row)).not.toHaveProperty("status");
  });

  it("carries the responder when the record was answered", () => {
    const result = toCheckInRecordResult({
      ...row,
      respondedByMemberId: "mem_1",
      respondedAt: RESPONDED_AT,
    });
    expect(result.respondedByMemberId).toBe("mem_1");
    expect(result.respondedAt).toBe(RESPONDED_AT);
    expect(result.dismissed).toBe(false);
  });

  it("marks a dismissed record", () => {
    const result = toCheckInRecordResult({ ...row, dismissed: true });
    expect(result.dismissed).toBe(true);
    expect(result.respondedAt).toBeNull();
  });
});

describe("toSystemSettingsResult", () => {
  it("does not expose the PIN hash from the row", () => {
    const rowWithPinHash = {
      id: "sset_1",
      systemId: "sys_1",
      locale: null,
      pinHash: "$argon2id$hash",
      biometricEnabled: false,
      encryptedData: BLOB,
      version: 1,
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
    };

    expect(toSystemSettingsResult(rowWithPinHash)).not.toHaveProperty("pinHash");
  });
});

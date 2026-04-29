import { brandId } from "@pluralscape/types";
import { describe, expect, it } from "vitest";

import { narrowArchivableRow } from "../../lib/archivable-row.js";

import type { AccountId, FriendCode, FriendCodeId, UnixMillis } from "@pluralscape/types";

interface SampleLive {
  readonly id: string;
  readonly name: string;
  readonly archived: false;
}

const liveRow = {
  id: "x",
  name: "n",
  archived: false,
  archivedAt: null,
} as const;

const archivedRow = {
  id: "x",
  name: "n",
  archived: true,
  archivedAt: 1_700_000_000_000 as UnixMillis,
} as const;

describe("narrowArchivableRow", () => {
  it("returns the live shape with no archivedAt for non-archived rows", () => {
    const result = narrowArchivableRow<SampleLive>(liveRow);
    expect(result.archived).toBe(false);
    expect("archivedAt" in result).toBe(false);
    expect(result.id).toBe("x");
  });

  it("returns the archived shape with branded archivedAt for archived rows", () => {
    const result = narrowArchivableRow<SampleLive>(archivedRow);
    expect(result.archived).toBe(true);
    if (!result.archived) throw new Error("Expected archived shape");
    expect(result.archivedAt).toBe(1_700_000_000_000);
  });

  it("throws when archived=true but archivedAt is null (CHECK violation)", () => {
    expect(() =>
      narrowArchivableRow<SampleLive>({
        id: "x",
        name: "n",
        archived: true,
        archivedAt: null,
      }),
    ).toThrow("Archivable row CHECK invariant violated: archived=true with archivedAt=null");
  });

  it("throws when archived=false but archivedAt is non-null (reverse CHECK violation)", () => {
    expect(() =>
      narrowArchivableRow<SampleLive>({
        id: "x",
        name: "n",
        archived: false,
        archivedAt: 1_700_000_000_000 as UnixMillis,
      }),
    ).toThrow("Archivable row CHECK invariant violated: archived=false with non-null archivedAt");
  });
});

describe("narrowArchivableRow with branded FriendCode entity", () => {
  const friendCodeId = brandId<FriendCodeId>("fcd_test001");
  const accountId = brandId<AccountId>("acc_test001");
  const createdAt = 1_700_000_000_000 as UnixMillis;
  const expiresAt = 1_700_500_000_000 as UnixMillis;
  const archivedAt = 1_700_900_000_000 as UnixMillis;

  it("preserves branded FriendCodeId, AccountId, and UnixMillis on the live shape", () => {
    const result = narrowArchivableRow<FriendCode>({
      id: friendCodeId,
      accountId,
      code: "TEST-LIVE-CODE",
      createdAt,
      expiresAt,
      archived: false,
      archivedAt: null,
    });

    expect(result.archived).toBe(false);
    expect("archivedAt" in result).toBe(false);
    expect(result.id).toBe(friendCodeId);
    expect(result.accountId).toBe(accountId);
    expect(result.code).toBe("TEST-LIVE-CODE");
    expect(result.createdAt).toBe(createdAt);
    expect(result.expiresAt).toBe(expiresAt);
  });

  it("preserves branded fields and surfaces archivedAt on the archived shape", () => {
    const result = narrowArchivableRow<FriendCode>({
      id: friendCodeId,
      accountId,
      code: "TEST-ARCHIVED-CODE",
      createdAt,
      expiresAt: null,
      archived: true,
      archivedAt,
    });

    expect(result.archived).toBe(true);
    if (!result.archived) throw new Error("Expected archived shape");
    expect(result.id).toBe(friendCodeId);
    expect(result.accountId).toBe(accountId);
    expect(result.code).toBe("TEST-ARCHIVED-CODE");
    expect(result.createdAt).toBe(createdAt);
    expect(result.expiresAt).toBeNull();
    expect(result.archivedAt).toBe(archivedAt);
  });
});

import { brandId } from "@pluralscape/types";
import { describe, expect, it } from "vitest";

import { narrowFriendCode, narrowFriendCodePage } from "../friend-code.js";

import type { FriendCodeRaw } from "../friend-code.js";
import type { AccountId, FriendCodeId, UnixMillis } from "@pluralscape/types";

const NOW = 1_700_000_000_000 as UnixMillis;
const LATER = 1_700_002_000_000 as UnixMillis;
const EXPIRES = 1_700_086_400_000 as UnixMillis;

function makeRaw(overrides?: Partial<FriendCodeRaw>): FriendCodeRaw {
  return {
    id: brandId<FriendCodeId>("fcd_test001"),
    accountId: brandId<AccountId>("acc_test001"),
    code: "ABCD-1234",
    createdAt: NOW,
    expiresAt: EXPIRES,
    archived: false,
    archivedAt: null,
    ...overrides,
  };
}

describe("narrowFriendCode", () => {
  it("returns live entity with archived: false", () => {
    const result = narrowFriendCode(makeRaw());
    expect(result.archived).toBe(false);
    expect(result.id).toBe("fcd_test001");
    expect(result.accountId).toBe("acc_test001");
    expect(result.code).toBe("ABCD-1234");
    expect(result.createdAt).toBe(NOW);
    expect(result.expiresAt).toBe(EXPIRES);
  });

  it("returns archived entity with archivedAt", () => {
    const result = narrowFriendCode(makeRaw({ archived: true, archivedAt: LATER }));
    expect(result.archived).toBe(true);
    if (result.archived) {
      expect(result.archivedAt).toBe(LATER);
    }
  });

  it("throws when archived=true but archivedAt is null", () => {
    expect(() => narrowFriendCode(makeRaw({ archived: true, archivedAt: null }))).toThrow(
      "missing archivedAt",
    );
  });

  it("handles null expiresAt (non-expiring code)", () => {
    const result = narrowFriendCode(makeRaw({ expiresAt: null }));
    expect(result.expiresAt).toBeNull();
  });
});

describe("narrowFriendCodePage", () => {
  it("narrows all items and preserves cursor", () => {
    const page = { data: [makeRaw(), makeRaw()], nextCursor: "cursor_abc" };
    const result = narrowFriendCodePage(page);
    expect(result.data).toHaveLength(2);
    expect(result.nextCursor).toBe("cursor_abc");
  });

  it("handles empty page", () => {
    const result = narrowFriendCodePage({ data: [], nextCursor: null });
    expect(result.data).toHaveLength(0);
    expect(result.nextCursor).toBeNull();
  });
});

import { describe, expect, it } from "vitest";

import {
  CastVoteBodySchema,
  CreatePollBodySchema,
  PollQuerySchema,
  PollVoteQuerySchema,
  UpdatePollBodySchema,
} from "../poll.js";
import { MAX_ENCRYPTED_DATA_SIZE } from "../validation.constants.js";

/** Remove a key from an object (lint-safe alternative to destructuring with _). */
function omit<T extends Record<string, unknown>, K extends keyof T>(obj: T, key: K): Omit<T, K> {
  return Object.fromEntries(Object.entries(obj).filter(([k]) => k !== key)) as Omit<T, K>;
}

// ── CreatePollBodySchema ──────────────────────────────────────────

describe("CreatePollBodySchema", () => {
  const valid = {
    encryptedData: "dGVzdA==",
    kind: "standard" as const,
    allowMultipleVotes: false,
    maxVotesPerMember: 1,
    allowAbstain: true,
    allowVeto: false,
  };

  it("accepts minimal valid input", () => {
    const result = CreatePollBodySchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.kind).toBe("standard");
      expect(result.data.maxVotesPerMember).toBe(1);
      expect(result.data.createdByMemberId).toBeUndefined();
      expect(result.data.endsAt).toBeUndefined();
    }
  });

  it("accepts with optional createdByMemberId", () => {
    const memberId = "mem_00000000-0000-0000-0000-000000000001";
    const result = CreatePollBodySchema.safeParse({
      ...valid,
      createdByMemberId: memberId,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.createdByMemberId).toBe(memberId);
    }
  });

  it("accepts with optional endsAt", () => {
    const result = CreatePollBodySchema.safeParse({
      ...valid,
      endsAt: 1700000000000,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.endsAt).toBe(1700000000000);
    }
  });

  it("accepts custom kind", () => {
    const result = CreatePollBodySchema.safeParse({ ...valid, kind: "custom" });
    expect(result.success).toBe(true);
  });

  it("rejects missing encryptedData", () => {
    expect(CreatePollBodySchema.safeParse(omit(valid, "encryptedData")).success).toBe(false);
  });

  it("rejects empty encryptedData", () => {
    expect(CreatePollBodySchema.safeParse({ ...valid, encryptedData: "" }).success).toBe(false);
  });

  it("rejects encryptedData exceeding max size", () => {
    expect(
      CreatePollBodySchema.safeParse({
        ...valid,
        encryptedData: "x".repeat(MAX_ENCRYPTED_DATA_SIZE + 1),
      }).success,
    ).toBe(false);
  });

  it("rejects invalid kind", () => {
    expect(CreatePollBodySchema.safeParse({ ...valid, kind: "invalid" }).success).toBe(false);
  });

  it("rejects missing kind", () => {
    expect(CreatePollBodySchema.safeParse(omit(valid, "kind")).success).toBe(false);
  });

  it("rejects maxVotesPerMember less than 1", () => {
    expect(CreatePollBodySchema.safeParse({ ...valid, maxVotesPerMember: 0 }).success).toBe(false);
  });

  it("rejects non-integer maxVotesPerMember", () => {
    expect(CreatePollBodySchema.safeParse({ ...valid, maxVotesPerMember: 1.5 }).success).toBe(
      false,
    );
  });

  it("rejects missing boolean fields", () => {
    expect(CreatePollBodySchema.safeParse(omit(valid, "allowMultipleVotes")).success).toBe(false);
  });

  it("rejects negative endsAt", () => {
    expect(CreatePollBodySchema.safeParse({ ...valid, endsAt: -1 }).success).toBe(false);
  });

  it("rejects zero endsAt", () => {
    expect(CreatePollBodySchema.safeParse({ ...valid, endsAt: 0 }).success).toBe(false);
  });

  it("strips extra properties", () => {
    const result = CreatePollBodySchema.safeParse({ ...valid, extra: "field" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(valid);
    }
  });
});

// ── UpdatePollBodySchema ──────────────────────────────────────────

describe("UpdatePollBodySchema", () => {
  it("accepts valid update body", () => {
    const result = UpdatePollBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      version: 1,
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing version", () => {
    expect(UpdatePollBodySchema.safeParse({ encryptedData: "dGVzdA==" }).success).toBe(false);
  });

  it("rejects version less than 1", () => {
    expect(UpdatePollBodySchema.safeParse({ encryptedData: "dGVzdA==", version: 0 }).success).toBe(
      false,
    );
  });

  it("rejects non-integer version", () => {
    expect(
      UpdatePollBodySchema.safeParse({ encryptedData: "dGVzdA==", version: 1.5 }).success,
    ).toBe(false);
  });

  it("rejects missing encryptedData", () => {
    expect(UpdatePollBodySchema.safeParse({ version: 1 }).success).toBe(false);
  });
});

// ── CastVoteBodySchema ───────────────────────────────────────────

describe("CastVoteBodySchema", () => {
  const valid = {
    optionId: "po_option1",
    voter: { entityType: "member" as const, entityId: "mem_abc123" },
    encryptedData: "dGVzdA==",
  };

  it("accepts vote with member voter", () => {
    const result = CastVoteBodySchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.voter.entityType).toBe("member");
      expect(result.data.isVeto).toBe(false);
    }
  });

  it("accepts vote with structure-entity voter", () => {
    const result = CastVoteBodySchema.safeParse({
      ...valid,
      voter: { entityType: "structure-entity", entityId: "ste_xyz789" },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.voter.entityType).toBe("structure-entity");
    }
  });

  it("accepts abstain vote with null optionId", () => {
    const result = CastVoteBodySchema.safeParse({ ...valid, optionId: null });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.optionId).toBeNull();
    }
  });

  it("accepts abstain vote with omitted optionId", () => {
    const result = CastVoteBodySchema.safeParse(omit(valid, "optionId"));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.optionId).toBeUndefined();
    }
  });

  it("accepts veto vote", () => {
    const result = CastVoteBodySchema.safeParse({ ...valid, isVeto: true });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isVeto).toBe(true);
    }
  });

  it("rejects missing voter", () => {
    expect(CastVoteBodySchema.safeParse(omit(valid, "voter")).success).toBe(false);
  });

  it("rejects invalid voter entityType", () => {
    expect(
      CastVoteBodySchema.safeParse({
        ...valid,
        voter: { entityType: "invalid", entityId: "id_123" },
      }).success,
    ).toBe(false);
  });

  it("rejects voter with empty entityId", () => {
    expect(
      CastVoteBodySchema.safeParse({
        ...valid,
        voter: { entityType: "member", entityId: "" },
      }).success,
    ).toBe(false);
  });

  it("rejects voter with missing entityId", () => {
    expect(
      CastVoteBodySchema.safeParse({
        ...valid,
        voter: { entityType: "member" },
      }).success,
    ).toBe(false);
  });

  it("rejects missing encryptedData", () => {
    expect(CastVoteBodySchema.safeParse(omit(valid, "encryptedData")).success).toBe(false);
  });

  it("strips extra properties", () => {
    const result = CastVoteBodySchema.safeParse({ ...valid, extra: "field" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect("extra" in result.data).toBe(false);
    }
  });
});

// ── PollQuerySchema ──────────────────────────────────────────────

describe("PollQuerySchema", () => {
  it("accepts empty query", () => {
    expect(PollQuerySchema.safeParse({}).success).toBe(true);
  });

  it("parses includeArchived boolean", () => {
    const result = PollQuerySchema.safeParse({ includeArchived: "true" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.includeArchived).toBe(true);
    }
  });

  it("parses status filter", () => {
    const result = PollQuerySchema.safeParse({ status: "open" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("open");
    }
  });

  it("accepts closed status", () => {
    const result = PollQuerySchema.safeParse({ status: "closed" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("closed");
    }
  });

  it("rejects invalid status", () => {
    expect(PollQuerySchema.safeParse({ status: "invalid" }).success).toBe(false);
  });
});

// ── PollVoteQuerySchema ──────────────────────────────────────────

describe("PollVoteQuerySchema", () => {
  it("accepts empty query", () => {
    expect(PollVoteQuerySchema.safeParse({}).success).toBe(true);
  });

  it("parses includeArchived boolean", () => {
    const result = PollVoteQuerySchema.safeParse({ includeArchived: "true" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.includeArchived).toBe(true);
    }
  });
});

import * as Automerge from "@automerge/automerge";
import { describe, expect, it, vi } from "vitest";

import { fromDoc } from "../../factories/document-factory.js";
import {
  addBucketAssignmentProjection,
  applyFriendCodeProjection,
  applyFriendConnectionProjection,
  applyKeyGrantProjection,
  archiveFriendCodeProjection,
  archiveFriendConnectionProjection,
  projectFriendCode,
  projectFriendConnection,
  projectKeyGrant,
  removeBucketAssignmentProjection,
  revokeKeyGrantProjection,
  updateFriendConnectionStatusProjection,
  updateFriendConnectionVisibilityProjection,
} from "../../projections/friend-projection.js";

import type {
  FriendCodeInput,
  FriendConnectionInput,
  KeyGrantInput,
} from "../../projections/friend-projection.js";
import type { PrivacyConfigDocument } from "../../schemas/privacy-config.js";
import type {
  AccountId,
  BucketId,
  FriendCodeId,
  FriendConnectionId,
  FriendConnectionStatus,
  KeyGrantId,
} from "@pluralscape/types";

// ── helpers ──────────────────────────────────────────────────────────

function makePrivacyConfigDoc(): Automerge.Doc<PrivacyConfigDocument> {
  return fromDoc({
    buckets: {},
    contentTags: {},
    friendConnections: {},
    friendCodes: {},
    keyGrants: {},
  });
}

function makeFriendCodeInput(overrides?: Partial<FriendCodeInput>): FriendCodeInput {
  return {
    id: "fcode_1" as FriendCodeId,
    accountId: "acc_1" as AccountId,
    code: "ABCD-EFGH-1234",
    createdAt: 1000,
    expiresAt: 2000,
    ...overrides,
  };
}

function makeFriendConnectionInput(
  overrides?: Partial<FriendConnectionInput>,
): FriendConnectionInput {
  return {
    id: "fc_1" as FriendConnectionId,
    accountId: "acc_1" as AccountId,
    friendAccountId: "acc_2" as AccountId,
    status: "pending" as FriendConnectionStatus,
    visibility: JSON.stringify({
      showMembers: true,
      showGroups: false,
      showStructure: false,
      allowFrontingNotifications: true,
    }),
    assignedBucketIds: ["bkt_1" as BucketId, "bkt_2" as BucketId],
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

function makeKeyGrantInput(overrides?: Partial<KeyGrantInput>): KeyGrantInput {
  return {
    id: "kg_1" as KeyGrantId,
    bucketId: "bkt_1" as BucketId,
    friendAccountId: "acc_2" as AccountId,
    encryptedBucketKey: "base64encodedkey==",
    keyVersion: 1,
    createdAt: 1000,
    ...overrides,
  };
}

// ── projectFriendCode ────────────────────────────────────────────────

describe("projectFriendCode", () => {
  it("converts input to CrdtFriendCode with archived=false", () => {
    const input = makeFriendCodeInput();
    const result = projectFriendCode(input);

    expect(result.id.val).toBe("fcode_1");
    expect(result.accountId.val).toBe("acc_1");
    expect(result.code.val).toBe("ABCD-EFGH-1234");
    expect(result.createdAt).toBe(1000);
    expect(result.expiresAt).toBe(2000);
    expect(result.archived).toBe(false);
  });

  it("handles null expiresAt", () => {
    const input = makeFriendCodeInput({ expiresAt: null });
    const result = projectFriendCode(input);

    expect(result.expiresAt).toBeNull();
  });
});

// ── projectFriendConnection ──────────────────────────────────────────

describe("projectFriendConnection", () => {
  it("converts input with assignedBuckets map from array", () => {
    const input = makeFriendConnectionInput();
    const result = projectFriendConnection(input);

    expect(result.id.val).toBe("fc_1");
    expect(result.accountId.val).toBe("acc_1");
    expect(result.friendAccountId.val).toBe("acc_2");
    expect(result.status.val).toBe("pending");
    expect(result.visibility.val).toBe(
      JSON.stringify({
        showMembers: true,
        showGroups: false,
        showStructure: false,
        allowFrontingNotifications: true,
      }),
    );
    expect(result.assignedBuckets).toEqual({ bkt_1: true, bkt_2: true });
    expect(result.archived).toBe(false);
  });

  it("handles empty assignedBucketIds array", () => {
    const input = makeFriendConnectionInput({ assignedBucketIds: [] });
    const result = projectFriendConnection(input);

    expect(result.assignedBuckets).toEqual({});
  });

  it("includes createdAt and updatedAt from input", () => {
    const input = makeFriendConnectionInput({ createdAt: 1000, updatedAt: 1000 });
    const result = projectFriendConnection(input);

    expect(result.createdAt).toBe(1000);
    expect(result.updatedAt).toBe(1000);
  });
});

// ── projectKeyGrant ──────────────────────────────────────────────────

describe("projectKeyGrant", () => {
  it("converts input with revokedAt=null", () => {
    const input = makeKeyGrantInput();
    const result = projectKeyGrant(input);

    expect(result.id.val).toBe("kg_1");
    expect(result.bucketId.val).toBe("bkt_1");
    expect(result.friendAccountId.val).toBe("acc_2");
    expect(result.encryptedBucketKey.val).toBe("base64encodedkey==");
    expect(result.keyVersion).toBe(1);
    expect(result.createdAt).toBe(1000);
    expect(result.revokedAt).toBeNull();
  });
});

// ── applyFriendCodeProjection ────────────────────────────────────────

describe("applyFriendCodeProjection", () => {
  it("adds code to doc.friendCodes keyed by id", () => {
    const input = makeFriendCodeInput();
    let doc = makePrivacyConfigDoc();

    doc = Automerge.change(doc, (d) => {
      applyFriendCodeProjection(d, input);
    });

    expect(Object.keys(doc.friendCodes)).toHaveLength(1);
    expect(doc.friendCodes["fcode_1"]?.id.val).toBe("fcode_1");
    expect(doc.friendCodes["fcode_1"]?.code.val).toBe("ABCD-EFGH-1234");
    expect(doc.friendCodes["fcode_1"]?.archived).toBe(false);
  });

  it("overwrites existing code with same id", () => {
    const input1 = makeFriendCodeInput({ code: "OLD-CODE-0000" });
    const input2 = makeFriendCodeInput({ code: "NEW-CODE-9999" });
    let doc = makePrivacyConfigDoc();

    doc = Automerge.change(doc, (d) => {
      applyFriendCodeProjection(d, input1);
    });
    doc = Automerge.change(doc, (d) => {
      applyFriendCodeProjection(d, input2);
    });

    expect(Object.keys(doc.friendCodes)).toHaveLength(1);
    expect(doc.friendCodes["fcode_1"]?.code.val).toBe("NEW-CODE-9999");
  });
});

// ── applyFriendConnectionProjection ──────────────────────────────────

describe("applyFriendConnectionProjection", () => {
  it("adds connection to doc.friendConnections keyed by id", () => {
    const input = makeFriendConnectionInput();
    let doc = makePrivacyConfigDoc();

    doc = Automerge.change(doc, (d) => {
      applyFriendConnectionProjection(d, input);
    });

    expect(Object.keys(doc.friendConnections)).toHaveLength(1);
    const fc = doc.friendConnections["fc_1"];
    expect(fc?.id.val).toBe("fc_1");
    expect(fc?.status.val).toBe("pending");
    expect(fc?.assignedBuckets["bkt_1"]).toBe(true);
    expect(fc?.assignedBuckets["bkt_2"]).toBe(true);
  });
});

// ── applyKeyGrantProjection ──────────────────────────────────────────

describe("applyKeyGrantProjection", () => {
  it("adds key grant to doc.keyGrants keyed by id", () => {
    const input = makeKeyGrantInput();
    let doc = makePrivacyConfigDoc();

    doc = Automerge.change(doc, (d) => {
      applyKeyGrantProjection(d, input);
    });

    expect(Object.keys(doc.keyGrants)).toHaveLength(1);
    const kg = doc.keyGrants["kg_1"];
    expect(kg?.id.val).toBe("kg_1");
    expect(kg?.encryptedBucketKey.val).toBe("base64encodedkey==");
    expect(kg?.revokedAt).toBeNull();
  });
});

// ── archiveFriendCodeProjection ──────────────────────────────────────

describe("archiveFriendCodeProjection", () => {
  it("sets archived=true on existing code", () => {
    const input = makeFriendCodeInput();
    let doc = makePrivacyConfigDoc();

    doc = Automerge.change(doc, (d) => {
      applyFriendCodeProjection(d, input);
    });
    doc = Automerge.change(doc, (d) => {
      archiveFriendCodeProjection(d, "fcode_1");
    });

    expect(doc.friendCodes["fcode_1"]?.archived).toBe(true);
  });

  it("is a no-op if code does not exist", () => {
    let doc = makePrivacyConfigDoc();

    doc = Automerge.change(doc, (d) => {
      archiveFriendCodeProjection(d, "nonexistent_code");
    });

    expect(Object.keys(doc.friendCodes)).toHaveLength(0);
  });
});

// ── updateFriendConnectionStatusProjection ───────────────────────────

describe("updateFriendConnectionStatusProjection", () => {
  it("updates status field on existing connection", () => {
    const input = makeFriendConnectionInput({ status: "pending" });
    let doc = makePrivacyConfigDoc();

    doc = Automerge.change(doc, (d) => {
      applyFriendConnectionProjection(d, input);
    });
    doc = Automerge.change(doc, (d) => {
      updateFriendConnectionStatusProjection(d, "fc_1", "accepted", 2000);
    });

    expect(doc.friendConnections["fc_1"]?.status.val).toBe("accepted");
  });

  it("is a no-op if connection does not exist", () => {
    let doc = makePrivacyConfigDoc();

    doc = Automerge.change(doc, (d) => {
      updateFriendConnectionStatusProjection(d, "nonexistent_fc", "accepted", 2000);
    });

    expect(Object.keys(doc.friendConnections)).toHaveLength(0);
  });
});

// ── updateFriendConnectionVisibilityProjection ───────────────────────

describe("updateFriendConnectionVisibilityProjection", () => {
  it("updates visibility field on existing connection", () => {
    const input = makeFriendConnectionInput();
    const newVisibility = JSON.stringify({
      showMembers: false,
      showGroups: true,
      showStructure: true,
      allowFrontingNotifications: false,
    });
    let doc = makePrivacyConfigDoc();

    doc = Automerge.change(doc, (d) => {
      applyFriendConnectionProjection(d, input);
    });
    doc = Automerge.change(doc, (d) => {
      updateFriendConnectionVisibilityProjection(d, "fc_1", newVisibility, 2000);
    });

    expect(doc.friendConnections["fc_1"]?.visibility.val).toBe(newVisibility);
  });

  it("is a no-op if connection does not exist", () => {
    let doc = makePrivacyConfigDoc();

    doc = Automerge.change(doc, (d) => {
      updateFriendConnectionVisibilityProjection(d, "nonexistent_fc", "{}", 2000);
    });

    expect(Object.keys(doc.friendConnections)).toHaveLength(0);
  });
});

// ── addBucketAssignmentProjection ────────────────────────────────────

describe("addBucketAssignmentProjection", () => {
  it("adds bucketId to assignedBuckets map", () => {
    const input = makeFriendConnectionInput({ assignedBucketIds: [] });
    let doc = makePrivacyConfigDoc();

    doc = Automerge.change(doc, (d) => {
      applyFriendConnectionProjection(d, input);
    });
    doc = Automerge.change(doc, (d) => {
      addBucketAssignmentProjection(d, "fc_1", "bkt_new" as BucketId, 2000);
    });

    expect(doc.friendConnections["fc_1"]?.assignedBuckets["bkt_new"]).toBe(true);
  });

  it("is idempotent when adding existing bucket", () => {
    const input = makeFriendConnectionInput({ assignedBucketIds: ["bkt_1" as BucketId] });
    let doc = makePrivacyConfigDoc();

    doc = Automerge.change(doc, (d) => {
      applyFriendConnectionProjection(d, input);
    });
    doc = Automerge.change(doc, (d) => {
      addBucketAssignmentProjection(d, "fc_1", "bkt_1" as BucketId, 2000);
    });

    expect(doc.friendConnections["fc_1"]?.assignedBuckets["bkt_1"]).toBe(true);
    expect(Object.keys(doc.friendConnections["fc_1"]?.assignedBuckets ?? {})).toHaveLength(1);
  });

  it("is a no-op if connection does not exist", () => {
    let doc = makePrivacyConfigDoc();

    doc = Automerge.change(doc, (d) => {
      addBucketAssignmentProjection(d, "nonexistent_fc", "bkt_1" as BucketId, 2000);
    });

    expect(Object.keys(doc.friendConnections)).toHaveLength(0);
  });
});

// ── removeBucketAssignmentProjection ────────────────────────────────

describe("removeBucketAssignmentProjection", () => {
  it("removes bucketId from assignedBuckets map", () => {
    const input = makeFriendConnectionInput({
      assignedBucketIds: ["bkt_1" as BucketId, "bkt_2" as BucketId],
    });
    let doc = makePrivacyConfigDoc();

    doc = Automerge.change(doc, (d) => {
      applyFriendConnectionProjection(d, input);
    });
    doc = Automerge.change(doc, (d) => {
      removeBucketAssignmentProjection(d, "fc_1", "bkt_1" as BucketId, 3000);
    });

    expect(doc.friendConnections["fc_1"]?.assignedBuckets["bkt_1"]).toBeUndefined();
    expect(doc.friendConnections["fc_1"]?.assignedBuckets["bkt_2"]).toBe(true);
    expect(doc.friendConnections["fc_1"]?.updatedAt).toBe(3000);
  });

  it("is a no-op when removing a bucket that is not assigned", () => {
    const input = makeFriendConnectionInput({ assignedBucketIds: ["bkt_1" as BucketId] });
    let doc = makePrivacyConfigDoc();

    doc = Automerge.change(doc, (d) => {
      applyFriendConnectionProjection(d, input);
    });
    doc = Automerge.change(doc, (d) => {
      removeBucketAssignmentProjection(d, "fc_1", "bkt_nonexistent" as BucketId, 3000);
    });

    expect(doc.friendConnections["fc_1"]?.assignedBuckets["bkt_1"]).toBe(true);
    expect(doc.friendConnections["fc_1"]?.updatedAt).toBe(3000);
  });

  it("is a no-op if connection does not exist", () => {
    let doc = makePrivacyConfigDoc();

    doc = Automerge.change(doc, (d) => {
      removeBucketAssignmentProjection(d, "nonexistent_fc", "bkt_1" as BucketId, 3000);
    });

    expect(Object.keys(doc.friendConnections)).toHaveLength(0);
  });

  it("logs a warning when connection is not found", () => {
    const doc = makePrivacyConfigDoc();
    const logger = { warn: vi.fn() };

    Automerge.change(doc, (d) => {
      removeBucketAssignmentProjection(d, "nonexistent_fc", "bkt_1" as BucketId, 3000, logger);
    });

    expect(logger.warn).toHaveBeenCalledWith(
      "removeBucketAssignmentProjection: connection not found",
      { connectionId: "nonexistent_fc" },
    );
  });
});

// ── archiveFriendConnectionProjection ──────────────────────────────

describe("archiveFriendConnectionProjection", () => {
  it("sets archived=true on existing connection", () => {
    const input = makeFriendConnectionInput();
    let doc = makePrivacyConfigDoc();

    doc = Automerge.change(doc, (d) => {
      applyFriendConnectionProjection(d, input);
    });
    doc = Automerge.change(doc, (d) => {
      archiveFriendConnectionProjection(d, "fc_1");
    });

    expect(doc.friendConnections["fc_1"]?.archived).toBe(true);
  });

  it("is a no-op if connection does not exist", () => {
    let doc = makePrivacyConfigDoc();

    doc = Automerge.change(doc, (d) => {
      archiveFriendConnectionProjection(d, "nonexistent_fc");
    });

    expect(Object.keys(doc.friendConnections)).toHaveLength(0);
  });

  it("logs a warning when connection is not found", () => {
    const doc = makePrivacyConfigDoc();
    const logger = { warn: vi.fn() };

    Automerge.change(doc, (d) => {
      archiveFriendConnectionProjection(d, "nonexistent_fc", logger);
    });

    expect(logger.warn).toHaveBeenCalledWith(
      "archiveFriendConnectionProjection: connection not found",
      { connectionId: "nonexistent_fc" },
    );
  });

  it("does not affect other fields on the connection", () => {
    const input = makeFriendConnectionInput();
    let doc = makePrivacyConfigDoc();

    doc = Automerge.change(doc, (d) => {
      applyFriendConnectionProjection(d, input);
    });
    doc = Automerge.change(doc, (d) => {
      archiveFriendConnectionProjection(d, "fc_1");
    });

    const fc = doc.friendConnections["fc_1"];
    expect(fc?.archived).toBe(true);
    expect(fc?.status.val).toBe("pending");
    expect(fc?.id.val).toBe("fc_1");
  });
});

// ── revokeKeyGrantProjection ─────────────────────────────────────────

describe("revokeKeyGrantProjection", () => {
  it("sets revokedAt on existing grant", () => {
    const input = makeKeyGrantInput();
    let doc = makePrivacyConfigDoc();

    doc = Automerge.change(doc, (d) => {
      applyKeyGrantProjection(d, input);
    });
    doc = Automerge.change(doc, (d) => {
      revokeKeyGrantProjection(d, "kg_1", 9999);
    });

    expect(doc.keyGrants["kg_1"]?.revokedAt).toBe(9999);
  });

  it("is a no-op if grant does not exist", () => {
    let doc = makePrivacyConfigDoc();

    doc = Automerge.change(doc, (d) => {
      revokeKeyGrantProjection(d, "nonexistent_kg", 9999);
    });

    expect(Object.keys(doc.keyGrants)).toHaveLength(0);
  });
});

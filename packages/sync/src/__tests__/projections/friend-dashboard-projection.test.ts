import * as Automerge from "@automerge/automerge";
import { describe, expect, it, vi } from "vitest";

import { createBucketDocument } from "../../factories/document-factory.js";
import {
  applyDashboardSnapshotProjection,
  projectDashboardSnapshot,
} from "../../projections/friend-dashboard-projection.js";

import type { FriendDashboardResponse } from "@pluralscape/types";

// ── Test helpers ────────────────────────────────────────────────

function makeDashboard(overrides?: Partial<FriendDashboardResponse>): FriendDashboardResponse {
  return {
    systemId: "sys_test" as FriendDashboardResponse["systemId"],
    memberCount: 7,
    activeFronting: {
      sessions: [],
      isCofronting: false,
    },
    visibleMembers: [],
    visibleCustomFronts: [],
    visibleStructureEntities: [],
    keyGrants: [],
    ...overrides,
  };
}

// ── Tests ───────────────────────────────────────────────────────

describe("projectDashboardSnapshot", () => {
  it("converts empty dashboard to minimal snapshot", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1700000000000);

    const result = projectDashboardSnapshot(makeDashboard());

    expect(result.memberCount).toBe(7);
    expect(result.isCofronting).toBe(false);
    expect(result.activeSessionCount).toBe(0);
    expect(result.lastUpdatedAt).toBe(1700000000000);

    vi.useRealTimers();
  });

  it("reflects co-fronting and session count", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1700000000000);

    const dashboard = makeDashboard({
      memberCount: 12,
      activeFronting: {
        sessions: [
          {
            id: "fs_1" as never,
            memberId: "mem_1" as never,
            customFrontId: null,
            structureEntityId: null,
            startTime: 1000 as never,
            encryptedData: "base64data",
          },
          {
            id: "fs_2" as never,
            memberId: "mem_2" as never,
            customFrontId: null,
            structureEntityId: null,
            startTime: 2000 as never,
            encryptedData: "base64data2",
          },
        ],
        isCofronting: true,
      },
    });

    const result = projectDashboardSnapshot(dashboard);

    expect(result.memberCount).toBe(12);
    expect(result.isCofronting).toBe(true);
    expect(result.activeSessionCount).toBe(2);

    vi.useRealTimers();
  });

  it("handles zero members", () => {
    const result = projectDashboardSnapshot(makeDashboard({ memberCount: 0 }));
    expect(result.memberCount).toBe(0);
  });
});

describe("applyDashboardSnapshotProjection", () => {
  it("sets dashboardSnapshot on the document", () => {
    let doc = createBucketDocument();
    expect(doc.dashboardSnapshot).toBeNull();

    doc = Automerge.change(doc, (d) => {
      applyDashboardSnapshotProjection(d, makeDashboard());
    });

    expect(doc.dashboardSnapshot).not.toBeNull();
    expect(doc.dashboardSnapshot?.memberCount).toBe(7);
    expect(doc.dashboardSnapshot?.isCofronting).toBe(false);
    expect(doc.dashboardSnapshot?.activeSessionCount).toBe(0);
  });

  it("overwrites existing snapshot", () => {
    let doc = createBucketDocument();

    doc = Automerge.change(doc, (d) => {
      applyDashboardSnapshotProjection(d, makeDashboard({ memberCount: 3 }));
    });

    doc = Automerge.change(doc, (d) => {
      applyDashboardSnapshotProjection(d, makeDashboard({ memberCount: 10 }));
    });

    expect(doc.dashboardSnapshot?.memberCount).toBe(10);
  });
});

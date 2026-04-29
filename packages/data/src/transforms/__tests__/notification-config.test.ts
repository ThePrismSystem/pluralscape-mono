import { describe, expect, it } from "vitest";

import { narrowNotificationConfig, narrowNotificationConfigPage } from "../notification-config.js";

import type { NotificationConfigWire, NotificationEventType } from "@pluralscape/types";

const NOW = 1_700_000_000_000;
const LATER = 1_700_002_000_000;

type LiveWire = Extract<NotificationConfigWire, { archived: false }>;
type ArchivedWire = Extract<NotificationConfigWire, { archived: true }>;

function makeLiveRaw(overrides?: Partial<LiveWire>): LiveWire {
  return {
    id: "nc_test0001",
    systemId: "sys_test001",
    eventType: "switch-reminder" as NotificationEventType,
    enabled: true,
    pushEnabled: false,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
    archived: false,
    ...overrides,
  };
}

function makeArchivedRaw(): ArchivedWire {
  return {
    id: "nc_test0001",
    systemId: "sys_test001",
    eventType: "switch-reminder" as NotificationEventType,
    enabled: true,
    pushEnabled: false,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
    archived: true,
    archivedAt: LATER,
  };
}

describe("narrowNotificationConfig", () => {
  it("returns live entity with archived: false", () => {
    const result = narrowNotificationConfig(makeLiveRaw());
    expect(result.archived).toBe(false);
    expect(result.id).toBe("nc_test0001");
    expect(result.systemId).toBe("sys_test001");
    expect(result.eventType).toBe("switch-reminder");
    expect(result.enabled).toBe(true);
    expect(result.pushEnabled).toBe(false);
    expect(result.version).toBe(1);
    expect(result.createdAt).toBe(NOW);
    expect(result.updatedAt).toBe(NOW);
  });

  it("returns archived entity with archivedAt", () => {
    const result = narrowNotificationConfig(makeArchivedRaw());
    expect(result.archived).toBe(true);
    if (!result.archived) throw new Error("Expected archived shape");
    expect(result.archivedAt).toBe(LATER);
  });

  it("handles pushEnabled: true", () => {
    const result = narrowNotificationConfig(makeLiveRaw({ pushEnabled: true }));
    expect(result.pushEnabled).toBe(true);
  });

  it("handles enabled: false", () => {
    const result = narrowNotificationConfig(makeLiveRaw({ enabled: false }));
    expect(result.enabled).toBe(false);
  });
});

describe("narrowNotificationConfigPage", () => {
  it("narrows all items and preserves cursor", () => {
    const page = { data: [makeLiveRaw(), makeArchivedRaw()], nextCursor: "cursor_abc" };
    const result = narrowNotificationConfigPage(page);
    expect(result.data).toHaveLength(2);
    expect(result.nextCursor).toBe("cursor_abc");
  });

  it("handles empty page", () => {
    const result = narrowNotificationConfigPage({ data: [], nextCursor: null });
    expect(result.data).toHaveLength(0);
    expect(result.nextCursor).toBeNull();
  });
});

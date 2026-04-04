// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderHookWithProviders } from "./helpers/render-hook-with-providers.js";

import type { UnixMillis } from "@pluralscape/types";

type CapturedInput = Record<string, unknown>;
type CapturedOpts = Record<string, unknown>;
let lastQueryInput: CapturedInput = {};
let lastQueryOpts: CapturedOpts = {};

const mockUtils = {};

vi.mock("@pluralscape/api-client/trpc", () => {
  return {
    trpc: {
      account: {
        queryAuditLog: {
          useInfiniteQuery: (input: CapturedInput, opts: CapturedOpts = {}) => {
            lastQueryInput = input;
            lastQueryOpts = opts;
            return { data: undefined, isLoading: true };
          },
        },
      },
      useUtils: () => mockUtils,
    },
  };
});

const { useAuditLog } = await import("../use-audit-log.js");

beforeEach(() => {
  lastQueryInput = {};
  lastQueryOpts = {};
  vi.clearAllMocks();
});

describe("useAuditLog", () => {
  it("does not require masterKey (no enabled guard)", () => {
    renderHookWithProviders(() => useAuditLog());
    expect(lastQueryOpts["enabled"]).toBeUndefined();
  });

  it("passes getNextPageParam", () => {
    renderHookWithProviders(() => useAuditLog());
    expect(lastQueryOpts["getNextPageParam"]).toBeTypeOf("function");
  });

  it("uses DEFAULT_LIST_LIMIT (20) when limit is not provided", () => {
    renderHookWithProviders(() => useAuditLog());
    expect(lastQueryInput["limit"]).toBe(20);
  });

  it("passes custom limit when provided", () => {
    renderHookWithProviders(() => useAuditLog({ limit: 50 }));
    expect(lastQueryInput["limit"]).toBe(50);
  });

  it("maps eventType to event_type in input", () => {
    renderHookWithProviders(() => useAuditLog({ eventType: "member.created" }));
    expect(lastQueryInput["event_type"]).toBe("member.created");
  });

  it("maps resourceType to resource_type in input", () => {
    renderHookWithProviders(() => useAuditLog({ resourceType: "member" }));
    expect(lastQueryInput["resource_type"]).toBe("member");
  });

  it("passes from and to date filters", () => {
    renderHookWithProviders(() =>
      useAuditLog({ from: 1000 as UnixMillis, to: 2000 as UnixMillis }),
    );
    expect(lastQueryInput["from"]).toBe(1000);
    expect(lastQueryInput["to"]).toBe(2000);
  });

  it("does not include systemId in input (account-level query)", () => {
    renderHookWithProviders(() => useAuditLog());
    expect(lastQueryInput["systemId"]).toBeUndefined();
  });

  it("passes undefined filters when opts are not provided", () => {
    renderHookWithProviders(() => useAuditLog());
    expect(lastQueryInput["event_type"]).toBeUndefined();
    expect(lastQueryInput["resource_type"]).toBeUndefined();
    expect(lastQueryInput["from"]).toBeUndefined();
    expect(lastQueryInput["to"]).toBeUndefined();
  });
});

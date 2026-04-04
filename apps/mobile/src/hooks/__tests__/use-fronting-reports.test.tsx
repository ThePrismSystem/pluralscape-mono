// @vitest-environment happy-dom
import { configureSodium, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { encryptFrontingReportInput } from "@pluralscape/data/transforms/fronting-report";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { TEST_MASTER_KEY, TEST_SYSTEM_ID } from "./helpers/test-crypto.js";

import type { FrontingReportRaw } from "@pluralscape/data/transforms/fronting-report";
import type { FrontingReportId, UnixMillis } from "@pluralscape/types";

beforeAll(async () => {
  configureSodium(new WasmSodiumAdapter());
  await initSodium();
});

vi.mock("react", async () => {
  const actual = await vi.importActual("react");
  return { ...(actual as object), useCallback: (fn: unknown) => fn };
});

// ── Capture tRPC hook calls ──────────────────────────────────────────
type CapturedOpts = Record<string, unknown>;
let lastGetOpts: CapturedOpts = {};
let lastListOpts: CapturedOpts = {};
let lastCreateMutationOpts: CapturedOpts = {};
let lastDeleteMutationOpts: CapturedOpts = {};

const mockUtils = {
  frontingReport: {
    get: { invalidate: vi.fn() },
    list: { invalidate: vi.fn() },
  },
};

vi.mock("@pluralscape/api-client/trpc", () => ({
  trpc: {
    frontingReport: {
      get: {
        useQuery: (_input: unknown, opts: CapturedOpts) => {
          lastGetOpts = opts;
          return { data: undefined, isLoading: true, status: "loading" };
        },
      },
      list: {
        useInfiniteQuery: (_input: unknown, opts: CapturedOpts) => {
          lastListOpts = opts;
          return { data: undefined, isLoading: true, status: "loading" };
        },
      },
      create: {
        useMutation: (opts: CapturedOpts) => {
          lastCreateMutationOpts = opts;
          return { mutate: vi.fn() };
        },
      },
      delete: {
        useMutation: (opts: CapturedOpts) => {
          lastDeleteMutationOpts = opts;
          return { mutate: vi.fn() };
        },
      },
    },
    useUtils: () => mockUtils,
  },
}));

vi.mock("../../providers/crypto-provider.js", () => ({
  useMasterKey: vi.fn(() => TEST_MASTER_KEY),
}));
vi.mock("../../providers/system-provider.js", () => ({
  useActiveSystemId: vi.fn(() => TEST_SYSTEM_ID),
}));

const { useMasterKey } = await import("../../providers/crypto-provider.js");
const { useFrontingReport, useFrontingReportsList, useGenerateReport, useDeleteReport } =
  await import("../use-fronting-reports.js");

// ── Fixtures ─────────────────────────────────────────────────────────
const NOW = 1_700_000_000_000 as UnixMillis;
const START = 1_699_900_000_000 as UnixMillis;
const END = 1_700_000_000_000 as UnixMillis;

function makeRawReport(id: string): FrontingReportRaw {
  const encrypted = encryptFrontingReportInput(
    {
      dateRange: { start: START, end: END },
      memberBreakdowns: [],
      chartData: [],
    },
    TEST_MASTER_KEY,
  );
  return {
    id: id as FrontingReportId,
    systemId: TEST_SYSTEM_ID,
    format: "html",
    generatedAt: NOW,
    version: 1,
    archived: false,
    archivedAt: null,
    ...encrypted,
  };
}

// ── Tests ────────────────────────────────────────────────────────────
describe("useFrontingReport", () => {
  it("enables when masterKey is present", () => {
    useFrontingReport("fr-1" as FrontingReportId);
    expect(lastGetOpts["enabled"]).toBe(true);
  });

  it("disables when masterKey is null", () => {
    vi.mocked(useMasterKey).mockReturnValueOnce(null);
    useFrontingReport("fr-1" as FrontingReportId);
    expect(lastGetOpts["enabled"]).toBe(false);
  });

  it("select decrypts raw report and drops wire-only fields", () => {
    useFrontingReport("fr-1" as FrontingReportId);
    const select = lastGetOpts["select"] as (raw: FrontingReportRaw) => unknown;
    const raw = makeRawReport("fr-1");
    const result = select(raw) as Record<string, unknown>;
    expect(result["id"]).toBe("fr-1");
    expect(result["systemId"]).toBe(TEST_SYSTEM_ID);
    expect(result["format"]).toBe("html");
    expect(result["dateRange"]).toEqual({ start: START, end: END });
    expect(result["memberBreakdowns"]).toEqual([]);
    expect(result["chartData"]).toEqual([]);
    // Wire-only fields should not be present
    expect(result["version"]).toBeUndefined();
    expect(result["archived"]).toBeUndefined();
    expect(result["encryptedData"]).toBeUndefined();
  });
});

describe("useFrontingReportsList", () => {
  it("select decrypts each page item", () => {
    useFrontingReportsList();
    const select = lastListOpts["select"] as (data: unknown) => unknown;
    const raw1 = makeRawReport("fr-1");
    const raw2 = makeRawReport("fr-2");
    const infiniteData = {
      pages: [{ data: [raw1, raw2], nextCursor: null }],
      pageParams: [undefined],
    };
    const result = select(infiniteData) as {
      pages: [{ data: [Record<string, unknown>, Record<string, unknown>] }];
    };
    expect(result.pages[0].data).toHaveLength(2);
    expect(result.pages[0].data[0]["id"]).toBe("fr-1");
    expect(result.pages[0].data[1]["id"]).toBe("fr-2");
    // Verify wire-only fields stripped from list items too
    expect(result.pages[0].data[0]["version"]).toBeUndefined();
  });
});

describe("useGenerateReport", () => {
  it("invalidates list onSuccess", () => {
    mockUtils.frontingReport.list.invalidate.mockClear();
    useGenerateReport();
    const onSuccess = lastCreateMutationOpts["onSuccess"] as () => void;
    onSuccess();
    expect(mockUtils.frontingReport.list.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
    });
  });
});

describe("useDeleteReport", () => {
  it("invalidates get and list onSuccess", () => {
    mockUtils.frontingReport.get.invalidate.mockClear();
    mockUtils.frontingReport.list.invalidate.mockClear();
    useDeleteReport();
    const onSuccess = lastDeleteMutationOpts["onSuccess"] as (
      data: unknown,
      variables: { reportId: string },
    ) => void;
    onSuccess(undefined, { reportId: "fr-1" });
    expect(mockUtils.frontingReport.get.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      reportId: "fr-1",
    });
    expect(mockUtils.frontingReport.list.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
    });
  });
});

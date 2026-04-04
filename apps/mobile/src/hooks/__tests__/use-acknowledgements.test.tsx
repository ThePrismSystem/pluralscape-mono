// @vitest-environment happy-dom
import { configureSodium, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { encryptAcknowledgementInput } from "@pluralscape/data/transforms/acknowledgement";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { TEST_MASTER_KEY, TEST_SYSTEM_ID } from "./helpers/test-crypto.js";

import type { AcknowledgementRaw } from "@pluralscape/data/transforms/acknowledgement";
import type { AcknowledgementId, MemberId, UnixMillis } from "@pluralscape/types";

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
let lastQueryOpts: CapturedOpts = {};
let lastInfiniteOpts: CapturedOpts = {};
let lastCreateMutationOpts: CapturedOpts = {};
let lastConfirmMutationOpts: CapturedOpts = {};
let lastArchiveMutationOpts: CapturedOpts = {};
let lastRestoreMutationOpts: CapturedOpts = {};
let lastDeleteMutationOpts: CapturedOpts = {};

const mockUtils = {
  acknowledgement: {
    get: { invalidate: vi.fn() },
    list: { invalidate: vi.fn() },
  },
};

vi.mock("@pluralscape/api-client/trpc", () => ({
  trpc: {
    acknowledgement: {
      get: {
        useQuery: (_input: unknown, opts: CapturedOpts) => {
          lastQueryOpts = opts;
          return { data: undefined, isLoading: true, status: "loading" };
        },
      },
      list: {
        useInfiniteQuery: (_input: unknown, opts: CapturedOpts) => {
          lastInfiniteOpts = opts;
          return { data: undefined, isLoading: true, status: "loading" };
        },
      },
      create: {
        useMutation: (opts: CapturedOpts) => {
          lastCreateMutationOpts = opts;
          return { mutate: vi.fn() };
        },
      },
      confirm: {
        useMutation: (opts: CapturedOpts) => {
          lastConfirmMutationOpts = opts;
          return { mutate: vi.fn() };
        },
      },
      archive: {
        useMutation: (opts: CapturedOpts) => {
          lastArchiveMutationOpts = opts;
          return { mutate: vi.fn() };
        },
      },
      restore: {
        useMutation: (opts: CapturedOpts) => {
          lastRestoreMutationOpts = opts;
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
const {
  useAcknowledgement,
  useAcknowledgementsList,
  useCreateAcknowledgement,
  useConfirmAcknowledgement,
  useArchiveAcknowledgement,
  useRestoreAcknowledgement,
  useDeleteAcknowledgement,
} = await import("../use-acknowledgements.js");

// ── Fixtures ─────────────────────────────────────────────────────────
const NOW = 1_700_000_000_000 as UnixMillis;

function makeRawAcknowledgement(id: string): AcknowledgementRaw {
  const encrypted = encryptAcknowledgementInput(
    {
      message: "Please read",
      targetMemberId: "m-1" as MemberId,
      confirmedAt: null,
    },
    TEST_MASTER_KEY,
  );
  return {
    id: id as AcknowledgementId,
    systemId: TEST_SYSTEM_ID,
    createdByMemberId: null,
    confirmed: false,
    version: 1,
    archived: false,
    archivedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...encrypted,
  };
}

// ── Tests ────────────────────────────────────────────────────────────
describe("useAcknowledgement", () => {
  it("enables when masterKey is present", () => {
    useAcknowledgement("ack-1" as AcknowledgementId);
    expect(lastQueryOpts["enabled"]).toBe(true);
  });

  it("disables when masterKey is null", () => {
    vi.mocked(useMasterKey).mockReturnValueOnce(null);
    useAcknowledgement("ack-1" as AcknowledgementId);
    expect(lastQueryOpts["enabled"]).toBe(false);
  });

  it("select decrypts raw acknowledgement correctly", () => {
    useAcknowledgement("ack-1" as AcknowledgementId);
    const select = lastQueryOpts["select"] as (raw: AcknowledgementRaw) => unknown;
    const raw = makeRawAcknowledgement("ack-1");
    const result = select(raw) as Record<string, unknown>;
    expect(result["message"]).toBe("Please read");
    expect(result["targetMemberId"]).toBe("m-1");
    expect(result["confirmedAt"]).toBeNull();
    expect(result["confirmed"]).toBe(false);
    expect(result["archived"]).toBe(false);
  });
});

describe("useAcknowledgementsList", () => {
  it("select decrypts each page item", () => {
    useAcknowledgementsList();
    const select = lastInfiniteOpts["select"] as (data: unknown) => unknown;
    const raw1 = makeRawAcknowledgement("ack-1");
    const raw2 = makeRawAcknowledgement("ack-2");
    const infiniteData = {
      pages: [{ data: [raw1, raw2], nextCursor: null }],
      pageParams: [undefined],
    };
    const result = select(infiniteData) as {
      pages: [{ data: [Record<string, unknown>, Record<string, unknown>] }];
    };
    expect(result.pages[0].data).toHaveLength(2);
    expect(result.pages[0].data[0]["message"]).toBe("Please read");
    expect(result.pages[0].data[1]["message"]).toBe("Please read");
  });
});

describe("useCreateAcknowledgement", () => {
  it("invalidates list on success", () => {
    mockUtils.acknowledgement.list.invalidate.mockClear();
    useCreateAcknowledgement();
    const onSuccess = lastCreateMutationOpts["onSuccess"] as () => void;
    onSuccess();
    expect(mockUtils.acknowledgement.list.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
    });
  });
});

describe("useConfirmAcknowledgement", () => {
  it("invalidates get and list on success", () => {
    mockUtils.acknowledgement.get.invalidate.mockClear();
    mockUtils.acknowledgement.list.invalidate.mockClear();
    useConfirmAcknowledgement();
    const onSuccess = lastConfirmMutationOpts["onSuccess"] as (
      data: unknown,
      variables: { ackId: string },
    ) => void;
    onSuccess(undefined, { ackId: "ack-1" });
    expect(mockUtils.acknowledgement.get.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      ackId: "ack-1",
    });
    expect(mockUtils.acknowledgement.list.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
    });
  });
});

describe("useArchiveAcknowledgement", () => {
  it("invalidates get and list on success", () => {
    mockUtils.acknowledgement.get.invalidate.mockClear();
    mockUtils.acknowledgement.list.invalidate.mockClear();
    useArchiveAcknowledgement();
    const onSuccess = lastArchiveMutationOpts["onSuccess"] as (
      data: unknown,
      variables: { ackId: string },
    ) => void;
    onSuccess(undefined, { ackId: "ack-2" });
    expect(mockUtils.acknowledgement.get.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      ackId: "ack-2",
    });
    expect(mockUtils.acknowledgement.list.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
    });
  });
});

describe("useRestoreAcknowledgement", () => {
  it("invalidates get and list on success", () => {
    mockUtils.acknowledgement.get.invalidate.mockClear();
    mockUtils.acknowledgement.list.invalidate.mockClear();
    useRestoreAcknowledgement();
    const onSuccess = lastRestoreMutationOpts["onSuccess"] as (
      data: unknown,
      variables: { ackId: string },
    ) => void;
    onSuccess(undefined, { ackId: "ack-3" });
    expect(mockUtils.acknowledgement.get.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      ackId: "ack-3",
    });
    expect(mockUtils.acknowledgement.list.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
    });
  });
});

describe("useDeleteAcknowledgement", () => {
  it("invalidates get and list on success", () => {
    mockUtils.acknowledgement.get.invalidate.mockClear();
    mockUtils.acknowledgement.list.invalidate.mockClear();
    useDeleteAcknowledgement();
    const onSuccess = lastDeleteMutationOpts["onSuccess"] as (
      data: unknown,
      variables: { ackId: string },
    ) => void;
    onSuccess(undefined, { ackId: "ack-4" });
    expect(mockUtils.acknowledgement.get.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      ackId: "ack-4",
    });
    expect(mockUtils.acknowledgement.list.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
    });
  });
});

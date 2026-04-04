// @vitest-environment happy-dom
import { configureSodium, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import {
  encryptFieldDefinitionInput,
  encryptFieldValueInput,
} from "@pluralscape/data/transforms/custom-field";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { TEST_MASTER_KEY, TEST_SYSTEM_ID } from "./helpers/test-crypto.js";

import type { FieldDefinitionRaw, FieldValueRaw } from "@pluralscape/data/transforms/custom-field";
import type { FieldDefinitionId, FieldValueId, MemberId, UnixMillis } from "@pluralscape/types";

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
let lastDefQueryOpts: CapturedOpts = {};
let lastDefInfiniteOpts: CapturedOpts = {};
let lastCreateOpts: CapturedOpts = {};
let lastUpdateOpts: CapturedOpts = {};
let lastDeleteOpts: CapturedOpts = {};
let lastValueQueryOpts: CapturedOpts = {};
let lastValueSetOpts: CapturedOpts = {};

const mockUtils = {
  field: {
    definition: {
      get: { invalidate: vi.fn() },
      list: { invalidate: vi.fn() },
    },
    value: {
      list: { invalidate: vi.fn() },
    },
  },
};

vi.mock("@pluralscape/api-client/trpc", () => ({
  trpc: {
    field: {
      definition: {
        get: {
          useQuery: (_input: unknown, opts: CapturedOpts) => {
            lastDefQueryOpts = opts;
            return { data: undefined, isLoading: true, status: "loading" };
          },
        },
        list: {
          useInfiniteQuery: (_input: unknown, opts: CapturedOpts) => {
            lastDefInfiniteOpts = opts;
            return { data: undefined, isLoading: true, status: "loading" };
          },
        },
        create: {
          useMutation: (opts: CapturedOpts) => {
            lastCreateOpts = opts;
            return { mutate: vi.fn() };
          },
        },
        update: {
          useMutation: (opts: CapturedOpts) => {
            lastUpdateOpts = opts;
            return { mutate: vi.fn() };
          },
        },
        delete: {
          useMutation: (opts: CapturedOpts) => {
            lastDeleteOpts = opts;
            return { mutate: vi.fn() };
          },
        },
      },
      value: {
        list: {
          useQuery: (_input: unknown, opts: CapturedOpts) => {
            lastValueQueryOpts = opts;
            return { data: undefined, isLoading: true, status: "loading" };
          },
        },
        set: {
          useMutation: (opts: CapturedOpts) => {
            lastValueSetOpts = opts;
            return { mutate: vi.fn() };
          },
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
  useFieldDefinition,
  useFieldDefinitionsList,
  useCreateField,
  useUpdateField,
  useDeleteField,
  useMemberFieldValues,
  useUpdateMemberFieldValues,
} = await import("../use-custom-fields.js");

// ── Fixtures ─────────────────────────────────────────────────────────
const NOW = 1_700_000_000_000 as UnixMillis;

function makeRawFieldDefinition(id: string): FieldDefinitionRaw {
  const encrypted = encryptFieldDefinitionInput(
    { name: `Field ${id}`, description: "A test field", options: null },
    TEST_MASTER_KEY,
  );
  return {
    id: id as FieldDefinitionId,
    systemId: TEST_SYSTEM_ID,
    fieldType: "text",
    required: false,
    sortOrder: 0,
    archived: false,
    archivedAt: null,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
    ...encrypted,
  };
}

function makeRawFieldValue(id: string): FieldValueRaw {
  const encrypted = encryptFieldValueInput({ fieldType: "text", value: "hello" }, TEST_MASTER_KEY);
  return {
    id: id as FieldValueId,
    fieldDefinitionId: "fd-1" as FieldDefinitionId,
    memberId: "m-1" as MemberId,
    structureEntityId: null,
    groupId: null,
    systemId: TEST_SYSTEM_ID,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
    ...encrypted,
  };
}

// ── Tests ────────────────────────────────────────────────────────────
describe("useFieldDefinition", () => {
  it("enables when masterKey is present", () => {
    useFieldDefinition("fd-1" as FieldDefinitionId);
    expect(lastDefQueryOpts["enabled"]).toBe(true);
  });

  it("disables when masterKey is null", () => {
    vi.mocked(useMasterKey).mockReturnValueOnce(null);
    useFieldDefinition("fd-1" as FieldDefinitionId);
    expect(lastDefQueryOpts["enabled"]).toBe(false);
  });

  it("select decrypts raw field definition correctly", () => {
    useFieldDefinition("fd-1" as FieldDefinitionId);
    const select = lastDefQueryOpts["select"] as (raw: FieldDefinitionRaw) => unknown;
    const raw = makeRawFieldDefinition("fd-1");
    const result = select(raw) as Record<string, unknown>;
    expect(result["name"]).toBe("Field fd-1");
    expect(result["description"]).toBe("A test field");
    expect(result["fieldType"]).toBe("text");
  });
});

describe("useFieldDefinitionsList", () => {
  it("select decrypts each page item", () => {
    useFieldDefinitionsList();
    const select = lastDefInfiniteOpts["select"] as (data: unknown) => unknown;
    const raw1 = makeRawFieldDefinition("fd-1");
    const raw2 = makeRawFieldDefinition("fd-2");
    const infiniteData = {
      pages: [{ data: [raw1, raw2], nextCursor: null }],
      pageParams: [undefined],
    };
    const result = select(infiniteData) as {
      pages: [{ data: [Record<string, unknown>, Record<string, unknown>] }];
    };
    expect(result.pages[0].data).toHaveLength(2);
    expect(result.pages[0].data[0]["name"]).toBe("Field fd-1");
    expect(result.pages[0].data[1]["name"]).toBe("Field fd-2");
  });
});

describe("useCreateField", () => {
  it("invalidates definition list on success", () => {
    mockUtils.field.definition.list.invalidate.mockClear();
    useCreateField();
    const onSuccess = lastCreateOpts["onSuccess"] as () => void;
    onSuccess();
    expect(mockUtils.field.definition.list.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
    });
  });
});

describe("useUpdateField", () => {
  it("invalidates get and list on success", () => {
    mockUtils.field.definition.get.invalidate.mockClear();
    mockUtils.field.definition.list.invalidate.mockClear();
    useUpdateField();
    const onSuccess = lastUpdateOpts["onSuccess"] as (
      data: unknown,
      variables: { fieldDefinitionId: string },
    ) => void;
    onSuccess(undefined, { fieldDefinitionId: "fd-1" });
    expect(mockUtils.field.definition.get.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      fieldDefinitionId: "fd-1",
    });
    expect(mockUtils.field.definition.list.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
    });
  });
});

describe("useDeleteField", () => {
  it("invalidates get and list on success", () => {
    mockUtils.field.definition.get.invalidate.mockClear();
    mockUtils.field.definition.list.invalidate.mockClear();
    useDeleteField();
    const onSuccess = lastDeleteOpts["onSuccess"] as (
      data: unknown,
      variables: { fieldDefinitionId: string },
    ) => void;
    onSuccess(undefined, { fieldDefinitionId: "fd-2" });
    expect(mockUtils.field.definition.get.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      fieldDefinitionId: "fd-2",
    });
    expect(mockUtils.field.definition.list.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
    });
  });
});

describe("useMemberFieldValues", () => {
  it("enables when masterKey is present", () => {
    useMemberFieldValues("m-1" as MemberId);
    expect(lastValueQueryOpts["enabled"]).toBe(true);
  });

  it("disables when masterKey is null", () => {
    vi.mocked(useMasterKey).mockReturnValueOnce(null);
    useMemberFieldValues("m-1" as MemberId);
    expect(lastValueQueryOpts["enabled"]).toBe(false);
  });

  it("select decrypts field value list correctly", () => {
    useMemberFieldValues("m-1" as MemberId);
    const select = lastValueQueryOpts["select"] as (raw: readonly FieldValueRaw[]) => unknown;
    const raw = [makeRawFieldValue("fv-1"), makeRawFieldValue("fv-2")];
    const result = select(raw) as [Record<string, unknown>, Record<string, unknown>];
    expect(result).toHaveLength(2);
    expect(result[0]["fieldType"]).toBe("text");
    expect(result[0]["value"]).toBe("hello");
  });
});

describe("useUpdateMemberFieldValues", () => {
  it("invalidates field value list on success", () => {
    mockUtils.field.value.list.invalidate.mockClear();
    useUpdateMemberFieldValues();
    const onSuccess = lastValueSetOpts["onSuccess"] as (
      data: unknown,
      variables: { owner: unknown },
    ) => void;
    const owner = { kind: "member" as const, id: "m-1" as MemberId };
    onSuccess(undefined, { owner });
    expect(mockUtils.field.value.list.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      owner,
    });
  });
});

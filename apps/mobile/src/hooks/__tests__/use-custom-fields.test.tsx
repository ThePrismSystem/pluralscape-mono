// @vitest-environment happy-dom
import { configureSodium, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import {
  encryptFieldDefinitionInput,
  encryptFieldValueInput,
} from "@pluralscape/data/transforms/custom-field";
import { brandId } from "@pluralscape/types";
import { act, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  renderHookWithProviders,
  TEST_MASTER_KEY,
  TEST_SYSTEM_ID,
} from "./helpers/render-hook-with-providers.js";

import type { FieldDefinitionRaw, FieldValueRaw } from "@pluralscape/data/transforms/custom-field";
import type { FieldDefinitionId, FieldValueId, MemberId, UnixMillis } from "@pluralscape/types";

beforeAll(async () => {
  configureSodium(new WasmSodiumAdapter());
  await initSodium();
});

// ── Fixture registry (accessible from vi.mock via hoisting) ──────────
const { fixtures } = vi.hoisted(() => {
  const store = new Map<string, unknown>();
  return { fixtures: store };
});

// ── Mock utils for mutation invalidation tracking ────────────────────
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

// ── tRPC mock backed by real React Query ─────────────────────────────
vi.mock("@pluralscape/api-client/trpc", async () => {
  const rq = await import("@tanstack/react-query");

  return {
    trpc: {
      field: {
        definition: {
          get: {
            useQuery: (input: unknown, opts: Record<string, unknown> = {}) =>
              rq.useQuery({
                queryKey: ["field.definition.get", input],
                queryFn: () => Promise.resolve(fixtures.get("field.definition.get")),
                enabled: opts.enabled as boolean | undefined,
                select: opts.select as ((d: unknown) => unknown) | undefined,
              }),
          },
          list: {
            useInfiniteQuery: (input: unknown, opts: Record<string, unknown> = {}) =>
              rq.useInfiniteQuery({
                queryKey: ["field.definition.list", input],
                queryFn: () => Promise.resolve(fixtures.get("field.definition.list")),
                enabled: opts.enabled as boolean | undefined,
                select: opts.select as ((d: unknown) => unknown) | undefined,
                getNextPageParam: opts.getNextPageParam as (lp: unknown) => unknown,
                initialPageParam: undefined,
              }),
          },
          create: {
            useMutation: (opts: Record<string, unknown> = {}) =>
              rq.useMutation({
                mutationFn: () => Promise.resolve({}),
                onSuccess: opts.onSuccess as (() => void) | undefined,
              }),
          },
          update: {
            useMutation: (opts: Record<string, unknown> = {}) =>
              rq.useMutation({
                mutationFn: () => Promise.resolve({}),
                onSuccess: opts.onSuccess as
                  | ((data: unknown, variables: unknown) => void)
                  | undefined,
              }),
          },
          delete: {
            useMutation: (opts: Record<string, unknown> = {}) =>
              rq.useMutation({
                mutationFn: () => Promise.resolve({}),
                onSuccess: opts.onSuccess as
                  | ((data: unknown, variables: unknown) => void)
                  | undefined,
              }),
          },
        },
        value: {
          list: {
            useQuery: (input: unknown, opts: Record<string, unknown> = {}) =>
              rq.useQuery({
                queryKey: ["field.value.list", input],
                queryFn: () => Promise.resolve(fixtures.get("field.value.list")),
                enabled: opts.enabled as boolean | undefined,
                select: opts.select as ((d: unknown) => unknown) | undefined,
              }),
          },
          set: {
            useMutation: (opts: Record<string, unknown> = {}) =>
              rq.useMutation({
                mutationFn: () => Promise.resolve({}),
                onSuccess: opts.onSuccess as
                  | ((data: unknown, variables: unknown) => void)
                  | undefined,
              }),
          },
        },
      },
      useUtils: () => mockUtils,
    },
  };
});

// Must import AFTER vi.mock
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
    id: brandId<FieldDefinitionId>(id),
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
    id: brandId<FieldValueId>(id),
    fieldDefinitionId: brandId<FieldDefinitionId>("fd-1"),
    memberId: brandId<MemberId>("m-1"),
    structureEntityId: null,
    groupId: null,
    systemId: TEST_SYSTEM_ID,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
    ...encrypted,
  };
}

beforeEach(() => {
  fixtures.clear();
  vi.clearAllMocks();
});

// ── Query tests ─────────────────────────────────────────────────────
describe("useFieldDefinition", () => {
  it("returns decrypted field definition data", async () => {
    fixtures.set("field.definition.get", makeRawFieldDefinition("fd-1"));
    const { result } = renderHookWithProviders(() =>
      useFieldDefinition(brandId<FieldDefinitionId>("fd-1")),
    );

    let data: Awaited<ReturnType<typeof useFieldDefinition>>["data"] | undefined;
    await waitFor(() => {
      data = result.current.data;
      expect(result.current.isSuccess).toBe(true);
    });
    expect(data?.name).toBe("Field fd-1");
    expect(data?.description).toBe("A test field");
    expect(data?.fieldType).toBe("text");
    expect(data?.archived).toBe(false);
  });

  it("does not fetch when masterKey is null", () => {
    const { result } = renderHookWithProviders(
      () => useFieldDefinition(brandId<FieldDefinitionId>("fd-1")),
      { masterKey: null },
    );
    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.data).toBeUndefined();
  });

  it("select is stable across rerenders (useCallback memoization)", async () => {
    fixtures.set("field.definition.get", makeRawFieldDefinition("fd-1"));
    const { result, rerender } = renderHookWithProviders(() =>
      useFieldDefinition(brandId<FieldDefinitionId>("fd-1")),
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    const ref1 = result.current.data;
    rerender();
    expect(result.current.data).toBe(ref1);
  });
});

describe("useFieldDefinitionsList", () => {
  it("returns decrypted paginated field definitions", async () => {
    const raw1 = makeRawFieldDefinition("fd-1");
    const raw2 = makeRawFieldDefinition("fd-2");
    fixtures.set("field.definition.list", { data: [raw1, raw2], nextCursor: null });

    const { result } = renderHookWithProviders(() => useFieldDefinitionsList());

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    const data = result.current.data;
    const pages = data && "pages" in data ? data.pages : [];
    expect(pages).toHaveLength(1);
    const items = pages[0] && "data" in pages[0] ? pages[0].data : [];
    expect(items).toHaveLength(2);
    expect(items[0]?.name).toBe("Field fd-1");
    expect(items[1]?.name).toBe("Field fd-2");
  });

  it("does not fetch when masterKey is null", () => {
    const { result } = renderHookWithProviders(() => useFieldDefinitionsList(), {
      masterKey: null,
    });
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("select is stable across rerenders", async () => {
    fixtures.set("field.definition.list", {
      data: [makeRawFieldDefinition("fd-1")],
      nextCursor: null,
    });
    const { result, rerender } = renderHookWithProviders(() => useFieldDefinitionsList());

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    const ref1 = result.current.data;
    rerender();
    expect(result.current.data).toBe(ref1);
  });
});

describe("useMemberFieldValues", () => {
  it("returns decrypted field values array", async () => {
    const raw = [makeRawFieldValue("fv-1"), makeRawFieldValue("fv-2")];
    fixtures.set("field.value.list", raw);

    const { result } = renderHookWithProviders(() =>
      useMemberFieldValues(brandId<MemberId>("m-1")),
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toHaveLength(2);
    expect(result.current.data?.[0]).toMatchObject({ fieldType: "text", value: "hello" });
  });

  it("does not fetch when masterKey is null", () => {
    const { result } = renderHookWithProviders(
      () => useMemberFieldValues(brandId<MemberId>("m-1")),
      {
        masterKey: null,
      },
    );
    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.data).toBeUndefined();
  });
});

// ── Mutation tests ──────────────────────────────────────────────────
describe("useCreateField", () => {
  it("invalidates definition list on success", async () => {
    const { result } = renderHookWithProviders(() => useCreateField());

    await act(() => result.current.mutateAsync({} as never));

    await waitFor(() => {
      expect(mockUtils.field.definition.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});

describe("useUpdateField", () => {
  it("invalidates get and list on success", async () => {
    const { result } = renderHookWithProviders(() => useUpdateField());

    await act(() => result.current.mutateAsync({ fieldDefinitionId: "fd-1" } as never));

    await waitFor(() => {
      expect(mockUtils.field.definition.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        fieldDefinitionId: "fd-1",
      });
      expect(mockUtils.field.definition.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});

describe("useDeleteField", () => {
  it("invalidates get and list on success", async () => {
    const { result } = renderHookWithProviders(() => useDeleteField());

    await act(() => result.current.mutateAsync({ fieldDefinitionId: "fd-2" } as never));

    await waitFor(() => {
      expect(mockUtils.field.definition.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        fieldDefinitionId: "fd-2",
      });
      expect(mockUtils.field.definition.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});

describe("useUpdateMemberFieldValues", () => {
  it("invalidates field value list on success", async () => {
    const { result } = renderHookWithProviders(() => useUpdateMemberFieldValues());

    const owner = { kind: "member" as const, id: brandId<MemberId>("m-1") };
    await act(() => result.current.mutateAsync({ owner } as never));

    await waitFor(() => {
      expect(mockUtils.field.value.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        owner,
      });
    });
  });
});

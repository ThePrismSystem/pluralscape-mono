// @vitest-environment happy-dom
import { brandId } from "@pluralscape/types";
import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderHookWithProviders, TEST_SYSTEM_ID } from "./helpers/render-hook-with-providers.js";

import type {
  ServerSecret,
  UnixMillis,
  WebhookConfig,
  WebhookDelivery,
  WebhookDeliveryId,
  WebhookId,
} from "@pluralscape/types";

// ── Fixture registry (accessible from vi.mock via hoisting) ──────────
const { fixtures } = vi.hoisted(() => {
  const store = new Map<string, unknown>();
  return { fixtures: store };
});

// ── Mock utils for mutation invalidation tracking ────────────────────
const mockUtils = {
  webhookConfig: {
    get: { invalidate: vi.fn() },
    list: { invalidate: vi.fn() },
  },
  webhookDelivery: {
    get: { invalidate: vi.fn() },
    list: { invalidate: vi.fn() },
  },
};

// ── tRPC mock backed by real React Query ─────────────────────────────
vi.mock("@pluralscape/api-client/trpc", async () => {
  const rq = await import("@tanstack/react-query");

  return {
    trpc: {
      webhookConfig: {
        get: {
          useQuery: (input: unknown, opts: Record<string, unknown> = {}) =>
            rq.useQuery({
              queryKey: ["webhookConfig.get", input],
              queryFn: () => Promise.resolve(fixtures.get("webhookConfig.get")),
              enabled: opts.enabled as boolean | undefined,
              select: opts.select as ((d: unknown) => unknown) | undefined,
            }),
        },
        list: {
          useInfiniteQuery: (input: unknown, opts: Record<string, unknown> = {}) =>
            rq.useInfiniteQuery({
              queryKey: ["webhookConfig.list", input],
              queryFn: () => Promise.resolve(fixtures.get("webhookConfig.list")),
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
        archive: {
          useMutation: (opts: Record<string, unknown> = {}) =>
            rq.useMutation({
              mutationFn: () => Promise.resolve({}),
              onSuccess: opts.onSuccess as
                | ((data: unknown, variables: unknown) => void)
                | undefined,
            }),
        },
        restore: {
          useMutation: (opts: Record<string, unknown> = {}) =>
            rq.useMutation({
              mutationFn: () => Promise.resolve({}),
              onSuccess: opts.onSuccess as
                | ((data: unknown, variables: unknown) => void)
                | undefined,
            }),
        },
        rotateSecret: {
          useMutation: (opts: Record<string, unknown> = {}) =>
            rq.useMutation({
              mutationFn: () => Promise.resolve({}),
              onSuccess: opts.onSuccess as
                | ((data: unknown, variables: unknown) => void)
                | undefined,
            }),
        },
        test: {
          useMutation: (opts: Record<string, unknown> = {}) =>
            rq.useMutation({
              mutationFn: () => Promise.resolve({}),
              onSuccess: opts.onSuccess as (() => void) | undefined,
            }),
        },
      },
      webhookDelivery: {
        get: {
          useQuery: (input: unknown, opts: Record<string, unknown> = {}) =>
            rq.useQuery({
              queryKey: ["webhookDelivery.get", input],
              queryFn: () => Promise.resolve(fixtures.get("webhookDelivery.get")),
              enabled: opts.enabled as boolean | undefined,
              select: opts.select as ((d: unknown) => unknown) | undefined,
            }),
        },
        list: {
          useInfiniteQuery: (input: unknown, opts: Record<string, unknown> = {}) =>
            rq.useInfiniteQuery({
              queryKey: ["webhookDelivery.list", input],
              queryFn: () => Promise.resolve(fixtures.get("webhookDelivery.list")),
              enabled: opts.enabled as boolean | undefined,
              select: opts.select as ((d: unknown) => unknown) | undefined,
              getNextPageParam: opts.getNextPageParam as (lp: unknown) => unknown,
              initialPageParam: undefined,
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
      useUtils: () => mockUtils,
    },
  };
});

// Must import AFTER vi.mock
const {
  useWebhookConfig,
  useWebhookConfigsList,
  useCreateWebhookConfig,
  useUpdateWebhookConfig,
  useDeleteWebhookConfig,
  useArchiveWebhookConfig,
  useRestoreWebhookConfig,
  useRotateWebhookSecret,
  useTestWebhook,
  useWebhookDelivery,
  useWebhookDeliveriesList,
  useDeleteWebhookDelivery,
} = await import("../use-webhooks.js");

// ── Fixtures ─────────────────────────────────────────────────────────
const NOW = 1_700_000_000_000 as UnixMillis;

function makeWebhookConfig(id: string): WebhookConfig {
  return {
    id: brandId<WebhookId>(id),
    systemId: TEST_SYSTEM_ID,
    url: `https://example.com/webhook/${id}`,
    secret: new Uint8Array([1, 2, 3]) as ServerSecret,
    eventTypes: ["member.created", "fronting.started"],
    enabled: true,
    cryptoKeyId: null,
    archived: false,
    createdAt: NOW,
    updatedAt: NOW,
    version: 1,
  };
}

function makeWebhookDelivery(id: string, webhookId: string): WebhookDelivery {
  return {
    id: brandId<WebhookDeliveryId>(id),
    systemId: TEST_SYSTEM_ID,
    webhookId: brandId<WebhookId>(webhookId),
    eventType: "member.created",
    status: "success",
    httpStatus: 200,
    attemptCount: 1,
    lastAttemptAt: NOW,
    nextRetryAt: null,
    createdAt: NOW,
  };
}

beforeEach(() => {
  fixtures.clear();
  vi.clearAllMocks();
});

// ── Webhook config query tests ─────────────────────────────────────
describe("useWebhookConfig", () => {
  it("returns webhook config data", async () => {
    fixtures.set("webhookConfig.get", makeWebhookConfig("wh_1"));
    const { result } = renderHookWithProviders(() => useWebhookConfig(brandId<WebhookId>("wh_1")));

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data?.url).toBe("https://example.com/webhook/wh_1");
    expect(result.current.data?.enabled).toBe(true);
    expect(result.current.data?.eventTypes).toEqual(["member.created", "fronting.started"]);
  });
});

describe("useWebhookConfigsList", () => {
  it("returns paginated webhook configs", async () => {
    const wh1 = makeWebhookConfig("wh_1");
    const wh2 = makeWebhookConfig("wh_2");
    fixtures.set("webhookConfig.list", { data: [wh1, wh2], nextCursor: null });

    const { result } = renderHookWithProviders(() => useWebhookConfigsList());

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    const data = result.current.data;
    const pages = data && "pages" in data ? data.pages : [];
    const [firstPage] = pages;
    const items = firstPage && "data" in firstPage ? firstPage.data : [];
    expect(pages).toHaveLength(1);
    expect(items).toHaveLength(2);
    expect(items[0]?.url).toBe("https://example.com/webhook/wh_1");
    expect(items[1]?.url).toBe("https://example.com/webhook/wh_2");
  });
});

// ── Webhook config mutation tests ──────────────────────────────────
describe("useCreateWebhookConfig", () => {
  it("invalidates list on success", async () => {
    const { result } = renderHookWithProviders(() => useCreateWebhookConfig());

    await act(() => result.current.mutateAsync({} as never));

    await waitFor(() => {
      expect(mockUtils.webhookConfig.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});

describe("useUpdateWebhookConfig", () => {
  it("invalidates get and list on success", async () => {
    const { result } = renderHookWithProviders(() => useUpdateWebhookConfig());

    await act(() => result.current.mutateAsync({ webhookId: "wh_1" } as never));

    await waitFor(() => {
      expect(mockUtils.webhookConfig.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        webhookId: "wh_1",
      });
      expect(mockUtils.webhookConfig.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});

describe("useDeleteWebhookConfig", () => {
  it("invalidates get and list on success", async () => {
    const { result } = renderHookWithProviders(() => useDeleteWebhookConfig());

    await act(() => result.current.mutateAsync({ webhookId: "wh_2" } as never));

    await waitFor(() => {
      expect(mockUtils.webhookConfig.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        webhookId: "wh_2",
      });
      expect(mockUtils.webhookConfig.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});

describe("useArchiveWebhookConfig", () => {
  it("invalidates get and list on success", async () => {
    const { result } = renderHookWithProviders(() => useArchiveWebhookConfig());

    await act(() => result.current.mutateAsync({ webhookId: "wh_3" } as never));

    await waitFor(() => {
      expect(mockUtils.webhookConfig.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        webhookId: "wh_3",
      });
      expect(mockUtils.webhookConfig.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});

describe("useRestoreWebhookConfig", () => {
  it("invalidates get and list on success", async () => {
    const { result } = renderHookWithProviders(() => useRestoreWebhookConfig());

    await act(() => result.current.mutateAsync({ webhookId: "wh_4" } as never));

    await waitFor(() => {
      expect(mockUtils.webhookConfig.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        webhookId: "wh_4",
      });
      expect(mockUtils.webhookConfig.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});

describe("useRotateWebhookSecret", () => {
  it("invalidates get on success (secret changed)", async () => {
    const { result } = renderHookWithProviders(() => useRotateWebhookSecret());

    await act(() => result.current.mutateAsync({ webhookId: "wh_5" } as never));

    await waitFor(() => {
      expect(mockUtils.webhookConfig.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        webhookId: "wh_5",
      });
      // list should NOT be invalidated for secret rotation
      expect(mockUtils.webhookConfig.list.invalidate).not.toHaveBeenCalled();
    });
  });
});

describe("useTestWebhook", () => {
  it("does not invalidate any cache", async () => {
    const { result } = renderHookWithProviders(() => useTestWebhook());

    await act(() => result.current.mutateAsync({} as never));

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(mockUtils.webhookConfig.get.invalidate).not.toHaveBeenCalled();
    expect(mockUtils.webhookConfig.list.invalidate).not.toHaveBeenCalled();
  });
});

// ── Webhook delivery query tests ───────────────────────────────────
describe("useWebhookDelivery", () => {
  it("returns webhook delivery data", async () => {
    fixtures.set("webhookDelivery.get", makeWebhookDelivery("wd_1", "wh_1"));
    const { result } = renderHookWithProviders(() =>
      useWebhookDelivery(brandId<WebhookDeliveryId>("wd_1")),
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data?.webhookId).toBe("wh_1");
    expect(result.current.data?.status).toBe("success");
    expect(result.current.data?.httpStatus).toBe(200);
  });
});

describe("useWebhookDeliveriesList", () => {
  it("returns paginated webhook deliveries", async () => {
    const d1 = makeWebhookDelivery("wd_1", "wh_1");
    const d2 = makeWebhookDelivery("wd_2", "wh_1");
    fixtures.set("webhookDelivery.list", { data: [d1, d2], nextCursor: null });

    const { result } = renderHookWithProviders(() => useWebhookDeliveriesList());

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    const data = result.current.data;
    const pages = data && "pages" in data ? data.pages : [];
    const [firstPage] = pages;
    const items = firstPage && "data" in firstPage ? firstPage.data : [];
    expect(pages).toHaveLength(1);
    expect(items).toHaveLength(2);
    expect(items[0]?.id).toBe("wd_1");
    expect(items[1]?.id).toBe("wd_2");
  });
});

// ── Webhook delivery mutation tests ────────────────────────────────
describe("useDeleteWebhookDelivery", () => {
  it("invalidates get and list on success", async () => {
    const { result } = renderHookWithProviders(() => useDeleteWebhookDelivery());

    await act(() => result.current.mutateAsync({ deliveryId: "wd_1" } as never));

    await waitFor(() => {
      expect(mockUtils.webhookDelivery.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        deliveryId: "wd_1",
      });
      expect(mockUtils.webhookDelivery.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});

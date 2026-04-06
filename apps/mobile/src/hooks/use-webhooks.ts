import { trpc } from "@pluralscape/api-client/trpc";

import {
  useOfflineFirstQuery,
  useOfflineFirstInfiniteQuery,
  useDomainMutation,
} from "./factories.js";
import {
  DEFAULT_LIST_LIMIT,
  type DataListQuery,
  type DataQuery,
  type SystemIdOverride,
  type TRPCMutation,
} from "./types.js";

import type { RouterInput, RouterOutput } from "@pluralscape/api-client/trpc";
import type {
  ArchivedWebhookConfig,
  WebhookConfig,
  WebhookDelivery,
  WebhookDeliveryId,
  WebhookDeliveryStatus,
  WebhookEventType,
  WebhookId,
} from "@pluralscape/types";

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

type WebhookConfigResult = WebhookConfig | ArchivedWebhookConfig;

interface WebhookConfigListOpts extends SystemIdOverride {
  readonly limit?: number;
  readonly includeArchived?: boolean;
}

interface WebhookDeliveryListOpts extends SystemIdOverride {
  readonly limit?: number;
  readonly webhookId?: WebhookId;
  readonly status?: WebhookDeliveryStatus;
  readonly eventType?: WebhookEventType;
  readonly fromDate?: number;
  readonly toDate?: number;
}

// ---------------------------------------------------------------------------
// Row transforms — remote-only stubs
// ---------------------------------------------------------------------------

/**
 * Webhook configs are partially materialized to local SQLite (the CRDT
 * materializer stores url, eventTypes, enabled, archived) but the
 * server-authoritative `secret` and `cryptoKeyId` fields are excluded
 * from the CRDT schema. Since the management UI needs the full config,
 * these hooks are remote-only and this transform is never called.
 */
function rowToWebhookConfigNever(): never {
  throw new Error("rowToWebhookConfig: webhook configs are remote-only");
}

/** Webhook deliveries are not in the CRDT materializer — remote-only. */
function rowToWebhookDeliveryNever(): never {
  throw new Error("rowToWebhookDelivery: webhook deliveries are remote-only");
}

// ---------------------------------------------------------------------------
// Webhook config queries
// ---------------------------------------------------------------------------

export function useWebhookConfig(
  webhookId: WebhookId,
  opts?: SystemIdOverride,
): DataQuery<WebhookConfigResult> {
  return useOfflineFirstQuery<WebhookConfigResult, WebhookConfigResult>({
    queryKey: ["webhook-configs", webhookId],
    table: "webhook_configs",
    entityId: webhookId,
    rowTransform: rowToWebhookConfigNever,
    systemIdOverride: opts,
    useRemote: ({ systemId, enabled }) =>
      trpc.webhookConfig.get.useQuery(
        { systemId, webhookId },
        { enabled },
      ) as DataQuery<WebhookConfigResult>,
  });
}

export function useWebhookConfigsList(
  opts?: WebhookConfigListOpts,
): DataListQuery<WebhookConfigResult> {
  return useOfflineFirstInfiniteQuery<WebhookConfigResult, WebhookConfigResult>({
    queryKey: ["webhook-configs", "list", opts?.systemId, opts?.includeArchived ?? false],
    table: "webhook_configs",
    rowTransform: rowToWebhookConfigNever,
    includeArchived: opts?.includeArchived,
    systemIdOverride: opts,
    useRemote: ({ systemId, enabled }) =>
      trpc.webhookConfig.list.useInfiniteQuery(
        {
          systemId,
          limit: opts?.limit ?? DEFAULT_LIST_LIMIT,
          includeArchived: opts?.includeArchived ?? false,
        },
        {
          enabled,
          getNextPageParam: (lastPage) => lastPage.nextCursor,
        },
      ) as DataListQuery<WebhookConfigResult>,
  });
}

// ---------------------------------------------------------------------------
// Webhook config mutations
// ---------------------------------------------------------------------------

export function useCreateWebhookConfig(): TRPCMutation<
  RouterOutput["webhookConfig"]["create"],
  RouterInput["webhookConfig"]["create"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.webhookConfig.create.useMutation(mutOpts),
    onInvalidate: (utils, systemId) => {
      void utils.webhookConfig.list.invalidate({ systemId });
    },
  });
}

export function useUpdateWebhookConfig(): TRPCMutation<
  RouterOutput["webhookConfig"]["update"],
  RouterInput["webhookConfig"]["update"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.webhookConfig.update.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.webhookConfig.get.invalidate({ systemId, webhookId: variables.webhookId });
      void utils.webhookConfig.list.invalidate({ systemId });
    },
  });
}

export function useDeleteWebhookConfig(): TRPCMutation<
  RouterOutput["webhookConfig"]["delete"],
  RouterInput["webhookConfig"]["delete"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.webhookConfig.delete.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.webhookConfig.get.invalidate({ systemId, webhookId: variables.webhookId });
      void utils.webhookConfig.list.invalidate({ systemId });
    },
  });
}

export function useArchiveWebhookConfig(): TRPCMutation<
  RouterOutput["webhookConfig"]["archive"],
  RouterInput["webhookConfig"]["archive"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.webhookConfig.archive.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.webhookConfig.get.invalidate({ systemId, webhookId: variables.webhookId });
      void utils.webhookConfig.list.invalidate({ systemId });
    },
  });
}

export function useRestoreWebhookConfig(): TRPCMutation<
  RouterOutput["webhookConfig"]["restore"],
  RouterInput["webhookConfig"]["restore"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.webhookConfig.restore.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.webhookConfig.get.invalidate({ systemId, webhookId: variables.webhookId });
      void utils.webhookConfig.list.invalidate({ systemId });
    },
  });
}

export function useRotateWebhookSecret(): TRPCMutation<
  RouterOutput["webhookConfig"]["rotateSecret"],
  RouterInput["webhookConfig"]["rotateSecret"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.webhookConfig.rotateSecret.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.webhookConfig.get.invalidate({ systemId, webhookId: variables.webhookId });
    },
  });
}

export function useTestWebhook(): TRPCMutation<
  RouterOutput["webhookConfig"]["test"],
  RouterInput["webhookConfig"]["test"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.webhookConfig.test.useMutation(mutOpts),
    onInvalidate: () => {
      // Test delivery is fire-and-forget — no cache invalidation needed
    },
  });
}

// ---------------------------------------------------------------------------
// Webhook delivery queries
// ---------------------------------------------------------------------------

export function useWebhookDelivery(
  deliveryId: WebhookDeliveryId,
  opts?: SystemIdOverride,
): DataQuery<WebhookDelivery> {
  return useOfflineFirstQuery<WebhookDelivery, WebhookDelivery>({
    queryKey: ["webhook-deliveries", deliveryId],
    table: "webhook_deliveries",
    entityId: deliveryId,
    rowTransform: rowToWebhookDeliveryNever,
    systemIdOverride: opts,
    useRemote: ({ systemId, enabled, select }) =>
      trpc.webhookDelivery.get.useQuery(
        { systemId, deliveryId },
        { enabled, select },
      ) as DataQuery<WebhookDelivery>,
  });
}

export function useWebhookDeliveriesList(
  opts?: WebhookDeliveryListOpts,
): DataListQuery<WebhookDelivery> {
  return useOfflineFirstInfiniteQuery<WebhookDelivery, WebhookDelivery>({
    queryKey: [
      "webhook-deliveries",
      "list",
      opts?.systemId,
      opts?.webhookId,
      opts?.status,
      opts?.eventType,
    ],
    table: "webhook_deliveries",
    rowTransform: rowToWebhookDeliveryNever,
    systemIdOverride: opts,
    useRemote: ({ systemId, enabled }) =>
      trpc.webhookDelivery.list.useInfiniteQuery(
        {
          systemId,
          limit: opts?.limit ?? DEFAULT_LIST_LIMIT,
          webhookId: opts?.webhookId,
          status: opts?.status,
          eventType: opts?.eventType,
          fromDate: opts?.fromDate?.toString(),
          toDate: opts?.toDate?.toString(),
        },
        {
          enabled,
          getNextPageParam: (lastPage) => lastPage.nextCursor,
        },
      ) as DataListQuery<WebhookDelivery>,
  });
}

// ---------------------------------------------------------------------------
// Webhook delivery mutations
// ---------------------------------------------------------------------------

export function useDeleteWebhookDelivery(): TRPCMutation<
  RouterOutput["webhookDelivery"]["delete"],
  RouterInput["webhookDelivery"]["delete"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.webhookDelivery.delete.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.webhookDelivery.get.invalidate({ systemId, deliveryId: variables.deliveryId });
      void utils.webhookDelivery.list.invalidate({ systemId });
    },
  });
}

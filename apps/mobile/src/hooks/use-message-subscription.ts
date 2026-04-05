import { trpc } from "@pluralscape/api-client/trpc";

import { useActiveSystemId } from "../providers/system-provider.js";

import { useQuerySource } from "./use-query-source.js";

import type { ChannelId } from "@pluralscape/types";

interface MessageSubscriptionOpts {
  readonly enabled?: boolean;
}

/**
 * Subscribe to real-time message changes for a channel.
 * Automatically invalidates message queries when events are received.
 * Mount this in the chat screen component — subscriptions are only active while mounted.
 *
 * @see {@link useQuerySource} for local-mode real-time update behavior.
 */
export function useMessageSubscription(channelId: ChannelId, opts?: MessageSubscriptionOpts): void {
  const source = useQuerySource();
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  trpc.message.onChange.useSubscription(
    { systemId, channelId },
    {
      enabled: source !== "local" && (opts?.enabled ?? true),
      onData: (event) => {
        void utils.message.list.invalidate({ systemId, channelId });
        if ("messageId" in event) {
          void utils.message.get.invalidate({ systemId, channelId, messageId: event.messageId });
        }
      },
      onError: () => {
        // subscription errors are surfaced via the tRPC error boundary
      },
    },
  );
}

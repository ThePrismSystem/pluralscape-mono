import { trpc } from "@pluralscape/api-client/trpc";

import { useActiveSystemId } from "../providers/system-provider.js";

import type { ChannelId } from "@pluralscape/types";

/**
 * Subscribe to real-time message changes for a channel.
 * Automatically invalidates message queries when events are received.
 * Mount this in the chat screen component — subscriptions are only active while mounted.
 */
export function useMessageSubscription(channelId: ChannelId): void {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  trpc.message.onChange.useSubscription(
    { systemId, channelId },
    {
      onData: (event) => {
        void utils.message.list.invalidate({ systemId, channelId });
        if ("messageId" in event) {
          void utils.message.get.invalidate({ systemId, channelId, messageId: event.messageId });
        }
      },
    },
  );
}

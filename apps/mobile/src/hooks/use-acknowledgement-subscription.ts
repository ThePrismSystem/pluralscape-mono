import { trpc } from "@pluralscape/api-client/trpc";

import { useActiveSystemId } from "../providers/system-provider.js";

/**
 * Subscribe to real-time acknowledgement changes.
 * Automatically invalidates acknowledgement queries when events are received.
 */
export function useAcknowledgementSubscription(): void {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  trpc.acknowledgement.onChange.useSubscription(
    { systemId },
    {
      onData: (event) => {
        void utils.acknowledgement.list.invalidate({ systemId });
        if ("ackId" in event) {
          void utils.acknowledgement.get.invalidate({ systemId, ackId: event.ackId });
        }
      },
    },
  );
}

import { trpc } from "@pluralscape/api-client/trpc";

import { useActiveSystemId } from "../providers/system-provider.js";

interface AcknowledgementSubscriptionOpts {
  readonly enabled?: boolean;
}

/**
 * Subscribe to real-time acknowledgement changes.
 * Automatically invalidates acknowledgement queries when events are received.
 */
export function useAcknowledgementSubscription(opts?: AcknowledgementSubscriptionOpts): void {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  trpc.acknowledgement.onChange.useSubscription(
    { systemId },
    {
      enabled: opts?.enabled ?? true,
      onData: (event) => {
        void utils.acknowledgement.list.invalidate({ systemId });
        if ("ackId" in event) {
          void utils.acknowledgement.get.invalidate({ systemId, ackId: event.ackId });
        }
      },
      onError: () => {
        // subscription errors are surfaced via the tRPC error boundary
      },
    },
  );
}

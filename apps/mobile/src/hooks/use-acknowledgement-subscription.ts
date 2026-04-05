import { trpc } from "@pluralscape/api-client/trpc";

import { useActiveSystemId } from "../providers/system-provider.js";

import { useQuerySource } from "./use-query-source.js";

interface AcknowledgementSubscriptionOpts {
  readonly enabled?: boolean;
}

/**
 * Subscribe to real-time acknowledgement changes.
 * Automatically invalidates acknowledgement queries when events are received.
 *
 * @see {@link useQuerySource} for local-mode real-time update behavior.
 */
export function useAcknowledgementSubscription(opts?: AcknowledgementSubscriptionOpts): void {
  const source = useQuerySource();
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  trpc.acknowledgement.onChange.useSubscription(
    { systemId },
    {
      enabled: source !== "local" && (opts?.enabled ?? true),
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

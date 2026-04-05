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
 * In local mode, real-time updates are handled by the sync engine → event bus → QueryInvalidator
 * pipeline, so the tRPC subscription is disabled.
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

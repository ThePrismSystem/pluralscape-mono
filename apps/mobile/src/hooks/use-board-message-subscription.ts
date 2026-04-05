import { trpc } from "@pluralscape/api-client/trpc";

import { useActiveSystemId } from "../providers/system-provider.js";

import { useQuerySource } from "./use-query-source.js";

interface BoardMessageSubscriptionOpts {
  readonly enabled?: boolean;
}

/**
 * Subscribe to real-time board message changes.
 * Automatically invalidates board message queries when events are received.
 *
 * @see {@link useQuerySource} for local-mode real-time update behavior.
 */
export function useBoardMessageSubscription(opts?: BoardMessageSubscriptionOpts): void {
  const source = useQuerySource();
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  trpc.boardMessage.onChange.useSubscription(
    { systemId },
    {
      enabled: source !== "local" && (opts?.enabled ?? true),
      onData: (event) => {
        void utils.boardMessage.list.invalidate({ systemId });
        if ("boardMessageId" in event) {
          void utils.boardMessage.get.invalidate({
            systemId,
            boardMessageId: event.boardMessageId,
          });
        }
      },
      onError: () => {
        // subscription errors are surfaced via the tRPC error boundary
      },
    },
  );
}

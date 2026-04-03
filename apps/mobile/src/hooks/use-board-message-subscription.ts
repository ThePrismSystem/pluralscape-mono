import { trpc } from "@pluralscape/api-client/trpc";

import { useActiveSystemId } from "../providers/system-provider.js";

/**
 * Subscribe to real-time board message changes.
 * Automatically invalidates board message queries when events are received.
 */
export function useBoardMessageSubscription(): void {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  trpc.boardMessage.onChange.useSubscription(
    { systemId },
    {
      onData: (event) => {
        void utils.boardMessage.list.invalidate({ systemId });
        if ("boardMessageId" in event) {
          void utils.boardMessage.get.invalidate({
            systemId,
            boardMessageId: event.boardMessageId,
          });
        }
      },
    },
  );
}

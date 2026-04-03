import { trpc } from "@pluralscape/api-client/trpc";

import { useActiveSystemId } from "../providers/system-provider.js";

import type { PollId } from "@pluralscape/types";

/**
 * Subscribe to real-time poll changes.
 * If pollId is provided, scopes to that poll only. Otherwise system-wide.
 */
export function usePollSubscription(pollId?: PollId): void {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  trpc.poll.onChange.useSubscription(
    { systemId, pollId },
    {
      onData: (event) => {
        void utils.poll.list.invalidate({ systemId });
        if ("pollId" in event) {
          void utils.poll.get.invalidate({ systemId, pollId: event.pollId });
          void utils.poll.results.invalidate({ systemId, pollId: event.pollId });
          void utils.poll.listVotes.invalidate({ systemId, pollId: event.pollId });
        }
      },
    },
  );
}

import { trpc } from "@pluralscape/api-client/trpc";

import { useActiveSystemId } from "../providers/system-provider.js";

import { useQuerySource } from "./use-query-source.js";

import type { PollId } from "@pluralscape/types";

interface PollSubscriptionOpts {
  readonly enabled?: boolean;
}

/**
 * Subscribe to real-time poll changes.
 * If pollId is provided, scopes to that poll only. Otherwise system-wide.
 *
 * @see {@link useQuerySource} for local-mode real-time update behavior.
 */
export function usePollSubscription(pollId?: PollId, opts?: PollSubscriptionOpts): void {
  const source = useQuerySource();
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  trpc.poll.onChange.useSubscription(
    { systemId, pollId },
    {
      enabled: source !== "local" && (opts?.enabled ?? true),
      onData: (event) => {
        void utils.poll.list.invalidate({ systemId });
        if ("pollId" in event) {
          void utils.poll.get.invalidate({ systemId, pollId: event.pollId });
          void utils.poll.results.invalidate({ systemId, pollId: event.pollId });
          void utils.poll.listVotes.invalidate({ systemId, pollId: event.pollId });
        }
      },
      onError: () => {
        // subscription errors are surfaced via the tRPC error boundary
      },
    },
  );
}

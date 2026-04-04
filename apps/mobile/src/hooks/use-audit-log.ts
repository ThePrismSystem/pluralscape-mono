import { trpc } from "@pluralscape/api-client/trpc";

import { DEFAULT_LIST_LIMIT, type TRPCInfiniteQuery } from "./types.js";

import type { RouterOutput } from "@pluralscape/api-client/trpc";
import type { AuditEventType, UnixMillis } from "@pluralscape/types";

type AuditLogPage = RouterOutput["account"]["queryAuditLog"];

interface AuditLogOpts {
  readonly eventType?: AuditEventType;
  readonly resourceType?: string;
  readonly from?: UnixMillis;
  readonly to?: UnixMillis;
  readonly limit?: number;
}

export function useAuditLog(opts?: AuditLogOpts): TRPCInfiniteQuery<AuditLogPage> {
  return trpc.account.queryAuditLog.useInfiniteQuery(
    {
      event_type: opts?.eventType,
      resource_type: opts?.resourceType,
      from: opts?.from,
      to: opts?.to,
      limit: opts?.limit ?? DEFAULT_LIST_LIMIT,
    },
    {
      getNextPageParam: (lastPage: AuditLogPage) => lastPage.nextCursor,
    },
  );
}

import { createTRPCReact } from "@trpc/react-query";

import type { AppRouter } from "@pluralscape/api/trpc";

/**
 * tRPC React client — the primary typed API interface for the mobile app.
 *
 * Usage in the app:
 *   import { trpc } from "@pluralscape/api-client/trpc";
 *   const { data } = trpc.member.list.useQuery({ systemId, limit: 20 });
 */
export const trpc = createTRPCReact<AppRouter>();

export type { AppRouter } from "@pluralscape/api/trpc";

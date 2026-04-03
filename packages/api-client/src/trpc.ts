import { createTRPCReact } from "@trpc/react-query";

import type { AppRouter } from "@pluralscape/api/trpc";
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";

/**
 * tRPC React client — the primary typed API interface for the mobile app.
 *
 * Usage in the app:
 *   import { trpc } from "@pluralscape/api-client/trpc";
 *   const { data } = trpc.member.list.useQuery({ systemId, limit: 20 });
 */
export const trpc = createTRPCReact<AppRouter>();

export type { AppRouter } from "@pluralscape/api/trpc";

/** Typed procedure input shapes, indexed by router path. */
export type RouterInput = inferRouterInputs<AppRouter>;

/** Typed procedure output shapes, indexed by router path. */
export type RouterOutput = inferRouterOutputs<AppRouter>;

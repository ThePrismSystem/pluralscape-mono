import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { Hono } from "hono";

import { getDb } from "../lib/db.js";
import { logger } from "../lib/logger.js";
import { validateSession } from "../lib/session-auth.js";
import { appRouter, createTRPCContext } from "../trpc/index.js";

import type { AuthEnv } from "../lib/auth-context.js";

export const trpcRoute = new Hono<AuthEnv>();

/**
 * Optional auth: attempt to authenticate but don't fail if no token is present.
 * Public tRPC procedures (register, login) work without auth; protected
 * procedures enforce auth via tRPC middleware.
 */
trpcRoute.use("*", async (c, next) => {
  const authHeader = c.req.header("authorization");
  if (authHeader) {
    const match = /^Bearer\s+(.+)$/i.exec(authHeader);
    if (match?.[1]) {
      try {
        const db = await getDb();
        const result = await validateSession(db, match[1]);
        if (result.ok) {
          c.set("auth", result.auth);
        }
      } catch (err) {
        logger.error("tRPC auth middleware: session validation failed", { err });
        throw err;
      }
    }
  }
  await next();
});

trpcRoute.all("/*", async (c) => {
  return fetchRequestHandler({
    endpoint: "/v1/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext: () => createTRPCContext(c),
  });
});

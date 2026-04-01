import type { ApiClient, MaybeOptionalInit, paths } from "@pluralscape/api-client";
import type { KdfMasterKey } from "@pluralscape/crypto";
import type { QueryKey } from "@tanstack/react-query";

/** Narrow interface — only the GET method is required, so tests can stub it easily. */
export interface ApiClientLike {
  readonly GET: ApiClient["GET"];
}

export interface RestQueryFactoryDeps {
  readonly apiClient: ApiClientLike;
  readonly getMasterKey: () => KdfMasterKey | null;
}

/** Paths in the generated schema that support GET. */
type GetPath = {
  [P in keyof paths]: paths[P] extends { get: object } ? P : never;
}[keyof paths];

/** The init object for a specific GET path (optional when no required params). */
type GetInit<P extends GetPath> = MaybeOptionalInit<paths[P], "get">;

export interface RestQueryOpts<P extends GetPath, TData = unknown> {
  readonly queryKey: QueryKey;
  readonly path: P;
  readonly init?: GetInit<P>;
  readonly decrypt?: (raw: unknown, masterKey: KdfMasterKey) => TData;
}

export interface RestQueryResult<TData> {
  readonly queryKey: QueryKey;
  readonly queryFn: () => Promise<TData>;
}

export interface RestQueryFactory {
  queryOptions<P extends GetPath, TData = unknown>(
    opts: RestQueryOpts<P, TData>,
  ): RestQueryResult<TData>;
}

/**
 * Narrow an openapi-fetch response to its success data, throwing on error.
 *
 * The response shape from openapi-fetch uses deep conditional types that
 * TypeScript cannot resolve when the path parameter `P` is still generic.
 * Accepting `unknown` here keeps the public API fully typed while avoiding
 * implementation-level assertions on every call site.
 */
function unwrap(result: { data?: unknown; error?: unknown }, path: string): unknown {
  if (result.error !== undefined) {
    throw new Error(`API error on ${path}: ${JSON.stringify(result.error)}`);
  }
  return result.data;
}

export function createRestQueryFactory(deps: RestQueryFactoryDeps): RestQueryFactory {
  return {
    queryOptions<P extends GetPath, TData = unknown>(
      opts: RestQueryOpts<P, TData>,
    ): RestQueryResult<TData> {
      return {
        queryKey: opts.queryKey,
        queryFn: async (): Promise<TData> => {
          // openapi-fetch's GET is generic over Path and Init, so TS cannot
          // resolve the conditional rest param when P is still generic. The
          // public API constrains P to valid GET paths and init to matching
          // FetchOptions, so narrowing to the runtime shape here is sound.
          type ErasedGet = (
            url: string,
            init?: Record<string, unknown>,
          ) => Promise<{ data?: unknown; error?: unknown }>;
          const result = await (deps.apiClient.GET as ErasedGet)(opts.path, opts.init);
          const data = unwrap(result, opts.path);
          if (opts.decrypt !== undefined) {
            const masterKey = deps.getMasterKey();
            if (masterKey === null) throw new Error("Master key not available for decryption");
            return opts.decrypt(data, masterKey);
          }
          return data as TData;
        },
      };
    },
  };
}

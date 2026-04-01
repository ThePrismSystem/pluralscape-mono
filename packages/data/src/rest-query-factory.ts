import type { ApiClient } from "@pluralscape/api-client";
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

export interface RestQueryOpts<TData> {
  readonly queryKey: QueryKey;
  readonly path: Parameters<ApiClient["GET"]>[0];
  readonly params?: Record<string, unknown>;
  readonly decrypt?: (raw: unknown, masterKey: KdfMasterKey) => TData;
}

export interface RestQueryResult<TData> {
  readonly queryKey: QueryKey;
  readonly queryFn: () => Promise<TData>;
}

export interface RestQueryFactory {
  queryOptions<TData = unknown>(opts: RestQueryOpts<TData>): RestQueryResult<TData>;
}

/** Narrow an openapi-fetch response to its success data, throwing on error. */
function unwrap<T extends object | string | number | boolean | null>(
  result:
    | { readonly data: T; readonly error?: never }
    | { readonly data?: never; readonly error: unknown },
  path: string,
): T {
  if ("error" in result && result.error !== undefined) {
    throw new Error(`API error on ${path}: ${JSON.stringify(result.error)}`);
  }
  return result.data as T;
}

export function createRestQueryFactory(deps: RestQueryFactoryDeps): RestQueryFactory {
  return {
    queryOptions<TData = unknown>(opts: RestQueryOpts<TData>): RestQueryResult<TData> {
      return {
        queryKey: opts.queryKey,
        queryFn: async (): Promise<TData> => {
          const init = opts.params !== undefined ? { params: opts.params } : undefined;
          const result = await deps.apiClient.GET(
            opts.path,
            init as Parameters<ApiClient["GET"]>[1],
          );
          const data = unwrap(result, String(opts.path));
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

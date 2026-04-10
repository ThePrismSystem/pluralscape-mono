/**
 * Avatar fetching boundary.
 *
 * Implementations live in the mobile glue (Plan 3): one downloads avatars over
 * HTTPS using the SP API URL, the other reads them from a companion ZIP. The
 * engine simply requests bytes by source identifier.
 */

/** Result of an avatar fetch attempt. */
export type AvatarFetchResult =
  | { readonly status: "ok"; readonly bytes: Uint8Array; readonly contentType: string }
  | { readonly status: "not-found" }
  | { readonly status: "error"; readonly message: string };

/**
 * Fetches member or system avatars from either the SP API or a companion ZIP.
 *
 * `key` is the SP-side identifier — for the API source it's the avatar URL,
 * for the file source it's the SP `_id` of the member/system the ZIP file is keyed by.
 */
export interface AvatarFetcher {
  fetchAvatar(key: string): Promise<AvatarFetchResult>;
}

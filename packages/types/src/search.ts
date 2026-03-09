import type { Brand } from "./ids.js";

/** A branded search index name. */
export type SearchIndex = Brand<string, "SearchIndex">;

/** Entity types that can be searched. */
export type SearchableEntityType =
  | "member"
  | "group"
  | "journal-entry"
  | "wiki-page"
  | "channel"
  | "note"
  | "custom-field"
  | "chat-message"
  | "board-message";

/** A search query with filters. */
export interface SearchQuery {
  readonly query: string;
  readonly entityTypes: readonly SearchableEntityType[] | null;
  readonly limit: number;
  readonly offset: number;
}

/** A single item in search results. */
export interface SearchResultItem<T> {
  readonly entityType: SearchableEntityType;
  readonly entityId: string;
  readonly score: number;
  readonly highlight: string | null;
  readonly data: T;
}

/** Full search results with metadata. */
export interface SearchResult<T> {
  readonly query: string;
  readonly totalCount: number;
  readonly items: readonly SearchResultItem<T>[];
}

/**
 * Communication (channels, polls, notes) const arrays for varchar CHECK constraints.
 * Values sourced from @pluralscape/types union types.
 */

import { type ChannelServerMetadata } from "@pluralscape/types";

export { NOTE_AUTHOR_ENTITY_TYPES } from "@pluralscape/types";
export { POLL_KINDS } from "@pluralscape/types";
export { POLL_STATUSES } from "@pluralscape/types";

export const CHANNEL_TYPES = [
  "category",
  "channel",
] as const satisfies readonly ChannelServerMetadata["type"][];

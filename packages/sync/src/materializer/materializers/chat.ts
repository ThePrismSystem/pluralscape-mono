import { materializeDocument } from "./materialize-document.js";

import type { EventBus, DataLayerEventMap } from "../../event-bus/index.js";
import type { MaterializerDb } from "../base-materializer.js";
import type { DocumentMaterializer } from "../materializer-registry.js";

/**
 * Materializer for the `chat` document (hot path).
 *
 * Handles: channel, message, board-message, poll, poll-option,
 * poll-vote, acknowledgement.
 */
export const chatMaterializer: DocumentMaterializer = {
  documentType: "chat",

  materialize(
    doc: Record<string, unknown>,
    db: MaterializerDb,
    eventBus: EventBus<DataLayerEventMap>,
  ): void {
    materializeDocument("chat", doc, db, eventBus);
  },
};

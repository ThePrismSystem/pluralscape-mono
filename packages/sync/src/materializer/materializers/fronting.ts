import { materializeDocument } from "./materialize-document.js";

import type { EventBus, DataLayerEventMap } from "../../event-bus/index.js";
import type { MaterializerDb } from "../base-materializer.js";
import type { DocumentMaterializer } from "../materializer-registry.js";

/**
 * Materializer for the `fronting` document (hot path).
 *
 * Handles: fronting-session, fronting-comment, check-in-record.
 */
export const frontingMaterializer: DocumentMaterializer = {
  documentType: "fronting",

  materialize(
    doc: Record<string, unknown>,
    db: MaterializerDb,
    eventBus: EventBus<DataLayerEventMap>,
  ): void {
    materializeDocument("fronting", doc, db, eventBus);
  },
};

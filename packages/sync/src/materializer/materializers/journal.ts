import { materializeDocument } from "./materialize-document.js";

import type { EventBus, DataLayerEventMap } from "../../event-bus/index.js";
import type { MaterializerDb } from "../base-materializer.js";
import type { DocumentMaterializer } from "../materializer-registry.js";

/**
 * Materializer for the `journal` document.
 *
 * Handles: journal-entry, wiki-page, note.
 */
export const journalMaterializer: DocumentMaterializer = {
  documentType: "journal",

  materialize(
    doc: Record<string, unknown>,
    db: MaterializerDb,
    eventBus: EventBus<DataLayerEventMap>,
  ): void {
    materializeDocument("journal", doc, db, eventBus);
  },
};

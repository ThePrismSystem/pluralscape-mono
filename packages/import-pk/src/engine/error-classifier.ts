import { classifyErrorDefault } from "@pluralscape/import-core";

import type { ClassifyContext } from "@pluralscape/import-core";
import type { ImportError } from "@pluralscape/types";

export function classifyPkError(thrown: unknown, ctx: ClassifyContext): ImportError {
  return classifyErrorDefault(thrown, ctx);
}

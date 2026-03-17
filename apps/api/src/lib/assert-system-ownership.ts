import { HTTP_FORBIDDEN } from "../http.constants.js";

import { ApiHttpError } from "./api-error.js";

import type { AuthContext } from "./auth-context.js";
import type { SystemId } from "@pluralscape/types";

export function assertSystemOwnership(auth: AuthContext, systemId: SystemId): void {
  if (auth.systemId !== systemId) {
    throw new ApiHttpError(HTTP_FORBIDDEN, "FORBIDDEN", "System access denied");
  }
}

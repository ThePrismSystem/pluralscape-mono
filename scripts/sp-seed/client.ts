// scripts/sp-seed/client.ts

export class SpApiError extends Error {
  constructor(
    readonly status: number,
    readonly method: string,
    readonly path: string,
    readonly body: string,
  ) {
    super(`SP API ${method} ${path} failed (${status}): ${body}`);
    this.name = "SpApiError";
  }
}

export class NonJsonResponseError extends Error {
  constructor(
    readonly method: string,
    readonly path: string,
    readonly rawBody: string,
  ) {
    super(`SP API ${method} ${path} returned non-JSON body: ${rawBody.slice(0, 200)}`);
    this.name = "NonJsonResponseError";
  }
}

export class InvalidObjectIdError extends Error {
  constructor(readonly received: string) {
    super(`Expected a 24-char hex ObjectId, got: ${received.slice(0, 80)}`);
    this.name = "InvalidObjectIdError";
  }
}

export class MalformedJwtError extends Error {
  constructor(reason = "malformed JWT") {
    super(reason);
    this.name = "MalformedJwtError";
  }
}

export class UnresolvedRefError extends Error {
  constructor(readonly ref: string) {
    super(`Unresolved fixture ref: "${ref}"`);
    this.name = "UnresolvedRefError";
  }
}

export class LegacyManifestError extends Error {
  constructor(readonly manifestPath: string) {
    super(`manifest format out of date — delete ${manifestPath} and re-run to regenerate`);
    this.name = "LegacyManifestError";
  }
}

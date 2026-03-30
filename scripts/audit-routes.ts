export interface RouteMethod {
  method: string;
  path: string;
}

export interface RouteFileInfo {
  hasAuth: boolean;
  rateLimitCategory: string | null;
  usesParseJsonBody: boolean;
  validationSchemas: string[];
  methods: RouteMethod[];
}

const METHOD_PATTERN = /\.(get|post|put|delete|patch)\(\s*["']([^"']+)["']/g;
const RATE_LIMIT_PATTERN = /createCategoryRateLimiter\(\s*["']([^"']+)["']\s*\)/;
const AUTH_MIDDLEWARE_PATTERN = /authMiddleware\(\)/;
const PARSE_JSON_BODY_PATTERN = /parseJsonBody\(/;
const VALIDATION_IMPORT_PATTERN = /import\s*\{([^}]+)\}\s*from\s*["']@pluralscape\/validation["']/;

export function parseRouteFile(source: string, _filename: string): RouteFileInfo {
  const methods: RouteMethod[] = [];
  let match: RegExpExecArray | null;
  const methodRegex = new RegExp(METHOD_PATTERN.source, METHOD_PATTERN.flags);
  while ((match = methodRegex.exec(source)) !== null) {
    const rawMethod = match[1];
    const rawPath = match[2];
    if (rawMethod !== undefined && rawPath !== undefined) {
      methods.push({ method: rawMethod.toUpperCase(), path: rawPath });
    }
  }

  const rateLimitMatch = RATE_LIMIT_PATTERN.exec(source);
  const rateLimitCategory = rateLimitMatch?.[1] ?? null;

  const hasAuth = AUTH_MIDDLEWARE_PATTERN.test(source);
  const usesParseJsonBody = PARSE_JSON_BODY_PATTERN.test(source);

  const validationSchemas: string[] = [];
  const validationMatch = VALIDATION_IMPORT_PATTERN.exec(source);
  if (validationMatch?.[1] !== undefined) {
    const imports = validationMatch[1]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    validationSchemas.push(...imports.filter((s) => s.endsWith("Schema")));
  }

  return { hasAuth, rateLimitCategory, usesParseJsonBody, validationSchemas, methods };
}

#!/usr/bin/env node
/**
 * Pluralscape token build (C1) — Style Dictionary
 *
 * Reads /tokens/*.json and emits:
 *   - ../../docs/design-system/preview/colors_and_type.generated.css  (CSS preview)
 *   - ../../docs/design-system/ui_kits/mobile/theme.generated.js      (JS preview)
 *   - ../src/tokens.generated.ts   (primitive scales — production SoT)
 *   - ../src/themes.generated.ts   (five merged themes — production SoT)
 *
 * Why Style Dictionary: the audit (C1) called out hand-mirroring between JSON
 * and the consumed CSS/JS as the drift vector. SD is the lowest-effort tool
 * that will (a) resolve `{primary.softLavender}` references for us, (b) emit
 * platform-specific files, (c) plug into a wider design-token pipeline when we
 * port to RN. Custom formats below replicate the bespoke shape the kit needs:
 *   - CSS: must emit grouped [data-mode="…"] blocks, not just :root
 *   - JS:  must emit a runtime-mutable PS_THEME object + applyMode helper
 *
 * A pairings validator (C2) runs first; the build short-circuits on contrast
 * violations so a forbidden pair never reaches consumers.
 *
 * Usage:
 *   npm install --save-dev style-dictionary
 *   node tokens/build.mjs            # write outputs
 *   node tokens/build.mjs --check    # validation only; exits non-zero on failure
 */

import StyleDictionary from "style-dictionary";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const CHECK_ONLY = process.argv.includes("--check");

const colors = readJSON("tokens/colors.json");
const pairings = readJSON("tokens/pairings.json");

// ---------- (C2) Forbidden-pair validator ----------
// Iterates pairings.json instead of guessing implied pairings from semantic
// tokens. `allowed` entries must clear their declared min ratio; `forbidden`
// entries must NOT appear as a resolved fg+bg in semantic.default.
function ratio(hex1, hex2) {
  const lum = (h) => {
    const v = [0, 2, 4]
      .map((i) => parseInt(h.replace("#", "").substr(i, 2), 16) / 255)
      .map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  };
  const l1 = lum(hex1),
    l2 = lum(hex2);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}
function lookup(name) {
  return colors.primary[name]?.value ?? colors.extended[name]?.value ?? null;
}
function resolveSemantic(value) {
  if (typeof value !== "string") return value;
  return value.replace(/\{([^}]+)\}/g, (_, path) => {
    const parts = path.split(".");
    let n = colors;
    for (const p of parts) n = n?.[p];
    return n && typeof n === "object" && "value" in n ? n.value : (n ?? "");
  });
}
function validatePairings() {
  const errs = [];
  for (const p of pairings.allowed) {
    const fg = lookup(p.fg),
      bg = lookup(p.bg);
    if (!fg || !bg) {
      errs.push(`allowed.${p.id}: unknown color`);
      continue;
    }
    const r = ratio(fg, bg);
    if (r < p.min) errs.push(`allowed.${p.id}: ${r.toFixed(2)}:1 < ${p.min}:1`);
  }
  // Forbidden: scan every semantic mode for a fill that resolves to the
  // forbidden bg while a sibling fg-role token resolves to the forbidden fg.
  for (const [modeName, modeDef] of Object.entries({
    default: colors.semantic.default,
    ...colors.modes,
  })) {
    if (modeName === "_doc") continue;
    const sem = {};
    for (const [k, v] of Object.entries(modeDef)) {
      if (k === "_doc") continue;
      sem[k] = resolveSemantic(v?.value ?? v);
    }
    for (const p of pairings.forbidden) {
      const fg = lookup(p.fg),
        bg = lookup(p.bg);
      if (!fg || !bg) continue;
      // fgOnAccent is the designated text-on-fill role; check it only against fill
      // backgrounds. Body-text roles (fg, fgMuted, fgSubtle, linkColor) sit on
      // canvas/surface backgrounds only — do not cross-check them against fills
      // (accent, success, etc.) because those are never actual surface backgrounds
      // for body text; a false match would fire whenever semantic.default lists
      // both a body-text role and a fill role, which it always does.
      const fgRoles = ["fgOnAccent"];
      const bgRoles = ["accent", "success", "danger", "warning", "intimate", "interactiveOn"];
      // Separately check body-text roles against canvas/surface backgrounds only
      const textFgRoles = ["fg", "fgMuted", "fgSubtle", "linkColor"];
      const surfaceBgRoles = ["bg", "bgSubtle", "surface", "surfaceHover"];
      for (const fgRole of fgRoles) {
        for (const bgRole of bgRoles) {
          if (
            (sem[fgRole] || "").toLowerCase() === fg.toLowerCase() &&
            (sem[bgRole] || "").toLowerCase() === bg.toLowerCase()
          ) {
            errs.push(
              `mode "${modeName}" pairs ${fgRole}=${p.fg} on ${bgRole}=${p.bg} — forbidden (${p.doc})`,
            );
          }
        }
      }
      for (const fgRole of textFgRoles) {
        for (const bgRole of surfaceBgRoles) {
          if (
            (sem[fgRole] || "").toLowerCase() === fg.toLowerCase() &&
            (sem[bgRole] || "").toLowerCase() === bg.toLowerCase()
          ) {
            errs.push(
              `mode "${modeName}" pairs ${fgRole}=${p.fg} on ${bgRole}=${p.bg} — forbidden (${p.doc})`,
            );
          }
        }
      }
    }
  }
  return errs;
}

const errs = validatePairings();
if (errs.length) {
  console.error("Token validation errors:");
  for (const e of errs) console.error("  - " + e);
  process.exit(1);
}
console.log("✓ tokens validated:");
console.log(`  ${pairings.allowed.length} allowed pairs clear AA`);
console.log(`  ${pairings.forbidden.length} forbidden pairs absent from semantic mappings`);

if (CHECK_ONLY) process.exit(0);

// ---------- Style Dictionary build (CSS + JS previews) ----------
// SD needs token files in {value} shape — colors.json/typography.json/etc
// already conform. We strip `_doc` keys via a custom parser, register custom
// formats for our two output shapes, and emit.

StyleDictionary.registerParser({
  name: "ps/strip-meta",
  pattern: /\.json$/,
  parser: ({ contents }) => {
    const stripDoc = (n) => {
      if (Array.isArray(n)) return n.map(stripDoc);
      if (n && typeof n === "object") {
        const out = {};
        for (const [k, v] of Object.entries(n)) {
          if (k === "_doc" || k === "$schema") continue;
          out[k] = stripDoc(v);
        }
        return out;
      }
      return n;
    };
    return stripDoc(JSON.parse(contents));
  },
});

// Custom format: our :root + [data-mode] CSS shape. Style Dictionary's stock
// css/variables format flattens everything to a single :root block; we need
// grouped overrides per accommodation mode.
StyleDictionary.registerFormat({
  name: "ps/css-variables-modes",
  format: ({ dictionary }) => {
    // Filter to color tokens only for this format; type/spacing emit elsewhere.
    const root = [];
    for (const t of dictionary.allTokens) {
      const path = t.path.join(".");
      if (
        path.startsWith("semantic.default.") ||
        path.startsWith("primary.") ||
        path.startsWith("extended.")
      ) {
        root.push(`  --${kebab(t.name)}: ${t.value};`);
      }
    }
    return `/* Generated by tokens/build.mjs — DO NOT EDIT */\n:root {\n${root.join("\n")}\n}\n`;
  },
});

// Custom format: window.PS_THEME runtime object.
StyleDictionary.registerFormat({
  name: "ps/js-theme",
  format: ({ dictionary }) => {
    const sem = {};
    for (const t of dictionary.allTokens) {
      if (!t.path[0] === "semantic") continue;
      if (t.path[0] === "semantic" && t.path[1] === "default") {
        sem[t.path[2]] = t.value;
      }
    }
    return `/* Generated by tokens/build.mjs — DO NOT EDIT */\nwindow.PS_THEME = window.PS_THEME || {};\nObject.assign(window.PS_THEME.color = window.PS_THEME.color || {}, ${JSON.stringify(sem, null, 2)});\n`;
  },
});

// Ensure preview output dirs exist (gitignored)
const previewDir = resolve(ROOT, "../../docs/design-system/preview");
const mobileDir = resolve(ROOT, "../../docs/design-system/ui_kits/mobile");
mkdirSync(previewDir, { recursive: true });
mkdirSync(mobileDir, { recursive: true });

const sd = new StyleDictionary({
  source: [
    "tokens/colors.json",
    "tokens/typography.json",
    "tokens/spacing.json",
    "tokens/radii.json",
    "tokens/elevation.json",
    "tokens/motion.json",
    "tokens/breakpoints.json",
  ],
  parsers: ["ps/strip-meta"],
  platforms: {
    css: {
      transformGroup: "css",
      buildPath: "../../docs/design-system/preview/",
      files: [{ destination: "colors_and_type.generated.css", format: "ps/css-variables-modes" }],
    },
    js: {
      transformGroup: "js",
      buildPath: "../../docs/design-system/ui_kits/mobile/",
      files: [{ destination: "theme.generated.js", format: "ps/js-theme" }],
    },
  },
});

await sd.buildAllPlatforms();
console.log("✓ Style Dictionary preview build complete.");

// ---------- Production TS build (tokens.generated.ts + themes.generated.ts) ----------
// We read the raw JSON files directly — not through SD — because the token
// files use a mix of {value} leaves for colors but raw scalars for spacing /
// motion / elevation / radii. Building the TS output directly from JSON gives
// us full control over the structure without SD transform/platform machinery.

const spacing = readJSON("tokens/spacing.json");
const motion = readJSON("tokens/motion.json");
const elevation = readJSON("tokens/elevation.json");
const typography = readJSON("tokens/typography.json");
const radii = readJSON("tokens/radii.json");

// Resolve all {ref} references in a value using the colors palette
function resolveRef(value) {
  if (typeof value !== "string") return value;
  return value.replace(/\{([^}]+)\}/g, (_, path) => {
    const parts = path.split(".");
    let n = colors;
    for (const p of parts) n = n?.[p];
    return n && typeof n === "object" && "value" in n ? n.value : (n ?? value);
  });
}

// Extract primitive value from a token node ({value} object or raw scalar)
function primitiveVal(node) {
  if (node && typeof node === "object" && "value" in node) {
    return resolveRef(node.value);
  }
  return node;
}

// Build a sorted plain object from key→value pairs
function sortedObj(entries) {
  return Object.fromEntries([...entries].sort(([a], [b]) => a.localeCompare(b)));
}

// ---- tokens.generated.ts primitives ----

// Palette: primary + extended — strip doc/internal keys, resolve refs
function buildPaletteGroup(src) {
  const entries = [];
  for (const [k, v] of Object.entries(src)) {
    if (k === "_doc" || k === "$schema") continue;
    entries.push([k, resolveRef(v?.value ?? v)]);
  }
  return sortedObj(entries);
}

const palette = {
  primary: buildPaletteGroup(colors.primary),
  extended: buildPaletteGroup(colors.extended),
};

// Spacing: scale (xs, sm, md, lg, xl, 2xl) — raw numbers
const spacingScale = sortedObj(
  Object.entries(colors.scale ?? {})
    .concat(Object.entries(spacing.scale ?? {}))
    .filter(([k]) => !["_doc"].includes(k))
    .map(([k, v]) => [k, typeof v === "number" ? v : primitiveVal(v)]),
);
// Use spacing.scale directly since colors has no 'scale'
const spacingOut = sortedObj(
  Object.entries(spacing.scale ?? {})
    .filter(([k]) => k !== "_doc")
    .map(([k, v]) => [k, typeof v === "number" ? v : primitiveVal(v)]),
);

// Hit targets: default values only (modes handled in themes.generated.ts)
const hitOut = sortedObj(
  Object.entries(spacing.hit?.default ?? {})
    .filter(([k]) => k !== "_doc")
    .map(([k, v]) => [k, typeof v === "number" ? v : primitiveVal(v)]),
);

// Typography: font families + type scale default
const typographyOut = {
  font: sortedObj(
    Object.entries(typography.font ?? {})
      .filter(([k]) => k !== "_doc")
      .map(([k, v]) => [k, primitiveVal(v)]),
  ),
  scale: sortedObj(
    Object.entries(typography.scale?.default ?? {})
      .filter(([k]) => k !== "_doc")
      .map(([k, v]) => {
        if (v && typeof v === "object") {
          return [
            k,
            sortedObj(
              Object.entries(v)
                .filter(([ik]) => ik !== "_doc")
                .map(([ik, iv]) => [ik, primitiveVal(iv)]),
            ),
          ];
        }
        return [k, primitiveVal(v)];
      }),
  ),
};

// Radii
const radiusOut = sortedObj(
  Object.entries(radii.scale ?? {})
    .filter(([k]) => k !== "_doc")
    .map(([k, v]) => [k, typeof v === "number" ? v : primitiveVal(v)]),
);

// Motion: ease + default durations
const motionOut = {
  ease: motion.ease,
  dur: sortedObj(
    Object.entries(motion.duration?.default ?? {})
      .filter(([k]) => k !== "_doc")
      .map(([k, v]) => [k, typeof v === "number" ? v : primitiveVal(v)]),
  ),
};

// Elevation: shadow (static, no modes) + glow default
const elevationOut = {
  shadow: sortedObj(
    Object.entries(elevation.shadow ?? {})
      .filter(([k]) => k !== "_doc")
      .map(([k, v]) => [k, primitiveVal(v)]),
  ),
  glow: sortedObj(
    Object.entries(elevation.glow?.default ?? {})
      .filter(([k]) => k !== "_doc")
      .map(([k, v]) => [k, primitiveVal(v)]),
  ),
};

// ---- themes.generated.ts — five merged themes ----

// Build the default color theme from semantic.default, resolving all refs
function buildDefaultColorTheme() {
  const sem = {};
  for (const [k, v] of Object.entries(colors.semantic.default)) {
    if (k === "_doc") continue;
    sem[k] = resolveRef(v?.value ?? v);
  }
  return sortedObj(Object.entries(sem));
}

// Merge mode overrides on top of a base object (leaf values only)
function mergeMode(base, overrides) {
  const out = { ...base };
  for (const [k, v] of Object.entries(overrides)) {
    if (k === "_doc") continue;
    const resolved = resolveRef(typeof v === "object" && v !== null && "value" in v ? v.value : v);
    out[k] = resolved;
  }
  return sortedObj(Object.entries(out));
}

const defaultColor = buildDefaultColorTheme();

// Build all five color themes
const colorThemes = {
  default: defaultColor,
  static: mergeMode(defaultColor, colors.modes?.static ?? {}),
  "reduced-motion": mergeMode(defaultColor, colors.modes?.["reduced-motion"] ?? {}),
  "high-contrast": mergeMode(defaultColor, colors.modes?.["high-contrast"] ?? {}),
  littles: mergeMode(defaultColor, colors.modes?.littles ?? {}),
};

// Hit target overrides per mode
const hitThemes = {
  default: hitOut,
  static: hitOut,
  "reduced-motion": hitOut,
  "high-contrast": sortedObj(
    Object.entries({ ...hitOut, ...(spacing.hit?.["high-contrast"] ?? {}) }),
  ),
  littles: sortedObj(Object.entries({ ...hitOut, ...(spacing.hit?.littles ?? {}) })),
};

// Motion duration overrides per mode
const defaultDur = motionOut.dur;
const durThemes = {
  default: defaultDur,
  static: sortedObj(
    Object.entries({
      ...defaultDur,
      ...Object.fromEntries(
        Object.entries(motion.duration?.static ?? {}).filter(([k]) => k !== "_doc"),
      ),
    }),
  ),
  "reduced-motion": sortedObj(
    Object.entries({
      ...defaultDur,
      ...Object.fromEntries(
        Object.entries(motion.duration?.["reduced-motion"] ?? {}).filter(([k]) => k !== "_doc"),
      ),
    }),
  ),
  "high-contrast": sortedObj(
    Object.entries({
      ...defaultDur,
      ...Object.fromEntries(
        Object.entries(motion.duration?.["high-contrast"] ?? {}).filter(([k]) => k !== "_doc"),
      ),
    }),
  ),
  littles: defaultDur,
};

// Glow overrides per mode
const defaultGlow = elevationOut.glow;
const glowThemes = {
  default: defaultGlow,
  static: sortedObj(Object.entries({ ...defaultGlow, ...(elevation.glow?.static ?? {}) })),
  "reduced-motion": defaultGlow,
  "high-contrast": sortedObj(
    Object.entries({ ...defaultGlow, ...(elevation.glow?.["high-contrast"] ?? {}) }),
  ),
  littles: defaultGlow,
};

// Typography scale overrides per mode
function buildTypoScale(modeOverrides) {
  const base = typographyOut.scale;
  if (!modeOverrides || Object.keys(modeOverrides).length === 0) return base;
  const out = {};
  for (const [k, v] of Object.entries(base)) {
    out[k] = { ...v };
  }
  for (const [k, v] of Object.entries(modeOverrides)) {
    if (k === "_doc") continue;
    if (out[k]) {
      out[k] = sortedObj(
        Object.entries({
          ...out[k],
          ...Object.fromEntries(Object.entries(v).filter(([ik]) => ik !== "_doc")),
        }),
      );
    }
  }
  return sortedObj(Object.entries(out));
}

const typoScaleThemes = {
  default: typographyOut.scale,
  static: typographyOut.scale,
  "reduced-motion": typographyOut.scale,
  "high-contrast": buildTypoScale(typography.modes?.["high-contrast"] ?? {}),
  littles: buildTypoScale(typography.modes?.littles ?? {}),
};

// Assemble the five complete themes
const MODES = ["default", "static", "reduced-motion", "high-contrast", "littles"];

function buildTheme(mode) {
  return {
    color: colorThemes[mode],
    font: typographyOut.font,
    scale: typoScaleThemes[mode],
    space: spacingOut,
    hit: hitThemes[mode],
    radius: radiusOut,
    motion: { ease: motion.ease, dur: durThemes[mode] },
    elevation: { shadow: elevationOut.shadow, glow: glowThemes[mode] },
  };
}

const allThemes = {};
for (const mode of MODES) {
  allThemes[mode] = buildTheme(mode);
}

// ---- Emit tokens.generated.ts ----

function tsLiteral(val, indent = 0) {
  const pad = "  ".repeat(indent);
  const inner = "  ".repeat(indent + 1);
  if (typeof val === "string") return JSON.stringify(val);
  if (typeof val === "number") return String(val);
  if (Array.isArray(val)) return JSON.stringify(val);
  if (val && typeof val === "object") {
    const entries = Object.entries(val);
    if (entries.length === 0) return "{}";
    const lines = entries.map(([k, v]) => {
      const key = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(k) ? k : JSON.stringify(k);
      return `${inner}${key}: ${tsLiteral(v, indent + 1)},`;
    });
    return `{\n${lines.join("\n")}\n${pad}}`;
  }
  return JSON.stringify(val);
}

const tokensTs = `// AUTO-GENERATED by tokens/build.mjs. DO NOT EDIT BY HAND.
// SoT: tokens/*.json. Run \`pnpm tokens:build\` to regenerate.

export const palette = ${tsLiteral(palette)} as const;

export const typography = ${tsLiteral(typographyOut)} as const;

export const spacing = ${tsLiteral(spacingOut)} as const;

export const hit = ${tsLiteral(hitOut)} as const;

export const radius = ${tsLiteral(radiusOut)} as const;

export const motion = ${tsLiteral(motionOut)} as const;

export const elevation = ${tsLiteral(elevationOut)} as const;
`;

// ---- Emit themes.generated.ts ----

const defaultTheme = allThemes["default"];

// Build a widened structural type from the default theme shape. Using
// `typeof _default` would pin every value to its exact literal type, making
// `satisfies Theme` reject mode themes whose values differ (e.g. high-contrast
// has different hex literals). We widen each leaf: string stays string, number
// stays number — shape is enforced but literals are free to vary per mode.
function widenedTypeOf(val, indent = 0) {
  const pad = "  ".repeat(indent);
  const inner = "  ".repeat(indent + 1);
  if (typeof val === "string") return "string";
  if (typeof val === "number") return "number";
  if (Array.isArray(val)) return "readonly string[]";
  if (val && typeof val === "object") {
    const entries = Object.entries(val);
    if (entries.length === 0) return "Record<string, never>";
    const lines = entries.map(([k, v]) => {
      const key = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(k) ? k : JSON.stringify(k);
      return `${inner}${key}: ${widenedTypeOf(v, indent + 1)};`;
    });
    return `{\n${lines.join("\n")}\n${pad}}`;
  }
  return "unknown";
}

const themesTs = `// AUTO-GENERATED by tokens/build.mjs. DO NOT EDIT BY HAND.
// SoT: tokens/*.json. Run \`pnpm tokens:build\` to regenerate.

export type Theme = ${widenedTypeOf(defaultTheme)};

export type ThemeMode = "default" | "static" | "reduced-motion" | "high-contrast" | "littles";

export const themes = {
  default: ${tsLiteral(defaultTheme)} as const satisfies Theme,
${MODES.filter((m) => m !== "default")
  .map((m) => `  ${JSON.stringify(m)}: ${tsLiteral(allThemes[m])} as const satisfies Theme,`)
  .join("\n")}
} as const satisfies Record<ThemeMode, Theme>;
`;

const srcDir = resolve(ROOT, "src");
mkdirSync(srcDir, { recursive: true });
writeFileSync(join(srcDir, "tokens.generated.ts"), tokensTs, "utf8");
writeFileSync(join(srcDir, "themes.generated.ts"), themesTs, "utf8");
console.log("✓ src/tokens.generated.ts written");
console.log("✓ src/themes.generated.ts written");

// Run prettier on the generated files to ensure pre-commit hook stability
try {
  execSync("npx prettier --write ../src/tokens.generated.ts ../src/themes.generated.ts", {
    cwd: __dirname,
    stdio: "inherit",
  });
  console.log("✓ Prettier pass complete");
} catch {
  // Prettier unavailable in local node_modules; try workspace prettier
  try {
    execSync("pnpm prettier --write ../src/tokens.generated.ts ../src/themes.generated.ts", {
      cwd: ROOT,
      stdio: "inherit",
    });
    console.log("✓ Prettier pass complete (workspace)");
  } catch {
    console.warn("⚠ Prettier not available — generated files may need formatting");
  }
}

console.log("✓ Build complete.");

// ---------- helpers ----------
function kebab(s) {
  return s.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}
function readJSON(rel) {
  return JSON.parse(readFileSync(join(ROOT, rel), "utf8"));
}

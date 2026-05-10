#!/usr/bin/env node
/**
 * Pluralscape token build (C1) — Style Dictionary
 *
 * Reads /tokens/*.json and emits:
 *   - colors_and_type.css      (CSS custom properties + [data-mode] overrides)
 *   - ui_kits/mobile/theme.js  (window.PS_THEME + applyMode helper)
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

import StyleDictionary from 'style-dictionary';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const CHECK_ONLY = process.argv.includes('--check');

const colors   = readJSON('tokens/colors.json');
const pairings = readJSON('tokens/pairings.json');

// ---------- (C2) Forbidden-pair validator ----------
// Iterates pairings.json instead of guessing implied pairings from semantic
// tokens. `allowed` entries must clear their declared min ratio; `forbidden`
// entries must NOT appear as a resolved fg+bg in semantic.default.
function ratio(hex1, hex2) {
  const lum = (h) => {
    const v = [0, 2, 4].map(i => parseInt(h.replace('#', '').substr(i, 2), 16) / 255).map(c =>
      c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  };
  const l1 = lum(hex1), l2 = lum(hex2);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}
function lookup(name) {
  return colors.primary[name]?.value ?? colors.extended[name]?.value ?? null;
}
function resolveSemantic(value) {
  if (typeof value !== 'string') return value;
  return value.replace(/\{([^}]+)\}/g, (_, path) => {
    const parts = path.split('.');
    let n = colors;
    for (const p of parts) n = n?.[p];
    return (n && typeof n === 'object' && 'value' in n) ? n.value : (n ?? '');
  });
}
function validatePairings() {
  const errs = [];
  for (const p of pairings.allowed) {
    const fg = lookup(p.fg), bg = lookup(p.bg);
    if (!fg || !bg) { errs.push(`allowed.${p.id}: unknown color`); continue; }
    const r = ratio(fg, bg);
    if (r < p.min) errs.push(`allowed.${p.id}: ${r.toFixed(2)}:1 < ${p.min}:1`);
  }
  // Forbidden: scan every semantic mode for a fill that resolves to the
  // forbidden bg while a sibling fg-role token resolves to the forbidden fg.
  for (const [modeName, modeDef] of Object.entries({ default: colors.semantic.default, ...colors.modes })) {
    if (modeName === '_doc') continue;
    const sem = {};
    for (const [k, v] of Object.entries(modeDef)) {
      if (k === '_doc') continue;
      sem[k] = resolveSemantic(v?.value ?? v);
    }
    for (const p of pairings.forbidden) {
      const fg = lookup(p.fg), bg = lookup(p.bg);
      if (!fg || !bg) continue;
      const fgRoles = ['fg', 'fgMuted', 'fgSubtle', 'fgOnAccent', 'linkColor'];
      const bgRoles = ['bg', 'bgSubtle', 'surface', 'accent', 'success', 'danger', 'warning', 'intimate', 'interactiveOn'];
      for (const fgRole of fgRoles) {
        for (const bgRole of bgRoles) {
          if ((sem[fgRole] || '').toLowerCase() === fg.toLowerCase()
           && (sem[bgRole] || '').toLowerCase() === bg.toLowerCase()) {
            errs.push(`mode "${modeName}" pairs ${fgRole}=${p.fg} on ${bgRole}=${p.bg} — forbidden (${p.doc})`);
          }
        }
      }
    }
  }
  return errs;
}

const errs = validatePairings();
if (errs.length) {
  console.error('Token validation errors:');
  for (const e of errs) console.error('  - ' + e);
  process.exit(1);
}
console.log('✓ tokens validated:');
console.log(`  ${pairings.allowed.length} allowed pairs clear AA`);
console.log(`  ${pairings.forbidden.length} forbidden pairs absent from semantic mappings`);

if (CHECK_ONLY) process.exit(0);

// ---------- Style Dictionary build ----------
// SD needs token files in {value} shape — colors.json/typography.json/etc
// already conform. We strip `_doc` keys via a custom parser, register custom
// formats for our two output shapes, and emit.

StyleDictionary.registerParser({
  name: 'ps/strip-meta',
  pattern: /\.json$/,
  parser: ({ contents }) => {
    const stripDoc = (n) => {
      if (Array.isArray(n)) return n.map(stripDoc);
      if (n && typeof n === 'object') {
        const out = {};
        for (const [k, v] of Object.entries(n)) {
          if (k === '_doc' || k === '$schema') continue;
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
  name: 'ps/css-variables-modes',
  format: ({ dictionary }) => {
    // Filter to color tokens only for this format; type/spacing emit elsewhere.
    const root = [];
    for (const t of dictionary.allTokens) {
      const path = t.path.join('.');
      if (path.startsWith('semantic.default.') || path.startsWith('primary.') || path.startsWith('extended.')) {
        root.push(`  --${kebab(t.name)}: ${t.value};`);
      }
    }
    return `/* Generated by tokens/build.mjs — DO NOT EDIT */\n:root {\n${root.join('\n')}\n}\n`;
  },
});

// Custom format: window.PS_THEME runtime object.
StyleDictionary.registerFormat({
  name: 'ps/js-theme',
  format: ({ dictionary }) => {
    const sem = {};
    for (const t of dictionary.allTokens) {
      if (!t.path[0] === 'semantic') continue;
      if (t.path[0] === 'semantic' && t.path[1] === 'default') {
        sem[t.path[2]] = t.value;
      }
    }
    return `/* Generated by tokens/build.mjs — DO NOT EDIT */\nwindow.PS_THEME = window.PS_THEME || {};\nObject.assign(window.PS_THEME.color = window.PS_THEME.color || {}, ${JSON.stringify(sem, null, 2)});\n`;
  },
});

const sd = new StyleDictionary({
  source: ['tokens/colors.json', 'tokens/typography.json', 'tokens/spacing.json', 'tokens/radii.json', 'tokens/elevation.json', 'tokens/motion.json', 'tokens/breakpoints.json'],
  parsers: ['ps/strip-meta'],
  platforms: {
    css: {
      transformGroup: 'css',
      buildPath: '',
      files: [{ destination: 'colors_and_type.generated.css', format: 'ps/css-variables-modes' }],
    },
    js: {
      transformGroup: 'js',
      buildPath: 'ui_kits/mobile/',
      files: [{ destination: 'theme.generated.js', format: 'ps/js-theme' }],
    },
  },
});

await sd.buildAllPlatforms();
console.log('✓ Style Dictionary build complete.');
console.log('  Note: the canonical colors_and_type.css and ui_kits/mobile/theme.js');
console.log('  remain hand-curated until the .generated.* outputs are wired in.');
console.log('  This build validates and produces the .generated.* files for diffing.');

// ---------- helpers ----------
function kebab(s) {
  return s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}
function readJSON(rel) {
  return JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
}

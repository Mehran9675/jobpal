import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, extname } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const EXTENSIONS = new Set(['.ts', '.tsx', '.scss', '.md', '.mjs', '.json', '.html', '.yml', '.yaml', '.txt']);
const SKIP_DIRS = new Set(['node_modules', 'dist', 'dist-firefox', 'release', 'icons', '.git']);

let files = 0;
let replacements = 0;

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full);
      continue;
    }
    if (!EXTENSIONS.has(extname(entry))) continue;
    const before = readFileSync(full, 'utf8');
    // Also collapse `--]` left behind when a dash inside a regex class is replaced.
    const after = before.replace(/[\u2013\u2014]/g, '-').replace(/--\]/g, ']');
    if (after !== before) {
      const count = (before.match(/[\u2013\u2014]/g) ?? []).length;
      writeFileSync(full, after);
      files += 1;
      replacements += count;
      console.log(`[dashes] ${full.slice(root.length)} (${count})`);
    }
  }
}

walk(root);
console.log(`[dashes] replaced ${replacements} en/em dashes in ${files} files`);

import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative, posix } from 'node:path';
import { createZip } from './lib/zip.mjs';
import { createCrx, generatePrivateKeyPem } from './lib/crx.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const outputDir = join(root, 'release');
const SKIP = ['.map', '.DS_Store', 'Thumbs.db'];

function walk(dir, base = dir, files = []) {
  for (const entry of readdirSync(dir).sort()) {
    const full = join(dir, entry);
    if (SKIP.some((suffix) => entry.endsWith(suffix))) continue;
    if (statSync(full).isDirectory()) walk(full, base, files);
    else files.push({ path: posix.join(...relative(base, full).split(/[\\/]/)), data: readFileSync(full) });
  }
  return files;
}

function pack(sourceDir, basename) {
  const manifestPath = join(sourceDir, 'manifest.json');
  if (!existsSync(manifestPath)) {
    console.error(`[package] ${sourceDir} has no manifest.json - run the build first.`);
    process.exit(1);
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const version = manifest.version;
  const entries = walk(sourceDir);
  const zip = createZip(entries);
  const zipPath = join(outputDir, `${basename}-${version}.zip`);
  writeFileSync(zipPath, zip);
  console.log(`[package] ${relative(root, zipPath)} (${entries.length} files, ${(zip.length / 1024).toFixed(0)} KB)`);
  return { zip, zipPath, version };
}

rmSync(outputDir, { recursive: true, force: true });
mkdirSync(outputDir, { recursive: true });

const chrome = pack(join(root, 'dist'), 'jobpal-chrome');
const firefox = pack(join(root, 'dist-firefox'), 'jobpal-firefox');

if (chrome.version !== firefox.version) {
  console.error(`[package] Version mismatch: chrome ${chrome.version} vs firefox ${firefox.version}`);
  process.exit(1);
}

// Chrome installs a single .crx file. The signing key must stay the same
// between builds so the extension ID (and user data) is stable: keep
// keys/jobpal-crx.pem locally, or set the JOBPAL_CRX_KEY secret in CI.
const KEY_PATH = join(root, 'keys', 'jobpal-crx.pem');
function loadSigningKey() {
  const fromEnv = process.env.JOBPAL_CRX_KEY;
  if (fromEnv && fromEnv.trim()) return fromEnv;
  if (existsSync(KEY_PATH)) return readFileSync(KEY_PATH, 'utf8');
  const pem = generatePrivateKeyPem();
  mkdirSync(join(root, 'keys'), { recursive: true });
  writeFileSync(KEY_PATH, pem);
  console.log('[package] generated a new CRX signing key at keys/jobpal-crx.pem');
  console.log('[package] keep that file (or set JOBPAL_CRX_KEY) so the extension ID stays stable');
  return pem;
}

const { crx, extensionId } = createCrx(chrome.zip, loadSigningKey());
const crxPath = join(outputDir, `jobpal-chrome-${chrome.version}.crx`);
writeFileSync(crxPath, crx);
console.log(`[package] ${relative(root, crxPath)} (extension ID ${extensionId})`);

// Firefox also accepts a .xpi (same zip container) for temporary installs.
const xpiPath = firefox.zipPath.replace(/\.zip$/, '.xpi');
writeFileSync(xpiPath, firefox.zip);
console.log(`[package] ${relative(root, xpiPath)} (copy of the Firefox zip)`);

writeFileSync(join(outputDir, 'version.txt'), `${chrome.version}\n`);
console.log(`[package] done - version ${chrome.version}`);

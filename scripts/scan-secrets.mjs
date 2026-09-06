import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const ignoredDirectories = new Set([
  '.git',
  '.next',
  '.npm-cache',
  '.vinext',
  '.wrangler',
  'dist',
  'node_modules',
  'outputs',
]);
const ignoredFiles = new Set(['package-lock.json', 'scan-secrets.mjs']);
const allowlistedValues = new Set(['sk_live_forbidden']);
const patterns = [
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g,
  /\bsk_(?:live|test)_[A-Za-z0-9]{12,}\b/g,
  /\bwhsec_[A-Za-z0-9]{12,}\b/g,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
];

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await filesUnder(absolute)));
    else if (!ignoredFiles.has(entry.name)) files.push(absolute);
  }
  return files;
}

const findings = [];
for (const file of await filesUnder(root)) {
  const content = await readFile(file, 'utf8').catch(() => null);
  if (content === null || content.includes('\0')) continue;
  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) {
      if (allowlistedValues.has(match[0])) continue;
      findings.push(`${path.relative(root, file)}:${match.index ?? 0}`);
    }
  }
}

if (findings.length) {
  console.error(`Potential secrets detected:\n${findings.join('\n')}`);
  process.exitCode = 1;
} else {
  console.log('Secret scan passed.');
}

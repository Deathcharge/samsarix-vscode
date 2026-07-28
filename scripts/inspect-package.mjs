import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const yauzl = require('yauzl');
const workspace = path.resolve(process.cwd());
const dist = path.join(workspace, 'dist');
const vsixFiles = readdirSync(dist).filter(name => name.endsWith('.vsix'));

if (vsixFiles.length !== 1) {
  throw new Error(`Expected exactly one VSIX in dist; found ${vsixFiles.length}.`);
}

const vsixPath = path.join(dist, vsixFiles[0]);
const allowed = [
  /^\[Content_Types\]\.xml$/,
  /^extension\.vsixmanifest$/,
  /^extension\/(package\.json|readme\.md|changelog\.md|license(?:\.txt)?|notice|trademarks\.md|icon\.png)$/i,
  /^extension\/assets\/chat\.(css|js)$/,
  /^extension\/out\/extension\.js$/,
  /^extension\/out\/local\/(ChatViewProvider|EditController|OllamaClient|PreviewProvider|configuration|policy)\.js$/,
];
const required = [
  'extension/package.json',
  'extension/readme.md',
  'extension/changelog.md',
  'extension/license.txt',
  'extension/notice',
  'extension/trademarks.md',
  'extension/icon.png',
  'extension/assets/chat.css',
  'extension/assets/chat.js',
  'extension/out/extension.js',
  'extension/out/local/OllamaClient.js',
];
const forbiddenRuntimeText = [
  'api.helixcollective.io',
  'innerHTML',
  'eval(',
  'child_process',
  'authToken',
  'openMarketplace',
  'CoordinationDashboard',
];

const entries = await readEntries(vsixPath);
const names = entries.map(entry => entry.name).sort();
const lowerCaseNames = new Set(names.map(name => name.toLowerCase()));

for (const name of names) {
  if (!allowed.some(pattern => pattern.test(name))) {
    throw new Error(`VSIX contains a non-allowlisted file: ${name}`);
  }
  if (/\.(map|ts|tsx|env)$/i.test(name) || /(^|\/)(src|tests?|node_modules)\//i.test(name)) {
    throw new Error(`VSIX contains a forbidden development file: ${name}`);
  }
}

for (const name of required) {
  if (!lowerCaseNames.has(name.toLowerCase())) {
    throw new Error(`VSIX is missing required file: ${name}`);
  }
}

const iconEntry = entries.find(entry => entry.name === 'extension/icon.png');
if (
  !iconEntry ||
  iconEntry.content.length < 24 ||
  iconEntry.content.toString('hex', 0, 8) !== '89504e470d0a1a0a' ||
  iconEntry.content.readUInt32BE(16) !== 256 ||
  iconEntry.content.readUInt32BE(20) !== 256
) {
  throw new Error('Release icon must be a 256×256 PNG.');
}

for (const entry of entries) {
  if (!/extension\/(out|assets)\/.+\.(js|css)$/.test(entry.name)) {
    continue;
  }
  const text = entry.content.toString('utf8');
  for (const forbidden of forbiddenRuntimeText) {
    if (text.includes(forbidden)) {
      throw new Error(`${entry.name} contains forbidden runtime text: ${forbidden}`);
    }
  }
}

const packageJsonEntry = entries.find(entry => entry.name === 'extension/package.json');
const manifest = JSON.parse(packageJsonEntry.content.toString('utf8'));
if (
  manifest.name !== 'samsarix-vscode' ||
  manifest.publisher !== 'samsarix' ||
  manifest.license !== 'MPL-2.0' ||
  manifest.author?.name !== 'Samsarix LLC' ||
  manifest.author?.email !== 'contact@samsarix.com'
) {
  throw new Error('Release manifest contains an unexpected product or legal identity.');
}
if (
  !manifest.contributes.commands.every(entry =>
    entry.command.startsWith('samsarix.')
  ) ||
  !Object.keys(manifest.contributes.configuration.properties).every(key =>
    key.startsWith('samsarix.')
  )
) {
  throw new Error('Release manifest contains a non-Samsarix command or setting.');
}
if (manifest.dependencies && Object.keys(manifest.dependencies).length > 0) {
  throw new Error('Release manifest unexpectedly contains production dependencies.');
}

const digest = createHash('sha256').update(readFileSync(vsixPath)).digest('hex');
writeFileSync(`${vsixPath}.sha256`, `${digest}  ${path.basename(vsixPath)}\n`);
writeFileSync(`${vsixPath}.contents.txt`, `${names.join('\n')}\n`);

console.log(`Verified ${names.length} allowlisted VSIX entries.`);
console.log(`SHA-256 ${digest}`);

function readEntries(archivePath) {
  return new Promise((resolve, reject) => {
    yauzl.open(archivePath, { lazyEntries: true }, (openError, zipfile) => {
      if (openError || !zipfile) {
        reject(openError ?? new Error('Could not open VSIX.'));
        return;
      }

      const result = [];
      zipfile.on('error', reject);
      zipfile.on('end', () => resolve(result));
      zipfile.on('entry', entry => {
        if (/\/$/.test(entry.fileName)) {
          zipfile.readEntry();
          return;
        }
        if (entry.uncompressedSize > 2_000_000) {
          reject(new Error(`Oversized VSIX entry: ${entry.fileName}`));
          return;
        }
        zipfile.openReadStream(entry, (streamError, stream) => {
          if (streamError || !stream) {
            reject(streamError ?? new Error(`Could not read ${entry.fileName}.`));
            return;
          }
          const chunks = [];
          stream.on('data', chunk => chunks.push(chunk));
          stream.on('error', reject);
          stream.on('end', () => {
            result.push({ name: entry.fileName, content: Buffer.concat(chunks) });
            zipfile.readEntry();
          });
        });
      });
      zipfile.readEntry();
    });
  });
}

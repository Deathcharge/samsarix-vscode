import { copyFileSync, createWriteStream, readdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

process.env.TZ = 'UTC';

const require = createRequire(import.meta.url);
const yauzl = require('yauzl');
const yazl = require('yazl');
const workspace = path.resolve(process.cwd());
const dist = path.join(workspace, 'dist');
const vsixFiles = readdirSync(dist).filter(name => name.endsWith('.vsix'));

if (vsixFiles.length !== 1) {
  throw new Error(`Expected exactly one VSIX in dist; found ${vsixFiles.length}.`);
}

const vsixPath = path.join(dist, vsixFiles[0]);
const temporaryPath = `${vsixPath}.deterministic`;
const entries = await readEntries(vsixPath);
const archive = new yazl.ZipFile();
const fixedTime = new Date(Date.UTC(2000, 0, 1, 0, 0, 0));

for (const entry of entries.sort((left, right) =>
  left.name.localeCompare(right.name)
)) {
  archive.addBuffer(entry.content, entry.name, {
    mtime: fixedTime,
    mode: entry.mode,
    compress: true,
  });
}

await new Promise((resolve, reject) => {
  const output = createWriteStream(temporaryPath, { flags: 'wx' });
  output.on('close', resolve);
  output.on('error', reject);
  archive.outputStream.on('error', reject);
  archive.outputStream.pipe(output);
  archive.end();
});

copyFileSync(temporaryPath, vsixPath);
rmSync(temporaryPath);
console.log(`Normalized ${entries.length} VSIX entries for reproducible hashing.`);

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
        zipfile.openReadStream(entry, (streamError, stream) => {
          if (streamError || !stream) {
            reject(streamError ?? new Error(`Could not read ${entry.fileName}.`));
            return;
          }
          const chunks = [];
          stream.on('data', chunk => chunks.push(chunk));
          stream.on('error', reject);
          stream.on('end', () => {
            result.push({
              name: entry.fileName,
              content: Buffer.concat(chunks),
              mode: (entry.externalFileAttributes >>> 16) || 0o100644,
            });
            zipfile.readEntry();
          });
        });
      });
      zipfile.readEntry();
    });
  });
}

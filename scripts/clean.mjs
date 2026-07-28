import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';

const workspace = path.resolve(process.cwd());

for (const directory of ['out', 'dist']) {
  const target = path.resolve(workspace, directory);
  if (path.dirname(target) !== workspace) {
    throw new Error(`Refusing to clean unexpected path: ${target}`);
  }
  rmSync(target, { recursive: true, force: true });
}

mkdirSync(path.join(workspace, 'dist'), { recursive: true });

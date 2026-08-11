import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { runTests } from '@vscode/test-electron';

const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const version = process.env.SAMSARIX_VSCODE_TEST_VERSION ?? '1.85.2';

try {
  await runTests({
    version,
    extensionDevelopmentPath: workspace,
    extensionTestsPath: path.join(workspace, 'out', 'integration', 'run.js'),
    launchArgs: [
      path.join(workspace, 'integration-fixture'),
      '--disable-extensions',
      '--disable-workspace-trust',
    ],
  });
} catch (error) {
  console.error(`Samsarix Extension Development Host test failed on VS Code ${version}.`);
  console.error(error);
  process.exitCode = 1;
}

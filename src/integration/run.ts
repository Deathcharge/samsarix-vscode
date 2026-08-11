import * as assert from 'node:assert/strict';
import * as vscode from 'vscode';

const extensionId = 'samsarix.samsarix-vscode';
const expectedCommands = [
  'samsarix.openChat',
  'samsarix.configureOllama',
  'samsarix.testConnection',
  'samsarix.addSelection',
  'samsarix.explainSelection',
  'samsarix.reviewSelection',
  'samsarix.repairDiagnostics',
  'samsarix.runAgentEdit',
  'samsarix.revertLastEdit',
  'samsarix.showPrivacy',
];

export async function run(): Promise<void> {
  const extension = vscode.extensions.getExtension(extensionId);
  assert.ok(extension, `Extension Development Host did not discover ${extensionId}.`);

  const originalFetch = globalThis.fetch;
  let ollamaFetchCalls = 0;
  globalThis.fetch = (async (input, init) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    if (url.startsWith('http://127.0.0.1:11434')) {
      ollamaFetchCalls += 1;
      throw new Error('Samsarix attempted an unexpected Ollama request.');
    }
    return originalFetch(input, init);
  }) as typeof fetch;

  try {
    await extension.activate();
    assert.equal(extension.isActive, true, 'Samsarix did not activate.');
    assert.equal(
      ollamaFetchCalls,
      0,
      'Samsarix made an Ollama request during activation.'
    );

    const commands = new Set(await vscode.commands.getCommands(true));
    for (const command of expectedCommands) {
      assert.ok(commands.has(command), `Missing registered command: ${command}`);
    }

    const document = await vscode.workspace.openTextDocument(
      vscode.Uri.joinPath(
        vscode.workspace.workspaceFolders?.[0]?.uri ?? vscode.Uri.file(''),
        'sample.ts'
      )
    );
    const editor = await vscode.window.showTextDocument(document);
    editor.selection = new vscode.Selection(0, 0, 0, 12);
    await vscode.commands.executeCommand('samsarix.addSelection');
    assert.equal(
      ollamaFetchCalls,
      0,
      'Attaching a selection made an Ollama request.'
    );

    const restricted = extension.packageJSON.capabilities?.untrustedWorkspaces;
    assert.equal(restricted?.supported, 'limited');
    assert.ok(
      restricted?.restrictedConfigurations?.includes('samsarix.ollama.endpoint'),
      'Ollama endpoint must remain restricted in untrusted workspaces.'
    );
  } finally {
    globalThis.fetch = originalFetch;
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  }
}

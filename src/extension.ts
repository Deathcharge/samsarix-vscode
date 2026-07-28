import * as vscode from 'vscode';
import { ChatViewProvider } from './local/ChatViewProvider';
import { EditController } from './local/EditController';
import { OllamaClient } from './local/OllamaClient';
import { PreviewProvider } from './local/PreviewProvider';
import {
  readLocalConfiguration,
  updateGlobalConfiguration,
} from './local/configuration';
import { normalizeEndpoint } from './local/policy';

export function activate(context: vscode.ExtensionContext): void {
  const createClient = () => new OllamaClient(readLocalConfiguration());
  const previewProvider = new PreviewProvider();
  const editController = new EditController(createClient, previewProvider);
  const chatProvider = new ChatViewProvider(
    context.extensionUri,
    createClient,
    editController
  );

  context.subscriptions.push(
    previewProvider,
    editController,
    chatProvider,
    vscode.workspace.registerTextDocumentContentProvider(
      PreviewProvider.scheme,
      previewProvider
    ),
    vscode.window.registerWebviewViewProvider(
      ChatViewProvider.viewType,
      chatProvider,
      { webviewOptions: { retainContextWhenHidden: true } }
    ),
    vscode.commands.registerCommand('helix.openChat', async () => {
      await vscode.commands.executeCommand(
        'workbench.view.extension.helix-sidebar'
      );
      await vscode.commands.executeCommand(`${ChatViewProvider.viewType}.focus`);
    }),
    vscode.commands.registerCommand('helix.configureOllama', () =>
      runCommand(() => configureOllama())
    ),
    vscode.commands.registerCommand('helix.testConnection', () =>
      runCommand(() => chatProvider.testConnection())
    ),
    vscode.commands.registerCommand('helix.addSelection', () =>
      runCommand(() => chatProvider.addActiveSelection())
    ),
    vscode.commands.registerCommand('helix.runAgentEdit', () =>
      runCommand(async () => {
        const outcome = await editController.propose();
        if (outcome.status !== 'rejected') {
          void vscode.window.showInformationMessage(`Helix: ${outcome.message}`);
        }
      })
    ),
    vscode.commands.registerCommand('helix.revertLastEdit', () =>
      runCommand(() => editController.revert())
    ),
    vscode.commands.registerCommand('helix.showPrivacy', async () => {
      const readme = vscode.Uri.joinPath(context.extensionUri, 'README.md');
      await vscode.commands.executeCommand('markdown.showPreview', readme);
    }),
    vscode.workspace.onDidChangeConfiguration(event => {
      if (event.affectsConfiguration('helix')) {
        chatProvider.refreshConfiguration();
      }
    })
  );
}

export function deactivate(): void {
  // VS Code disposes every registration through ExtensionContext subscriptions.
}

async function configureOllama(): Promise<void> {
  const current = readLocalConfiguration();
  const endpointInput = await vscode.window.showInputBox({
    title: 'Configure local Ollama',
    prompt:
      'Helix connects only after an explicit action. Remote endpoints require HTTPS and the User Setting opt-in.',
    value: current.endpoint,
    ignoreFocusOut: true,
    validateInput: value => {
      try {
        normalizeEndpoint(value, current.allowRemoteEndpoint);
        return undefined;
      } catch (error) {
        return error instanceof Error ? error.message : 'Invalid endpoint.';
      }
    },
  });
  if (endpointInput === undefined) {
    return;
  }

  const endpoint = normalizeEndpoint(
    endpointInput,
    current.allowRemoteEndpoint
  );
  const candidateConfiguration = { ...current, endpoint };
  const models = await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Helix: checking Ollama at ${endpoint}`,
      cancellable: true,
    },
    async (_progress, cancellation) => {
      const controller = new AbortController();
      const subscription = cancellation.onCancellationRequested(() =>
        controller.abort()
      );
      try {
        return await new OllamaClient(candidateConfiguration).listModels(
          controller.signal
        );
      } finally {
        subscription.dispose();
      }
    }
  );

  await updateGlobalConfiguration('ollama.endpoint', endpoint);

  if (models.length === 0) {
    void vscode.window.showWarningMessage(
      'Helix connected, but no Ollama models are installed. Run “ollama pull qwen2.5-coder:7b”, then configure again.'
    );
    return;
  }

  const selected = await vscode.window.showQuickPick(
    models.map(model => ({
      label: model,
      description: model === current.model ? 'Current model' : undefined,
    })),
    {
      title: 'Select the local model Helix should use',
      placeHolder: 'Installed Ollama models',
      matchOnDescription: true,
    }
  );
  if (!selected) {
    return;
  }

  await updateGlobalConfiguration('ollama.model', selected.label);
  void vscode.window.showInformationMessage(
    `Helix will use ${selected.label} at ${endpoint}. No request runs until you choose an action.`
  );
}

async function runCommand(action: () => Promise<unknown>): Promise<void> {
  try {
    await action();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'An unexpected error occurred.';
    void vscode.window.showErrorMessage(`Helix: ${message}`);
  }
}

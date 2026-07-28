import * as path from 'path';
import { randomBytes } from 'crypto';
import * as vscode from 'vscode';
import { EditController } from './EditController';
import { OllamaClient } from './OllamaClient';
import { readLocalConfiguration } from './configuration';
import {
  MAX_QUESTION_CHARACTERS,
  assertBoundedText,
  isRecord,
} from './policy';

interface AttachedContext {
  label: string;
  content: string;
  characterCount: number;
}

interface DisplayMessage {
  role: 'user' | 'assistant';
  text: string;
  durationMs?: number;
}

type ConnectionState = 'untested' | 'testing' | 'connected' | 'error';

export class ChatViewProvider
  implements vscode.WebviewViewProvider, vscode.Disposable
{
  public static readonly viewType = 'helix.chatPanel';

  private view: vscode.WebviewView | undefined;
  private context: AttachedContext | undefined;
  private messages: DisplayMessage[] = [];
  private busy = false;
  private connection: ConnectionState = 'untested';
  private notice =
    'Helix makes no network request until you choose Test, Send, or Propose edit.';
  private activeAbort: AbortController | undefined;
  private readonly disposables: vscode.Disposable[] = [];

  public constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly createClient: () => OllamaClient,
    private readonly editController: EditController
  ) {}

  public resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'assets')],
    };
    view.webview.html = this.createHtml(view.webview);

    this.disposables.push(
      view.webview.onDidReceiveMessage(message => this.handleMessage(message)),
      view.onDidDispose(() => {
        this.activeAbort?.abort();
        this.view = undefined;
      })
    );
    void this.postState();
  }

  public async addActiveSelection(): Promise<void> {
    if (this.busy) {
      throw new Error('Wait for the current Helix request to finish.');
    }
    if (!vscode.workspace.isTrusted) {
      throw new Error('Trust this workspace before attaching source code.');
    }

    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.uri.scheme !== 'file') {
      throw new Error('Open a workspace file and select text to attach.');
    }
    const folder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
    if (!folder) {
      throw new Error('The active file is outside the open workspace.');
    }
    if (editor.selection.isEmpty) {
      throw new Error('Select the exact text you want to attach.');
    }

    const content = editor.document.getText(editor.selection);
    const maximum = readLocalConfiguration().maxContextCharacters;
    if (content.length > maximum) {
      throw new Error(
        `The selection has ${content.length.toLocaleString()} characters; the configured limit is ${maximum.toLocaleString()}.`
      );
    }
    if (content.includes('\0')) {
      throw new Error('Binary content cannot be attached.');
    }

    const relativePath = path
      .relative(folder.uri.fsPath, editor.document.uri.fsPath)
      .split(path.sep)
      .join('/');
    const startLine = editor.selection.start.line + 1;
    const endLine = editor.selection.end.line + 1;
    this.context = {
      label: `${relativePath}:${startLine}-${endLine}`,
      content,
      characterCount: content.length,
    };
    this.notice = 'Selection attached. Its label and size are shown before Send.';
    await this.postState();
    await vscode.commands.executeCommand(`${ChatViewProvider.viewType}.focus`);
  }

  public async testConnection(): Promise<void> {
    if (this.busy) {
      throw new Error('Wait for the current Helix request to finish.');
    }
    this.busy = true;
    this.connection = 'testing';
    this.notice = 'Testing the configured Ollama endpoint…';
    this.activeAbort = new AbortController();
    await this.postState();

    try {
      const models = await this.createClient().listModels(
        this.activeAbort.signal
      );
      this.connection = 'connected';
      this.notice =
        models.length === 0
          ? 'Connected, but Ollama has no installed models. Run “ollama pull qwen2.5-coder:7b”.'
          : `Connected. Ollama reports ${models.length} installed model${models.length === 1 ? '' : 's'}.`;
    } catch (error) {
      this.connection = 'error';
      this.notice = toMessage(error);
      throw error;
    } finally {
      this.busy = false;
      this.activeAbort = undefined;
      await this.postState();
    }
  }

  public refreshConfiguration(): void {
    this.connection = 'untested';
    this.notice = 'Configuration changed. Test the connection when ready.';
    void this.postState();
  }

  public dispose(): void {
    this.activeAbort?.abort();
    this.messages = [];
    this.context = undefined;
    for (const disposable of this.disposables.splice(0)) {
      disposable.dispose();
    }
  }

  private async handleMessage(message: unknown): Promise<void> {
    try {
      if (!isRecord(message) || typeof message.type !== 'string') {
        throw new Error('Helix ignored an invalid panel message.');
      }

      switch (message.type) {
        case 'ready':
          await this.postState();
          return;
        case 'configure':
          await vscode.commands.executeCommand('helix.configureOllama');
          return;
        case 'test':
          await this.testConnection();
          return;
        case 'attachSelection':
          await this.addActiveSelection();
          return;
        case 'clearContext':
          this.context = undefined;
          this.notice = 'Attached context cleared.';
          await this.postState();
          return;
        case 'clearChat':
          this.messages = [];
          this.notice = 'In-memory chat cleared.';
          await this.postState();
          return;
        case 'cancel':
          this.activeAbort?.abort();
          this.editController.cancel();
          this.notice = 'Cancelling the current request…';
          await this.postState();
          return;
        case 'send':
          await this.send(message.text);
          return;
        case 'proposeEdit':
          await this.proposeEdit(message.text);
          return;
        default:
          throw new Error('Helix ignored an unsupported panel action.');
      }
    } catch (error) {
      this.notice = toMessage(error);
      await this.postState();
      if (this.notice === 'The Ollama request was cancelled.') {
        this.notice = 'Request cancelled.';
        await this.postState();
      } else {
        void vscode.window.showErrorMessage(`Helix: ${this.notice}`);
      }
    }
  }

  private async send(rawQuestion: unknown): Promise<void> {
    if (this.busy) {
      throw new Error('Wait for the current Helix request to finish.');
    }
    const question = assertBoundedText(
      rawQuestion,
      'Question',
      MAX_QUESTION_CHARACTERS
    );
    if (this.context && !vscode.workspace.isTrusted) {
      throw new Error('Trust this workspace before sending attached source code.');
    }

    this.busy = true;
    this.notice = `Sending to ${readLocalConfiguration().endpoint}…`;
    this.messages.push({ role: 'user', text: question });
    this.messages = this.messages.slice(-20);
    this.activeAbort = new AbortController();
    await this.postState();

    try {
      const result = await this.createClient().chat(
        question,
        this.context
          ? { label: this.context.label, content: this.context.content }
          : undefined,
        this.activeAbort.signal
      );
      this.messages.push({
        role: 'assistant',
        text: result.value,
        durationMs: result.durationMs,
      });
      this.messages = this.messages.slice(-20);
      this.connection = 'connected';
      this.notice = `Completed locally in ${(result.durationMs / 1_000).toFixed(1)} seconds.`;
    } finally {
      this.busy = false;
      this.activeAbort = undefined;
      await this.postState();
    }
  }

  private async proposeEdit(rawInstruction: unknown): Promise<void> {
    const instruction = assertBoundedText(
      rawInstruction,
      'Edit instruction',
      MAX_QUESTION_CHARACTERS
    );
    if (this.busy) {
      throw new Error('Wait for the current Helix request to finish.');
    }

    this.busy = true;
    this.notice =
      'Generating one active-file proposal. A native diff will open before any write.';
    await this.postState();
    try {
      const outcome = await this.editController.propose(instruction);
      this.notice = outcome.durationMs
        ? `${outcome.message} Generation took ${(outcome.durationMs / 1_000).toFixed(1)} seconds.`
        : outcome.message;
    } finally {
      this.busy = false;
      await this.postState();
    }
  }

  private async postState(): Promise<void> {
    if (!this.view) {
      return;
    }
    let endpoint = readLocalConfiguration().endpoint;
    let model = readLocalConfiguration().model;
    try {
      const display = this.createClient().displayConfiguration;
      endpoint = display.endpoint;
      model = display.model;
    } catch {
      // Keep raw global values visible so the user can repair them.
    }

    await this.view.webview.postMessage({
      type: 'state',
      endpoint,
      model,
      connection: this.connection,
      busy: this.busy,
      notice: this.notice,
      trusted: vscode.workspace.isTrusted,
      canRevert: this.editController.canRevert,
      context: this.context
        ? {
            label: this.context.label,
            characterCount: this.context.characterCount,
          }
        : undefined,
      messages: this.messages,
    });
  }

  private createHtml(webview: vscode.Webview): string {
    const nonce = createNonce();
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'assets', 'chat.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'assets', 'chat.css')
    );
    const csp = [
      "default-src 'none'",
      `style-src ${webview.cspSource}`,
      `script-src 'nonce-${nonce}'`,
      "img-src 'none'",
      "connect-src 'none'",
      "base-uri 'none'",
      "form-action 'none'",
      "frame-ancestors 'none'",
    ].join('; ');

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <link rel="stylesheet" href="${styleUri}">
  <title>Helix local assistant</title>
</head>
<body>
  <header>
    <div>
      <h1>Helix</h1>
      <p class="eyebrow">Local, review-first coding companion</p>
    </div>
    <span id="connection" class="badge">Not tested</span>
  </header>

  <section class="configuration" aria-label="Ollama configuration">
    <dl>
      <div><dt>Endpoint</dt><dd id="endpoint"></dd></div>
      <div><dt>Model</dt><dd id="model"></dd></div>
    </dl>
    <div class="button-row">
      <button id="configure" type="button">Configure</button>
      <button id="test" type="button">Test</button>
    </div>
  </section>

  <p id="notice" class="notice" role="status" aria-live="polite"></p>

  <section id="context-card" class="context-card" hidden>
    <div>
      <strong>Attached selection</strong>
      <span id="context-label"></span>
    </div>
    <button id="clear-context" class="quiet" type="button">Clear</button>
  </section>

  <main id="messages" aria-label="Chat messages" aria-live="polite"></main>

  <section class="composer" aria-label="Ask Helix">
    <label for="prompt">Question or one-file edit instruction</label>
    <textarea id="prompt" maxlength="${MAX_QUESTION_CHARACTERS}" rows="5" placeholder="Ask about code, or describe one edit to the active file"></textarea>
    <div class="button-row wrap">
      <button id="send" class="primary" type="button">Send</button>
      <button id="propose" type="button">Propose edit</button>
      <button id="cancel" class="danger" type="button" disabled>Cancel</button>
      <button id="attach" type="button">Add editor selection</button>
      <button id="clear-chat" class="quiet" type="button">Clear chat</button>
    </div>
    <p class="disclosure">Send shares only this prompt and the displayed selection. Propose edit shares the active file with the configured Ollama endpoint and always opens a diff before writing.</p>
  </section>

  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function createNonce(): string {
  return randomBytes(24).toString('base64');
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'An unexpected error occurred.';
}

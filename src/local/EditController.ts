import { realpath } from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';
import { OllamaClient } from './OllamaClient';
import { PreviewProvider } from './PreviewProvider';
import {
  MAX_EDIT_CHARACTERS,
  MAX_QUESTION_CHARACTERS,
  assertBoundedText,
  isPathInside,
} from './policy';

interface AppliedEdit {
  uri: vscode.Uri;
  canonicalRoot: string;
  canonicalPath: string;
  relativePath: string;
  before: string;
  after: string;
}

export interface EditOutcome {
  status: 'applied' | 'rejected' | 'unchanged';
  message: string;
  durationMs?: number;
}

export class EditController implements vscode.Disposable {
  private busy = false;
  private lastApplied: AppliedEdit | undefined;
  private activeAbort: AbortController | undefined;

  public constructor(
    private readonly createClient: () => OllamaClient,
    private readonly previewProvider: PreviewProvider
  ) {}

  public get canRevert(): boolean {
    return this.lastApplied !== undefined;
  }

  public cancel(): void {
    this.activeAbort?.abort();
  }

  public async propose(instruction?: string): Promise<EditOutcome> {
    if (this.busy) {
      throw new Error('An edit proposal is already running.');
    }
    if (!vscode.workspace.isTrusted) {
      throw new Error('Trust this workspace before sharing file content or applying edits.');
    }

    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      throw new Error('Open a workspace file before proposing an edit.');
    }

    const captured = await captureEditableDocument(editor.document);
    const requestedInstruction =
      instruction ??
      (await vscode.window.showInputBox({
        title: `Propose an edit to ${captured.relativePath}`,
        prompt: 'Describe one bounded change. Helix will show a diff before writing.',
        placeHolder: 'Example: handle an empty input without changing the public API',
        ignoreFocusOut: true,
        validateInput: value =>
          value.trim().length > MAX_QUESTION_CHARACTERS
            ? `Use at most ${MAX_QUESTION_CHARACTERS.toLocaleString()} characters.`
            : undefined,
      }));

    if (requestedInstruction === undefined) {
      return { status: 'rejected', message: 'Edit cancelled.' };
    }
    const boundedInstruction = assertBoundedText(
      requestedInstruction,
      'Edit instruction',
      MAX_QUESTION_CHARACTERS
    );

    this.busy = true;
    this.activeAbort = new AbortController();

    try {
      const generation = await this.createClient().proposeEdit(
        boundedInstruction,
        captured.relativePath,
        captured.languageId,
        captured.content,
        this.activeAbort.signal
      );

      if (generation.value.content === captured.content) {
        return {
          status: 'unchanged',
          message: 'The model proposed no change.',
          durationMs: generation.durationMs,
        };
      }

      const previewUri = this.previewProvider.create(
        captured.uri,
        generation.value.content
      );
      await vscode.commands.executeCommand(
        'vscode.diff',
        captured.uri,
        previewUri,
        `Helix proposal — ${captured.relativePath}`,
        { preview: true }
      );

      const decision = await vscode.window.showInformationMessage(
        `Apply the Helix proposal to ${captured.relativePath}?`,
        {
          modal: true,
          detail: `${generation.value.summary}\n\nReview the open diff. Helix will change only this file and will not save it automatically.`,
        },
        'Apply',
        'Reject'
      );

      if (decision !== 'Apply') {
        return {
          status: 'rejected',
          message: 'Proposal rejected; no file was changed.',
          durationMs: generation.durationMs,
        };
      }

      const currentDocument = await vscode.workspace.openTextDocument(captured.uri);
      const currentCanonicalPath = await realpath(currentDocument.uri.fsPath);
      if (
        currentDocument.version !== captured.version ||
        currentDocument.getText() !== captured.content ||
        currentCanonicalPath !== captured.canonicalPath
      ) {
        throw new Error(
          'The file changed after generation. Nothing was applied; request a new proposal.'
        );
      }

      const workspaceEdit = new vscode.WorkspaceEdit();
      workspaceEdit.replace(
        captured.uri,
        new vscode.Range(
          currentDocument.positionAt(0),
          currentDocument.positionAt(captured.content.length)
        ),
        generation.value.content
      );
      const applied = await vscode.workspace.applyEdit(workspaceEdit);
      if (!applied) {
        throw new Error('VS Code rejected the workspace edit. No change was applied.');
      }

      this.lastApplied = {
        uri: captured.uri,
        canonicalRoot: captured.canonicalRoot,
        canonicalPath: captured.canonicalPath,
        relativePath: captured.relativePath,
        before: captured.content,
        after: generation.value.content,
      };

      return {
        status: 'applied',
        message: `Applied to ${captured.relativePath}. The buffer is unsaved; use “Helix: Revert Last Applied Edit” during this session if needed.`,
        durationMs: generation.durationMs,
      };
    } finally {
      this.busy = false;
      this.activeAbort = undefined;
    }
  }

  public async revert(): Promise<boolean> {
    const snapshot = this.lastApplied;
    if (!snapshot) {
      void vscode.window.showInformationMessage(
        'There is no Helix edit to revert in this session.'
      );
      return false;
    }
    if (!vscode.workspace.isTrusted) {
      throw new Error('Trust this workspace before reverting an edit.');
    }

    const document = await vscode.workspace.openTextDocument(snapshot.uri);
    const currentCanonicalPath = await realpath(document.uri.fsPath);
    if (
      currentCanonicalPath !== snapshot.canonicalPath ||
      !isPathInside(snapshot.canonicalRoot, currentCanonicalPath) ||
      document.getText() !== snapshot.after
    ) {
      throw new Error(
        `Helix cannot safely revert ${snapshot.relativePath} because it changed after the edit.`
      );
    }

    const decision = await vscode.window.showWarningMessage(
      `Revert the last Helix edit to ${snapshot.relativePath}?`,
      { modal: true, detail: 'This restores the exact in-memory pre-edit content.' },
      'Revert'
    );
    if (decision !== 'Revert') {
      return false;
    }

    const workspaceEdit = new vscode.WorkspaceEdit();
    workspaceEdit.replace(
      snapshot.uri,
      new vscode.Range(document.positionAt(0), document.positionAt(snapshot.after.length)),
      snapshot.before
    );
    const applied = await vscode.workspace.applyEdit(workspaceEdit);
    if (!applied) {
      throw new Error('VS Code rejected the revert.');
    }

    this.lastApplied = undefined;
    void vscode.window.showInformationMessage(
      `Reverted the Helix edit to ${snapshot.relativePath}. The buffer is unsaved.`
    );
    return true;
  }

  public dispose(): void {
    this.activeAbort?.abort();
    this.lastApplied = undefined;
  }
}

async function captureEditableDocument(document: vscode.TextDocument): Promise<{
  uri: vscode.Uri;
  canonicalPath: string;
  canonicalRoot: string;
  relativePath: string;
  languageId: string;
  version: number;
  content: string;
}> {
  if (document.uri.scheme !== 'file' || document.isUntitled) {
    throw new Error('Helix edits only saved local files in an open workspace.');
  }

  const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
  if (!workspaceFolder || workspaceFolder.uri.scheme !== 'file') {
    throw new Error('The active file is outside the open workspace.');
  }

  const [canonicalRoot, canonicalPath] = await Promise.all([
    realpath(workspaceFolder.uri.fsPath),
    realpath(document.uri.fsPath),
  ]);
  if (!isPathInside(canonicalRoot, canonicalPath)) {
    throw new Error('The active file resolves outside the workspace.');
  }

  const content = document.getText();
  if (content.includes('\0')) {
    throw new Error('Binary files are not supported.');
  }
  if (content.length === 0 || content.length > MAX_EDIT_CHARACTERS) {
    throw new Error(
      `The active file must contain 1–${MAX_EDIT_CHARACTERS.toLocaleString()} characters.`
    );
  }

  return {
    uri: document.uri,
    canonicalPath,
    canonicalRoot,
    relativePath: path
      .relative(workspaceFolder.uri.fsPath, document.uri.fsPath)
      .split(path.sep)
      .join('/'),
    languageId: document.languageId,
    version: document.version,
    content,
  };
}

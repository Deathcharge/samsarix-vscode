import * as vscode from 'vscode';

export class PreviewProvider
  implements vscode.TextDocumentContentProvider, vscode.Disposable
{
  public static readonly scheme = 'samsarix-proposed';

  private readonly contents = new Map<string, string>();
  private readonly changed = new vscode.EventEmitter<vscode.Uri>();

  public readonly onDidChange = this.changed.event;

  public create(source: vscode.Uri, content: string): vscode.Uri {
    this.contents.clear();
    const uri = vscode.Uri.from({
      scheme: PreviewProvider.scheme,
      path: source.path,
      query: `proposal=${Date.now()}`,
    });
    this.contents.set(uri.toString(), content);
    this.changed.fire(uri);
    return uri;
  }

  public provideTextDocumentContent(uri: vscode.Uri): string {
    return this.contents.get(uri.toString()) ?? '';
  }

  public dispose(): void {
    this.contents.clear();
    this.changed.dispose();
  }
}

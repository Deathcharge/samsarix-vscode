import { readFileSync } from 'fs';
import * as path from 'path';

describe('release surface security invariants', () => {
  const workspace = path.resolve(__dirname, '..', '..', '..');

  test('webview script renders dynamic values without HTML injection primitives', () => {
    const script = readFileSync(path.join(workspace, 'assets', 'chat.js'), 'utf8');
    expect(script).not.toContain('innerHTML');
    expect(script).not.toContain('outerHTML');
    expect(script).not.toContain('insertAdjacentHTML');
    expect(script).not.toContain('eval(');
    expect(script).toContain('textContent');
  });

  test('webview policy denies ambient content and network access', () => {
    const provider = readFileSync(
      path.join(workspace, 'src', 'local', 'ChatViewProvider.ts'),
      'utf8'
    );
    expect(provider).toContain("default-src 'none'");
    expect(provider).toContain("connect-src 'none'");
    expect(provider).toContain("base-uri 'none'");
    expect(provider).toContain("form-action 'none'");
    expect(provider).toContain("frame-ancestors 'none'");
  });

  test('manifest contributes only registered Helix commands', () => {
    const manifest = JSON.parse(
      readFileSync(path.join(workspace, 'package.json'), 'utf8')
    );
    const extension = readFileSync(
      path.join(workspace, 'src', 'extension.ts'),
      'utf8'
    );
    const contributed = manifest.contributes.commands.map(
      (entry: { command: string }) => entry.command
    );
    const registered = [...extension.matchAll(/registerCommand\('([^']+)'/g)].map(
      match => match[1]
    );

    expect(new Set(registered)).toEqual(new Set(contributed));
  });

  test('release entrypoint contains no hosted-service or process execution path', () => {
    const extension = readFileSync(
      path.join(workspace, 'src', 'extension.ts'),
      'utf8'
    );
    expect(extension).not.toContain('api.helixcollective.io');
    expect(extension).not.toContain('child_process');
    expect(extension).not.toContain('registerUriHandler');
    expect(extension).not.toContain('setInterval');
  });
});

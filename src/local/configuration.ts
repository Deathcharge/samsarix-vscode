import * as vscode from 'vscode';
import { LocalConfiguration, clampInteger } from './policy';

export const DEFAULT_ENDPOINT = 'http://127.0.0.1:11434';
export const DEFAULT_MODEL = 'qwen2.5-coder:7b';

export function readLocalConfiguration(): LocalConfiguration {
  const config = vscode.workspace.getConfiguration('samsarix');

  return {
    endpoint: readGlobal(config, 'ollama.endpoint', DEFAULT_ENDPOINT),
    model: readGlobal(config, 'ollama.model', DEFAULT_MODEL),
    allowRemoteEndpoint: readGlobal(
      config,
      'ollama.allowRemoteEndpoint',
      false
    ),
    timeoutMs:
      clampInteger(readGlobal(config, 'requestTimeoutSeconds', 60), 5, 120) *
      1_000,
    maxContextCharacters: clampInteger(
      readGlobal(config, 'maxContextCharacters', 60_000),
      1_000,
      100_000
    ),
  };
}

export async function updateGlobalConfiguration<T>(
  key: string,
  value: T
): Promise<void> {
  await vscode.workspace
    .getConfiguration('samsarix')
    .update(key, value, vscode.ConfigurationTarget.Global);
}

function readGlobal<T>(
  configuration: vscode.WorkspaceConfiguration,
  key: string,
  fallback: T
): T {
  const inspected = configuration.inspect<T>(key);
  return inspected?.globalValue ?? inspected?.defaultValue ?? fallback;
}

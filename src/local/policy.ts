import * as path from 'path';

export const MAX_QUESTION_CHARACTERS = 12_000;
export const MAX_CONTEXT_CHARACTERS = 60_000;
export const MAX_EDIT_CHARACTERS = 200_000;
export const MAX_RESPONSE_BYTES = 1_000_000;

export interface LocalConfiguration {
  endpoint: string;
  model: string;
  allowRemoteEndpoint: boolean;
  timeoutMs: number;
  maxContextCharacters: number;
}

export interface EditProposal {
  content: string;
  summary: string;
}

export function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  return (
    normalized === 'localhost' ||
    normalized === '::1' ||
    normalized.startsWith('127.')
  );
}

export function normalizeEndpoint(raw: string, allowRemote: boolean): string {
  const value = raw.trim();
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error('Enter a complete Ollama URL, for example http://127.0.0.1:11434.');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('The Ollama endpoint must use HTTP or HTTPS.');
  }
  if (url.username || url.password) {
    throw new Error('Credentials are not allowed in the Ollama endpoint URL.');
  }
  if (url.search || url.hash) {
    throw new Error('The Ollama endpoint cannot contain a query string or fragment.');
  }
  if (url.pathname !== '/' && url.pathname !== '') {
    throw new Error('The Ollama endpoint must be an origin without a path.');
  }

  const loopback = isLoopbackHostname(url.hostname);
  if (!loopback && !allowRemote) {
    throw new Error(
      'Remote endpoints are disabled. Enable “Samsarix: Ollama › Allow Remote Endpoint” in User Settings after reviewing the privacy impact.'
    );
  }
  if (!loopback && url.protocol !== 'https:') {
    throw new Error('Remote Ollama endpoints must use HTTPS.');
  }

  return url.origin;
}

export function validateModelName(raw: string): string {
  const value = raw.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/.test(value)) {
    throw new Error('Select a valid Ollama model name (letters, numbers, dot, dash, underscore, slash, or colon).');
  }
  return value;
}

export function clampInteger(
  value: number,
  minimum: number,
  maximum: number
): number {
  if (!Number.isFinite(value)) {
    return minimum;
  }
  return Math.min(maximum, Math.max(minimum, Math.trunc(value)));
}

export function isPathInside(rootPath: string, candidatePath: string): boolean {
  const root = path.resolve(rootPath);
  const candidate = path.resolve(candidatePath);
  const relative = path.relative(root, candidate);

  return (
    relative === '' ||
    (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))
  );
}

export function parseEditProposal(raw: string): EditProposal {
  const trimmed = raw.trim();
  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(withoutFence);
  } catch {
    throw new Error('The model did not return a valid JSON edit proposal. Try a more specific instruction.');
  }

  if (!isRecord(parsed)) {
    throw new Error('The model returned an unsupported edit proposal.');
  }

  const keys = Object.keys(parsed);
  if (keys.some(key => key !== 'content' && key !== 'summary')) {
    throw new Error('The model returned unsupported edit fields.');
  }
  if (typeof parsed.content !== 'string' || parsed.content.length === 0) {
    throw new Error('The model returned an empty edit. Samsarix will not erase a file.');
  }
  if (parsed.content.length > MAX_EDIT_CHARACTERS) {
    throw new Error(`The proposed file exceeds the ${MAX_EDIT_CHARACTERS.toLocaleString()} character safety limit.`);
  }
  if (typeof parsed.summary !== 'string' || parsed.summary.trim().length === 0) {
    throw new Error('The model did not explain the proposed edit.');
  }
  if (parsed.summary.length > 1_000) {
    throw new Error('The model summary is unexpectedly large.');
  }

  return { content: parsed.content, summary: parsed.summary.trim() };
}

export function assertBoundedText(
  value: unknown,
  label: string,
  maximum: number
): string {
  if (typeof value !== 'string') {
    throw new Error(`${label} must be text.`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${label} cannot be empty.`);
  }
  if (trimmed.length > maximum) {
    throw new Error(`${label} exceeds the ${maximum.toLocaleString()} character limit.`);
  }
  return trimmed;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

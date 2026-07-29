import * as path from 'path';
import {
  MAX_EDIT_CHARACTERS,
  assertBoundedText,
  clampInteger,
  isLoopbackHostname,
  isPathInside,
  normalizeEndpoint,
  parseEditProposal,
  validateModelName,
} from '../policy';

describe('local policy', () => {
  test.each(['localhost', 'LOCALHOST', '127.0.0.1', '127.42.0.8', '::1', '[::1]'])(
    'recognizes loopback host %s',
    hostname => {
      expect(isLoopbackHostname(hostname)).toBe(true);
    }
  );

  test('normalizes a loopback endpoint', () => {
    expect(normalizeEndpoint(' http://localhost:11434/ ', false)).toBe(
      'http://localhost:11434'
    );
  });

  test.each([
    ['not a URL', false],
    ['file:///tmp/ollama', false],
    ['http://user:secret@localhost:11434', false],
    ['http://localhost:11434/api', false],
    ['http://localhost:11434/?token=x', false],
    ['http://192.0.2.10:11434', false],
    ['http://models.example.test', true],
  ])('rejects unsafe endpoint %s', (endpoint, allowRemote) => {
    expect(() => normalizeEndpoint(endpoint, allowRemote)).toThrow();
  });

  test('permits explicitly opted-in remote HTTPS', () => {
    expect(normalizeEndpoint('https://models.example.test', true)).toBe(
      'https://models.example.test'
    );
  });

  test('validates model names', () => {
    expect(validateModelName(' qwen2.5-coder:7b ')).toBe('qwen2.5-coder:7b');
    expect(() => validateModelName('../model with spaces')).toThrow();
    expect(() => validateModelName('')).toThrow();
  });

  test('clamps integer configuration', () => {
    expect(clampInteger(7.9, 5, 10)).toBe(7);
    expect(clampInteger(20, 5, 10)).toBe(10);
    expect(clampInteger(Number.NaN, 5, 10)).toBe(5);
  });

  test('keeps candidates inside a root', () => {
    const root = path.resolve('workspace');
    expect(isPathInside(root, path.join(root, 'src', 'file.ts'))).toBe(true);
    expect(isPathInside(root, root)).toBe(true);
    expect(isPathInside(root, path.resolve('outside', 'file.ts'))).toBe(false);
  });

  test('parses a bounded edit proposal with an optional JSON fence', () => {
    expect(
      parseEditProposal('```json\n{"summary":"Fix it","content":"const ok = true;"}\n```')
    ).toEqual({ summary: 'Fix it', content: 'const ok = true;' });
  });

  test.each([
    'not-json',
    '[]',
    '{"summary":"x","content":""}',
    '{"summary":"","content":"x"}',
    '{"summary":"x","content":"y","path":"outside.txt"}',
  ])('rejects malformed edit proposal %s', proposal => {
    expect(() => parseEditProposal(proposal)).toThrow();
  });

  test('rejects oversized edit content and summaries', () => {
    expect(() =>
      parseEditProposal(
        JSON.stringify({ summary: 'x', content: 'a'.repeat(MAX_EDIT_CHARACTERS + 1) })
      )
    ).toThrow(/safety limit/);
    expect(() =>
      parseEditProposal(
        JSON.stringify({ summary: 'x'.repeat(1001), content: 'ok' })
      )
    ).toThrow(/summary/);
  });

  test('bounds required text', () => {
    expect(assertBoundedText(' hello ', 'Prompt', 10)).toBe('hello');
    expect(() => assertBoundedText(7, 'Prompt', 10)).toThrow(/text/);
    expect(() => assertBoundedText(' ', 'Prompt', 10)).toThrow(/empty/);
    expect(() => assertBoundedText('too long', 'Prompt', 3)).toThrow(/limit/);
  });
});

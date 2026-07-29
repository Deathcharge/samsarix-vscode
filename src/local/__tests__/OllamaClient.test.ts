import { OllamaClient } from '../OllamaClient';
import { LocalConfiguration, MAX_RESPONSE_BYTES } from '../policy';

const configuration: LocalConfiguration = {
  endpoint: 'http://127.0.0.1:11434',
  model: 'qwen2.5-coder:7b',
  allowRemoteEndpoint: false,
  timeoutMs: 5_000,
  maxContextCharacters: 60_000,
};

describe('OllamaClient', () => {
  const fetchMock = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock;
  });

  test('exposes only the normalized endpoint and validated model for display', () => {
    expect(
      new OllamaClient({
        ...configuration,
        endpoint: 'http://localhost:11434/',
      }).displayConfiguration
    ).toEqual({
      endpoint: 'http://localhost:11434',
      model: 'qwen2.5-coder:7b',
    });
  });

  test('lists unique installed models in stable order', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        models: [
          { name: 'zeta:latest' },
          { name: 'alpha:7b' },
          { name: 'alpha:7b' },
          { invalid: true },
        ],
      })
    );

    await expect(new OllamaClient(configuration).listModels()).resolves.toEqual([
      'alpha:7b',
      'zeta:latest',
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:11434/api/tags',
      expect.objectContaining({ method: 'GET', signal: expect.any(AbortSignal) })
    );
  });

  test('sends only the explicit question and attached context', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ message: { content: 'A local answer' } })
    );

    const result = await new OllamaClient(configuration).chat('Why?', {
      label: 'src/example.ts:2-4',
      content: 'const value = 1;',
    });

    expect(result.value).toBe('A local answer');
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(init?.body));
    expect(body).toMatchObject({
      model: 'qwen2.5-coder:7b',
      stream: false,
    });
    expect(body.messages).toHaveLength(2);
    expect(body.messages[1].content).toContain('Why?');
    expect(body.messages[1].content).toContain('src/example.ts:2-4');
    expect(body.messages[1].content).toContain('const value = 1;');
  });

  test('requests a path-free structured edit and validates it', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        message: {
          content: JSON.stringify({
            summary: 'Handle the empty case',
            content: 'export const value = 1;\n',
          }),
        },
      })
    );

    const result = await new OllamaClient(configuration).proposeEdit(
      'Handle empty input',
      'src/value.ts',
      'typescript',
      'export const value = 0;\n'
    );

    expect(result.value).toEqual({
      summary: 'Handle the empty case',
      content: 'export const value = 1;\n',
    });
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(init?.body));
    expect(body.format).toBe('json');
    expect(body.messages[0].content).toContain('Never include a path');
  });

  test('reports HTTP failures without response content', async () => {
    fetchMock.mockResolvedValue(
      new Response('sensitive backend body', { status: 404 })
    );

    await expect(new OllamaClient(configuration).chat('Hello')).rejects.toThrow(
      /HTTP 404/
    );
  });

  test('rejects malformed and empty model responses', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ unexpected: true }));
    await expect(new OllamaClient(configuration).chat('Hello')).rejects.toThrow(
      /unexpected chat response/
    );

    fetchMock.mockResolvedValueOnce(
      jsonResponse({ message: { content: '   ' } })
    );
    await expect(new OllamaClient(configuration).chat('Hello')).rejects.toThrow(
      /empty response/
    );
  });

  test('rejects an invalid model-list response', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ models: 'not-an-array' }));
    await expect(new OllamaClient(configuration).listModels()).rejects.toThrow(
      /model-list/
    );
  });

  test('rejects declared oversized responses before reading them', async () => {
    fetchMock.mockResolvedValue(
      new Response('{}', {
        status: 200,
        headers: { 'content-length': String(MAX_RESPONSE_BYTES + 1) },
      })
    );
    await expect(new OllamaClient(configuration).listModels()).rejects.toThrow(
      /safety limit/
    );
  });

  test('normalizes network errors into an actionable message', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    await expect(new OllamaClient(configuration).chat('Hello')).rejects.toThrow(
      /Cannot reach Ollama/
    );
  });

  test('rejects invalid configuration at construction time', () => {
    expect(
      () =>
        new OllamaClient({
          ...configuration,
          endpoint: 'http://remote.example.test:11434',
        })
    ).toThrow(/Remote endpoints are disabled/);
  });
});

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { testLLMProvider } from './llm-settings.ts';
import { DEFAULT_CONFIG, type JarvisConfig } from '../config/types.ts';

function makeConfig(): JarvisConfig {
  return structuredClone(DEFAULT_CONFIG);
}

describe('testLLMProvider', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = mock(async (_url: string) => {
      return new Response(JSON.stringify({
        id: 'cmpl_test',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-test',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'OK' },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 1,
          completion_tokens: 1,
          total_tokens: 2,
        },
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test('uses the official OpenAI endpoint when no base URL is configured', async () => {
    const config = makeConfig();
    const result = await testLLMProvider(
      {
        provider: 'openai',
        api_key: 'sk-test-key',
        model: 'gpt-5.4',
      },
      config,
    );

    expect(result.ok).toBe(true);

    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof mock>;
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.openai.com/v1/chat/completions');
  });

  test('uses custom compatible base URLs without assuming an OpenAI key prefix', async () => {
    const config = makeConfig();
    const result = await testLLMProvider(
      {
        provider: 'openai',
        api_key: 'nvapi-custom-key',
        model: 'gpt-5.4',
        base_url: 'https://gateway.example.com/openai',
      },
      config,
    );

    expect(result.ok).toBe(true);

    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof mock>;
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://gateway.example.com/openai/chat/completions');
  });
});

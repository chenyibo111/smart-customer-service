import { describe, expect, it } from 'vitest';

import { loadConfig } from '../src/config.js';

describe('loadConfig', () => {
  it('rejects a missing DeepSeek key outside test mode', () => {
    expect(() => loadConfig({ NODE_ENV: 'production' })).toThrow('DEEPSEEK_API_KEY');
  });

  it('uses OpenAI-compatible DeepSeek defaults in test mode', () => {
    const config = loadConfig({ NODE_ENV: 'test', DEEPSEEK_API_KEY: 'test-key' });

    expect(config.deepseekBaseUrl).toBe('https://api.deepseek.com');
    expect(config.deepseekModel).toBe('deepseek-v4-flash');
  });
});

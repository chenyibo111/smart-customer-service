export type AppConfig = {
  port: number;
  databasePath: string;
  deepseekApiKey: string;
  deepseekBaseUrl: string;
  deepseekModel: string;
  ragMinScore: number;
};

export function loadConfig(env: NodeJS.ProcessEnv): AppConfig {
  const deepseekApiKey = env.DEEPSEEK_API_KEY;

  if (!deepseekApiKey && env.NODE_ENV !== 'test') {
    throw new Error('DEEPSEEK_API_KEY is required');
  }

  return {
    port: Number(env.PORT ?? 3001),
    databasePath: env.DATABASE_PATH ?? './data/customer-service.sqlite',
    deepseekApiKey: deepseekApiKey ?? 'test-key',
    deepseekBaseUrl: env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com',
    deepseekModel: env.DEEPSEEK_MODEL ?? 'deepseek-v4-flash',
    ragMinScore: Number(env.RAG_MIN_SCORE ?? 0.55),
  };
}

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createDatabase, type AppDatabase } from '../src/db/database.js';
import { migrate } from '../src/db/migrate.js';
import type { EmbeddingProvider } from '../src/knowledge/embedder.js';
import { Retriever } from '../src/knowledge/retriever.js';
import { KnowledgeRepository } from '../src/repositories/knowledge-repository.js';

describe('Retriever', () => {
  let database: AppDatabase;

  beforeEach(() => {
    database = createDatabase(':memory:');
    migrate(database);
  });

  afterEach(() => database.close());

  it('returns the most relevant indexed FAQ with a source label', async () => {
    const embedder: EmbeddingProvider = {
      embed: async (texts) => texts.map((text) => (text.includes('退款') ? [1, 0] : [0, 1])),
    };
    const retriever = new Retriever(new KnowledgeRepository(database), embedder, 0.5);

    await retriever.indexDocument({
      title: '退款说明',
      markdown: '# 退款\n七日内可申请退款。\n\n# 配送\n配送时效为三至五个工作日。',
    });

    const results = await retriever.search('怎么退款', 3);

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ title: '退款说明', sourceLabel: '退款说明', content: '七日内可申请退款。' });
    expect(results[0]?.score).toBe(1);
  });
});

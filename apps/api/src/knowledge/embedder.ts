export type EmbeddingProvider = {
  embed(texts: string[]): Promise<number[][]>;
};

export class LocalEmbeddingProvider implements EmbeddingProvider {
  private extractor: Promise<(text: string, options: { pooling: 'mean'; normalize: true }) => Promise<{ data: Float32Array }>> | undefined;

  constructor(private readonly model = 'Xenova/bge-small-zh-v1.5') {}

  async embed(texts: string[]): Promise<number[][]> {
    if (!this.extractor) {
      this.extractor = import('@huggingface/transformers').then(async ({ pipeline }) =>
        pipeline('feature-extraction', this.model, { dtype: 'q8' }) as unknown as (text: string, options: { pooling: 'mean'; normalize: true }) => Promise<{ data: Float32Array }>,
      );
    }
    const extract = await this.extractor;
    return Promise.all(texts.map(async (text) => Array.from((await extract(text, { pooling: 'mean', normalize: true })).data)));
  }
}

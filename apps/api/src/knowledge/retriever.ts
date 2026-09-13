import { chunkMarkdown } from './chunker.js';
import type { EmbeddingProvider } from './embedder.js';
import type { KnowledgeRepository } from '../repositories/knowledge-repository.js';

export type RetrievedChunk = {
  chunkId: string;
  title: string;
  sourceLabel: string;
  content: string;
  score: number;
};

export function cosineSimilarity(left: number[], right: number[]): number {
  if (left.length === 0 || left.length !== right.length) throw new Error('embedding dimensions must match');
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index]! * right[index]!;
    leftMagnitude += left[index]! ** 2;
    rightMagnitude += right[index]! ** 2;
  }
  if (leftMagnitude === 0 || rightMagnitude === 0) return 0;
  return dot / Math.sqrt(leftMagnitude * rightMagnitude);
}

export class Retriever {
  constructor(
    private readonly repository: KnowledgeRepository,
    private readonly embedder: EmbeddingProvider,
    private readonly minScore: number,
  ) {}

  async indexDocument(input: { title: string; markdown: string }): Promise<void> {
    const document = this.repository.createDocument({ title: input.title, content: input.markdown });
    const chunks = chunkMarkdown(document.id, input.markdown);
    const embeddings = await this.embedder.embed(chunks.map((chunk) => chunk.content));
    this.repository.insertChunks(chunks.map((chunk, index) => ({ ...chunk, embedding: embeddings[index]! })));
  }

  async search(query: string, limit: number): Promise<RetrievedChunk[]> {
    const [queryEmbedding] = await this.embedder.embed([query]);
    return this.repository
      .listIndexedChunks()
      .map((chunk) => ({
        chunkId: chunk.id,
        title: chunk.title,
        sourceLabel: chunk.sourceLabel,
        content: chunk.content,
        score: cosineSimilarity(queryEmbedding!, chunk.embedding),
      }))
      .filter((chunk) => chunk.score >= this.minScore)
      .sort((left, right) => right.score - left.score)
      .slice(0, limit);
  }
}

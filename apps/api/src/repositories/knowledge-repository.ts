import { randomUUID } from 'node:crypto';

import type { AppDatabase } from '../db/database.js';

export type KnowledgeDocument = {
  id: string;
  title: string;
  sourceLabel: string;
  content: string;
  indexStatus: 'indexed' | 'failed';
  createdAt: string;
};

export type IndexedChunk = {
  id: string;
  documentId: string;
  title: string;
  sourceLabel: string;
  content: string;
  embedding: number[];
};

export class KnowledgeRepository {
  constructor(private readonly database: AppDatabase) {}

  createDocument(input: { title: string; content: string }): KnowledgeDocument {
    const document: KnowledgeDocument = {
      id: randomUUID(),
      title: input.title,
      sourceLabel: input.title,
      content: input.content,
      indexStatus: 'indexed',
      createdAt: new Date().toISOString(),
    };
    this.database
      .prepare('INSERT INTO knowledge_documents (id, title, source_label, content, index_status, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(document.id, document.title, document.sourceLabel, document.content, document.indexStatus, document.createdAt);
    return document;
  }

  insertChunks(chunks: Array<{ id: string; documentId: string; content: string; embedding: number[] }>): void {
    const insert = this.database.prepare('INSERT INTO knowledge_chunks (id, document_id, content, embedding_json, created_at) VALUES (?, ?, ?, ?, ?)');
    const now = new Date().toISOString();
    const transaction = this.database.transaction(() => {
      for (const chunk of chunks) insert.run(chunk.id, chunk.documentId, chunk.content, JSON.stringify(chunk.embedding), now);
    });
    transaction();
  }

  listIndexedChunks(): IndexedChunk[] {
    return this.database
      .prepare('SELECT c.id, c.document_id, c.content, c.embedding_json, d.title, d.source_label FROM knowledge_chunks c JOIN knowledge_documents d ON d.id = c.document_id')
      .all()
      .map((row) => {
        const item = row as { id: string; document_id: string; content: string; embedding_json: string; title: string; source_label: string };
        return {
          id: item.id,
          documentId: item.document_id,
          title: item.title,
          sourceLabel: item.source_label,
          content: item.content,
          embedding: JSON.parse(item.embedding_json) as number[],
        };
      });
  }
}

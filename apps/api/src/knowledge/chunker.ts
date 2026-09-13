import { randomUUID } from 'node:crypto';

export type KnowledgeChunkDraft = {
  id: string;
  documentId: string;
  content: string;
};

export function chunkMarkdown(documentId: string, markdown: string): KnowledgeChunkDraft[] {
  const sections = [...markdown.matchAll(/(?:^|\n)#\s+[^\n]+\n([\s\S]*?)(?=\n#\s|$)/g)]
    .map((match) => match[1]?.trim())
    .filter((content): content is string => Boolean(content));
  const contents = sections.length > 0 ? sections : [markdown.trim()].filter(Boolean);

  return contents.map((content) => ({ id: randomUUID(), documentId, content }));
}

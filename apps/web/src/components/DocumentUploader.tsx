import { useState } from 'react';

export function DocumentUploader({ onImport }: { onImport(input: { title: string; markdown: string }): Promise<void> }) {
  const [title, setTitle] = useState('');
  const [markdown, setMarkdown] = useState('');
  return <form className="document-uploader" onSubmit={(event) => { event.preventDefault(); if (!title.trim() || !markdown.trim()) return; void onImport({ title: title.trim(), markdown: markdown.trim() }).then(() => { setTitle(''); setMarkdown(''); }); }}><h2>导入知识</h2><input aria-label="知识标题" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="例如：退款说明" /><textarea aria-label="Markdown 内容" value={markdown} onChange={(event) => setMarkdown(event.target.value)} placeholder="# 退款\n七日内可申请退款。" /><button type="submit">导入并索引</button></form>;
}

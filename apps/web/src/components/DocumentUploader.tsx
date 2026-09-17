import { useState } from 'react';
import { Button, Field, Input, Textarea } from '@chenyibo111/ui';

export function DocumentUploader({ onImport }: { onImport(input: { title: string; markdown: string }): Promise<boolean> }) {
  const [title, setTitle] = useState('');
  const [markdown, setMarkdown] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submit = async () => {
    if (!title.trim() || !markdown.trim() || submitting) return;
    setSubmitting(true);
    try {
      if (await onImport({ title: title.trim(), markdown: markdown.trim() })) {
        setTitle('');
        setMarkdown('');
      }
    } finally {
      setSubmitting(false);
    }
  };
  return <form className="document-uploader" noValidate onSubmit={(event) => { event.preventDefault(); void submit(); }}><h2>导入知识</h2><Field label="知识标题"><Input aria-label="知识标题" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="例如：退款说明" /></Field><Field label="Markdown 内容"><Textarea className="knowledge-markdown-input resize-none" aria-label="Markdown 内容" value={markdown} onChange={(event) => setMarkdown(event.target.value)} placeholder="# 退款\n七日内可申请退款。" /></Field><Button type="submit" loading={submitting} disabled={submitting}>导入并索引</Button></form>;
}

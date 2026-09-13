import { useEffect, useState } from 'react';

import { adminApi, type AdminApi, type KnowledgeDocument, type Replay } from '../app/api.js';
import { DocumentUploader } from '../components/DocumentUploader.js';
import { TraceTimeline } from '../components/TraceTimeline.js';

export function AdminPage({ client = adminApi }: { client?: AdminApi }) {
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [replay, setReplay] = useState<Replay | null>(null);
  const [notice, setNotice] = useState('');
  const refresh = async () => { try { setDocuments(await client.listDocuments()); } catch { setNotice('无法加载知识库。'); } };
  useEffect(() => { void refresh(); void client.getReplay('demo-conversation').then(setReplay).catch(() => setReplay({ messages: [], toolCalls: [] })); }, [client]);
  const importDocument = async (input: { title: string; markdown: string }) => { try { await client.importDocument(input); await refresh(); setNotice('知识已导入并建立索引。'); } catch { setNotice('知识导入失败。'); } };

  return <main className="workspace admin-workspace"><header className="workspace-header"><span className="eyebrow">运营后台</span><h1>知识与回放</h1><p>上传 FAQ，并审查 Agent 的可追溯运行记录。</p></header>{notice && <p className="notice" role="status">{notice}</p>}<div className="admin-grid"><section><DocumentUploader onImport={importDocument} /><h2>已索引知识</h2>{documents.length === 0 ? <p className="empty-state">尚未导入知识。</p> : <ul className="document-list">{documents.map((document) => <li key={document.id}><strong>{document.title}</strong><span>{document.indexStatus === 'indexed' ? '已索引' : document.indexStatus}</span></li>)}</ul>}</section><TraceTimeline replay={replay} /></div></main>;
}

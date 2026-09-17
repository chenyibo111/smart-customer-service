import { useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, CardContent, Empty } from '@chenyibo111/ui';

import { adminApi, type AdminApi, type Conversation, type KnowledgeDocument, type Replay } from '../app/api.js';
import { DocumentUploader } from '../components/DocumentUploader.js';
import { EvaluationCenter } from '../components/EvaluationCenter.js';
import { TraceTimeline } from '../components/TraceTimeline.js';

export function AdminPage({ client = adminApi }: { client?: AdminApi }) {
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [replay, setReplay] = useState<Replay | null>(null);
  const [notice, setNotice] = useState('');
  const refresh = async () => { try { setDocuments(await client.listDocuments()); } catch { setNotice('无法加载知识库。'); } };
  const selectConversation = async (conversationId: string) => { try { setReplay(await client.getReplay(conversationId)); } catch { setReplay({ messages: [], toolCalls: [] }); setNotice('无法加载会话回放。'); } };
  useEffect(() => { void refresh(); void client.listConversations().then((items) => { setConversations(items); if (items[0]) void selectConversation(items[0].id); else setReplay({ messages: [], toolCalls: [] }); }).catch(() => { setConversations([]); setReplay({ messages: [], toolCalls: [] }); }); }, [client]);
  const importDocument = async (input: { title: string; markdown: string }) => { try { await client.importDocument(input); await refresh(); setNotice('知识已导入并建立索引。'); } catch (error) { setNotice(error instanceof Error ? error.message : '知识导入失败。'); } };

  return <main className="workspace admin-workspace"><header className="workspace-header"><span className="eyebrow">运营后台</span><h1>知识、回放与评估</h1><p>上传 FAQ，并审查 Agent 的可追溯运行记录与评估结果。</p></header>{notice && <Alert className="notice" variant="info" role="status">{notice}</Alert>}<div className="admin-grid"><section><DocumentUploader onImport={importDocument} /><h2>已索引知识</h2>{documents.length === 0 ? <Empty title="尚未导入知识。" /> : <ul className="document-list">{documents.map((document) => <li key={document.id}><Card><CardContent className="document-row"><strong>{document.title}</strong><Badge variant={document.indexStatus === 'indexed' ? 'success' : 'warning'}>{document.indexStatus === 'indexed' ? '已索引' : document.indexStatus}</Badge></CardContent></Card></li>)}</ul>}<h2>真实会话</h2>{conversations.length === 0 ? <Empty title="尚无可回放会话。" /> : <ul className="document-list">{conversations.map((conversation) => { const visitor = conversation.visitorId ?? '访客'; return <li key={conversation.id}><Card><CardContent className="document-row"><span>{visitor}</span><Button aria-label={`查看${visitor} 的会话`} variant="secondary" onClick={() => void selectConversation(conversation.id)}>查看{visitor}的会话</Button></CardContent></Card></li>; })}</ul>}</section><TraceTimeline replay={replay} /></div><EvaluationCenter client={client} /></main>;
}

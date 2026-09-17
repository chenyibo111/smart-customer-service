import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { AdminPage } from '../src/pages/AdminPage.js';

describe('AdminPage', () => {
  it('shows imported knowledge and a replay trace', async () => {
    const client = {
      listDocuments: async () => [{ id: 'doc-1', title: '退款说明', indexStatus: 'indexed' }],
      listConversations: async () => [{ id: 'conversation-7', visitorId: '访客 7', status: 'resolved' }],
      importDocument: async () => undefined,
      getReplay: async () => ({
        messages: [{ id: 'message-7', role: 'customer', content: '请查询订单 A1001。' }],
        toolCalls: [{ id: 'call-1', name: 'query_order', maskedArguments: '{"orderId":"A***1"}', status: 'succeeded' }],
      }),
      listEvaluationCases: async () => [],
      listEvaluationRuns: async () => [],
      runEvaluation: async () => ({ run: { id: 'run-empty', mode: 'offline', status: 'completed', startedAt: '', completedAt: '', totalCount: 0, passCount: 0, elapsedMs: 0 }, results: [] }),
      getEvaluationRun: async () => ({ run: { id: 'run-empty', mode: 'offline', status: 'completed', startedAt: '', completedAt: '', totalCount: 0, passCount: 0, elapsedMs: 0 }, results: [] }),
    };
    render(<AdminPage client={client} />);

    expect(await screen.findByText('退款说明')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: '查看访客 7 的会话' })).toBeInTheDocument();
    expect(screen.getByText('请查询订单 A1001。')).toBeInTheDocument();
    expect(await screen.findByText('query_order')).toBeInTheDocument();
  });

  it('starts the deterministic offline run and keeps a safe failed case detail reviewable', async () => {
    const user = userEvent.setup();
    const failedDetail = {
      run: { id: 'run-failed', mode: 'offline' as const, status: 'completed' as const, startedAt: '', completedAt: '', totalCount: 1, passCount: 0, elapsedMs: 4 },
      results: [{
        id: 'result-failed', runId: 'run-failed', caseId: 'refund-answer', name: '退款知识问答', question: '怎么退款？',
        expectedOutcome: 'answer' as const, expectedSourceLabel: '退款说明', expectedToolName: null, expectedHandoffReason: null,
        outcome: 'answer' as const, citationLabels: [], toolNames: [], handoffReason: null, answerContent: '可以退款。', elapsedMs: 4,
        passed: false, failureReason: '未引用预期知识来源：退款说明。', createdAt: '',
      }],
    };
    const passedDetail = {
      run: { id: 'run-passed', mode: 'offline' as const, status: 'completed' as const, startedAt: '', completedAt: '', totalCount: 6, passCount: 6, elapsedMs: 12 },
      results: [],
    };
    const client = {
      listDocuments: async () => [],
      listConversations: async () => [],
      importDocument: async () => undefined,
      getReplay: async () => ({ messages: [], toolCalls: [] }),
      listEvaluationCases: async () => [{ id: 'refund-answer', name: '退款知识问答', question: '怎么退款？', expectedOutcome: 'answer' as const, expectedSourceLabel: '退款说明', expectedToolName: null, expectedHandoffReason: null }],
      listEvaluationRuns: async () => [failedDetail.run],
      runEvaluation: async () => passedDetail,
      getEvaluationRun: async () => failedDetail,
    };
    render(<AdminPage client={client} />);

    expect(await screen.findByText('未引用预期知识来源：退款说明。')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '运行离线评估' }));
    expect(await screen.findByText(/6 \/ 6 通过/, { selector: '.evaluation-summary span' })).toBeInTheDocument();
    expect(screen.getByText(/离线模式为确定性执行，不会调用模型。/, { selector: '.evaluation-hint' })).toBeInTheDocument();
  });

  it('shows the safe indexing failure returned by the API', async () => {
    const user = userEvent.setup();
    const client = {
      listDocuments: async () => [],
      listConversations: async () => [],
      importDocument: async () => { throw new Error('知识索引失败，请检查本地模型下载网络后重试。'); },
      getReplay: async () => ({ messages: [], toolCalls: [] }),
      listEvaluationCases: async () => [],
      listEvaluationRuns: async () => [],
      runEvaluation: async () => ({ run: { id: 'run-empty', mode: 'offline' as const, status: 'completed' as const, startedAt: '', completedAt: '', totalCount: 0, passCount: 0, elapsedMs: 0 }, results: [] }),
      getEvaluationRun: async () => ({ run: { id: 'run-empty', mode: 'offline' as const, status: 'completed' as const, startedAt: '', completedAt: '', totalCount: 0, passCount: 0, elapsedMs: 0 }, results: [] }),
    };
    render(<AdminPage client={client} />);

    await user.type(screen.getByRole('textbox', { name: '知识标题' }), '退款说明');
    await user.type(screen.getByRole('textbox', { name: 'Markdown 内容' }), '# 退款\\n七日内可申请退款。');
    await user.click(screen.getByRole('button', { name: '导入并索引' }));

    expect(await screen.findByRole('status')).toHaveTextContent('知识索引失败，请检查本地模型下载网络后重试。');
  });
});

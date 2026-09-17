import { useEffect, useState } from 'react';
import { Badge, Button, Card, CardContent, Empty } from '@chenyibo111/ui';

import type { AdminApi, EvaluationRun, EvaluationRunDetail } from '../app/api.js';
import { FeedbackAlert, type FeedbackNotice } from './FeedbackAlert.js';

const outcomeLabels = { answer: '回答', handoff: '转人工', failed: '失败' };

function RunSummary({ run }: { run: EvaluationRun }) {
  const failed = run.totalCount - run.passCount;
  return <span>{run.passCount} / {run.totalCount} 通过{failed > 0 ? `，${failed} 失败` : ''}{run.elapsedMs === null ? '' : ` · ${run.elapsedMs} ms`}</span>;
}

export function EvaluationCenter({ client }: { client: AdminApi }) {
  const [caseCount, setCaseCount] = useState(0);
  const [runs, setRuns] = useState<EvaluationRun[]>([]);
  const [detail, setDetail] = useState<EvaluationRunDetail | null>(null);
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState<FeedbackNotice | null>(null);

  const selectRun = async (runId: string) => {
    try {
      setDetail(await client.getEvaluationRun(runId));
      setNotice(null);
    } catch {
      setNotice({ message: '无法加载评估结果。', variant: 'destructive' });
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        const [availableCases, history] = await Promise.all([client.listEvaluationCases(), client.listEvaluationRuns()]);
        setCaseCount(availableCases.length);
        setRuns(history);
        if (history[0]) await selectRun(history[0].id);
      } catch {
        setNotice({ message: '无法加载评估中心。', variant: 'destructive' });
      }
    };
    void load();
  }, [client]);

  const start = async (mode: 'offline' | 'real') => {
    setRunning(true);
    setNotice(null);
    try {
      const next = await client.runEvaluation(mode);
      setDetail(next);
      setRuns((current) => [next.run, ...current.filter((run) => run.id !== next.run.id)]);
    } catch {
      setNotice({ message: '评估运行失败，请稍后重试。', variant: 'destructive' });
    } finally {
      setRunning(false);
    }
  };

  return <section className="evaluation-center" aria-labelledby="evaluation-heading">
    <div className="evaluation-heading">
      <div><span className="eyebrow">Agent 质量</span><h2 id="evaluation-heading">评估中心</h2><p>用固定用例审查检索、工具调用与转人工行为。</p></div>
      <Badge className="evaluation-case-count">{caseCount} 个用例</Badge>
    </div>
    <div className="evaluation-actions">
      <Button onClick={() => void start('offline')} disabled={running}>运行离线评估</Button>
      <Button variant="secondary" onClick={() => void start('real')} disabled={running}>运行真实 DeepSeek 评估</Button>
    </div>
    <p className="evaluation-hint">离线模式为确定性执行，不会调用模型。真实模式会调用 DeepSeek，可能消耗额度。</p>
    <FeedbackAlert notice={notice} />
    <div className="evaluation-layout">
      <section>
        <h3>运行历史</h3>
        {runs.length === 0 ? <Empty title="尚无评估记录。" /> : <ul className="evaluation-run-list">{runs.map((run) => <li key={run.id}><Button variant="secondary" onClick={() => void selectRun(run.id)}><span>{run.mode === 'offline' ? '离线评估' : '真实 DeepSeek 评估'}</span><RunSummary run={run} /></Button></li>)}</ul>}
      </section>
      <section className="evaluation-detail">
        <h3>结果明细</h3>
        {detail === null ? <Empty title="选择或运行一次评估以查看结果。" /> : <>
          <Card className="evaluation-summary"><CardContent className="evaluation-summary-content"><strong>{detail.run.mode === 'offline' ? '离线评估' : '真实 DeepSeek 评估'}</strong><RunSummary run={detail.run} /></CardContent></Card>
          <ul className="evaluation-results">{detail.results.map((result) => <li key={result.id} className={result.passed ? 'evaluation-result passed' : 'evaluation-result failed'}>
            <div className="evaluation-result-heading"><strong>{result.name}</strong><span>{result.passed ? '通过' : '失败'}</span></div>
            <p>问题：{result.question}</p>
            <dl><dt>预期</dt><dd>{outcomeLabels[result.expectedOutcome]}{result.expectedSourceLabel ? ` · 来源：${result.expectedSourceLabel}` : ''}{result.expectedToolName ? ` · 工具：${result.expectedToolName}` : ''}{result.expectedHandoffReason ? ` · 原因：${result.expectedHandoffReason}` : ''}</dd><dt>实际</dt><dd>{outcomeLabels[result.outcome]}{result.citationLabels.length ? ` · 来源：${result.citationLabels.join('、')}` : ''}{result.toolNames.length ? ` · 工具：${result.toolNames.join('、')}` : ''}{result.handoffReason ? ` · 原因：${result.handoffReason}` : ''}</dd></dl>
            {result.answerContent && <p>回答：{result.answerContent}</p>}
            {result.failureReason && <p className="evaluation-failure">{result.failureReason}</p>}
          </li>)}</ul>
        </>}
      </section>
    </div>
  </section>;
}

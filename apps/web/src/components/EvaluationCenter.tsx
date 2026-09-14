import { useEffect, useState } from 'react';

import type { AdminApi, EvaluationRun, EvaluationRunDetail } from '../app/api.js';

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
  const [notice, setNotice] = useState('');

  const selectRun = async (runId: string) => {
    try {
      setDetail(await client.getEvaluationRun(runId));
      setNotice('');
    } catch {
      setNotice('无法加载评估结果。');
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
        setNotice('无法加载评估中心。');
      }
    };
    void load();
  }, [client]);

  const start = async (mode: 'offline' | 'real') => {
    setRunning(true);
    setNotice('');
    try {
      const next = await client.runEvaluation(mode);
      setDetail(next);
      setRuns((current) => [next.run, ...current.filter((run) => run.id !== next.run.id)]);
    } catch {
      setNotice('评估运行失败，请稍后重试。');
    } finally {
      setRunning(false);
    }
  };

  return <section className="evaluation-center" aria-labelledby="evaluation-heading">
    <div className="evaluation-heading">
      <div><span className="eyebrow">Agent 质量</span><h2 id="evaluation-heading">评估中心</h2><p>用固定用例审查检索、工具调用与转人工行为。</p></div>
      <span className="evaluation-case-count">{caseCount} 个用例</span>
    </div>
    <div className="evaluation-actions">
      <button onClick={() => void start('offline')} disabled={running}>运行离线评估</button>
      <button className="secondary" onClick={() => void start('real')} disabled={running}>运行真实 DeepSeek 评估</button>
    </div>
    <p className="evaluation-hint">离线模式为确定性执行，不会调用模型。真实模式会调用 DeepSeek，可能消耗额度。</p>
    {notice && <p className="notice" role="status">{notice}</p>}
    <div className="evaluation-layout">
      <section>
        <h3>运行历史</h3>
        {runs.length === 0 ? <p className="empty-state">尚无评估记录。</p> : <ul className="evaluation-run-list">{runs.map((run) => <li key={run.id}><button className="secondary" onClick={() => void selectRun(run.id)}><span>{run.mode === 'offline' ? '离线评估' : '真实 DeepSeek 评估'}</span><RunSummary run={run} /></button></li>)}</ul>}
      </section>
      <section className="evaluation-detail">
        <h3>结果明细</h3>
        {detail === null ? <p className="empty-state">选择或运行一次评估以查看结果。</p> : <>
          <div className="evaluation-summary"><strong>{detail.run.mode === 'offline' ? '离线评估' : '真实 DeepSeek 评估'}</strong><RunSummary run={detail.run} /></div>
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

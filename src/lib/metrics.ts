// Pure cost & quality math shared by every page. Costs always derive from the price table.
export type Price = {
  model_id: string;
  friendly_name: string;
  size_tag: string;
  input_per_m: number;
  output_per_m: number;
  sort: number;
};

export type Call = {
  id: string;
  model_id: string;
  status: string;
  input_position: number;
  input_text: string;
  reference: string | null;
  output: string | null;
  error: string | null;
  latency_ms: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  tokens_estimated: boolean;
  score: number | null;
  reason: string | null;
  grade_status: string;
};

export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

export function callCost(c: Pick<Call, "input_tokens" | "output_tokens">, p?: Price): number {
  if (!p) return 0;
  return ((c.input_tokens ?? 0) * Number(p.input_per_m) + (c.output_tokens ?? 0) * Number(p.output_per_m)) / 1_000_000;
}

export function percentile(values: number[], pct: number): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((pct / 100) * s.length) - 1;
  return s[Math.max(0, Math.min(s.length - 1, rank))];
}

export type ModelSummary = {
  model_id: string;
  name: string;
  calls: number;
  ok: number;
  failed: number;
  avgScore: number;
  passRate: number;
  avgLatency: number;
  p95Latency: number;
  totalTokens: number;
  runCost: number;
  per1000: number;
  anyEstimated: boolean;
};

export function summarize(calls: Call[], models: string[], prices: Price[], threshold: number): ModelSummary[] {
  return models.map((m) => {
    const p = prices.find((x) => x.model_id === m);
    const mc = calls.filter((c) => c.model_id === m);
    const ok = mc.filter((c) => c.status === "ok");
    const graded = ok.filter((c) => c.score != null);
    const lats = ok.map((c) => c.latency_ms ?? 0);
    const runCost = mc.reduce((s, c) => s + callCost(c, p), 0);
    // Failed calls count as failing the quality bar.
    const passes = graded.filter((c) => (c.score ?? 0) >= threshold).length;
    return {
      model_id: m,
      name: p?.friendly_name ?? m,
      calls: mc.length,
      ok: ok.length,
      failed: mc.filter((c) => c.status === "failed").length,
      avgScore: graded.length ? graded.reduce((s, c) => s + (c.score ?? 0), 0) / graded.length : 0,
      passRate: mc.length ? (passes / mc.length) * 100 : 0,
      avgLatency: lats.length ? lats.reduce((a, b) => a + b, 0) / lats.length : 0,
      p95Latency: percentile(lats, 95),
      totalTokens: mc.reduce((s, c) => s + (c.input_tokens ?? 0) + (c.output_tokens ?? 0), 0),
      runCost,
      per1000: runCost * 1000,
      anyEstimated: mc.some((c) => c.tokens_estimated),
    };
  });
}

export function recommend(s: ModelSummary[], target: number) {
  const usable = s.filter((x) => x.ok > 0);
  const meeting = usable.filter((x) => x.passRate >= target).sort((a, b) => a.per1000 - b.per1000);
  const cheapest = meeting[0] ?? null;
  const best = [...usable].sort((a, b) => b.avgScore - a.avgScore || a.per1000 - b.per1000)[0] ?? null;
  const fastest = [...usable].sort((a, b) => a.avgLatency - b.avgLatency)[0] ?? null;
  return { cheapest, best, fastest, meetingCount: meeting.length };
}

export function fmtUsd(n: number): string {
  if (n === 0) return "$0.00";
  if (n < 0.01) return `$${n.toFixed(5)}`;
  if (n < 1) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}
export function fmtPhp(n: number): string {
  return `₱${n < 1 ? n.toFixed(3) : n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Trophy, Zap, PiggyBank, AlertTriangle } from "lucide-react";
import { CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis, LabelList, Cell } from "recharts";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, LoadingBlock, ErrorBlock } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { runQuery, pricesQuery, settingsQuery } from "@/lib/queries";
import { summarize, recommend, fmtUsd, fmtPhp, callCost, type ModelSummary } from "@/lib/metrics";
import { useRunExecutor } from "@/lib/useRunExecutor";

export const Route = createFileRoute("/runs/$runId")({
  head: () => ({
    meta: [
      { title: "Run results — ModelBench" },
      { name: "description", content: "Quality, latency and cost per model, with a recommendation and side-by-side outputs." },
      { property: "og:title", content: "Run results — ModelBench" },
      { property: "og:description", content: "Cheapest model that meets the quality bar, with full evidence." },
    ],
  }),
  component: RunPage,
});

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"];

function RunPage() {
  const { runId } = Route.useParams();
  const q = useQuery({
    ...runQuery(runId),
    refetchInterval: (query) => (query.state.data?.run?.status === "completed" ? false : 2500),
  });
  const prices = useQuery(pricesQuery);
  const settings = useQuery(settingsQuery);
  const exec = useRunExecutor(runId, q.data?.run?.status, q.data?.calls);

  if (q.isLoading || prices.isLoading || settings.isLoading) return <LoadingBlock label="Loading run…" />;
  if (q.error) return <ErrorBlock error={q.error} retry={() => q.refetch()} />;
  if (!q.data?.run)
    return (
      <div className="rounded-lg border border-dashed p-10 text-center text-sm">
        Run not found. <Link to="/" className="text-primary underline">Back to tasks</Link>
      </div>
    );
  const { run, calls } = q.data;
  const task = run.tasks as { name: string; pass_threshold: number } | null;
  const threshold = task?.pass_threshold ?? 4;
  const P = prices.data ?? [];
  const php = settings.data?.php_rate ?? 58;
  const target = settings.data?.pass_rate_target ?? 80;
  const summary = summarize(calls, run.models, P, threshold);
  const rec = recommend(summary, target);
  const finished = calls.filter((c) => c.status !== "pending").length;
  const graded = calls.filter((c) => c.grade_status !== "pending").length;
  const running = run.status !== "completed";

  return (
    <>
      <PageHeader
        title={task?.name ?? "Run"}
        sub={
          <>
            Prompt v{run.prompt_version} · {new Date(run.created_at).toLocaleString()} · pass = score ≥ {threshold}, target pass rate {target}%
            {run.is_seed && " · sample run stored from an earlier session"}
          </>
        }
        actions={
          <>
            <StatusBadge status={run.status} />
            <Button asChild variant="outline" size="sm">
              <Link to="/tasks/$taskId" params={{ taskId: run.task_id }} search={{ tab: "runs" }}>Task</Link>
            </Button>
          </>
        }
      />

      {running && (
        <div className="mb-6 space-y-3 rounded-lg border bg-card p-5 shadow-card">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">{exec.phase === "grading" || run.status === "grading" ? "Grading outputs" : "Calling models"}</span>
            <span className="num">
              {exec.phase === "grading" || run.status === "grading"
                ? `${graded} / ${calls.length} graded`
                : `${finished} / ${calls.length} calls`}
            </span>
          </div>
          <Progress value={((exec.phase === "grading" ? graded : finished) / Math.max(1, calls.length)) * 100} />
          <p className="text-xs text-muted-foreground">Keep this tab open — the run continues from where it left off if you reload.</p>
        </div>
      )}

      {!running && (
        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <RecCard
            icon={<PiggyBank className="size-4" />}
            title={`Cheapest model meeting ${target}% pass rate`}
            highlight
            m={rec.cheapest}
            php={php}
            body={
              rec.cheapest
                ? `${rec.cheapest.name} passed ${rec.cheapest.passRate.toFixed(0)}% of cases at ${fmtUsd(rec.cheapest.per1000)} per 1,000 runs. ${rec.meetingCount > 1 ? `It beat ${rec.meetingCount - 1} other qualifying model(s) on cost.` : "It is the only model that met the target."}`
                : `No model reached a ${target}% pass rate. Improve the prompt or try a larger model.`
            }
          />
          <RecCard icon={<Trophy className="size-4" />} title="Highest quality" m={rec.best} php={php} body={rec.best ? `Avg score ${rec.best.avgScore.toFixed(2)} / 5.` : "—"} />
          <RecCard icon={<Zap className="size-4" />} title="Fastest" m={rec.fastest} php={php} body={rec.fastest ? `Avg latency ${Math.round(rec.fastest.avgLatency)} ms.` : "—"} />
        </div>
      )}

      <section className="mb-6 overflow-hidden rounded-lg border bg-card shadow-card">
        <h2 className="border-b px-4 py-3 font-semibold">Per-model summary</h2>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Model</TableHead>
                <TableHead className="text-right">Avg score</TableHead>
                <TableHead className="text-right">Pass rate</TableHead>
                <TableHead className="text-right">Avg latency</TableHead>
                <TableHead className="text-right">p95 latency</TableHead>
                <TableHead className="text-right">Tokens</TableHead>
                <TableHead className="text-right">Run cost</TableHead>
                <TableHead className="text-right">Per 1,000 runs</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.map((s) => (
                <TableRow key={s.model_id}>
                  <TableCell>
                    <div className="font-medium">{s.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {s.ok}/{s.calls} ok{s.failed > 0 && <span className="text-destructive"> · {s.failed} failed</span>}
                      {s.anyEstimated && " · tokens estimated"}
                    </div>
                  </TableCell>
                  <TableCell className="num text-right">{s.avgScore ? s.avgScore.toFixed(2) : "—"}</TableCell>
                  <TableCell className={`num text-right ${s.passRate >= target ? "text-success" : "text-destructive"}`}>{s.passRate.toFixed(0)}%</TableCell>
                  <TableCell className="num text-right">{Math.round(s.avgLatency)} ms</TableCell>
                  <TableCell className="num text-right">{Math.round(s.p95Latency)} ms</TableCell>
                  <TableCell className="num text-right">{s.totalTokens.toLocaleString()}</TableCell>
                  <TableCell className="num text-right">{fmtUsd(s.runCost)}</TableCell>
                  <TableCell className="num text-right">
                    {fmtUsd(s.per1000)}
                    <div className="text-xs text-muted-foreground">{fmtPhp(s.per1000 * php)}</div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="border-t px-4 py-2 text-xs text-muted-foreground">
          Costs recompute live from the <Link to="/prices" className="text-primary underline">Prices</Link> table. “Per 1,000 runs” = this run’s cost × 1,000.
        </p>
      </section>

      <section className="mb-6 rounded-lg border bg-card p-4 shadow-card">
        <h2 className="mb-2 font-semibold">Quality vs cost</h2>
        <Chart summary={summary} />
      </section>

      <OutputViewer calls={calls} models={run.models} summary={summary} threshold={threshold} prices={P} />
    </>
  );
}

function RecCard({ icon, title, body, m, highlight, php }: { icon: React.ReactNode; title: string; body: string; m: ModelSummary | null; highlight?: boolean; php: number }) {
  return (
    <div className={`rounded-lg border p-5 shadow-card ${highlight ? "border-primary bg-primary text-primary-foreground" : "bg-card"}`}>
      <div className={`flex items-center gap-2 text-xs font-medium uppercase tracking-wide ${highlight ? "opacity-80" : "text-muted-foreground"}`}>
        {icon} {title}
      </div>
      <div className="mt-2 text-xl font-semibold">{m?.name ?? "None"}</div>
      {m && <div className="num mt-0.5 text-xs opacity-80">{fmtUsd(m.per1000)} · {fmtPhp(m.per1000 * php)} per 1,000 runs</div>}
      <p className={`mt-3 text-sm ${highlight ? "opacity-90" : "text-muted-foreground"}`}>{body}</p>
    </div>
  );
}

function Chart({ summary }: { summary: ModelSummary[] }) {
  const data = summary.filter((s) => s.ok > 0).map((s) => ({ x: Number(s.per1000.toFixed(5)), y: Number(s.avgScore.toFixed(2)), name: s.name }));
  if (!data.length) return <p className="py-10 text-center text-sm text-muted-foreground">No completed calls to chart yet.</p>;
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <ScatterChart margin={{ top: 20, right: 30, bottom: 30, left: 10 }}>
          <CartesianGrid stroke="var(--border)" />
          <XAxis type="number" dataKey="x" name="Cost / 1,000 runs" tickFormatter={(v) => `$${v}`} stroke="var(--muted-foreground)" fontSize={11} label={{ value: "Cost per 1,000 runs (USD)", position: "insideBottom", offset: -15, fontSize: 11, fill: "var(--muted-foreground)" }} />
          <YAxis type="number" dataKey="y" name="Avg score" domain={[0, 5]} stroke="var(--muted-foreground)" fontSize={11} label={{ value: "Avg quality (1–5)", angle: -90, position: "insideLeft", fontSize: 11, fill: "var(--muted-foreground)" }} />
          <ZAxis range={[160, 160]} />
          <Tooltip cursor={{ strokeDasharray: "3 3" }} formatter={(v: number, n: string) => (n === "Cost / 1,000 runs" ? `$${v}` : v)} />
          <Scatter data={data}>
            {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            <LabelList dataKey="name" position="top" fontSize={11} fill="var(--foreground)" />
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

function OutputViewer({ calls, models, summary, threshold, prices }: { calls: import("@/lib/metrics").Call[]; models: string[]; summary: ModelSummary[]; threshold: number; prices: import("@/lib/metrics").Price[] }) {
  const positions = [...new Set(calls.map((c) => c.input_position))].sort((a, b) => a - b);
  const [pos, setPos] = useState(positions[0] ?? 1);
  const row = calls.filter((c) => c.input_position === pos);
  const first = row[0];
  return (
    <section className="rounded-lg border bg-card shadow-card">
      <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-semibold">Side-by-side outputs</h2>
        <div className="flex flex-wrap gap-1">
          {positions.map((p) => (
            <Button key={p} size="sm" variant={p === pos ? "default" : "outline"} className="num" onClick={() => setPos(p)}>
              #{p}
            </Button>
          ))}
        </div>
      </div>
      {first && (
        <div className="grid gap-4 border-b bg-muted/40 p-4 md:grid-cols-2">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Input #{pos}</p>
            <pre className="mt-1 whitespace-pre-wrap text-sm">{first.input_text}</pre>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Reference answer</p>
            <pre className="num mt-1 whitespace-pre-wrap text-xs">{first.reference ?? "—"}</pre>
          </div>
        </div>
      )}
      <div className="grid gap-px bg-border md:grid-flow-col md:auto-cols-fr">
        {models.map((m) => {
          const c = row.find((x) => x.model_id === m);
          const name = summary.find((s) => s.model_id === m)?.name ?? m;
          const pass = c?.score != null && c.score >= threshold;
          return (
            <div key={m} className="flex flex-col bg-card p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">{name}</span>
                {c?.status === "failed" ? (
                  <Badge variant="destructive">failed</Badge>
                ) : c?.score != null ? (
                  <span className={`num rounded px-2 py-0.5 text-xs font-medium ${pass ? "bg-success text-success-foreground" : "bg-destructive text-destructive-foreground"}`}>
                    {c.score}/5 {pass ? "pass" : "fail"}
                  </span>
                ) : (
                  <Badge variant="outline">{c?.status === "pending" ? "running…" : "grading…"}</Badge>
                )}
              </div>
              {c?.status === "failed" ? (
                <p className="flex items-start gap-2 rounded bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {c.error}
                </p>
              ) : (
                <pre className="num flex-1 whitespace-pre-wrap rounded bg-muted/60 p-3 text-xs">{c?.output ?? "…"}</pre>
              )}
              {c?.reason && <p className="mt-2 text-xs italic text-muted-foreground">“{c.reason}”</p>}
              {c && c.status === "ok" && (
                <p className="num mt-2 text-[11px] text-muted-foreground">
                  {c.latency_ms} ms · {c.input_tokens} in / {c.output_tokens} out{c.tokens_estimated ? " (est.)" : ""} · {fmtUsd(callCost(c, prices.find((p) => p.model_id === m)))}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

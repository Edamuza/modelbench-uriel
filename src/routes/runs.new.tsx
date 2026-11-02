import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Play } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, LoadingBlock, ErrorBlock } from "@/components/AppShell";
import { tasksQuery, taskQuery, pricesQuery } from "@/lib/queries";
import { createRun } from "@/lib/bench.functions";
import { GRADER_MODEL } from "@/lib/models";

export const Route = createFileRoute("/runs/new")({
  validateSearch: z.object({ taskId: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "New run — ModelBench" },
      { name: "description", content: "Run a task's test inputs across 2–4 LLMs and grade every output." },
      { property: "og:title", content: "New run — ModelBench" },
      { property: "og:description", content: "Pick a task, prompt version and 2–4 models, then run the benchmark." },
    ],
  }),
  component: NewRunPage,
});

const SIZE_LABEL: Record<string, string> = { small: "Small / fast", medium: "Mid-size", large: "Large" };

function NewRunPage() {
  const search = Route.useSearch();
  const tasks = useQuery(tasksQuery);
  const prices = useQuery(pricesQuery);
  const [taskId, setTaskId] = useState<string | undefined>(search.taskId);
  const task = useQuery({ ...taskQuery(taskId ?? ""), enabled: !!taskId });
  const [pvId, setPvId] = useState<string>();
  const [models, setModels] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const create = useServerFn(createRun);
  const nav = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    if (!taskId && tasks.data?.tasks[0]) setTaskId(tasks.data.tasks[0].id);
  }, [tasks.data, taskId]);
  useEffect(() => {
    setPvId(task.data?.pvs[0]?.id);
  }, [task.data?.pvs[0]?.id]);

  if (tasks.isLoading || prices.isLoading) return <LoadingBlock />;
  if (tasks.error || prices.error) return <ErrorBlock error={tasks.error ?? prices.error} />;

  const nInputs = task.data?.inputs.length ?? 0;
  const total = nInputs * models.length;
  const canRun = !!taskId && !!pvId && models.length >= 2 && models.length <= 4 && nInputs > 0;

  function toggle(m: string) {
    setModels((cur) => (cur.includes(m) ? cur.filter((x) => x !== m) : cur.length >= 4 ? cur : [...cur, m]));
  }

  async function run() {
    if (!canRun || !taskId || !pvId) return;
    setBusy(true);
    try {
      const r = await create({ data: { taskId, promptVersionId: pvId, models } });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["task", taskId] });
      nav({ to: "/runs/$runId", params: { runId: r.runId } });
    } catch (e) {
      toast.error("Couldn't start run", { description: e instanceof Error ? e.message : String(e) });
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="New run" sub="Every test input runs on every selected model, then a fixed AI grader scores each output against the rubric." />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6 rounded-lg border bg-card p-5 shadow-card">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Task</Label>
              <Select value={taskId ?? ""} onValueChange={(v) => setTaskId(v)}>
                <SelectTrigger><SelectValue placeholder="Choose a task" /></SelectTrigger>
                <SelectContent>
                  {tasks.data?.tasks.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Prompt version</Label>
              <Select value={pvId ?? ""} onValueChange={setPvId} disabled={!task.data}>
                <SelectTrigger><SelectValue placeholder={task.isLoading ? "Loading…" : "Choose version"} /></SelectTrigger>
                <SelectContent>
                  {task.data?.pvs.map((p) => (
                    <SelectItem key={p.id} value={p.id}>v{p.version} — {p.change_note}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Models (pick 2–4)</Label>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {prices.data?.map((p) => {
                const on = models.includes(p.model_id);
                return (
                  <label key={p.model_id} className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors ${on ? "border-primary bg-accent" : "hover:bg-muted"}`}>
                    <Checkbox checked={on} onCheckedChange={() => toggle(p.model_id)} disabled={!on && models.length >= 4} className="mt-0.5" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{p.friendly_name}</div>
                      <div className="text-xs text-muted-foreground">{SIZE_LABEL[p.size_tag] ?? p.size_tag} · <span className="num">${Number(p.input_per_m)} / ${Number(p.output_per_m)}</span> per 1M</div>
                      <div className="num truncate text-[10px] text-muted-foreground">{p.model_id}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
        <div className="h-fit space-y-4 rounded-lg border bg-ink p-5 text-ink-foreground">
          <h3 className="font-semibold">Run summary</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="opacity-70">Test inputs</dt><dd className="num">{nInputs}</dd></div>
            <div className="flex justify-between"><dt className="opacity-70">Models</dt><dd className="num">{models.length}</dd></div>
            <div className="flex justify-between"><dt className="opacity-70">Model calls</dt><dd className="num">{total}</dd></div>
            <div className="flex justify-between"><dt className="opacity-70">Grader calls</dt><dd className="num">≤ {total}</dd></div>
            <div className="flex justify-between gap-2"><dt className="opacity-70">Grader</dt><dd className="text-right">{prices.data?.find((p) => p.model_id === GRADER_MODEL)?.friendly_name ?? GRADER_MODEL}, fixed</dd></div>
          </dl>
          <Button className="w-full" variant="secondary" disabled={!canRun || busy} onClick={run}>
            <Play className="size-4" /> {busy ? "Starting…" : "Run"}
          </Button>
          {models.length < 2 && <p className="text-xs opacity-70">Select at least 2 models.</p>}
          {task.data && nInputs === 0 && <p className="text-xs text-signal">This task has no test inputs yet.</p>}
        </div>
      </div>
    </>
  );
}

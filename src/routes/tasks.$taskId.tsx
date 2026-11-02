import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Play, Plus, Trash2 } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader, LoadingBlock, ErrorBlock } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { taskQuery, pricesQuery } from "@/lib/queries";
import { savePromptVersion, saveRubric, saveTestInputs } from "@/lib/bench.functions";

const search = z.object({ tab: z.enum(["prompt", "inputs", "rubric", "runs"]).optional() });

export const Route = createFileRoute("/tasks/$taskId")({
  validateSearch: search,
  head: () => ({
    meta: [
      { title: "Task — ModelBench" },
      { name: "description", content: "Versioned prompt, test inputs, rubric and run history for a benchmark task." },
      { property: "og:title", content: "Task — ModelBench" },
      { property: "og:description", content: "Versioned prompt, test inputs, rubric and run history." },
    ],
  }),
  component: TaskPage,
});

function errMsg(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

function TaskPage() {
  const { taskId } = Route.useParams();
  const { tab = "prompt" } = Route.useSearch();
  const nav = useNavigate({ from: Route.fullPath });
  const q = useQuery(taskQuery(taskId));

  if (q.isLoading) return <LoadingBlock label="Loading task…" />;
  if (q.error) return <ErrorBlock error={q.error} retry={() => q.refetch()} />;
  if (!q.data?.task)
    return (
      <div className="rounded-lg border border-dashed p-10 text-center text-sm">
        Task not found. <Link to="/" className="text-primary underline">Back to tasks</Link>
      </div>
    );
  const { task, pvs, inputs, runs } = q.data;
  return (
    <>
      <PageHeader
        title={task.name}
        sub={task.description}
        actions={
          <Button asChild>
            <Link to="/runs/new" search={{ taskId }}>
              <Play className="size-4" /> New run
            </Link>
          </Button>
        }
      />
      <Tabs value={tab} onValueChange={(v) => nav({ search: { tab: v as "prompt" } })}>
        <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
          <TabsTrigger value="prompt">Prompt</TabsTrigger>
          <TabsTrigger value="inputs">Test inputs ({inputs.length})</TabsTrigger>
          <TabsTrigger value="rubric">Rubric</TabsTrigger>
          <TabsTrigger value="runs">Runs ({runs.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="prompt" className="mt-6">
          <PromptTab taskId={taskId} pvs={pvs} />
        </TabsContent>
        <TabsContent value="inputs" className="mt-6">
          <InputsTab taskId={taskId} inputs={inputs} />
        </TabsContent>
        <TabsContent value="rubric" className="mt-6">
          <RubricTab taskId={taskId} rubric={task.rubric} threshold={task.pass_threshold} />
        </TabsContent>
        <TabsContent value="runs" className="mt-6">
          <RunsTab runs={runs} taskId={taskId} />
        </TabsContent>
      </Tabs>
    </>
  );
}

type PV = { id: string; version: number; system_prompt: string; user_template: string; change_note: string; created_at: string };

function PromptTab({ taskId, pvs }: { taskId: string; pvs: PV[] }) {
  const latest = pvs[0];
  const [viewing, setViewing] = useState<string | null>(null);
  const [system, setSystem] = useState(latest?.system_prompt ?? "");
  const [template, setTemplate] = useState(latest?.user_template ?? "{{input}}");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const save = useServerFn(savePromptVersion);
  const qc = useQueryClient();
  useEffect(() => {
    setSystem(latest?.system_prompt ?? "");
    setTemplate(latest?.user_template ?? "{{input}}");
  }, [latest?.id]);
  const shown = pvs.find((p) => p.id === viewing);
  const dirty = system !== (latest?.system_prompt ?? "") || template !== (latest?.user_template ?? "");

  async function submit() {
    if (!template.includes("{{input}}")) {
      toast.error("User template must include {{input}}");
      return;
    }
    if (!note.trim()) {
      toast.error("Add a short change note");
      return;
    }
    setBusy(true);
    try {
      const r = await save({ data: { taskId, system, template, note: note.trim() } });
      setNote("");
      await qc.invalidateQueries({ queryKey: ["task", taskId] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success(`Saved as v${r.version}`);
    } catch (e) {
      toast.error("Couldn't save prompt", { description: errMsg(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <div className="space-y-4 rounded-lg border bg-card p-5 shadow-card">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Edit prompt</h3>
          <span className="text-xs text-muted-foreground">Editing from v{latest?.version ?? 0}; saving creates v{(latest?.version ?? 0) + 1}</span>
        </div>
        <div className="space-y-1.5">
          <Label>System prompt</Label>
          <Textarea className="num min-h-32 text-xs" value={system} onChange={(e) => setSystem(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>User template <span className="text-muted-foreground">(must contain {"{{input}}"})</span></Label>
          <Textarea className="num min-h-24 text-xs" value={template} onChange={(e) => setTemplate(e.target.value)} />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input placeholder="Change note, e.g. Tightened output format" value={note} onChange={(e) => setNote(e.target.value)} />
          <Button onClick={submit} disabled={busy || !dirty}>{busy ? "Saving…" : "Save new version"}</Button>
        </div>
        {!dirty && <p className="text-xs text-muted-foreground">Edit the prompt to enable saving.</p>}
      </div>
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Versions</h3>
        {pvs.map((p) => (
          <button
            key={p.id}
            onClick={() => setViewing(viewing === p.id ? null : p.id)}
            className={`w-full rounded-md border p-3 text-left text-sm transition-colors hover:bg-muted ${viewing === p.id ? "border-primary bg-accent" : "bg-card"}`}
          >
            <div className="flex items-center justify-between">
              <span className="num font-medium">v{p.version}</span>
              <span className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{p.change_note}</p>
          </button>
        ))}
      </div>
      {shown && (
        <div className="rounded-lg border bg-muted/50 p-5 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold">v{shown.version} — {shown.change_note}</h3>
            <Button variant="outline" size="sm" onClick={() => { setSystem(shown.system_prompt); setTemplate(shown.user_template); }}>
              Load into editor
            </Button>
          </div>
          <p className="text-xs font-medium text-muted-foreground">System</p>
          <pre className="num mt-1 whitespace-pre-wrap rounded bg-card p-3 text-xs">{shown.system_prompt || "(empty)"}</pre>
          <p className="mt-3 text-xs font-medium text-muted-foreground">User template</p>
          <pre className="num mt-1 whitespace-pre-wrap rounded bg-card p-3 text-xs">{shown.user_template}</pre>
        </div>
      )}
    </div>
  );
}

type TI = { id?: string; input: string; reference: string | null };

function InputsTab({ taskId, inputs }: { taskId: string; inputs: { id: string; input: string; reference: string | null }[] }) {
  const [rows, setRows] = useState<TI[]>(inputs);
  const [busy, setBusy] = useState(false);
  const save = useServerFn(saveTestInputs);
  const qc = useQueryClient();
  useEffect(() => setRows(inputs), [inputs]);
  const valid = rows.length >= 5 && rows.length <= 20 && rows.every((r) => r.input.trim());

  async function submit() {
    setBusy(true);
    try {
      await save({ data: { taskId, inputs: rows.map((r) => ({ ...r, input: r.input.trim(), reference: r.reference?.trim() || null })) } });
      await qc.invalidateQueries({ queryKey: ["task", taskId] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Test inputs saved");
    } catch (e) {
      toast.error("Couldn't save inputs", { description: errMsg(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">5–20 inputs. Reference answers are optional but help the grader.</p>
      {rows.length === 0 && <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">No inputs yet — add at least 5.</div>}
      {rows.map((r, i) => (
        <div key={r.id ?? `new-${i}`} className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-[2rem_1fr_1fr_auto]">
          <span className="num text-sm text-muted-foreground">#{i + 1}</span>
          <div className="space-y-1">
            <Label className="text-xs">Input</Label>
            <Textarea className="min-h-20 text-sm" value={r.input} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, input: e.target.value } : x)))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Reference answer (optional)</Label>
            <Textarea className="num min-h-20 text-xs" value={r.reference ?? ""} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, reference: e.target.value } : x)))} />
          </div>
          <Button variant="ghost" size="icon" aria-label="Remove input" onClick={() => setRows(rows.filter((_, j) => j !== i))}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" disabled={rows.length >= 20} onClick={() => setRows([...rows, { input: "", reference: "" }])}>
          <Plus className="size-4" /> Add input
        </Button>
        <Button onClick={submit} disabled={busy || !valid}>{busy ? "Saving…" : "Save inputs"}</Button>
        <span className="num text-xs text-muted-foreground">{rows.length} / 20</span>
        {!valid && <span className="text-xs text-destructive">Need 5–20 non-empty inputs.</span>}
      </div>
    </div>
  );
}

function RubricTab({ taskId, rubric, threshold }: { taskId: string; rubric: string; threshold: number }) {
  const [text, setText] = useState(rubric);
  const [th, setTh] = useState(threshold);
  const [busy, setBusy] = useState(false);
  const save = useServerFn(saveRubric);
  const qc = useQueryClient();
  async function submit() {
    setBusy(true);
    try {
      await save({ data: { taskId, rubric: text, threshold: th } });
      await qc.invalidateQueries({ queryKey: ["task", taskId] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Rubric saved");
    } catch (e) {
      toast.error("Couldn't save rubric", { description: errMsg(e) });
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="max-w-3xl space-y-4 rounded-lg border bg-card p-5 shadow-card">
      <div className="space-y-1.5">
        <Label>Grading criteria</Label>
        <Textarea className="min-h-48 text-sm" value={text} onChange={(e) => setText(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label>Pass threshold (score ≥ this passes)</Label>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <Button key={n} variant={th === n ? "default" : "outline"} size="sm" className="num w-10" onClick={() => setTh(n)}>
              {n}
            </Button>
          ))}
        </div>
      </div>
      <Button onClick={submit} disabled={busy || !text.trim()}>{busy ? "Saving…" : "Save rubric"}</Button>
    </div>
  );
}

function RunsTab({ runs, taskId }: { runs: { id: string; created_at: string; status: string; models: string[]; prompt_version: number; is_seed: boolean }[]; taskId: string }) {
  const prices = useQuery(pricesQuery);
  const name = (m: string) => prices.data?.find((p) => p.model_id === m)?.friendly_name ?? m;
  if (!runs.length)
    return (
      <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
        No runs yet.{" "}
        <Link to="/runs/new" search={{ taskId }} className="text-primary underline">Start the first run</Link>
      </div>
    );
  return (
    <div className="divide-y rounded-lg border bg-card">
      {runs.map((r) => (
        <Link key={r.id} to="/runs/$runId" params={{ runId: r.id }} className="flex flex-col gap-2 p-4 hover:bg-muted sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium">
              {new Date(r.created_at).toLocaleString()}
              {r.is_seed && <Badge variant="outline">sample run</Badge>}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">Prompt v{r.prompt_version} · {r.models.map(name).join(", ")}</p>
          </div>
          <StatusBadge status={r.status} />
        </Link>
      ))}
    </div>
  );
}

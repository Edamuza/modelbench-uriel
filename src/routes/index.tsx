import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PageHeader, LoadingBlock, ErrorBlock } from "@/components/AppShell";
import { tasksQuery, pricesQuery, settingsQuery, callsForRunsQuery } from "@/lib/queries";
import { summarize, recommend } from "@/lib/metrics";
import { createTask } from "@/lib/bench.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Tasks — ModelBench" },
      { name: "description", content: "Business tasks benchmarked across LLMs, with the recommended model for each." },
      { property: "og:title", content: "Tasks — ModelBench" },
      { property: "og:description", content: "Which model should we use, and what will it cost? Compare LLMs per task." },
    ],
  }),
  component: TasksPage,
});

function TasksPage() {
  const q = useQuery(tasksQuery);
  const prices = useQuery(pricesQuery);
  const settings = useQuery(settingsQuery);
  const runs = q.data?.runs ?? [];
  const latestCompleted = q.data
    ? q.data.tasks
        .map((t) => runs.find((r) => r.task_id === t.id && r.status === "completed"))
        .filter((r): r is NonNullable<typeof r> => !!r)
    : [];
  const calls = useQuery(callsForRunsQuery(latestCompleted.map((r) => r.id)));

  return (
    <>
      <PageHeader
        title="Tasks"
        sub="Each task is one business job. Run it across models to see which one is good enough — and cheapest."
        actions={<NewTaskButton />}
      />
      {q.isLoading ? (
        <LoadingBlock label="Loading tasks…" />
      ) : q.error ? (
        <ErrorBlock error={q.error} retry={() => q.refetch()} />
      ) : !q.data?.tasks.length ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          No tasks yet. Create one, or use “Reset demo” to restore the samples.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {q.data.tasks.map((t) => {
            const pv = Math.max(0, ...q.data.pvs.filter((p) => p.task_id === t.id).map((p) => p.version));
            const n = q.data.inputs.filter((i) => i.task_id === t.id).length;
            const last = runs.find((r) => r.task_id === t.id);
            const lastDone = latestCompleted.find((r) => r.task_id === t.id);
            let rec: string | null = null;
            if (lastDone && calls.data && prices.data && settings.data) {
              const s = summarize(
                calls.data.filter((c) => c.run_id === lastDone.id),
                lastDone.models,
                prices.data,
                t.pass_threshold,
              );
              rec = recommend(s, settings.data.pass_rate_target).cheapest?.name ?? "None met target";
            }
            return (
              <Link
                key={t.id}
                to="/tasks/$taskId"
                params={{ taskId: t.id }}
                className="group flex flex-col rounded-lg border bg-card p-5 shadow-card transition-colors hover:border-primary/50"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-semibold leading-snug">{t.name}</h2>
                  <Badge variant="secondary" className="num shrink-0">v{pv}</Badge>
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{t.description}</p>
                <dl className="mt-4 grid grid-cols-2 gap-3 border-t pt-4 text-xs">
                  <div>
                    <dt className="text-muted-foreground">Test inputs</dt>
                    <dd className="num mt-0.5 text-sm">{n}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Last run</dt>
                    <dd className="mt-0.5 text-sm">{last ? new Date(last.created_at).toLocaleDateString() : "Never"}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-muted-foreground">Recommended model</dt>
                    <dd className="mt-0.5 text-sm font-medium text-primary">
                      {lastDone ? rec ?? "Calculating…" : "Run it to find out"}
                    </dd>
                  </div>
                </dl>
                <span className="mt-4 inline-flex items-center gap-1 text-sm text-primary opacity-80 group-hover:opacity-100">
                  Open task <ArrowRight className="size-3.5" />
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}

function NewTaskButton() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const create = useServerFn(createTask);
  const qc = useQueryClient();
  const nav = useNavigate();
  async function submit() {
    if (!name.trim()) return toast.error("Give the task a name");
    setBusy(true);
    try {
      const r = await create({ data: { name: name.trim(), description: desc.trim() } });
      await qc.invalidateQueries({ queryKey: ["tasks"] });
      setOpen(false);
      toast.success("Task created — add at least 5 test inputs next");
      nav({ to: "/tasks/$taskId", params: { taskId: r.id }, search: { tab: "inputs" } });
    } catch (e) {
      toast.error("Couldn't create task", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" /> New task
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input placeholder="e.g. Draft a reply to a complaint" value={name} onChange={(e) => setName(e.target.value)} />
          <Textarea placeholder="What should the model do, and for whom?" value={desc} onChange={(e) => setDesc(e.target.value)} />
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={busy}>{busy ? "Creating…" : "Create task"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { executeCall, finalizePending, gradeCall, setRunStatus } from "./bench.functions";
import type { Call } from "./metrics";

const CONCURRENCY = 4;

async function pool<T>(items: T[], n: number, fn: (t: T) => Promise<boolean>) {
  let i = 0;
  let stop = false;
  const worker = async () => {
    while (!stop && i < items.length) {
      const item = items[i++] as T;
      const keep = await fn(item);
      if (!keep) stop = true;
    }
  };
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
  return !stop;
}

// Drives a run from the browser: one server call per model request (keeps each
// request short), small concurrency, then grading. Resumes if the page reloads.
export function useRunExecutor(runId: string, status: string | undefined, calls: Call[] | undefined) {
  const exec = useServerFn(executeCall);
  const grade = useServerFn(gradeCall);
  const setStatus = useServerFn(setRunStatus);
  const finalize = useServerFn(finalizePending);
  const qc = useQueryClient();
  const started = useRef(false);
  const [phase, setPhase] = useState<"idle" | "calling" | "grading" | "done">("idle");
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!calls || !status || status === "completed" || started.current) return;
    started.current = true;
    const refresh = () => qc.invalidateQueries({ queryKey: ["run", runId] });
    let warned429 = false;

    (async () => {
      try {
        const pending = calls.filter((c) => c.status === "pending");
        let abort: string | null = null;
        if (pending.length) {
          setPhase("calling");
          setTotal(calls.length);
          setDone(calls.length - pending.length);
          await setStatus({ data: { runId, status: "running" } });
          await pool(pending, CONCURRENCY, async (c) => {
            try {
              const r = await exec({ data: { callId: c.id } });
              if (!r.ok && r.code === 429 && !warned429) {
                warned429 = true;
                toast.warning("Rate limited", { description: "Some calls hit the rate limit and were marked failed." });
              }
              if (!r.ok && (r.code === 402 || r.code === 401)) {
                abort = r.message;
                toast.error("Run stopped", { description: r.message });
                return false;
              }
            } catch (e) {
              toast.error("A model call errored", { description: e instanceof Error ? e.message : String(e) });
            }
            setDone((d) => d + 1);
            refresh();
            return true;
          });
        }
        await finalize({ data: { runId, mode: "calls" } });
        if (abort) {
          await setStatus({ data: { runId, status: "completed", abortReason: `Not run: ${abort}` } });
          setPhase("done");
          refresh();
          qc.invalidateQueries({ queryKey: ["tasks"] });
          return;
        }
        // Re-read fresh rows to know which outputs need grading.
        const fresh = (await qc.fetchQuery({ queryKey: ["run", runId] }).catch(() => null)) as { calls: Call[] } | null;
        const toGrade = (fresh?.calls ?? calls).filter((c) => c.status === "ok" && c.grade_status === "pending");
        if (toGrade.length) {
          setPhase("grading");
          setTotal(toGrade.length);
          setDone(0);
          await setStatus({ data: { runId, status: "grading" } });
          await pool(toGrade, CONCURRENCY, async (c) => {
            try {
              const r = await grade({ data: { callId: c.id } });
              if (!r.ok && r.code === 402) {
                abort = r.message;
                toast.error("Grading stopped", { description: r.message });
                return false;
              }
            } catch (e) {
              toast.error("Grading errored", { description: e instanceof Error ? e.message : String(e) });
            }
            setDone((d) => d + 1);
            refresh();
            return true;
          });
        }
        await finalize({ data: { runId, mode: "grades" } });
        await setStatus({ data: { runId, status: "completed", abortReason: abort ? `Not graded: ${abort}` : undefined } });
        setPhase("done");
        toast.success("Run complete");
      } catch (e) {
        toast.error("Run failed", { description: e instanceof Error ? e.message : String(e) });
        await setStatus({ data: { runId, status: "completed", abortReason: "Run interrupted" } }).catch(() => {});
        setPhase("done");
      } finally {
        refresh();
        qc.invalidateQueries({ queryKey: ["tasks"] });
      }
    })();
  }, [calls, status, runId]);

  return { phase, done, total };
}

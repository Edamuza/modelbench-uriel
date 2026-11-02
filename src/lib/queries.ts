import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Call, Price } from "./metrics";

function ok<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data as T;
}

export const pricesQuery = queryOptions({
  queryKey: ["prices"],
  queryFn: async () => ok(await supabase.from("prices").select("*").order("sort")) as Price[],
});

export const settingsQuery = queryOptions({
  queryKey: ["settings"],
  queryFn: async () => {
    const res = await supabase.from("settings").select("*").eq("id", 1).maybeSingle();
    if (res.error) throw new Error(res.error.message);
    const r = res.data;
    return { php_rate: Number(r?.php_rate ?? 58), pass_rate_target: Number(r?.pass_rate_target ?? 80) };
  },
});

export const tasksQuery = queryOptions({
  queryKey: ["tasks"],
  queryFn: async () => {
    const [tasks, pvs, inputs, runs] = await Promise.all([
      supabase.from("tasks").select("*").order("created_at"),
      supabase.from("prompt_versions").select("task_id, version"),
      supabase.from("test_inputs").select("task_id"),
      supabase.from("runs").select("id, task_id, status, created_at, models").order("created_at", { ascending: false }),
    ]);
    return { tasks: ok(tasks), pvs: ok(pvs), inputs: ok(inputs), runs: ok(runs) };
  },
});

export const taskQuery = (id: string) =>
  queryOptions({
    queryKey: ["task", id],
    queryFn: async () => {
      const [task, pvs, inputs, runs] = await Promise.all([
        supabase.from("tasks").select("*").eq("id", id).maybeSingle(),
        supabase.from("prompt_versions").select("*").eq("task_id", id).order("version", { ascending: false }),
        supabase.from("test_inputs").select("*").eq("task_id", id).order("position"),
        supabase.from("runs").select("*").eq("task_id", id).order("created_at", { ascending: false }),
      ]);
      return { task: ok(task), pvs: ok(pvs), inputs: ok(inputs), runs: ok(runs) };
    },
  });

export const runQuery = (id: string) =>
  queryOptions({
    queryKey: ["run", id],
    queryFn: async () => {
      const run = ok(await supabase.from("runs").select("*, tasks(name, pass_threshold)").eq("id", id).maybeSingle());
      const calls = ok(await supabase.from("run_calls").select("*").eq("run_id", id).order("input_position")) as Call[];
      return { run, calls };
    },
  });

// Latest run's call rows for a set of runs — used to show the recommended model on the Tasks list.
export const callsForRunsQuery = (runIds: string[]) =>
  queryOptions({
    queryKey: ["calls-for-runs", runIds],
    enabled: runIds.length > 0,
    queryFn: async () =>
      ok(await supabase.from("run_calls").select("*").in("run_id", runIds)) as (Call & { run_id: string })[],
  });

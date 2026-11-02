import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Demo data is read through the server so tables need no anonymous database access.
async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}
function ok<R extends { data: unknown; error: { message: string } | null }>(r: R): R["data"] {
  if (r.error) throw new Error(r.error.message);
  return r.data;
}

export const getPrices = createServerFn({ method: "GET" }).handler(async () => {
  const db = await admin();
  return ok(await db.from("prices").select("*").order("sort")) ?? [];
});

export const getSettings = createServerFn({ method: "GET" }).handler(async () => {
  const db = await admin();
  const r = ok(await db.from("settings").select("*").eq("id", 1).maybeSingle());
  return { php_rate: Number(r?.php_rate ?? 58), pass_rate_target: Number(r?.pass_rate_target ?? 80) };
});

export const getTasks = createServerFn({ method: "GET" }).handler(async () => {
  const db = await admin();
  const [tasks, pvs, inputs, runs] = await Promise.all([
    db.from("tasks").select("*").order("created_at"),
    db.from("prompt_versions").select("task_id, version"),
    db.from("test_inputs").select("task_id"),
    db.from("runs").select("id, task_id, status, created_at, models").order("created_at", { ascending: false }),
  ]);
  return { tasks: ok(tasks) ?? [], pvs: ok(pvs) ?? [], inputs: ok(inputs) ?? [], runs: ok(runs) ?? [] };
});

export const getTask = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id: z.string().uuid() }).parse)
  .handler(async ({ data }) => {
    const db = await admin();
    const [task, pvs, inputs, runs] = await Promise.all([
      db.from("tasks").select("*").eq("id", data.id).maybeSingle(),
      db.from("prompt_versions").select("*").eq("task_id", data.id).order("version", { ascending: false }),
      db.from("test_inputs").select("*").eq("task_id", data.id).order("position"),
      db.from("runs").select("*").eq("task_id", data.id).order("created_at", { ascending: false }),
    ]);
    return { task: ok(task), pvs: ok(pvs) ?? [], inputs: ok(inputs) ?? [], runs: ok(runs) ?? [] };
  });

export const getRun = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id: z.string().uuid() }).parse)
  .handler(async ({ data }) => {
    const db = await admin();
    const run = ok(await db.from("runs").select("*, tasks(name, pass_threshold)").eq("id", data.id).maybeSingle());
    const calls = ok(await db.from("run_calls").select("*").eq("run_id", data.id).order("input_position")) ?? [];
    return { run, calls };
  });

export const getCallsForRuns = createServerFn({ method: "GET" })
  .inputValidator(z.object({ ids: z.array(z.string().uuid()).max(100) }).parse)
  .handler(async ({ data }) => {
    if (!data.ids.length) return [];
    const db = await admin();
    return ok(await db.from("run_calls").select("*").in("run_id", data.ids)) ?? [];
  });

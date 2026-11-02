import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Public demo: no login. All writes go through these server functions using the
// service-role client; RLS keeps tables read-only for anonymous browsers.
async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function check<R extends { data: unknown; error: { message: string } | null }>(r: R): NonNullable<R["data"]> {
  if (r.error) throw new Error(r.error.message);
  return r.data as NonNullable<R["data"]>;
}

export const createTask = createServerFn({ method: "POST" })
  .inputValidator(z.object({ name: z.string().min(1).max(120), description: z.string().max(500) }).parse)
  .handler(async ({ data }) => {
    const db = await admin();
    const t = check(
      await db
        .from("tasks")
        .insert({
          name: data.name,
          description: data.description,
          rubric: "5 = fully correct and well formatted.\n3 = partially correct.\n1 = wrong or unusable.",
        })
        .select("id")
        .single(),
    );
    check(
      await db.from("prompt_versions").insert({
        task_id: t.id,
        version: 1,
        system_prompt: "You are a helpful assistant.",
        user_template: "{{input}}",
        change_note: "Initial draft",
      }),
    );
    return { id: t.id };
  });

export const savePromptVersion = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      taskId: z.string().uuid(),
      system: z.string().max(8000),
      template: z.string().min(1).max(8000),
      note: z.string().max(300),
    }).parse,
  )
  .handler(async ({ data }) => {
    if (!data.template.includes("{{input}}")) throw new Error("The user template must contain {{input}}.");
    const db = await admin();
    const last = check(
      await db.from("prompt_versions").select("version").eq("task_id", data.taskId).order("version", { ascending: false }).limit(1),
    );
    const version = (last[0]?.version ?? 0) + 1;
    check(
      await db.from("prompt_versions").insert({
        task_id: data.taskId,
        version,
        system_prompt: data.system,
        user_template: data.template,
        change_note: data.note || `Version ${version}`,
      }),
    );
    return { version };
  });

export const saveTestInputs = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      taskId: z.string().uuid(),
      inputs: z
        .array(z.object({ id: z.string().uuid().optional(), input: z.string().min(1).max(4000), reference: z.string().max(4000).nullable() }))
        .min(5)
        .max(20),
    }).parse,
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const existing = check(await db.from("test_inputs").select("id").eq("task_id", data.taskId));
    const keep = new Set(data.inputs.filter((i) => i.id).map((i) => i.id));
    const remove = existing.filter((e) => !keep.has(e.id)).map((e) => e.id);
    if (remove.length) check(await db.from("test_inputs").delete().in("id", remove));
    for (const [idx, i] of data.inputs.entries()) {
      const row = { task_id: data.taskId, position: idx + 1, input: i.input, reference: i.reference || null };
      if (i.id) check(await db.from("test_inputs").update(row).eq("id", i.id));
      else check(await db.from("test_inputs").insert(row));
    }
    return { ok: true };
  });

export const saveRubric = createServerFn({ method: "POST" })
  .inputValidator(z.object({ taskId: z.string().uuid(), rubric: z.string().min(1).max(4000), threshold: z.number().int().min(1).max(5) }).parse)
  .handler(async ({ data }) => {
    const db = await admin();
    check(await db.from("tasks").update({ rubric: data.rubric, pass_threshold: data.threshold }).eq("id", data.taskId));
    return { ok: true };
  });

export const createRun = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({ taskId: z.string().uuid(), promptVersionId: z.string().uuid(), models: z.array(z.string()).min(2).max(4) }).parse,
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const prices = check(await db.from("prices").select("model_id"));
    const allowed = new Set(prices.map((p) => p.model_id));
    if (!data.models.every((m) => allowed.has(m))) throw new Error("Unknown model selected.");
    const pv = check(await db.from("prompt_versions").select("id, version, task_id").eq("id", data.promptVersionId).single());
    if (pv.task_id !== data.taskId) throw new Error("Prompt version does not belong to this task.");
    const inputs = check(await db.from("test_inputs").select("*").eq("task_id", data.taskId).order("position"));
    if (inputs.length < 1) throw new Error("This task has no test inputs.");
    const run = check(
      await db
        .from("runs")
        .insert({ task_id: data.taskId, prompt_version_id: pv.id, prompt_version: pv.version, models: data.models, status: "running" })
        .select("id")
        .single(),
    );
    const rows = inputs.flatMap((i) =>
      data.models.map((m) => ({
        run_id: run.id,
        test_input_id: i.id,
        input_position: i.position,
        input_text: i.input,
        reference: i.reference,
        model_id: m,
      })),
    );
    check(await db.from("run_calls").insert(rows));
    return { runId: run.id };
  });

export const executeCall = createServerFn({ method: "POST" })
  .inputValidator(z.object({ callId: z.string().uuid() }).parse)
  .handler(async ({ data }) => {
    const db = await admin();
    const { callModel } = await import("./ai.server");
    const call = check(await db.from("run_calls").select("*, runs(prompt_version_id)").eq("id", data.callId).single());
    if (call.status !== "pending") return { ok: true, status: call.status, code: 0, message: "" };
    const pvId = (call.runs as { prompt_version_id: string | null } | null)?.prompt_version_id;
    const pv = check(await db.from("prompt_versions").select("*").eq("id", pvId ?? "").single());
    const userMsg = pv.user_template.split("{{input}}").join(call.input_text);
    const r = await callModel(call.model_id, pv.system_prompt, userMsg);
    if (!r.ok) {
      check(
        await db
          .from("run_calls")
          .update({ status: "failed", error: r.message, latency_ms: r.latencyMs, grade_status: "skipped", input_tokens: 0, output_tokens: 0 })
          .eq("id", call.id),
      );
      return { ok: false, status: "failed", code: r.status, message: r.message };
    }
    const estimated = r.inputTokens == null || r.outputTokens == null;
    const inTok = r.inputTokens ?? Math.ceil((pv.system_prompt.length + userMsg.length) / 4);
    const outTok = r.outputTokens ?? Math.ceil(r.text.length / 4);
    check(
      await db
        .from("run_calls")
        .update({ status: "ok", output: r.text, latency_ms: r.latencyMs, input_tokens: inTok, output_tokens: outTok, tokens_estimated: estimated })
        .eq("id", call.id),
    );
    return { ok: true, status: "ok", code: 0, message: "" };
  });

export const gradeCall = createServerFn({ method: "POST" })
  .inputValidator(z.object({ callId: z.string().uuid() }).parse)
  .handler(async ({ data }) => {
    const db = await admin();
    const { gradeOutput } = await import("./ai.server");
    const call = check(await db.from("run_calls").select("*, runs(task_id)").eq("id", data.callId).single());
    if (call.status !== "ok" || call.grade_status !== "pending") return { ok: true, code: 0, message: "" };
    const taskId = (call.runs as { task_id: string } | null)?.task_id ?? "";
    const task = check(await db.from("tasks").select("rubric, pass_threshold").eq("id", taskId).single());
    const g = await gradeOutput({
      rubric: task.rubric,
      threshold: task.pass_threshold,
      input: call.input_text,
      reference: call.reference,
      output: call.output ?? "",
    });
    if (!g.ok) {
      check(await db.from("run_calls").update({ grade_status: "failed", reason: `Grading failed: ${g.message}` }).eq("id", call.id));
      return { ok: false, code: g.status, message: g.message };
    }
    check(await db.from("run_calls").update({ grade_status: "graded", score: g.score, reason: g.reason }).eq("id", call.id));
    return { ok: true, code: 0, message: "" };
  });

async function failPending(db: Awaited<ReturnType<typeof admin>>, runId: string, mode: "calls" | "grades", reason?: string) {
  if (mode === "calls")
    check(
      await db
        .from("run_calls")
        .update({ status: "failed", error: reason ?? "Call did not complete", grade_status: "skipped", input_tokens: 0, output_tokens: 0 })
        .eq("run_id", runId)
        .eq("status", "pending"),
    );
  check(
    await db
      .from("run_calls")
      .update({ grade_status: "failed", reason: reason ?? "Grading did not complete" })
      .eq("run_id", runId)
      .eq("grade_status", "pending"),
  );
}

// Marks leftover pending rows as failed after a phase so nothing stays stuck.
export const finalizePending = createServerFn({ method: "POST" })
  .inputValidator(z.object({ runId: z.string().uuid(), mode: z.enum(["calls", "grades"]) }).parse)
  .handler(async ({ data }) => {
    const db = await admin();
    if (data.mode === "calls") {
      check(
        await db
          .from("run_calls")
          .update({ status: "failed", error: "Call did not complete", grade_status: "skipped", input_tokens: 0, output_tokens: 0 })
          .eq("run_id", data.runId)
          .eq("status", "pending"),
      );
    } else {
      await failPending(db, data.runId, "grades");
    }
    return { ok: true };
  });

export const setRunStatus = createServerFn({ method: "POST" })
  .inputValidator(z.object({ runId: z.string().uuid(), status: z.enum(["running", "grading", "completed"]), abortReason: z.string().max(300).optional() }).parse)
  .handler(async ({ data }) => {
    const db = await admin();
    // A completed run never contains pending rows.
    if (data.status === "completed" || data.abortReason) {
      await failPending(db, data.runId, "calls", data.abortReason);
      await failPending(db, data.runId, "grades", data.abortReason);
    }
    check(
      await db
        .from("runs")
        .update({ status: data.status, completed_at: data.status === "completed" ? new Date().toISOString() : null })
        .eq("id", data.runId),
    );
    return { ok: true };
  });

export const updatePrice = createServerFn({ method: "POST" })
  .inputValidator(z.object({ modelId: z.string(), input: z.number().min(0).max(1000), output: z.number().min(0).max(1000) }).parse)
  .handler(async ({ data }) => {
    const db = await admin();
    check(await db.from("prices").update({ input_per_m: data.input, output_per_m: data.output }).eq("model_id", data.modelId));
    return { ok: true };
  });

export const updateSettings = createServerFn({ method: "POST" })
  .inputValidator(z.object({ phpRate: z.number().min(1).max(1000), passRateTarget: z.number().min(0).max(100) }).parse)
  .handler(async ({ data }) => {
    const db = await admin();
    check(await db.from("settings").update({ php_rate: data.phpRate, pass_rate_target: data.passRateTarget }).eq("id", 1));
    return { ok: true };
  });

export const resetDemo = createServerFn({ method: "POST" }).handler(async () => {
  const db = await admin();
  const r = await db.rpc("reset_demo");
  if (r.error) throw new Error(r.error.message);
  return { ok: true };
});

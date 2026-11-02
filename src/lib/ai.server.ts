// Server-only Lovable AI Gateway helpers. Never import from client code.
const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

export type ModelResult =
  | {
      ok: true;
      text: string;
      latencyMs: number;
      inputTokens: number | null;
      outputTokens: number | null;
    }
  | { ok: false; status: number; message: string; latencyMs: number };

function friendlyError(status: number, body: string): string {
  if (status === 429) return "Rate limited by the AI gateway (429). Try again in a moment.";
  if (status === 402) return "AI credits exhausted (402). Add credits in Settings → Plans & credits.";
  if (status === 403) return "This model is not available for this workspace (403).";
  if (status === 400) return "The model rejected the request (400).";
  if (status >= 500) return `AI provider error (${status}).`;
  try {
    const j = JSON.parse(body);
    return j?.error?.message ?? j?.message ?? `Request failed (${status})`;
  } catch {
    return `Request failed (${status})`;
  }
}

export async function callModel(
  model: string,
  system: string,
  user: string,
): Promise<ModelResult> {
  const key = process.env["LOVABLE_API_KEY"];
  const start = Date.now();
  if (!key) return { ok: false, status: 401, message: "AI key is not configured.", latencyMs: 0 };
  const body: Record<string, unknown> = {
    model,
    stream: true,
    stream_options: { include_usage: true },
    messages: [
      ...(system ? [{ role: "system", content: system }] : []),
      { role: "user", content: user },
    ],
  };
  if (model.startsWith("openai/")) body["reasoning_effort"] = "low";
  let res: Response;
  try {
    res = await fetch(GATEWAY, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    return { ok: false, status: 0, message: "Network error reaching the AI gateway.", latencyMs: Date.now() - start };
  }
  if (!res.ok || !res.body) {
    const t = await res.text().catch(() => "");
    console.error("AI gateway error", model, res.status, t.slice(0, 300));
    return { ok: false, status: res.status, message: friendlyError(res.status, t), latencyMs: Date.now() - start };
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let text = "";
  let inTok: number | null = null;
  let outTok: number | null = null;
  let streamErr: string | null = null;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (data === "[DONE]") continue;
      try {
        const j = JSON.parse(data);
        if (j.error) streamErr = j.error.message ?? "Stream error";
        const d = j.choices?.[0]?.delta?.content;
        if (typeof d === "string") text += d;
        if (j.usage) {
          inTok = j.usage.prompt_tokens ?? inTok;
          outTok = j.usage.completion_tokens ?? outTok;
        }
      } catch {
        /* partial frame ignored */
      }
    }
  }
  const latencyMs = Date.now() - start;
  if (streamErr && !text) return { ok: false, status: 500, message: streamErr, latencyMs };
  if (!text.trim()) return { ok: false, status: 200, message: "Model returned an empty response (possibly refused).", latencyMs };
  return { ok: true, text, latencyMs, inputTokens: inTok, outputTokens: outTok };
}

export const GRADER_MODEL = "google/gemini-3-flash-preview";

export async function gradeOutput(args: {
  rubric: string;
  threshold: number;
  input: string;
  reference: string | null;
  output: string;
}): Promise<{ ok: true; score: number; reason: string } | { ok: false; status: number; message: string }> {
  const system =
    'You are a strict, fair grader. Score the candidate output from 1 to 5 using the rubric. Reply with JSON only: {"score": <1-5 integer>, "reason": "<one short sentence>"}';
  const user = `RUBRIC:\n${args.rubric}\n\nTEST INPUT:\n${args.input}\n\nREFERENCE ANSWER:\n${args.reference ?? "(none provided)"}\n\nCANDIDATE OUTPUT:\n${args.output}\n\nReturn the JSON now.`;
  const r = await callModel(GRADER_MODEL, system, user);
  if (!r.ok) return { ok: false, status: r.status, message: r.message };
  const m = r.text.match(/\{[\s\S]*\}/);
  try {
    const j = JSON.parse(m ? m[0] : r.text);
    const score = Math.max(1, Math.min(5, Math.round(Number(j.score))));
    if (!Number.isFinite(score)) throw new Error("bad score");
    return { ok: true, score, reason: String(j.reason ?? "").slice(0, 300) };
  } catch {
    return { ok: false, status: 200, message: "Grader returned unparseable output." };
  }
}

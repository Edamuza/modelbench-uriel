import { createFileRoute } from "@tanstack/react-router";
import { Github, Linkedin } from "lucide-react";
import { PageHeader } from "@/components/AppShell";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About this project — ModelBench" },
      { name: "description", content: "Why ModelBench exists, how it works, its architecture and next steps. By Uriel Papa." },
      { property: "og:title", content: "About ModelBench — by Uriel Papa" },
      { property: "og:description", content: "An LLM cost/speed/quality benchmarking tool built as an AI Solutions Engineer portfolio piece." },
    ],
  }),
  component: About,
});

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-3 border-t py-8 md:grid-cols-[180px_1fr]">
      <div>
        <span className="num text-xs text-primary">{n}</span>
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

function About() {
  return (
    <div className="max-w-4xl">
      <PageHeader title="About this project" sub="ModelBench — answering “Which model should we use, and what will it cost?”" />
      <Section n="01" title="The problem">
        <p>
          Every team adopting LLMs asks the same question. Picking by reputation usually means paying for a frontier
          model on a task a small model handles fine — often a 10–30× cost difference at production volume — or
          shipping a cheap model that quietly fails on edge cases.
        </p>
      </Section>
      <Section n="02" title="The approach">
        <p>
          Define the business task once: a versioned prompt, 5–20 realistic test inputs with reference answers, and a
          rubric. ModelBench runs every input on every chosen model, records latency, tokens and cost, then uses an
          <strong className="text-foreground"> LLM-as-judge</strong> grader (a fixed model) to score each output 1–5
          with a one-line reason.
        </p>
        <p>
          The recommendation is deliberately boring: the <em>cheapest</em> model whose pass rate clears the target —
          with the highest-quality and fastest models shown alongside, and every output inspectable side by side.
        </p>
      </Section>
      <Section n="03" title="Architecture">
        <pre className="num overflow-x-auto rounded-md bg-ink p-4 text-xs text-ink-foreground">{`Browser (React, TanStack Start)
   │  every read, write and AI call via server functions
   ▼
Server functions  ──►  Lovable AI Gateway  (models under test + grader)
   │
   ▼
Lovable Cloud database`}</pre>
        <p><strong className="text-foreground">Tables:</strong> tasks, prompt_versions, test_inputs, runs, run_calls, prices, settings — Row Level Security on, no direct browser access.</p>
        <p>
          <strong className="text-foreground">Server functions:</strong> read functions (getTasks, getTask, getRun, getPrices, getSettings), createTask, savePromptVersion, saveTestInputs,
          saveRubric, createRun, executeCall (one model call), gradeCall (one grade), setRunStatus, updatePrice,
          updateSettings, resetDemo. The browser orchestrates a run with a concurrency limit of 4, so each request stays
          short and a reload resumes where it left off. Costs are never stored — they are derived from token counts × the
          current price table.
        </p>
      </Section>
      <Section n="04" title="What I'd do next">
        <ul className="list-disc space-y-1 pl-5">
          <li>Move orchestration to a durable server-side queue with retries and per-provider rate limits.</li>
          <li>Calibrate the grader against human labels and report grader agreement; add exact-match checks for JSON tasks.</li>
          <li>Repeat runs to report variance and confidence intervals, not single-sample scores.</li>
          <li>Pull live provider prices, add auth and per-client workspaces, and export a shareable recommendation report.</li>
        </ul>
      </Section>
      <section className="flex flex-wrap items-center gap-4 border-t py-8 text-sm">
        <span>Built by <strong>Uriel Papa</strong></span>
        <a className="inline-flex items-center gap-1.5 text-primary hover:underline" href="https://github.com/Edamuza" target="_blank" rel="noreferrer"><Github className="size-4" /> github.com/Edamuza</a>
        <a className="inline-flex items-center gap-1.5 text-primary hover:underline" href="https://linkedin.com/in/uriel-papa-vitese01" target="_blank" rel="noreferrer"><Linkedin className="size-4" /> linkedin.com/in/uriel-papa-vitese01</a>
      </section>
    </div>
  );
}

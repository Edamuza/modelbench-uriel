# Modelbench Uriel

Build this complete app now, all screens and the backend, following the spec below. Use Lovable Cloud and Lovable AI; do not ask me for API keys.

# Project 5 — ModelBench: compare LLMs on cost, speed and quality for a business task

Build "ModelBench", a tool that answers the question every client asks an AI solutions engineer: "Which model should we use, and what will it cost?" It runs the same prompt and test inputs across several models, measures latency, tokens and estimated cost, grades quality with a rubric, and recommends the cheapest model that meets the quality bar.

## Screens
1. **Tasks** (home): list of tasks (name, description, number of test inputs, latest prompt version, last run date, recommended model). "New task" button.
2. **Task detail**: tabs:
   - Prompt: versioned system prompt + user template with a {{input}} placeholder. Saving creates a new version (v1, v2, …) with a change note; previous versions viewable.
   - Test inputs: editable list of 5–20 inputs, each with an optional reference answer.
   - Rubric: grading criteria (text) and a pass threshold on a 1–5 scale (default 4).
   - Runs: history of runs for this task.
3. **New run**: pick task, prompt version and 2–4 models from those available through Lovable AI (list them with friendly names; include at least one small/fast and one large model). "Run" executes every test input on every model through an edge function (in parallel with a small concurrency limit), recording per call: output, latency in ms, input tokens, output tokens (from the API usage field when present; otherwise estimate as characters ÷ 4 and mark as estimated), estimated cost from the price table, and status. Then an AI grader (fixed model) scores each output 1–5 against the rubric and reference answer with a one-line reason; pass = score ≥ threshold. Show live progress ("18 / 30 calls").
4. **Run results**: per-model summary table (avg quality score, pass rate %, avg latency, p95 latency, total tokens, cost for this run, projected cost per 1,000 runs); a scatter chart of avg quality (y) vs cost per 1,000 runs (x), one dot per model; a recommendation card: "Cheapest model that meets the pass-rate target (default 80%)" with the reasoning, plus "highest quality" and "fastest"; a side-by-side output viewer per test input (columns = models) with score and reason under each output.
5. **Prices**: editable table of models with input and output price per 1M tokens (USD) and a PHP rate (default 58), labelled "Example prices — edit to match your provider." Costs on all pages recompute from this table.
6. **About this project** (common requirements).

## Seed data (3 tasks, each with v1 and v2 prompts, 6 test inputs with reference answers, and a rubric)
1. "Classify customer emails" — output one label from {sales_inquiry, support, booking, refund, spam} plus one-sentence reason. Inputs: short fictional customer emails.
2. "Extract invoice fields to JSON" — output JSON {vendor, invoice_number, date, total}. Inputs: plain-text invoice snippets (fictional).
3. "Summarize a policy for employees" — 3 bullet summary under 60 words. Inputs: short fictional HR policy paragraphs.
Seed one completed run for task 1 so the results page has content on first visit (real outputs produced at seed time are fine, or realistic stored results clearly from an earlier run).

## Acceptance checks
- E1 Tasks page shows 3 seeded tasks; task 1 has a completed run whose results page shows the summary table, chart and recommendation.
- E2 Starting a new run on task 2 with 3 models completes all 18 calls with progress, then grades them, and the results page renders with costs that match the price table (spot-check one call: tokens × price).
- E3 Editing a model's price on Prices changes the run's cost figures.
- E4 Saving a prompt edit creates v3 and it can be selected for a run.
- E5 Side-by-side viewer shows each model's output, score and reason for a chosen input.
- E6 Failed model calls (if any) show as failed rows, not a stuck run.
- E7 Reset demo data, About page, mobile layout, no console errors.

# Common requirements for all five portfolio apps (append to every Lovable spec)

These apps are portfolio pieces for Uriel Papa, who is applying for AI Solutions Engineer / Forward-Deployed Engineer roles. A hiring manager will open the published link and click around with no login and no setup. Everything must work on first visit.

## Stack and backend
- Use Lovable Cloud for the database, file storage and edge functions.
- Use Lovable AI (Lovable's built-in AI gateway) for every model call. Do not ask for, or depend on, any external API key (no OpenAI/Anthropic/OpenRouter keys).
- All model calls happen in edge functions, never in the browser.
- No login. This is a public demo. Keep Row Level Security enabled on every table, with policies that let the demo work (anonymous read of demo data; writes go through edge functions or narrowly scoped anon policies). The project must pass Lovable's security scan so it can be published.
- Handle AI errors visibly: show a friendly error toast/message on rate limits (429), credits (402) or timeouts, never a blank screen or a spinner that never ends.

## Demo data
- Seed realistic sample data on first load (or via a migration) so every screen has content immediately. All sample businesses, people and documents are fictional and labeled as such.
- Add a "Reset demo data" action (with confirm) that restores the seed state.
- Show a slim banner: "Demo app — all sample data is fictional."

## Portfolio framing
- Add an "About this project" page reachable from the nav with four short sections: The problem (who has it, what it costs), The approach (how the app solves it, the AI pattern used), Architecture (frontend → edge functions → Lovable AI → database; list tables and functions), What I'd do next in a real deployment. Author: Uriel Papa, with links to github.com/Edamuza and linkedin.com/in/uriel-papa-vitese01.
- Clean, professional, responsive UI (works at 375px phone width and on desktop). Consistent nav. Empty states, loading states and error states for every async action.

## Quality bar
- No console errors on load. No broken routes. Every button does something real.
- Numbers shown in tables/KPIs must be computed from stored data, not hard-coded.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://modelbench-uriel.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/0efad481-3d74-490d-93f0-a7d88e8e089b).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

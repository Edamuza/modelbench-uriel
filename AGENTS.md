<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- No login: all tables are anon read-only via RLS; every write and AI call goes through `src/lib/bench.functions.ts` server functions using the service-role client — keeps the public demo safe.
- Model calls live only in `src/lib/ai.server.ts` (Lovable AI Gateway, streamed chat completions) — keeps keys server-side.
- Runs are orchestrated from the browser (`useRunExecutor`) one call per server request with a small concurrency limit — avoids worker timeouts and lets reloads resume.
- Costs are never stored; always derive them from tokens × the `prices` table via `src/lib/metrics.ts` — so price edits recompute everywhere.
- Demo seed lives in the `public.reset_demo()` SQL function; extend it there when seed data changes.

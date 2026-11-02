DROP POLICY "Public demo read" ON public.prices;
DROP POLICY "Public demo read" ON public.settings;
DROP POLICY "Public demo read" ON public.tasks;
DROP POLICY "Public demo read" ON public.prompt_versions;
DROP POLICY "Public demo read" ON public.test_inputs;
DROP POLICY "Public demo read" ON public.runs;
DROP POLICY "Public demo read" ON public.run_calls;
REVOKE SELECT ON public.prices, public.settings, public.tasks, public.prompt_versions, public.test_inputs, public.runs, public.run_calls FROM anon, authenticated;
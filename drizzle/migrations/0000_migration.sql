
CREATE TABLE public.prices (
  model_id text PRIMARY KEY,
  friendly_name text NOT NULL,
  size_tag text NOT NULL DEFAULT 'medium',
  input_per_m numeric NOT NULL DEFAULT 0,
  output_per_m numeric NOT NULL DEFAULT 0,
  sort int NOT NULL DEFAULT 0
);
CREATE TABLE public.settings (
  id int PRIMARY KEY DEFAULT 1,
  php_rate numeric NOT NULL DEFAULT 58,
  pass_rate_target numeric NOT NULL DEFAULT 80
);
CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  rubric text NOT NULL DEFAULT '',
  pass_threshold int NOT NULL DEFAULT 4,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.prompt_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  version int NOT NULL,
  system_prompt text NOT NULL DEFAULT '',
  user_template text NOT NULL DEFAULT '{{input}}',
  change_note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id, version)
);
CREATE TABLE public.test_inputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  position int NOT NULL DEFAULT 0,
  input text NOT NULL,
  reference text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  prompt_version_id uuid REFERENCES public.prompt_versions(id) ON DELETE SET NULL,
  prompt_version int NOT NULL DEFAULT 1,
  models text[] NOT NULL,
  status text NOT NULL DEFAULT 'running',
  is_seed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE TABLE public.run_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.runs(id) ON DELETE CASCADE,
  test_input_id uuid REFERENCES public.test_inputs(id) ON DELETE SET NULL,
  input_position int NOT NULL DEFAULT 0,
  input_text text NOT NULL,
  reference text,
  model_id text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  output text,
  error text,
  latency_ms int,
  input_tokens int,
  output_tokens int,
  tokens_estimated boolean NOT NULL DEFAULT false,
  score int,
  reason text,
  grade_status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.run_calls(run_id);
CREATE INDEX ON public.runs(task_id);
CREATE INDEX ON public.prompt_versions(task_id);
CREATE INDEX ON public.test_inputs(task_id);

GRANT SELECT ON public.prices, public.settings, public.tasks, public.prompt_versions, public.test_inputs, public.runs, public.run_calls TO anon, authenticated;
GRANT ALL ON public.prices, public.settings, public.tasks, public.prompt_versions, public.test_inputs, public.runs, public.run_calls TO service_role;

ALTER TABLE public.prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_inputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.run_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public demo read" ON public.prices FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public demo read" ON public.settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public demo read" ON public.tasks FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public demo read" ON public.prompt_versions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public demo read" ON public.test_inputs FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public demo read" ON public.runs FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public demo read" ON public.run_calls FOR SELECT TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION public.reset_demo()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  t1 uuid; t2 uuid; t3 uuid; pv uuid; r1 uuid;
  i int; m int;
  ins text[]; refs text[];
  mods text[] := ARRAY['google/gemini-3.1-flash-lite','google/gemini-3-flash-preview','openai/gpt-6-sol'];
  outs text[][];
  scores int[][];
  reasons text[][];
  lat int[][];
  otok int[][];
  itok int[] := ARRAY[96,104,92,101,88,99];
BEGIN
  DELETE FROM public.run_calls WHERE true;
  DELETE FROM public.runs WHERE true;
  DELETE FROM public.test_inputs WHERE true;
  DELETE FROM public.prompt_versions WHERE true;
  DELETE FROM public.tasks WHERE true;
  DELETE FROM public.prices WHERE true;
  DELETE FROM public.settings WHERE true;

  INSERT INTO public.settings(id, php_rate, pass_rate_target) VALUES (1, 58, 80);
  INSERT INTO public.prices(model_id, friendly_name, size_tag, input_per_m, output_per_m, sort) VALUES
   ('google/gemini-3.1-flash-lite','Gemini 3.1 Flash Lite','small',0.10,0.40,1),
   ('openai/gpt-6-luna','GPT-6 Luna','small',0.20,1.25,2),
   ('openai/gpt-5.4-mini','GPT-5.4 mini','small',0.25,2.00,3),
   ('google/gemini-3-flash-preview','Gemini 3 Flash','medium',0.50,3.00,4),
   ('openai/gpt-6-sol','GPT-6 Sol','large',1.50,10.00,5),
   ('google/gemini-3.1-pro-preview','Gemini 3.1 Pro','large',2.00,12.00,6);

  -- Task 1
  INSERT INTO public.tasks(name, description, rubric, pass_threshold, created_at) VALUES (
   'Classify customer emails',
   'Route inbound emails for a fictional travel agency (Bayview Travel Co.) into one of five queues.',
   E'5 = correct label from {sales_inquiry, support, booking, refund, spam} and a clear one-sentence reason.\n4 = correct label, reason slightly vague or a bit long.\n3 = label debatable but defensible, or extra text beyond the requested format.\n2 = wrong label but plausible.\n1 = wrong label, invalid label, or no label.',
   4, now() - interval '3 days') RETURNING id INTO t1;
  INSERT INTO public.prompt_versions(task_id, version, system_prompt, user_template, change_note, created_at) VALUES
   (t1, 1, 'You classify customer emails.', E'Classify this email: {{input}}', 'Initial draft', now() - interval '3 days'),
   (t1, 2, E'You are an email triage assistant for a travel agency. Choose exactly one label from: sales_inquiry, support, booking, refund, spam.\nRespond in the format:\nlabel: <label>\nreason: <one sentence>',
    E'Email:\n"""\n{{input}}\n"""', 'Constrained labels and fixed output format', now() - interval '2 days')
   ;
  SELECT id INTO pv FROM public.prompt_versions WHERE task_id = t1 AND version = 2;
  ins := ARRAY[
   'Hi, do you offer group packages to Palawan for 12 people in March? Looking for prices. — Marco (fictional)',
   'I was charged twice for booking #BT-4471. Please return the duplicate charge to my card.',
   'Can I move my Cebu flight from June 3 to June 5? Booking ref BT-5502.',
   'CONGRATULATIONS!!! You have won a FREE cruise. Click here to claim your prize now!!!',
   'The app keeps logging me out every time I try to view my itinerary. Using an iPhone 15.',
   'Please reserve 2 rooms at the Baguio Pine Lodge for Dec 20–23 under the name Reyes.'];
  refs := ARRAY['sales_inquiry','refund','booking','spam','support','booking'];
  outs := ARRAY[
   ARRAY['label: sales_inquiry\nreason: The customer asks about group package pricing.',
         'label: refund\nreason: The customer requests return of a duplicate charge.',
         'label: support\nreason: The customer needs help changing a flight.',
         'label: spam\nreason: Unsolicited prize message with a suspicious link.',
         'label: support\nreason: The customer reports an app login problem.',
         'label: booking\nreason: The customer wants to reserve hotel rooms.'],
   ARRAY['label: sales_inquiry\nreason: Prospective customer requesting prices for a group package.',
         'label: refund\nreason: Customer asks for a duplicate charge to be refunded.',
         'label: booking\nreason: Customer wants to change the date of an existing booking.',
         'label: spam\nreason: Generic prize-claim message typical of spam.',
         'label: support\nreason: Technical issue with the app logging the user out.',
         'label: booking\nreason: Request to reserve two hotel rooms for specific dates.'],
   ARRAY['label: sales_inquiry\nreason: The sender is asking for pricing on a group travel package before buying.',
         'label: refund\nreason: The sender was double-charged and wants the duplicate amount returned.',
         'label: booking\nreason: The sender wants to modify the dates of an existing flight booking.',
         'label: spam\nreason: This is an unsolicited prize scam with a click-bait link.',
         'label: support\nreason: The sender reports a technical login issue in the mobile app.',
         'label: booking\nreason: The sender is requesting a new hotel reservation for set dates.']];
  scores := ARRAY[ARRAY[5,5,2,5,5,5], ARRAY[5,5,5,5,5,5], ARRAY[5,5,5,5,5,5]];
  reasons := ARRAY[
   ARRAY['Correct label with a concise reason.','Correct label; reason matches the request.','Date change is a booking modification, not support.','Correct label and clear reason.','Correct label; clear reason.','Correct label; concise reason.'],
   ARRAY['Correct label with a precise reason.','Correct label and reason.','Correct label; reason identifies the booking change.','Correct label and reason.','Correct label and clear technical reason.','Correct label with specifics.'],
   ARRAY['Correct label; detailed one-sentence reason.','Correct label; reason is precise.','Correct label; correctly treats it as a booking change.','Correct label; reason names the scam.','Correct label; reason is specific.','Correct label; reason is clear.']];
  lat := ARRAY[ARRAY[612,580,655,541,598,603], ARRAY[1180,1240,1105,990,1320,1150], ARRAY[2310,2480,2205,1950,2620,2390]];
  otok := ARRAY[ARRAY[16,17,17,15,15,15], ARRAY[19,18,20,16,18,19], ARRAY[24,23,24,21,22,22]];

  INSERT INTO public.runs(task_id, prompt_version_id, prompt_version, models, status, is_seed, created_at, completed_at)
   VALUES (t1, pv, 2, mods, 'completed', true, now() - interval '1 day', now() - interval '1 day' + interval '40 seconds')
   RETURNING id INTO r1;

  FOR i IN 1..6 LOOP
    INSERT INTO public.test_inputs(task_id, position, input, reference) VALUES (t1, i, ins[i], refs[i]);
    FOR m IN 1..3 LOOP
      INSERT INTO public.run_calls(run_id, test_input_id, input_position, input_text, reference, model_id, status, output, latency_ms, input_tokens, output_tokens, tokens_estimated, score, reason, grade_status)
      VALUES (r1, (SELECT id FROM public.test_inputs WHERE task_id = t1 AND position = i), i, ins[i], refs[i], mods[m], 'ok',
        replace(outs[m][i], '\n', E'\n'), lat[m][i], itok[i], otok[m][i], false, scores[m][i], reasons[m][i], 'graded');
    END LOOP;
  END LOOP;

  -- Task 2
  INSERT INTO public.tasks(name, description, rubric, pass_threshold, created_at) VALUES (
   'Extract invoice fields to JSON',
   'Turn plain-text supplier invoices (fictional vendors) into structured JSON for an accounts-payable system.',
   E'5 = valid JSON only, keys {vendor, invoice_number, date, total}, all values match the reference (date ISO YYYY-MM-DD, total as a number).\n4 = all values correct but minor formatting issue (e.g. code fences, total as string).\n3 = one field wrong or missing.\n2 = two or more fields wrong.\n1 = not JSON or unusable.',
   4, now() - interval '2 days') RETURNING id INTO t2;
  INSERT INTO public.prompt_versions(task_id, version, system_prompt, user_template, change_note, created_at) VALUES
   (t2, 1, 'Extract the invoice details as JSON.', E'{{input}}', 'Initial draft', now() - interval '2 days'),
   (t2, 2, E'You extract invoice fields. Return ONLY a JSON object with keys: vendor (string), invoice_number (string), date (YYYY-MM-DD), total (number, no currency symbol). No code fences, no commentary.',
    E'Invoice text:\n"""\n{{input}}\n"""', 'Strict keys, ISO dates, numeric totals, no fences', now() - interval '1 day');
  INSERT INTO public.test_inputs(task_id, position, input, reference) VALUES
   (t2,1,E'INVOICE\nMabuhay Office Supplies Inc. (fictional)\nInvoice No: MOS-2026-0193\nDate: March 4, 2026\nBond paper x20 .... PHP 4,200.00\nTOTAL DUE: PHP 4,704.00','{"vendor":"Mabuhay Office Supplies Inc.","invoice_number":"MOS-2026-0193","date":"2026-03-04","total":4704.00}'),
   (t2,2,E'From: Kalye Coffee Roasters\nBill #: KCR-881\nIssued 12/05/2026\nWholesale beans 10kg\nAmount payable: ₱18,950.50','{"vendor":"Kalye Coffee Roasters","invoice_number":"KCR-881","date":"2026-05-12","total":18950.50}'),
   (t2,3,E'Pacific Rim Logistics (fictional) — Tax Invoice 00457\nInvoice date: 2026-07-19\nFreight Manila→Davao\nSubtotal 32,000.00  VAT 3,840.00  Grand total 35,840.00','{"vendor":"Pacific Rim Logistics","invoice_number":"00457","date":"2026-07-19","total":35840.00}'),
   (t2,4,E'Bright Sparks Electrical Services\nINV-BSE-2210 dated 1 Aug 2026\nRewiring 2nd floor, labor + materials\nPlease pay 12,500 pesos.','{"vendor":"Bright Sparks Electrical Services","invoice_number":"INV-BSE-2210","date":"2026-08-01","total":12500}'),
   (t2,5,E'Invoice #A-77 | Luntian Landscaping Co. | Sept 15 2026\nMonthly garden maintenance  PHP 6,000\nDiscount -500\nTotal: PHP 5,500','{"vendor":"Luntian Landscaping Co.","invoice_number":"A-77","date":"2026-09-15","total":5500}'),
   (t2,6,E'CloudNest Hosting (fictional)\nReceipt/Invoice: CN-2026-10-0042\nBilling date: October 1, 2026\nPro plan annual  USD 240.00\nTotal charged: USD 240.00','{"vendor":"CloudNest Hosting","invoice_number":"CN-2026-10-0042","date":"2026-10-01","total":240.00}');

  -- Task 3
  INSERT INTO public.tasks(name, description, rubric, pass_threshold, created_at) VALUES (
   'Summarize a policy for employees',
   'Rewrite HR policy paragraphs (from a fictional company, Northwind Manila) as a 3-bullet employee summary under 60 words.',
   E'5 = exactly 3 bullets, under 60 words total, covers every key rule in the reference, plain language.\n4 = 3 bullets and under 60 words, misses a minor detail.\n3 = misses a key rule OR breaks one format rule (bullet count or word limit).\n2 = misses several key rules or breaks both format rules.\n1 = inaccurate or invents rules.',
   4, now() - interval '1 day') RETURNING id INTO t3;
  INSERT INTO public.prompt_versions(task_id, version, system_prompt, user_template, change_note, created_at) VALUES
   (t3, 1, 'Summarize this policy.', E'{{input}}', 'Initial draft', now() - interval '1 day'),
   (t3, 2, E'You write employee-facing policy summaries. Output exactly 3 bullet points starting with "- ", under 60 words total, plain language, no intro or outro. Never add rules that are not in the policy.',
    E'Policy:\n"""\n{{input}}\n"""', 'Exact format, word limit, no invented rules', now() - interval '12 hours');
  INSERT INTO public.test_inputs(task_id, position, input, reference) VALUES
   (t3,1,'Remote work: Employees may work remotely up to two days per week with manager approval. Core hours are 10:00–15:00 Manila time, during which employees must be reachable on chat. Remote days cannot be carried over to the next week. Equipment issued by the company must be used for all work tasks.','- Up to 2 remote days/week with manager approval\n- Be reachable on chat 10:00–15:00\n- Unused days don''t carry over; use company equipment'),
   (t3,2,'Leave requests: Vacation leave must be filed at least 5 working days in advance through the HR portal. Sick leave of more than 2 consecutive days requires a medical certificate. Unused vacation leave of up to 5 days may be converted to cash at year end.','- File vacation leave 5 working days ahead in HR portal\n- Sick leave over 2 days needs a medical certificate\n- Up to 5 unused vacation days convert to cash at year end'),
   (t3,3,'Expense reimbursement: Submit receipts within 30 days of purchase. Meals are reimbursed up to PHP 800 per day when traveling for work. Alcohol is never reimbursable. Claims above PHP 10,000 need director approval.','- Submit receipts within 30 days\n- Travel meals up to PHP 800/day; no alcohol\n- Claims over PHP 10,000 need director approval'),
   (t3,4,'Data security: Lock your screen whenever you leave your desk. Do not store client files on personal devices or personal cloud accounts. Report suspected phishing emails to security@northwind.example within one hour. Passwords must be changed every 90 days.','- Lock screen when away; no client files on personal devices/cloud\n- Report phishing to security within 1 hour\n- Change passwords every 90 days'),
   (t3,5,'Overtime: Overtime must be pre-approved by your supervisor in writing. Overtime is paid at 125% of the hourly rate on regular days and 130% on rest days. Employees may not work more than 12 hours in a single day.','- Get written supervisor pre-approval\n- Paid 125% on regular days, 130% on rest days\n- Max 12 hours of work per day'),
   (t3,6,'Office visitors: All visitors must be registered at reception and wear a visitor badge. Employees are responsible for escorting their visitors at all times. Visitors are not allowed in the server room under any circumstances.','- Register visitors at reception; they wear badges\n- Escort your visitors at all times\n- No visitors in the server room, ever');
END;
$fn$;

REVOKE ALL ON FUNCTION public.reset_demo() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_demo() TO service_role;

SELECT public.reset_demo();

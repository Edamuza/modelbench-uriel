import { queryOptions } from "@tanstack/react-query";
import type { Call, Price } from "./metrics";
import { getCallsForRuns, getPrices, getRun, getSettings, getTask, getTasks } from "./read.functions";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (id: string) => UUID_RE.test(id);

export const pricesQuery = queryOptions({
  queryKey: ["prices"],
  queryFn: async () => (await getPrices()) as Price[],
});

export const settingsQuery = queryOptions({
  queryKey: ["settings"],
  queryFn: () => getSettings(),
});

export const tasksQuery = queryOptions({
  queryKey: ["tasks"],
  queryFn: () => getTasks(),
});

export const taskQuery = (id: string) =>
  queryOptions({
    queryKey: ["task", id],
    retry: false,
    // Malformed ids are "not found" right away — never hit the server or show validation output.
    queryFn: async () => (isUuid(id) ? getTask({ data: { id } }) : { task: null, pvs: [], inputs: [], runs: [] }) as Awaited<ReturnType<typeof getTask>>,
  });

export const runQuery = (id: string) =>
  queryOptions({
    queryKey: ["run", id],
    retry: false,
    queryFn: async () => {
      if (!isUuid(id)) return { run: null, calls: [] as Call[] } as unknown as { run: Awaited<ReturnType<typeof getRun>>["run"]; calls: Call[] };
      const r = await getRun({ data: { id } });
      return { run: r.run, calls: r.calls as Call[] };
    },
  });

// Latest completed runs' call rows — used to show the recommended model on the Tasks list.
export const callsForRunsQuery = (runIds: string[]) =>
  queryOptions({
    queryKey: ["calls-for-runs", runIds],
    enabled: runIds.length > 0,
    queryFn: async () => (await getCallsForRuns({ data: { ids: runIds } })) as (Call & { run_id: string })[],
  });

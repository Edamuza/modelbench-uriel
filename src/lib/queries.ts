import { queryOptions } from "@tanstack/react-query";
import type { Call, Price } from "./metrics";
import { getCallsForRuns, getPrices, getRun, getSettings, getTask, getTasks } from "./read.functions";

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
    queryFn: () => getTask({ data: { id } }),
  });

export const runQuery = (id: string) =>
  queryOptions({
    queryKey: ["run", id],
    queryFn: async () => {
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

import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, LoadingBlock, ErrorBlock } from "@/components/AppShell";
import { pricesQuery, settingsQuery } from "@/lib/queries";
import { updatePrice, updateSettings } from "@/lib/bench.functions";
import type { Price } from "@/lib/metrics";

export const Route = createFileRoute("/prices")({
  head: () => ({
    meta: [
      { title: "Prices — ModelBench" },
      { name: "description", content: "Editable per-model token prices and PHP exchange rate used for every cost figure." },
      { property: "og:title", content: "Prices — ModelBench" },
      { property: "og:description", content: "Edit model prices; all run costs recompute instantly." },
    ],
  }),
  component: PricesPage,
});

function PricesPage() {
  const prices = useQuery(pricesQuery);
  const settings = useQuery(settingsQuery);
  if (prices.isLoading || settings.isLoading) return <LoadingBlock />;
  if (prices.error || settings.error) return <ErrorBlock error={prices.error ?? settings.error} />;
  return (
    <>
      <PageHeader title="Prices" sub="Example prices — edit to match your provider. Every cost on every page is recomputed from this table." />
      <div className="mb-6 overflow-hidden rounded-lg border bg-card shadow-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Model</TableHead>
                <TableHead>Input $ / 1M tokens</TableHead>
                <TableHead>Output $ / 1M tokens</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {prices.data?.map((p) => <PriceRow key={p.model_id} p={p} />)}
            </TableBody>
          </Table>
        </div>
      </div>
      {settings.data && <SettingsCard php={settings.data.php_rate} target={settings.data.pass_rate_target} />}
    </>
  );
}

function PriceRow({ p }: { p: Price }) {
  const [i, setI] = useState(String(p.input_per_m));
  const [o, setO] = useState(String(p.output_per_m));
  const [busy, setBusy] = useState(false);
  const save = useServerFn(updatePrice);
  const qc = useQueryClient();
  useEffect(() => { setI(String(p.input_per_m)); setO(String(p.output_per_m)); }, [p.input_per_m, p.output_per_m]);
  const dirty = Number(i) !== Number(p.input_per_m) || Number(o) !== Number(p.output_per_m);
  const valid = i !== "" && o !== "" && Number(i) >= 0 && Number(o) >= 0;
  async function submit() {
    setBusy(true);
    try {
      await save({ data: { modelId: p.model_id, input: Number(i), output: Number(o) } });
      await qc.invalidateQueries({ queryKey: ["prices"] });
      toast.success(`${p.friendly_name} price updated`);
    } catch (e) {
      toast.error("Couldn't save price", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  }
  return (
    <TableRow>
      <TableCell>
        <div className="font-medium">{p.friendly_name}</div>
        <div className="num text-xs text-muted-foreground">{p.model_id} · {p.size_tag}</div>
      </TableCell>
      <TableCell><Input aria-label={`${p.friendly_name} input price`} className="num w-28" type="number" step="0.01" min="0" value={i} onChange={(e) => setI(e.target.value)} /></TableCell>
      <TableCell><Input aria-label={`${p.friendly_name} output price`} className="num w-28" type="number" step="0.01" min="0" value={o} onChange={(e) => setO(e.target.value)} /></TableCell>
      <TableCell><Button size="sm" disabled={!dirty || !valid || busy} onClick={submit}>{busy ? "Saving…" : "Save"}</Button></TableCell>
    </TableRow>
  );
}

function SettingsCard({ php, target }: { php: number; target: number }) {
  const [rate, setRate] = useState(String(php));
  const [tgt, setTgt] = useState(String(target));
  const [busy, setBusy] = useState(false);
  const save = useServerFn(updateSettings);
  const qc = useQueryClient();
  async function submit() {
    setBusy(true);
    try {
      await save({ data: { phpRate: Number(rate), passRateTarget: Number(tgt) } });
      await qc.invalidateQueries({ queryKey: ["settings"] });
      toast.success("Settings saved");
    } catch (e) {
      toast.error("Couldn't save settings", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="grid max-w-xl gap-4 rounded-lg border bg-card p-5 shadow-card sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <div className="space-y-1.5">
        <Label>PHP per 1 USD</Label>
        <Input className="num" type="number" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label>Pass-rate target (%)</Label>
        <Input className="num" type="number" min="0" max="100" value={tgt} onChange={(e) => setTgt(e.target.value)} />
      </div>
      <Button onClick={submit} disabled={busy || !(Number(rate) > 0)}>{busy ? "Saving…" : "Save"}</Button>
    </div>
  );
}

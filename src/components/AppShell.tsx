import { Link, useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { FlaskConical, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { resetDemo } from "@/lib/bench.functions";

const NAV = [
  { to: "/", label: "Tasks" },
  { to: "/runs/new", label: "New run" },
  { to: "/prices", label: "Prices" },
  { to: "/about", label: "About" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const reset = useServerFn(resetDemo);
  const qc = useQueryClient();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function doReset() {
    setBusy(true);
    try {
      await reset();
      await qc.invalidateQueries();
      toast.success("Demo data restored");
      router.navigate({ to: "/" });
    } catch (e) {
      toast.error("Reset failed", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-ink px-4 py-1.5 text-center text-xs text-ink-foreground">
        Demo app — all sample data is fictional.
      </div>
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
          <Link to="/" className="flex shrink-0 items-center gap-2 font-semibold tracking-tight">
            <span className="grid size-8 place-items-center rounded-md bg-primary text-primary-foreground">
              <FlaskConical className="size-4" />
            </span>
            <span className="hidden sm:inline">ModelBench</span>
          </Link>
          <nav className="-mx-1 flex flex-1 gap-1 overflow-x-auto">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                activeOptions={{ exact: n.to === "/" }}
                className="whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                activeProps={{ className: "bg-accent text-accent-foreground font-medium" }}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={busy} className="shrink-0">
                <RotateCcw className="size-3.5" />
                <span className="hidden md:inline">{busy ? "Resetting…" : "Reset demo"}</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset demo data?</AlertDialogTitle>
                <AlertDialogDescription>
                  This deletes every task, prompt version, run and price edit, and restores the original 3 seeded
                  tasks plus the sample run.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={doReset}>Reset</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 md:py-10">{children}</main>
      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        ModelBench · a portfolio project by Uriel Papa
      </footer>
    </div>
  );
}

export function PageHeader({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
        {sub && <p className="mt-1 text-sm text-muted-foreground">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function LoadingBlock({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="grid place-items-center rounded-lg border border-dashed py-16 text-sm text-muted-foreground">
      <div className="flex items-center gap-2">
        <span className="size-2 animate-pulse rounded-full bg-primary" /> {label}
      </div>
    </div>
  );
}

export function ErrorBlock({ error, retry }: { error: unknown; retry?: () => void }) {
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-sm">
      <p className="font-medium text-destructive">Couldn't load this data.</p>
      <p className="mt-1 text-muted-foreground">{error instanceof Error ? error.message : String(error)}</p>
      {retry && (
        <Button variant="outline" size="sm" className="mt-3" onClick={retry}>
          Try again
        </Button>
      )}
    </div>
  );
}

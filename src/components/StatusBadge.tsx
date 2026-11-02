export function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "completed" || status === "ok" || status === "graded"
      ? "bg-success text-success-foreground"
      : status === "failed"
        ? "bg-destructive text-destructive-foreground"
        : "bg-warning text-ink";
  return <span className={`inline-flex w-fit rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>{status}</span>;
}

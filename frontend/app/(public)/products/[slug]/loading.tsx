export default function ProductLoading() {
  return (
    <main className="animate-pulse space-y-5" aria-label="Loading resource">
      <div className="h-5 w-52 rounded bg-white/10" />
      <section className="border-b border-border pb-5">
        <div className="space-y-4 py-2">
          <div className="h-8 w-3/4 rounded bg-white/10" />
          <div className="h-4 w-full rounded bg-elevated" />
          <div className="h-4 w-2/3 rounded bg-elevated" />
        </div>
      </section>
      <div className="h-12 rounded-lg bg-elevated" />
      <div className="resource-layout-grid">
        <div className="h-72 rounded-lg bg-elevated" />
        <div className="h-72 rounded-lg bg-elevated" />
      </div>
    </main>
  );
}

export default function AdminDashboardPage() {
  return (
    <section className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-2">
        <p className="text-xs uppercase tracking-[0.3em] text-zinc-500 sm:text-sm">Overview</p>
        <h2 className="text-2xl font-semibold text-zinc-900 sm:text-3xl">Revenue and occupancy</h2>
      </div>
      <div className="grid gap-4 sm:gap-6 sm:grid-cols-3">
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 sm:rounded-3xl sm:p-6">
          <p className="text-sm text-zinc-500">Revenue</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-900 sm:mt-3 sm:text-3xl">$94.5k</p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 sm:rounded-3xl sm:p-6">
          <p className="text-sm text-zinc-500">Occupancy</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-900 sm:mt-3 sm:text-3xl">82%</p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 sm:rounded-3xl sm:p-6">
          <p className="text-sm text-zinc-500">Bookings</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-900 sm:mt-3 sm:text-3xl">214</p>
        </div>
      </div>
    </section>
  );
}

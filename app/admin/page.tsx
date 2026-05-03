import Link from "next/link";

export default function AdminIndexPage() {
  return (
    <section className="mx-auto max-w-4xl space-y-4 sm:space-y-6">
      <div className="rounded-2xl bg-white p-6 shadow-sm sm:rounded-3xl sm:p-8">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-zinc-500 sm:text-sm">Admin area</p>
          <h2 className="mt-3 text-2xl font-semibold text-zinc-900 sm:mt-4 sm:text-3xl">Company-only tools</h2>
          <p className="mt-2 text-sm text-zinc-600 sm:mt-3 sm:text-base">Choose from the dashboard, booking calendar, or room management tools.</p>
        </div>
        <div className="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:gap-4">
          <Link href="/admin/dashboard" className="rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-700 sm:rounded-full sm:px-5 sm:py-3">
            Go to dashboard
          </Link>
          <Link href="/admin/manage-rooms" className="rounded-2xl border border-zinc-200 px-4 py-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 sm:rounded-full sm:px-5 sm:py-3">
            Manage rooms
          </Link>
        </div>
      </div>
    </section>
  );
}

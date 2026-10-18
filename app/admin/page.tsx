import Link from 'next/link';

export default function AdminIndexPage() {
  return (
    <section className="mx-auto max-w-4xl space-y-6 font-sans">
      <div className="neu-card p-6 sm:p-8 space-y-5">
        <div>
          <p className="text-xs uppercase tracking-widest text-emerald-600 font-bold">
            Staff Portal
          </p>
          <h2 className="mt-2 text-2xl sm:text-3xl font-black text-slate-900">
            Welcome to the Admin Panel
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Choose a tool below to view bookings, check revenue, or update villa packages.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Link
            href="/admin/dashboard"
            className="neu-btn-primary px-6 py-3 text-sm font-semibold text-center"
          >
            Go to Overview
          </Link>
          <Link
            href="/admin/bookings"
            className="neu-btn px-6 py-3 text-sm font-semibold text-center"
          >
            Manage Bookings
          </Link>
          <Link
            href="/admin/manage-rooms"
            className="neu-btn px-6 py-3 text-sm font-semibold text-center"
          >
            Villas &amp; Rates
          </Link>
        </div>
      </div>
    </section>
  );
}

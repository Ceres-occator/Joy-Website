import Link from "next/link";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-900">
      <div className="grid min-h-screen grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
        <aside className="rounded-br-2xl bg-zinc-950 px-4 py-6 text-white shadow-2xl sm:rounded-br-[3rem] sm:px-6 sm:py-8">
          <div className="mb-6 sm:mb-10">
            <p className="text-xs uppercase tracking-[0.3em] text-zinc-400 sm:text-sm">Admin</p>
            <h1 className="mt-3 text-xl font-semibold sm:mt-4 sm:text-2xl">Company dashboard</h1>
          </div>
          <nav className="space-y-2 text-sm font-medium sm:space-y-3">
            <Link href="/admin/dashboard" className="block rounded-2xl px-3 py-2 hover:bg-white/10 sm:px-4 sm:py-3">
              Overview
            </Link>
            <Link href="/admin/manage-rooms" className="block rounded-2xl px-3 py-2 hover:bg-white/10 sm:px-4 sm:py-3">
              Manage rooms
            </Link>
            <Link href="/admin/calendar" className="block rounded-2xl px-3 py-2 hover:bg-white/10 sm:px-4 sm:py-3">
              Calendar
            </Link>
          </nav>
        </aside>
        <main className="px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      </div>
    </div>
  );
}

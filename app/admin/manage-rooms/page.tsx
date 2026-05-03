export default function ManageRoomsPage() {
  return (
    <section className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-2">
        <p className="text-xs uppercase tracking-[0.3em] text-zinc-500 sm:text-sm">Manage properties</p>
        <h2 className="text-2xl font-semibold text-zinc-900 sm:text-3xl">Add or edit room details</h2>
      </div>
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 sm:rounded-3xl sm:p-6">
        <p className="text-sm text-zinc-600 sm:text-base">Use this page to create new listings, update pricing, and manage property amenities.</p>
      </div>
    </section>
  );
}

export default function AboutPage() {
  return (
    <section className="mx-auto max-w-4xl space-y-4 sm:space-y-6">
      <div className="rounded-2xl bg-white p-6 shadow-sm sm:rounded-3xl sm:p-8 border">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-zinc-500 sm:text-sm">Company information</p>
          {/* 🌟 BRANDING SWAP: Updated Title Component */}
          <h2 className="mt-3 text-2xl font-black text-zinc-900 sm:mt-4 sm:text-3xl tracking-tight">
            About Joy's Events and Party Place
          </h2>
          {/* 🌟 BRANDING SWAP: Updated Body Summary Paragraph */}
          <p className="mt-3 text-sm leading-relaxed text-zinc-600 sm:mt-4 sm:text-base font-medium">
            Joy's Events and Party Place helps clients locate, secure, and experience premier destination venues managed by our dedicated hospitality team. We maintain a curated portfolio of high-end resort villas tailored for comfort, security, and memorable celebrations.
          </p>
        </div>

        <div className="mt-6 grid gap-4 sm:mt-8 sm:gap-6 sm:grid-cols-2">
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 sm:rounded-3xl sm:p-6">
            <h3 className="text-lg font-bold text-zinc-900 sm:text-xl">Our Mission</h3>
            <p className="mt-2 text-sm text-zinc-600 leading-relaxed font-medium">Deliver outstanding accommodation stays across all our corporate-managed properties with transparent baseline matrix pricing and seamless on-site support lines.</p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 sm:rounded-3xl sm:p-6">
            <h3 className="text-lg font-bold text-zinc-900 sm:text-xl">What We Do</h3>
            <p className="mt-2 text-sm text-zinc-600 leading-relaxed font-medium">We organize listings inventory, streamline confirmation ledgers, and manage incoming guest logistics so every booking performs reliably for customers and managers alike.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
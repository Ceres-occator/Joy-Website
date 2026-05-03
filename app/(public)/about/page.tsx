export default function AboutPage() {
  return (
    <section className="mx-auto max-w-4xl space-y-4 sm:space-y-6">
      <div className="rounded-2xl bg-white p-6 shadow-sm sm:rounded-3xl sm:p-8">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-zinc-500 sm:text-sm">Company information</p>
          <h2 className="mt-3 text-2xl font-semibold text-zinc-900 sm:mt-4 sm:text-3xl">About Maro Airbnb</h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-600 sm:mt-4 sm:text-base">
            Maro Airbnb helps travelers find trusted properties managed by our hospitality team. We maintain a curated portfolio of rentals for comfort, safety, and local experiences.
          </p>
        </div>

        <div className="mt-6 grid gap-4 sm:mt-8 sm:gap-6 sm:grid-cols-2">
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 sm:rounded-3xl sm:p-6">
            <h3 className="text-lg font-semibold text-zinc-900 sm:text-xl">Our mission</h3>
            <p className="mt-2 text-sm text-zinc-600 sm:mt-3">Deliver outstanding stays across all our company-managed properties with clear pricing and seamless support.</p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 sm:rounded-3xl sm:p-6">
            <h3 className="text-lg font-semibold text-zinc-900 sm:text-xl">What we do</h3>
            <p className="mt-2 text-sm text-zinc-600 sm:mt-3">We manage listings, bookings, and guest experiences so every stay performs reliably for customers and owners.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

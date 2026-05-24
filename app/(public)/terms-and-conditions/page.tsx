// app/(public)/terms-and-conditions/page.tsx
export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl p-4 sm:p-8 space-y-6 text-sm text-zinc-600 leading-relaxed animate-fadeIn">
      <div className="border-b border-zinc-200 pb-4">
        <p className="text-xs uppercase tracking-[0.3em] text-zinc-400">Legal Framework</p>
        <h1 className="text-3xl font-black text-zinc-900 tracking-tight mt-1">Digital Rental Agreement</h1>
      </div>

      <section className="bg-white p-6 rounded-3xl border border-zinc-100 space-y-4 shadow-sm text-zinc-700">
        <h2 className="font-bold text-zinc-900 text-lg border-b pb-1">1. Booking & Cancellation Rules</h2>
        <p>By checking the reservation agreement box, the renter agrees that down payments are non-refundable but remain re-schedulable up to fourteen (14) days prior to the original selected date slot.</p>

        <h2 className="font-bold text-zinc-900 text-lg border-b pb-1 pt-3">2. Surcharges & Excess Headcounts</h2>
        <p>Only the declared headcount of guests will be permitted entry into the establishment premises. Any excess visitors will be subject to a strict fine of ₱300 per individual pax.</p>

        <h2 className="font-bold text-zinc-900 text-lg border-b pb-1 pt-3">3. Care of Property Premises</h2>
        <p>The client assumes full financial liability for any damage inflicted upon resort infrastructure, pool filtration systems, karaoke machinery, billiards hardware, or bedding linen assets during their designated hours of occupancy.</p>
      </section>
    </main>
  );
}
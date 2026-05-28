// app/(public)/terms-and-conditions/page.tsx
export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl p-4 sm:p-8 space-y-6 text-sm text-zinc-600 leading-relaxed animate-fadeIn font-sans">
      <div className="border-b border-zinc-200 pb-4">
        <p className="text-xs uppercase tracking-[0.3em] text-zinc-400">Legal Framework</p>
        <h1 className="text-3xl font-black text-zinc-900 tracking-tight mt-1">Digital Rental Agreement</h1>
      </div>

      <section className="bg-white p-6 rounded-3xl border border-zinc-100 space-y-5 shadow-sm text-zinc-700">
        
        {/* SECTION 1 */}
        <div>
          <h2 className="font-bold text-zinc-900 text-base border-b pb-1.5 uppercase tracking-wide">1. Booking, Deposits & Cancellations</h2>
          <p className="mt-2 text-zinc-600">
            To officially secure a reservation window, a mandatory **50% down payment deposit** of the total package price rate is required. By checking the reservation box, the renter acknowledges that all down payments are non-refundable. However, dates remain re-schedulable up to fourteen (14) days prior to the originally selected check-in slot.
          </p>
        </div>

        {/* SECTION 2 - OVERHAULED TO MATCH COMPUTE MATRIX */}
        <div>
          <h2 className="font-bold text-zinc-900 text-base border-b pb-1.5 pt-2 uppercase tracking-wide">2. Surcharges & Excess Headcounts</h2>
          <p className="mt-2 text-zinc-600">
            Only the officially declared headcount number of pax will be permitted entry into the premises. Excess occupants or visitors will be assessed and charged matching the property's structural tier rates:
          </p>
          <ul className="mt-2 list-disc pl-5 space-y-2 text-zinc-600 font-medium">
            <li>
              <strong>Accommodation Stays (Overnight):</strong> Sandy's Villa features a baseline cap of 16 Pax (sleeps up to 30), with a surcharge of <span className="text-zinc-950 font-bold">₱600 per additional overnight guest</span>. Suki's Events Space features a baseline cap of 8 Pax (sleeps up to 25), with a surcharge of <span className="text-zinc-950 font-bold">₱500 per additional overnight guest</span>.
            </li>
            <li>
              <strong>Daytime Event Visitors:</strong> Extra visitors not staying overnight are strictly charged at <span className="text-zinc-950 font-bold">₱400/pax for Sandy's Villa</span> and <span className="text-zinc-950 font-bold">₱300/pax for Suki's Events Space</span>.
            </li>
            <li>
              <strong>Optional Evening Event Overnight Addon:</strong> Evening event packages extending overnight (with 9:00 AM checkout next day) include up to 15 guests baseline. Any headcount exceeding 15 will be billed an excess night fee of <span className="text-zinc-950 font-bold">₱600/pax for Sandy's</span> and <span className="text-zinc-950 font-bold">₱500/pax for Suki's</span>.
            </li>
          </ul>
        </div>

        {/* SECTION 3 */}
        <div>
          <h2 className="font-bold text-zinc-900 text-base border-b pb-1.5 pt-2 uppercase tracking-wide">3. Mandatory Fees & Security Bonds</h2>
          <p className="mt-2 text-zinc-600">
            The remaining contract balance and a mandatory cash-only **refundable security bond deposit of ₱3,000** are payable strictly upon check-in clearance. This bond covers potential on-site asset destruction and will be refunded completely at checkout pending an inspection. Additionally, all overnight accommodation bookings are assessed a one-off structural housekeeping cleaning fee of **₱500**.
          </p>
        </div>

        {/* SECTION 4 */}
        <div>
          <h2 className="font-bold text-zinc-900 text-base border-b pb-1.5 pt-2 uppercase tracking-wide">4. Schedules & Property Care</h2>
          <p className="mt-2 text-zinc-600">
            For accommodation stays, check-in begins at **3:00 PM** and check-out is strictly at **9:00 AM**. For daytime events, time windows are restricted to 4 hours (11:00 AM - 3:00 PM) while evening event slots run for 5 hours (5:00 PM - 10:00 PM). The client assumes total financial liability for any damage inflicted upon structural properties, infinity pool systems, karaoke electronics, billiards tables, or room linen assets.
          </p>
        </div>
        
      </section>
    </main>
  );
}
export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl p-4 sm:p-8 space-y-6 text-sm text-slate-700 leading-relaxed animate-fadeIn font-sans">
      <div>
        <p className="text-xs uppercase tracking-widest text-emerald-600 font-bold">
          House Rules
        </p>
        <h1 className="text-3xl font-black text-slate-900 mt-1">Booking Rules &amp; Terms</h1>
      </div>

      <section className="neu-card p-6 sm:p-8 space-y-6">
        <div className="space-y-2">
          <h2 className="font-bold text-slate-900 text-base">
            1. Deposits, Rescheduling &amp; Cancellations
          </h2>
          <p className="text-slate-600">
            A <strong>50% down payment</strong> of the total booking price is required to reserve
            your date. Down payments are non-refundable, but you can reschedule for free up to 7
            days before your scheduled stay (subject to date availability).
          </p>
        </div>

        <div className="space-y-2 border-t border-slate-300/60 pt-5">
          <h2 className="font-bold text-slate-900 text-base">
            2. Guest Limits &amp; Extra Guest Fees
          </h2>
          <p className="text-slate-600">
            Only the declared number of guests may enter the property. Extra guests are charged as
            follows:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-slate-600">
            <li>
              <strong>Overnight Stays:</strong> Sandy&apos;s Villa includes 16 guests (max 30), with{' '}
              <strong>₱600 per extra overnight guest</strong>. Suki&apos;s Place includes 8 guests
              (max 25), with <strong>₱500 per extra overnight guest</strong>.
            </li>
            <li>
              <strong>Event Visitors:</strong> Extra daytime or evening visitors not staying
              overnight are <strong>₱400/person at Sandy&apos;s Villa</strong> and{' '}
              <strong>₱300/person at Suki&apos;s Place</strong>.
            </li>
            <li>
              <strong>Evening Event Overnight Add-on:</strong> Includes up to 15 overnight guests
              (check-out at 9:00 AM the next day). Extra overnight guests beyond 15 are{' '}
              <strong>₱600/person at Sandy&apos;s</strong> and{' '}
              <strong>₱500/person at Suki&apos;s</strong>.
            </li>
          </ul>
        </div>

        <div className="space-y-2 border-t border-slate-300/60 pt-5">
          <h2 className="font-bold text-slate-900 text-base">
            3. Security Deposit &amp; Cleaning Fee
          </h2>
          <p className="text-slate-600">
            Any remaining balance and a refundable <strong>₱3,000 cash security deposit</strong> are
            collected at check-in. The security deposit is returned in full at check-out once our
            staff confirms there are no damages. All overnight stays also include a one-time{' '}
            <strong>₱500 cleaning fee</strong>.
          </p>
        </div>

        <div className="space-y-2 border-t border-slate-300/60 pt-5">
          <h2 className="font-bold text-slate-900 text-base">
            4. Check-In Times &amp; Care of Property
          </h2>
          <p className="text-slate-600">
            For overnight stays, check-in starts at <strong>3:00 PM</strong> and check-out is at{' '}
            <strong>9:00 AM</strong>. Daytime events run from <strong>11:00 AM – 3:00 PM</strong>{' '}
            (4 hours) and evening events run from <strong>5:00 PM – 10:00 PM</strong> (5 hours).
            Guests are responsible for any damage to the pool, karaoke equipment, furniture,
            appliances, or linens during their stay.
          </p>
        </div>
      </section>
    </main>
  );
}
export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl p-4 sm:p-8 space-y-6 text-sm text-slate-700 leading-relaxed animate-fadeIn font-sans">
      <div>
        <p className="text-xs uppercase tracking-widest text-emerald-600 font-bold">
          Your Privacy
        </p>
        <h1 className="text-3xl font-black text-slate-900 mt-1">Privacy Policy</h1>
      </div>

      <section className="neu-card p-6 sm:p-8 space-y-4">
        <p>
          We respect your privacy and only collect the information needed to confirm and manage
          your stay at Joy&apos;s Events and Party Place.
        </p>

        <h2 className="font-bold text-slate-900 text-base pt-2">Information We Collect</h2>
        <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
          <li>Your full name, phone number, and optional email address.</li>
          <li>A photo of your valid government ID for check-in security.</li>
          <li>Your payment reference number and receipt screenshot.</li>
        </ul>

        <h2 className="font-bold text-slate-900 text-base pt-2">How We Protect Your Data</h2>
        <p className="text-slate-600">
          Your uploaded ID and payment receipts are stored in a private folder and are only viewed
          by our authorized staff to verify your booking. We never sell or share your personal
          details with third parties.
        </p>
      </section>
    </main>
  );
}
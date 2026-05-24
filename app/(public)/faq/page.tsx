// app/(public)/faq/page.tsx
export default function FAQPage() {
  const faqs = [
    {
      q: "How do I secure my reservation slot?",
      a: "We require a mandatory 50% deposit down payment via GCash or bank transfer. You can upload your reference verification slip right on our checkout platform."
    },
    {
      q: "Is there a security bond deposit fee?",
      a: "Yes. All property stays require a refundable bond deposit of ₱3,000 paid in cash upon check-in to cover potential property damages. This will be returned completely upon successful checkout clearance."
    },
    {
      q: "What happens if our headcount exceeds the package limit?",
      a: "Extra visitors are subject to an excess pax surcharge fee of ₱300 per person. Please ensure you declare accurate numbers during booking registration."
    },
    {
      q: "Can we use the kitchen facilities for cooking?",
      a: "Our Option 3 (Accommodation Stay) packages include full, unlimited access to kitchen amenities. For Option 1 & 2 event venue packages, please coordinate with our booking office regarding kitchen use restrictions."
    }
  ];

  return (
    <main className="mx-auto max-w-3xl p-4 sm:p-8 space-y-8 animate-fadeIn">
      <div className="border-b border-zinc-200 pb-4">
        <p className="text-xs uppercase tracking-[0.3em] text-zinc-400">Support Center</p>
        <h1 className="text-3xl font-black text-zinc-900 tracking-tight mt-1">Frequently Asked Questions</h1>
      </div>

      <div className="space-y-6">
        {faqs.map((faq, idx) => (
          <div key={idx} className="bg-white p-6 rounded-2xl border border-zinc-100 shadow-sm space-y-2">
            <h3 className="font-bold text-zinc-900 text-base flex items-start gap-2">
              <span className="text-emerald-500 font-extrabold">Q:</span> {faq.q}
            </h3>
            <p className="text-sm text-zinc-600 pl-5 leading-relaxed">{faq.a}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
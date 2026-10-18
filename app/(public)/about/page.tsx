export default function AboutPage() {
  const highlights = [
    {
      badge: 'Safety First',
      title: 'Private & Secure',
      description:
        'Each villa booking is private to your group, with verified check-ins and attentive on-site staff so you can relax in peace.',
    },
    {
      badge: 'Clear Pricing',
      title: 'No Hidden Fees',
      description:
        'All package rates, guest allowances, and extra guest fees are shown upfront before you pay.',
    },
    {
      badge: 'Warm Hospitality',
      title: 'Well-Kept Spaces',
      description:
        'From clean pools and fresh linens to karaoke and catering setups, our team prepares every detail before you arrive.',
    },
  ];

  return (
    <section className="mx-auto max-w-6xl space-y-14 py-6 sm:py-10 animate-fadeIn font-sans">
      <div className="neu-card p-6 sm:p-10 grid gap-10 md:grid-cols-2 items-center">
        <div className="space-y-4">
          <span className="inline-block text-xs font-bold uppercase tracking-widest text-emerald-600 px-3 py-1 neu-inset-sm">
            About Us
          </span>
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-slate-900 leading-tight">
            OUR <span className="text-emerald-600">STORY</span>
          </h2>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
            Joy&apos;s Events and Party Place offers comfortable private villas and event venues in
            Davao City. Whether you&apos;re planning an intimate family staycation, a birthday pool
            party, or a wedding reception, our spaces are built to make your celebration easy and
            memorable.
          </p>
        </div>

        <div className="neu-inset p-6 sm:p-8 space-y-5">
          <div className="space-y-1">
            <h4 className="text-sm font-black uppercase tracking-wider text-emerald-700">
              Our Goal
            </h4>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Provide clean, welcoming, and well-managed resort spaces with honest pricing and
              friendly local service.
            </p>
          </div>

          <div className="space-y-1 border-t border-slate-300/60 pt-4">
            <h4 className="text-sm font-black uppercase tracking-wider text-emerald-700">
              What We Offer
            </h4>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Flexible daytime and evening event packages, catering options, and full overnight
              villa stays for families, friends, and company outings.
            </p>
          </div>
        </div>
      </div>

      {/* Highlights */}
      <div className="space-y-6">
        <div>
          <p className="text-xs uppercase tracking-widest text-emerald-600 font-bold">
            Why Guests Choose Us
          </p>
          <h3 className="text-2xl font-black text-slate-900 mt-1">What You Can Expect</h3>
        </div>

        <div className="grid gap-6 sm:grid-cols-3">
          {highlights.map((item) => (
            <div key={item.title} className="neu-card p-6 space-y-3">
              <span className="inline-block text-[10px] uppercase tracking-wider font-bold px-2.5 py-1 neu-inset-sm text-emerald-700">
                {item.badge}
              </span>
              <h4 className="text-lg font-bold text-slate-900">{item.title}</h4>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Services */}
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="neu-card p-6 sm:p-8 space-y-2.5">
          <h4 className="font-black text-slate-900 text-base">Event Celebrations</h4>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Host birthdays, weddings, reunions, and company parties. Choose between venue-only
            rental or convenient packages with catering included.
          </p>
        </div>

        <div className="neu-card p-6 sm:p-8 space-y-2.5">
          <h4 className="font-black text-slate-900 text-base">Overnight Villa Stays</h4>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Enjoy full access to the villa, swimming pool, lounge areas, and air-conditioned
            bedrooms for a relaxing overnight getaway with family and friends.
          </p>
        </div>
      </div>
    </section>
  );
}
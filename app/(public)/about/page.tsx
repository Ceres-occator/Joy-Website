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
    <section className="mx-auto max-w-6xl space-y-24 animate-fadeIn font-sans">
      {/* Intro */}
      <div className="grid gap-12 md:grid-cols-2 items-start">
        <div className="space-y-5">
          <p className="eyebrow">About us</p>
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-gray-900 dark:text-gray-100 leading-tight">
            Our <span className="text-emerald-600">story</span>
          </h2>
          <p className="text-base sm:text-lg text-gray-600 dark:text-gray-300 leading-relaxed">
            Joy&apos;s Events and Party Place offers comfortable private villas and event venues in
            Davao City. Whether you&apos;re planning an intimate family staycation, a birthday pool
            party, or a wedding reception, our spaces are built to make your celebration easy and
            memorable.
          </p>
        </div>

        <div className="space-y-8 md:pt-10 md:pl-10 md:border-l border-gray-200 dark:border-gray-800">
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Our goal</h3>
            <p className="text-base text-gray-600 dark:text-gray-300 leading-relaxed">
              Provide clean, welcoming, and well-managed resort spaces with honest pricing and
              friendly local service.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              What we offer
            </h3>
            <p className="text-base text-gray-600 dark:text-gray-300 leading-relaxed">
              Flexible daytime and evening event packages, catering options, and full overnight
              villa stays for families, friends, and company outings.
            </p>
          </div>
        </div>
      </div>

      {/* Highlights */}
      <div className="space-y-10">
        <div className="space-y-2">
          <p className="eyebrow">Why guests choose us</p>
          <h3 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            What you can expect
          </h3>
        </div>

        <div className="grid gap-10 sm:grid-cols-3">
          {highlights.map((item) => (
            <div key={item.title} className="space-y-3 border-t-2 border-emerald-600 pt-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                {item.badge}
              </p>
              <h4 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {item.title}
              </h4>
              <p className="text-base text-gray-600 dark:text-gray-300 leading-relaxed">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Services */}
      <div className="grid gap-10 sm:grid-cols-2 border-t border-gray-200 dark:border-gray-800 pt-16">
        <div className="space-y-3">
          <h4 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Event celebrations
          </h4>
          <p className="text-base text-gray-600 dark:text-gray-300 leading-relaxed">
            Host birthdays, weddings, reunions, and company parties. Choose between venue-only
            rental or convenient packages with catering included.
          </p>
        </div>

        <div className="space-y-3">
          <h4 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Overnight villa stays
          </h4>
          <p className="text-base text-gray-600 dark:text-gray-300 leading-relaxed">
            Enjoy full access to the villa, swimming pool, lounge areas, and air-conditioned
            bedrooms for a relaxing overnight getaway with family and friends.
          </p>
        </div>
      </div>
    </section>
  );
}
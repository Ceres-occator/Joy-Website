export default function ContactPage() {
  const channels = [
    {
      title: 'Facebook Page',
      subtitle: 'Photos & Updates',
      detail: "Joy's Events and Party Place",
      actionLabel: 'Visit Facebook',
      actionUrl: 'https://www.facebook.com/profile.php?id=100092158506002',
    },
    {
      title: 'Facebook Messenger',
      subtitle: 'Quick Chat',
      detail: 'Message us directly on Messenger',
      actionLabel: 'Chat Now',
      actionUrl: 'https://m.me/100092158506002',
    },
    {
      title: 'Phone / Mobile',
      subtitle: 'Call or Text',
      detail: '0916 107 2015 / 0922 882 2828',
      actionLabel: 'Call Now',
      actionUrl: 'tel:09161072015',
    },
    {
      title: 'Email',
      subtitle: 'Inquiries',
      detail: 'joyspartyplace@gmail.com',
      actionLabel: 'Send Email',
      actionUrl: 'mailto:joyspartyplace@gmail.com',
    },
  ];

  return (
    <section className="mx-auto max-w-6xl space-y-24 animate-fadeIn font-sans">
      {/* Intro */}
      <div className="grid gap-12 md:grid-cols-2 items-start">
        <div className="space-y-5">
          <p className="eyebrow">Get in touch</p>
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-gray-900 dark:text-gray-100 leading-tight">
            Contact <span className="text-emerald-600">us</span>
          </h2>
          <p className="text-base sm:text-lg text-gray-600 dark:text-gray-300 leading-relaxed">
            Have questions about available dates, catering packages, or your reservation? Reach out
            to our team anytime through the channels below.
          </p>
        </div>

        <div className="space-y-3 md:pt-10 md:pl-10 md:border-l border-gray-200 dark:border-gray-800">
          <p className="eyebrow">Support hours</p>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Booking assistance
          </h3>
          <p className="text-base text-gray-600 dark:text-gray-300 leading-relaxed">
            Our team reviews bookings, answers questions, and verifies payment receipts every day.
          </p>
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 pt-1">
            Monday – Sunday: 8:00 AM – 9:00 PM
          </p>
        </div>
      </div>

      {/* Channels */}
      <div className="space-y-10">
        <div className="space-y-2">
          <p className="eyebrow">Ways to reach us</p>
          <h3 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            Contact channels
          </h3>
        </div>

        <div className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {channels.map((channel) => (
            <div
              key={channel.title}
              className="flex flex-col justify-between gap-6 border-t border-gray-200 dark:border-gray-800 pt-5"
            >
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  {channel.subtitle}
                </p>
                <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {channel.title}
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-300 break-words leading-relaxed">
                  {channel.detail}
                </p>
              </div>

              <a
                href={channel.actionUrl}
                target={channel.actionUrl.startsWith('http') ? '_blank' : undefined}
                rel="noreferrer"
                className="neu-btn w-full py-3 text-sm font-semibold text-center block"
              >
                {channel.actionLabel}
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
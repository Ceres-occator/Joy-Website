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
    <section className="mx-auto max-w-6xl space-y-14 py-6 sm:py-10 animate-fadeIn font-sans">
      <div className="neu-card p-6 sm:p-10 grid gap-10 md:grid-cols-2 items-center">
        <div className="space-y-4">
          <span className="inline-block text-xs font-bold uppercase tracking-widest text-emerald-600 px-3 py-1 neu-inset-sm">
            Get in Touch
          </span>
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-slate-900 leading-tight">
            CONTACT <span className="text-emerald-600">US</span>
          </h2>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
            Have questions about available dates, catering packages, or your reservation? Reach out
            to our team anytime through the channels below.
          </p>
        </div>

        <div className="neu-inset p-6 sm:p-8 space-y-3">
          <span className="text-xs uppercase tracking-widest text-emerald-600 font-bold">
            Support Hours
          </span>
          <h4 className="text-lg font-black text-slate-900">Booking Assistance</h4>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Our team reviews bookings, answers questions, and verifies payment receipts every day.
          </p>
          <div className="text-xs font-mono text-emerald-700 font-bold pt-2">
            Monday – Sunday: 8:00 AM – 9:00 PM
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <p className="text-xs uppercase tracking-widest text-emerald-600 font-bold">
            Ways to Reach Us
          </p>
          <h3 className="text-2xl font-black text-slate-900 mt-1">Contact Channels</h3>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {channels.map((channel) => (
            <div
              key={channel.title}
              className="neu-card p-6 flex flex-col justify-between space-y-6"
            >
              <div className="space-y-2">
                <span className="inline-block text-[10px] uppercase tracking-wider font-bold px-2.5 py-1 neu-inset-sm text-emerald-700">
                  {channel.subtitle}
                </span>
                <h4 className="text-base font-bold text-slate-900 pt-1">{channel.title}</h4>
                <p className="text-xs font-medium text-slate-600 break-all leading-relaxed">
                  {channel.detail}
                </p>
              </div>

              <a
                href={channel.actionUrl}
                target={channel.actionUrl.startsWith('http') ? '_blank' : undefined}
                rel="noreferrer"
                className="neu-btn-primary w-full py-2.5 text-xs font-bold uppercase tracking-wider text-center block"
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
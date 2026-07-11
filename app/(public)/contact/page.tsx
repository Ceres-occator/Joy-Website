export default function ContactPage() {
  const channels = [
    {
      title: "Official Facebook",
      subtitle: "Social Catalog Platform",
      detail: "Joy's Events and Party Place",
      actionLabel: "Visit Page",
      actionUrl: "https://www.facebook.com/profile.php?id=100092158506002" // 🌐 Updated with your Facebook profile link
    },
    {
      title: "Direct Messenger",
      subtitle: "Instant Chat Support", 
      detail: "Joy's Events and Party Place Messenger",
      actionLabel: "Chat Now",
      actionUrl: "https://m.me/100092158506002" // 🛠️ FIXED: Redirects directly to the page conversation chat matrix
    },
    {
      title: "Mobile Contact",
      subtitle: "Direct Hotline Lines",
      detail: "0916 107 2015 / 0922 882 2828",
      actionLabel: "Tap to Call",
      actionUrl: "tel:09161072015"
    },
    {
      title: "Corporate Email",
      subtitle: "Business Ledger Desk",
      detail: "joyspartyplace@gmail.com",
      actionLabel: "Send Email",
      actionUrl: "mailto:joyspartyplace@gmail.com"
    }
  ];

  return (
    <section className="mx-auto max-w-6xl space-y-16 py-6 sm:py-12 animate-fadeIn font-sans antialiased text-zinc-800">
      
      {/* SPLIT HERO LAYOUT */}
      <div className="grid gap-12 md:grid-cols-2 items-center min-h-[350px] px-2">
        <div className="space-y-6">
          <div className="space-y-2">
            <h2 className="text-4xl sm:text-6xl font-black tracking-tight text-zinc-950 uppercase leading-none">
              CONTACT <span className="text-emerald-600">HUB</span>
            </h2>
            <h3 className="text-sm sm:text-base font-extrabold tracking-wider text-zinc-400 uppercase">
              Get in touch with management
            </h3>
          </div>
          <p className="text-sm text-zinc-500 font-medium leading-relaxed max-w-md">
            Have date calculation queries, custom package requests, or need manual booking billing clearance? Reach out straight to our desk through any verified platform channel.
          </p>
        </div>

        {/* Office Hours Statement Panel */}
        <div className="relative w-full p-8 rounded-3xl bg-zinc-900 text-white shadow-2xl flex flex-col justify-center min-h-[220px]">
          <span className="text-[10px] uppercase tracking-widest text-emerald-400 font-black mb-1">Operating Hours</span>
          <h4 className="text-lg font-black tracking-tight text-white uppercase">Central Booking Desk</h4>
          <p className="text-xs text-zinc-400 mt-2 leading-relaxed font-medium">
            Our administration verification pipeline processes transaction vouchers and incoming verification ID records daily.
          </p>
          <div className="text-xs font-mono text-emerald-400 font-black mt-4 tracking-wider">
            🕒 MON - SUN / 8:00 AM - 9:00 PM PST
          </div>
        </div>
      </div>

      {/* DIRECTORY GRID */}
      <div className="space-y-6 pt-6 border-t border-zinc-200/60">
        <div className="px-2">
          <p className="text-[10px] uppercase tracking-widest text-zinc-400 font-black">Directory</p>
          <h3 className="text-xl sm:text-2xl font-black text-zinc-950 tracking-tight mt-0.5 uppercase">
            Verified Support Lines
          </h3>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 px-2">
          {channels.map((channel, idx) => (
            <div key={idx} className="flex flex-col justify-between border border-zinc-200 bg-white p-5 rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 group">
              <div className="space-y-2 mb-6">
                <div>
                  <span className="text-[8px] uppercase tracking-widest font-black px-2 py-0.5 bg-zinc-900 text-white rounded border">
                    {channel.subtitle}
                  </span>
                </div>
                <h4 className="text-base font-black text-zinc-950 tracking-tight transition-colors group-hover:text-emerald-600 pt-1">
                  {channel.title}
                </h4>
                <p className="text-xs font-mono font-bold text-zinc-500 break-all pt-1 leading-relaxed">
                  {channel.detail}
                </p>
              </div>

              <a 
                href={channel.actionUrl}
                target={channel.actionUrl.startsWith('http') ? "_blank" : undefined}
                rel="noreferrer"
                className="inline-flex w-full justify-center rounded-xl bg-zinc-100 hover:bg-emerald-600 border border-zinc-200 hover:border-emerald-600 py-2.5 text-xs font-black text-zinc-700 hover:text-white transition-all uppercase tracking-wider text-center"
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
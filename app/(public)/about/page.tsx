export default function AboutPage() {
  return (
    <section className="mx-auto max-w-6xl space-y-16 py-6 sm:py-12 animate-fadeIn font-sans antialiased text-zinc-800">
      
      {/* 🌟 1. SPLIT HERO STYLE LAYOUT */}
      <div className="grid gap-12 md:grid-cols-2 items-center min-h-[400px] px-2">
        
        {/* Left Column: Heavy Typography & Core Profile Description */}
        <div className="space-y-6">
          <div className="space-y-2">
            <h2 className="text-4xl sm:text-6xl font-black tracking-tight text-zinc-950 uppercase leading-none">
              OUR <span className="text-emerald-600">PROFILE</span>
            </h2>
            <h3 className="text-sm sm:text-base font-extrabold tracking-wider text-zinc-400 uppercase">
              About Joy's Events and Party Place
            </h3>
          </div>
          
          <p className="text-sm text-zinc-500 font-medium leading-relaxed max-w-md">
            Joy's Events and Party Place helps clients locate, secure, and experience premier destination venues managed by our dedicated hospitality team. We maintain a curated portfolio of high-end resort villas tailored for comfort, security, and memorable celebrations. Whether you are coordinating an intimate family getaway or a grand milestone celebration, our facilities provide a seamless blend of luxury and utility.
          </p>
        </div>

        {/* Right Column: Corporate Directives Panel */}
        <div className="relative w-full p-8 rounded-3xl bg-zinc-50 border border-zinc-200 shadow-xl space-y-6 flex flex-col justify-center min-h-[300px]">
          
          <div className="space-y-1.5">
            <h4 className="text-sm font-black text-zinc-950 uppercase tracking-wider text-emerald-700">Our Mission</h4>
            <p className="text-xs text-zinc-500 leading-relaxed font-semibold">
              Deliver outstanding accommodation stays across all our corporate-managed properties with transparent baseline matrix pricing and seamless on-site support lines.
            </p>
          </div>

          <div className="space-y-1.5 border-t border-zinc-200/60 pt-4">
            <h4 className="text-sm font-black text-zinc-950 uppercase tracking-wider text-emerald-700">What We Do</h4>
            <p className="text-xs text-zinc-500 leading-relaxed font-semibold">
              We organize listings inventory, streamline confirmation ledgers, and manage incoming guest logistics so every booking performs reliably for customers and managers alike.
            </p>
          </div>

          {/* Minimal Geometric Dot Grid matching Home Page */}
          <div className="absolute top-4 right-4 grid grid-cols-2 gap-1.5 opacity-30 select-none">
            <span className="h-2 w-2 rounded-full bg-emerald-600" />
            <span className="h-2 w-2 rounded-full bg-emerald-600" />
            <span className="h-2 w-2 rounded-full bg-emerald-600" />
            <span className="h-2 w-2 rounded-full bg-emerald-600" />
          </div>
        </div>

      </div>

      {/* 🌟 2. FOUNDATIONAL PILLARS GRID (Clones home page villa card style) */}
      <div className="space-y-6 pt-6 border-t border-zinc-200/60">
        <div className="px-2">
          <p className="text-[10px] uppercase tracking-widest text-zinc-400 font-black">Our Philosophy</p>
          <h3 className="text-xl sm:text-2xl font-black text-zinc-950 tracking-tight mt-0.5 uppercase">
            Foundational Pillars
          </h3>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 px-2">
          
          <div className="flex flex-col justify-between border border-zinc-200 bg-white p-5 rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 group">
            <div className="space-y-2">
              <div>
                <span className="text-[8px] uppercase tracking-widest font-black px-2 py-0.5 bg-zinc-900 text-white rounded border">
                  Safety First
                </span>
              </div>
              <h4 className="text-base font-black text-zinc-950 tracking-tight transition-colors group-hover:text-emerald-600 pt-1">
                Uncompromised Security
              </h4>
              <p className="text-xs text-zinc-500 leading-relaxed font-medium pt-1">
                From our strict identity verification policies down to our on-site asset access control, your group's safety and privacy remain our operational priority.
              </p>
            </div>
          </div>

          <div className="flex flex-col justify-between border border-zinc-200 bg-white p-5 rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 group">
            <div className="space-y-2">
              <div>
                <span className="text-[8px] uppercase tracking-widest font-black px-2 py-0.5 bg-zinc-900 text-white rounded border">
                  Honest Ledgers
                </span>
              </div>
              <h4 className="text-base font-black text-zinc-950 tracking-tight transition-colors group-hover:text-emerald-600 pt-1">
                Absolute Transparency
              </h4>
              <p className="text-xs text-zinc-500 leading-relaxed font-medium pt-1">
                We eliminate hidden charges. All package boundaries, baseline headcount tiers, and excess visitor surcharges are clearly mapped and mathematically verified.
              </p>
            </div>
          </div>

          <div className="flex flex-col justify-between border border-zinc-200 bg-white p-5 rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 group">
            <div className="space-y-2">
              <div>
                <span className="text-[8px] uppercase tracking-widest font-black px-2 py-0.5 bg-zinc-900 text-white rounded border">
                  Guest Care
                </span>
              </div>
              <h4 className="text-base font-black text-zinc-950 tracking-tight transition-colors group-hover:text-emerald-600 pt-1">
                Hospitality Excellence
              </h4>
              <p className="text-xs text-zinc-500 leading-relaxed font-medium pt-1">
                Every facility, linen setup, infinity pool parameter, and catering option is managed by dedicated staff to ensure smooth execution.
              </p>
            </div>
          </div>

        </div>
      </div>

      {/* 🌟 3. SERVICE OFFERINGS ROW (Two Wide Minimal Blocks) */}
      <div className="space-y-6 pt-6 border-t border-zinc-200/60">
        <div className="px-2">
          <p className="text-[10px] uppercase tracking-widest text-zinc-400 font-black">Offerings</p>
          <h3 className="text-xl sm:text-2xl font-black text-zinc-950 tracking-tight mt-0.5 uppercase">
            Tailored Venue Experiences
          </h3>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 px-2">
          
          <div className="p-6 rounded-3xl bg-zinc-900 text-white space-y-3 shadow-xl relative overflow-hidden group border border-zinc-800">
            <div className="flex items-center gap-2">
              <span className="text-emerald-400 font-bold text-sm">✓</span>
              <h4 className="font-black text-white text-sm uppercase tracking-wide">Event Space Hosting</h4>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed font-medium pl-5">
              Our prime locations support milestone celebrations like weddings, corporate functions, and birthdays. We provide flexible options, offering either venue-only packages or comprehensive bookings bundled with premium catering tiers.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-zinc-900 text-white space-y-3 shadow-xl relative overflow-hidden group border border-zinc-800">
            <div className="flex items-center gap-2">
              <span className="text-emerald-400 font-bold text-sm">✓</span>
              <h4 className="font-black text-white text-sm uppercase tracking-wide">Premium Accommodations</h4>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed font-medium pl-5">
              Designed for luxury stayovers, our full-villa vacation stays feature comprehensive access to luxury amenities, dedicated housekeeping, lounge areas, and infinite pool matrices optimized for premium group leisure.
            </p>
          </div>

        </div>
      </div>

    </section>
  );
}
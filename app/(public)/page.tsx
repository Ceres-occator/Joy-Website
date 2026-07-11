import { createClient } from "@/utils/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();

  // Load properties data from Supabase
  const { data: villas, error } = await supabase
    .from("villas")
    .select("id, name, description, category_type, image_url")
    .order("name", { ascending: true });

  // Select the first villa image to display as the main featured hero asset
  let heroFeaturedImage = "";
  if (villas && villas.length > 0) {
    try {
      const parsed = villas[0].image_url ? JSON.parse(villas[0].image_url) : [];
      heroFeaturedImage = Array.isArray(parsed) ? parsed[0] : villas[0].image_url;
    } catch {
      heroFeaturedImage = villas[0].image_url || "";
    }
  }

  return (
    // 🚀 Restored max-w-6xl for desktop centering, while maintaining full-bleed responsive support on mobile
    <section className="mx-auto max-w-6xl w-full space-y-16 py-4 sm:py-12 animate-fadeIn font-sans antialiased text-zinc-800">
      
      {/* 🌟 1. RESPONSIVE HERO LAYOUT */}
      <div className="grid gap-10 md:grid-cols-[1.2fr_1fr] items-center min-h-[450px]">
        
        {/* Left Column: Heavy Typography & Action Trigger */}
        <div className="space-y-6 sm:space-y-8">
          <div className="space-y-3">
            <h2 className="text-4xl sm:text-7xl font-black tracking-tight text-zinc-950 uppercase leading-none">
              VILLAS <span className="text-emerald-600">FOR YOU</span>
            </h2>
            <h3 className="text-xs sm:text-lg font-extrabold tracking-wider text-zinc-400 uppercase">
              And enjoy your memorable stay
            </h3>
          </div>
          
          <p className="text-sm sm:text-base text-zinc-500 font-medium leading-relaxed max-w-3xl">
            Explore our curated portfolio of premium corporate-managed resort spaces in Davao City, explicitly tailored for private stay accommodations and grand event celebrations.
          </p>

          <div className="pt-2">
            <a 
              href="#catalog-gallery" 
              className="inline-block rounded-xl bg-zinc-900 hover:bg-emerald-600 px-6 py-3.5 sm:px-8 sm:py-4 text-xs sm:text-sm font-black text-white uppercase tracking-wider transition-all duration-300 shadow-lg active:scale-[0.99]"
            >
              Book your room
            </a>
          </div>
        </div>

        {/* Right Column: Showcase Image Block */}
        <div className="relative w-full aspect-[4/3] sm:aspect-[16/11] rounded-[2rem] sm:rounded-[2.5rem] bg-zinc-100 overflow-hidden border border-zinc-200/80 shadow-2xl animate-fadeIn">
          {heroFeaturedImage ? (
            <img 
              src={heroFeaturedImage} 
              alt="Featured Resort Asset" 
              className="w-full h-full object-cover select-none pointer-events-none"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-300 text-3xl">🖼️</div>
          )}
          
          <div className="absolute -bottom-2 -left-2 bg-emerald-500/10 h-24 w-24 rounded-full blur-2xl" />
          <div className="absolute top-6 right-6 grid grid-cols-2 gap-2 opacity-30 select-none">
            <span className="h-2 w-2 rounded-full bg-emerald-600" />
            <span className="h-2 w-2 rounded-full bg-emerald-600" />
            <span className="h-2 w-2 rounded-full bg-emerald-600" />
            <span className="h-2 w-2 rounded-full bg-emerald-600" />
          </div>
        </div>

      </div>

      {/* 🌟 2. CATALOG DIRECTORY GRID */}
      <div id="catalog-gallery" className="space-y-8 pt-12 border-t border-zinc-200/60">
        <div>
          <p className="text-[11px] uppercase tracking-[0.25em] text-zinc-400 font-black">Our Spaces</p>
          <h3 className="text-xl sm:text-3xl font-black text-zinc-950 tracking-tight mt-1 uppercase">
            Available Resort Accommodations
          </h3>
        </div>

        {error && (
          <p className="text-xs font-bold text-red-600 bg-red-50 border p-4 rounded-xl max-w-xl">
            ⚠️ Failed loading catalog assets array parameters: {error.message}
          </p>
        )}

        {/* 🚀 Grid configuration optimized to display perfectly within the max-w-6xl viewport constraints */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {villas?.map((villa) => {
            let thumbnail = "";
            try {
              const parsed = villa.image_url ? JSON.parse(villa.image_url) : [];
              thumbnail = Array.isArray(parsed) ? parsed[0] : villa.image_url;
            } catch { 
              thumbnail = villa.image_url || ""; 
            }

            return (
              <article key={villa.id} className="flex flex-col border border-zinc-200 bg-white p-4 rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 group">
                
                <div className="w-full aspect-[4/3] rounded-xl bg-zinc-50 overflow-hidden mb-4 relative border border-zinc-100">
                  {thumbnail ? (
                    <img src={thumbnail} alt={villa.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-102" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-300 text-xl">🖼️</div>
                  )}
                  
                  <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1">
                    {villa.category_type?.map((cat: string) => (
                      <span key={cat} className="text-[8px] uppercase tracking-widest font-black px-2 py-0.5 bg-zinc-900/90 text-white rounded border border-white/10 backdrop-blur-sm">
                        {cat}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="space-y-3 flex-1 flex flex-col justify-between">
                  <div className="space-y-1">
                    <h4 className="text-base font-black text-zinc-950 tracking-tight transition-colors group-hover:text-emerald-600">
                      {villa.name}
                    </h4>
                    <p className="text-xs text-zinc-500 line-clamp-2 leading-relaxed font-medium">
                      {villa.description}
                    </p>
                  </div>

                  <a 
                    href={`/villas/${villa.id}`} 
                    className="mt-2 inline-flex w-full justify-center rounded-xl bg-zinc-100 hover:bg-emerald-600 border border-zinc-200 hover:border-emerald-600 py-3 text-xs font-black text-zinc-700 hover:text-white transition-all uppercase tracking-wider text-center shadow-sm"
                  >
                    View Details & Book
                  </a>
                </div>

              </article>
            );
          })}
        </div>
      </div>

    </section>
  );
}
import Link from 'next/link';
import Image from 'next/image';
import { Sparkles, ShieldCheck, CalendarCheck2, MapPin, Images, CheckCircle2 } from 'lucide-react';
import { createClient } from '@/utils/supabase/server';
import { parseVillaImages } from '@/utils/formatters';
import OpenFreeMap from '@/components/map/OpenFreeMap';

export default async function HomePage() {
  const supabase = await createClient();

  const { data: villas, error } = await supabase
    .from('villas')
    .select('id, name, description, category_type, image_url, inclusions, address, latitude, longitude, map_zoom')
    .order('name', { ascending: true });

  // Collect all discovered villa images from Supabase Storage + local fallback for the Hero Bento Showcase
  const allDiscoveredImages = (villas || []).flatMap((v) => parseVillaImages(v.image_url));
  const heroBentoImages =
    allDiscoveredImages.length >= 4
      ? allDiscoveredImages.slice(0, 4)
      : [
          allDiscoveredImages[0] || '/room images/suki-villa.jpg',
          allDiscoveredImages[1] || '/room images/sandy-villa.jpg',
          allDiscoveredImages[2] || '/room images/joy-villa.jpg',
          allDiscoveredImages[3] || '/room images/suki-villa.jpg',
        ];

  const primaryVilla = villas?.[0];

  return (
    <section className="mx-auto max-w-6xl w-full space-y-16 py-4 sm:py-8 animate-fadeIn font-sans">
      {/* High-Converting Neumorphic Hero with Bento Photo Showcase */}
      <div className="neu-card p-6 sm:p-10 grid gap-8 lg:grid-cols-12 items-center">
        <div className="lg:col-span-6 space-y-6">
          <div className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-emerald-700 px-3.5 py-1.5 neu-inset-sm">
            <Sparkles className="w-3.5 h-3.5" /> Ma-a, Davao City • Private Resort &amp; Events
          </div>

          <div className="space-y-3">
            <h2 className="text-4xl sm:text-5xl font-black tracking-tight text-slate-800 leading-[1.08]">
              Celebrate &amp; Stay in <span className="text-emerald-600">Private Comfort</span>
            </h2>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
              Host unforgettable birthdays, weddings, company outings, and relaxing family stays at{' '}
              <strong>Suki&apos;s Events Space</strong> and <strong>Sandy&apos;s Villa Space</strong>
              —complete with private pools, karaoke, function halls, and instant online booking.
            </p>
          </div>

          {/* Highlight Pills */}
          <div className="grid grid-cols-3 gap-2.5 text-xs">
            <div className="neu-inset-sm p-3 space-y-0.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <p className="font-extrabold text-slate-800">PayMongo Ready</p>
              <p className="text-[11px] text-slate-500">Chinabank, QR Ph, GCash</p>
            </div>
            <div className="neu-inset-sm p-3 space-y-0.5">
              <CalendarCheck2 className="w-4 h-4 text-emerald-600" />
              <p className="font-extrabold text-slate-800">Live Calendar</p>
              <p className="text-[11px] text-slate-500">Instant slot check</p>
            </div>
            <div className="neu-inset-sm p-3 space-y-0.5">
              <MapPin className="w-4 h-4 text-emerald-600" />
              <p className="font-extrabold text-slate-800">80–100 Pax</p>
              <p className="text-[11px] text-slate-500">Pools &amp; Event Halls</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-1">
            <a
              href="#villas-list"
              className="neu-btn-primary px-7 py-3.5 text-xs sm:text-sm font-bold uppercase tracking-wider inline-block"
            >
              Explore Villas &amp; Book
            </a>
            <Link
              href="/my-bookings"
              className="neu-btn px-6 py-3.5 text-xs sm:text-sm font-bold uppercase tracking-wider inline-block"
            >
              Track My Booking
            </Link>
          </div>
        </div>

        {/* Modern Bento Photo Grid Highlighting Real Database Pictures */}
        <div className="lg:col-span-6 grid grid-cols-12 grid-rows-2 gap-3 h-[320px] sm:h-[400px]">
          <div className="col-span-7 row-span-2 neu-inset p-2 relative overflow-hidden group">
            <div className="relative w-full h-full rounded-2xl overflow-hidden">
              <Image
                src={heroBentoImages[0]}
                alt="Suki's Events Space Pool & Hall"
                fill
                priority
                sizes="(max-width: 1024px) 60vw, 420px"
                className="object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/65 via-transparent to-transparent" />
              <div className="absolute bottom-3 left-3 right-3 text-white">
                <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-600/90 px-2.5 py-0.5 rounded-md">
                  Up to 100 Guests
                </span>
                <p className="text-sm font-extrabold mt-1">Suki&apos;s Events Space</p>
              </div>
            </div>
          </div>

          <div className="col-span-5 row-span-1 neu-inset p-2 relative overflow-hidden group">
            <div className="relative w-full h-full rounded-2xl overflow-hidden">
              <Image
                src={heroBentoImages[1]}
                alt="Villa Amenities"
                fill
                sizes="(max-width: 1024px) 40vw, 260px"
                className="object-cover transition-transform duration-700 group-hover:scale-105"
              />
            </div>
          </div>

          <div className="col-span-5 row-span-1 neu-inset p-2 relative overflow-hidden group">
            <div className="relative w-full h-full rounded-2xl overflow-hidden">
              <Image
                src={heroBentoImages[2]}
                alt="Sandy's Villa Space"
                fill
                sizes="(max-width: 1024px) 40vw, 260px"
                className="object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/65 via-transparent to-transparent" />
              <div className="absolute bottom-2.5 left-2.5 right-2.5 text-white">
                <p className="text-xs font-extrabold">Sandy&apos;s Villa Space</p>
                <span className="text-[10px] text-slate-200">{allDiscoveredImages.length} Photos Available</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Villas Directory */}
      <div id="villas-list" className="space-y-8 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-emerald-700 font-bold">
              Choose Your Venue
            </p>
            <h3 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight mt-1">
              Available Villas &amp; Event Spaces
            </h3>
          </div>
          <p className="text-xs text-slate-500">
            Select a villa below to view its photo gallery, live calendar, and 3-step booking calculator.
          </p>
        </div>

        {error && (
          <p className="text-xs font-bold text-red-600 neu-inset p-4 max-w-xl">
            Could not load villas right now: {error.message}
          </p>
        )}

        <div className="grid gap-8 md:grid-cols-2">
          {villas?.map((villa) => {
            const album = parseVillaImages(villa.image_url);
            const primaryImg = album[0] || '/room images/joy-villa.jpg';
            const secondaryImgs = album.slice(1, 4);

            return (
              <article
                key={villa.id}
                className="neu-card p-5 sm:p-6 flex flex-col justify-between transition-transform duration-300 hover:-translate-y-1 group space-y-5"
              >
                <div className="space-y-4">
                  {/* Main Thumbnail + Mini Preview Strip */}
                  <div className="space-y-2.5">
                    <div className="w-full h-64 sm:h-72 neu-inset p-2 overflow-hidden relative">
                      <div className="relative w-full h-full rounded-2xl overflow-hidden">
                        <Image
                          src={primaryImg}
                          alt={villa.name}
                          fill
                          sizes="(max-width: 768px) 100vw, 540px"
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                          {villa.category_type?.map((cat: string) => (
                            <span
                              key={cat}
                              className="text-[10px] uppercase tracking-wider font-bold px-2.5 py-1 bg-slate-900/80 text-white rounded-lg backdrop-blur-sm"
                            >
                              {cat}
                            </span>
                          ))}
                        </div>
                        {album.length > 1 && (
                          <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 bg-slate-900/80 text-white rounded-lg backdrop-blur-sm">
                            <Images className="w-3.5 h-3.5 text-emerald-400" /> {album.length} Photos
                          </span>
                        )}
                      </div>
                    </div>

                    {secondaryImgs.length > 0 && (
                      <div className="grid grid-cols-3 gap-2">
                        {secondaryImgs.map((imgUrl, idx) => (
                          <div
                            key={idx}
                            className="relative h-16 rounded-xl overflow-hidden neu-inset-sm p-1"
                          >
                            <div className="relative w-full h-full rounded-lg overflow-hidden">
                              <Image
                                src={imgUrl}
                                alt={`${villa.name} view ${idx + 2}`}
                                fill
                                sizes="160px"
                                className="object-cover"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Description & Top Inclusions */}
                  <div className="space-y-2.5 px-1">
                    <h4 className="text-xl font-extrabold text-slate-800 group-hover:text-emerald-600 transition-colors">
                      {villa.name}
                    </h4>
                    <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                      {villa.description}
                    </p>

                    {villa.inclusions && villa.inclusions.length > 0 && (
                      <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {villa.inclusions.slice(0, 4).map((inc: string, idx: number) => (
                          <div
                            key={idx}
                            className="flex items-center gap-1.5 text-[11px] text-slate-600 font-semibold truncate"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span className="truncate">{inc}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <Link
                  href={`/villas/${villa.id}`}
                  className="neu-btn-primary w-full py-3.5 text-xs font-bold uppercase tracking-wider text-center block"
                >
                  View Gallery, Map &amp; Book Now
                </Link>
              </article>
            );
          })}
        </div>
      </div>

      {/* Interactive OpenFreeMap Location Section */}
      <div className="space-y-4 pt-2">
        <div>
          <p className="text-xs uppercase tracking-widest text-emerald-700 font-bold">
            Find Us Easily
          </p>
          <h3 className="text-2xl font-black text-slate-800 tracking-tight mt-0.5">
            Resort Location Map
          </h3>
        </div>
        <OpenFreeMap
          latitude={Number(primaryVilla?.latitude ?? 7.0915)}
          longitude={Number(primaryVilla?.longitude ?? 125.5826)}
          zoom={Number(primaryVilla?.map_zoom ?? 16)}
          title="Joy's Events and Party Place — Main Branch"
          address={primaryVilla?.address || 'Ma-a, Davao City, Philippines, 8000'}
          heightClass="h-80"
        />
      </div>
    </section>
  );
}
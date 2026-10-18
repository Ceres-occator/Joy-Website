import Link from 'next/link';
import Image from 'next/image';
import { ShieldCheck, CalendarCheck2, MapPin, Images, CheckCircle2, Users, ArrowRight } from 'lucide-react';
import { createClient } from '@/utils/supabase/server';
import { parseVillaImages } from '@/utils/formatters';
import OpenFreeMap from '@/components/map/OpenFreeMap';

export default async function HomePage() {
  const supabase = await createClient();

  const { data: villas, error } = await supabase
    .from('villas')
    .select('id, name, description, category_type, image_url, inclusions, address, latitude, longitude, map_zoom')
    .order('name', { ascending: true });

  // Collect all discovered villa images from Supabase Storage + local fallback for the hero photo grid
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
    <section className="mx-auto max-w-6xl w-full space-y-24 animate-fadeIn font-sans">
      {/* Hero: open layout, no wrapping card */}
      <div className="grid gap-10 lg:gap-14 lg:grid-cols-12 items-center">
        <div className="lg:col-span-6 space-y-8">
          <div className="space-y-5">
            <p className="inline-flex items-center gap-2 eyebrow">
              <MapPin className="w-4 h-4" /> Ma-a, Davao City
            </p>

            <h2 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-bold tracking-tight text-gray-900 dark:text-gray-100 leading-[1.1]">
              Celebrate and stay in <span className="text-emerald-600">private comfort</span>
            </h2>

            <p className="text-base sm:text-lg text-gray-600 dark:text-gray-300 leading-relaxed max-w-xl">
              Host birthdays, weddings, company outings, and relaxing family stays at{' '}
              <strong className="font-semibold text-gray-900 dark:text-gray-100">
                Suki&apos;s Events Space
              </strong>{' '}
              and{' '}
              <strong className="font-semibold text-gray-900 dark:text-gray-100">
                Sandy&apos;s Villa Space
              </strong>
              , with private pools, karaoke, and function halls.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <a
              href="#villas-list"
              className="neu-btn-primary px-7 py-3.5 text-sm text-center inline-block"
            >
              Explore villas
            </a>
            <Link
              href="/my-bookings"
              className="neu-btn px-7 py-3.5 text-sm font-semibold text-center inline-block"
            >
              Track my booking
            </Link>
          </div>

          {/* Highlights: one divided row instead of three separate boxes */}
          <dl className="grid grid-cols-3 divide-x divide-gray-200 dark:divide-gray-800 pt-6 border-t border-gray-200 dark:border-gray-800">
            <div className="pr-3 sm:pr-4 space-y-1">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <dt className="text-sm font-semibold text-gray-900 dark:text-gray-100">PayMongo</dt>
              <dd className="text-xs text-gray-600 dark:text-gray-300">GCash, QR Ph, Chinabank</dd>
            </div>
            <div className="px-3 sm:px-4 space-y-1">
              <CalendarCheck2 className="w-5 h-5 text-emerald-600" />
              <dt className="text-sm font-semibold text-gray-900 dark:text-gray-100">Live calendar</dt>
              <dd className="text-xs text-gray-600 dark:text-gray-300">Instant slot check</dd>
            </div>
            <div className="pl-3 sm:pl-4 space-y-1">
              <Users className="w-5 h-5 text-emerald-600" />
              <dt className="text-sm font-semibold text-gray-900 dark:text-gray-100">80 to 100 guests</dt>
              <dd className="text-xs text-gray-600 dark:text-gray-300">Pools and event halls</dd>
            </div>
          </dl>
        </div>

        {/* Photo grid: images only, no frames */}
        <div className="lg:col-span-6 grid grid-cols-12 grid-rows-2 gap-3 h-[320px] sm:h-[440px]">
          <div className="col-span-7 row-span-2 relative overflow-hidden rounded-lg group">
            <Image
              src={heroBentoImages[0]}
              alt="Suki's Events Space pool and hall"
              fill
              priority
              sizes="(max-width: 1024px) 60vw, 420px"
              className="object-cover transition-transform duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent" />
            <div className="absolute bottom-4 left-4 right-4 text-white">
              <p className="text-xs font-medium text-white/80">Up to 100 guests</p>
              <p className="text-base font-semibold">Suki&apos;s Events Space</p>
            </div>
          </div>

          <div className="col-span-5 row-span-1 relative overflow-hidden rounded-lg group">
            <Image
              src={heroBentoImages[1]}
              alt="Villa amenities"
              fill
              sizes="(max-width: 1024px) 40vw, 260px"
              className="object-cover transition-transform duration-700 group-hover:scale-105"
            />
          </div>

          <div className="col-span-5 row-span-1 relative overflow-hidden rounded-lg group">
            <Image
              src={heroBentoImages[2]}
              alt="Sandy's Villa Space"
              fill
              sizes="(max-width: 1024px) 40vw, 260px"
              className="object-cover transition-transform duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent" />
            <div className="absolute bottom-3 left-3 right-3 text-white">
              <p className="text-sm font-semibold">Sandy&apos;s Villa Space</p>
            </div>
          </div>
        </div>
      </div>

      {/* Villas */}
      <div id="villas-list" className="space-y-10 scroll-mt-24">
        <div className="max-w-2xl space-y-2">
          <p className="eyebrow">Choose your venue</p>
          <h3 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">
            Villas and event spaces
          </h3>
          <p className="text-base text-gray-600 dark:text-gray-300">
            Pick a venue to see photos, live availability, and a quick booking form.
          </p>
        </div>

        {error && (
          <p className="text-sm font-medium text-red-600 dark:text-red-400 neu-inset p-4 max-w-xl">
            Could not load villas right now: {error.message}
          </p>
        )}

        <div className="grid gap-x-8 gap-y-14 md:grid-cols-2">
          {villas?.map((villa) => {
            const album = parseVillaImages(villa.image_url);
            const primaryImg = album[0] || '/room images/joy-villa.jpg';

            return (
              <article key={villa.id} className="group flex flex-col">
                <Link
                  href={`/villas/${villa.id}`}
                  className="relative block w-full aspect-[4/3] overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-900"
                >
                  <Image
                    src={primaryImg}
                    alt={villa.name}
                    fill
                    sizes="(max-width: 768px) 100vw, 540px"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  {album.length > 1 && (
                    <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 bg-black/60 text-white rounded-md backdrop-blur-sm">
                      <Images className="w-3.5 h-3.5" /> {album.length} photos
                    </span>
                  )}
                </Link>

                <div className="pt-5 space-y-3 flex-1">
                  {villa.category_type && villa.category_type.length > 0 && (
                    <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                      {villa.category_type.join('  /  ')}
                    </p>
                  )}

                  <h4 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                    {villa.name}
                  </h4>

                  <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-3 leading-relaxed">
                    {villa.description}
                  </p>

                  {villa.inclusions && villa.inclusions.length > 0 && (
                    <ul className="pt-1 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                      {villa.inclusions.slice(0, 4).map((inc: string, idx: number) => (
                        <li
                          key={idx}
                          className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 min-w-0"
                        >
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span className="truncate">{inc}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <Link
                  href={`/villas/${villa.id}`}
                  className="mt-6 inline-flex items-center gap-2 self-start text-sm font-semibold text-emerald-700 dark:text-emerald-400 hover:gap-3 transition-all"
                >
                  View details and book <ArrowRight className="w-4 h-4" />
                </Link>
              </article>
            );
          })}
        </div>
      </div>

      {/* Location */}
      <div className="space-y-6">
        <div className="space-y-2">
          <p className="eyebrow">Find us easily</p>
          <h3 className="text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">
            Resort location
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
'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';
import { CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { parseVillaImages } from '@/utils/formatters';
import type { PackageRow, RateTierRow, Villa } from '@/types';
import BookingForm from '@/components/booking/BookingForm';
import AvailabilityCalendar from '@/components/booking/AvailabilityCalendar';
import VillaGallery from '@/components/ui/VillaGallery';
import { SkeletonBox, MapSkeleton } from '@/components/ui/Skeleton';

const OpenFreeMap = dynamic(() => import('@/components/map/OpenFreeMap'), {
  ssr: false,
  loading: () => <MapSkeleton heightClass="h-72" />,
});

export default function VillaDetailPage() {
  const params = useParams();
  const villaId = params.villaId as string;
  const supabase = createClient();

  const [villa, setVilla] = useState<Villa | null>(null);
  const [initialPackages, setInitialPackages] = useState<PackageRow[]>([]);
  const [initialRateTiers, setInitialRateTiers] = useState<RateTierRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [imagesAlbum, setImagesAlbum] = useState<string[]>([]);
  const [isAmenitiesOpen, setIsAmenitiesOpen] = useState(false);

  useEffect(() => {
    async function loadVillaDetails() {
      // Fetch villa with foreign-key joined packages and nested rate_tiers
      let { data, error } = await supabase
        .from('villas')
        .select('*, packages(*, rate_tiers(*))')
        .eq('id', villaId)
        .single();

      // Fallback if PostgREST foreign-key join cache is still refreshing
      if (error || !data) {
        const fallback = await supabase
          .from('villas')
          .select('*')
          .eq('id', villaId)
          .single();
        data = fallback.data;
      }

      if (data) {
        setVilla(data as Villa);
        setImagesAlbum(parseVillaImages(data.image_url));

        if (Array.isArray((data as any).packages)) {
          const rawPkgs = (data as any).packages as Array<PackageRow & { rate_tiers?: RateTierRow[] }>;
          setInitialPackages(
            rawPkgs.map((p) => ({
              id: p.id,
              villa_id: p.villa_id,
              name: p.name,
              excess_pax_rate: Number(p.excess_pax_rate || 0),
            }))
          );
          const nestedTiers = rawPkgs.flatMap((p) =>
            Array.isArray(p.rate_tiers) ? p.rate_tiers : []
          );
          setInitialRateTiers(nestedTiers);
        }
      }
      setLoading(false);
    }
    if (villaId) loadVillaDetails();
  }, [villaId, supabase]);

  if (loading) {
    return (
      <div
        className="mx-auto max-w-6xl grid gap-12 lg:grid-cols-[1fr_420px]"
        aria-busy="true"
      >
        <div className="space-y-8">
          <SkeletonBox className="h-[340px] sm:h-[440px] w-full rounded-lg" />
          <div className="space-y-4">
            <SkeletonBox className="h-4 w-28" />
            <SkeletonBox className="h-9 w-72 max-w-full" />
            <SkeletonBox className="h-20 w-full" />
          </div>
        </div>
        <div className="space-y-5">
          <SkeletonBox className="h-6 w-48" />
          <SkeletonBox className="h-12 w-full" />
          <SkeletonBox className="h-12 w-full" />
          <SkeletonBox className="h-40 w-full" />
          <SkeletonBox className="h-12 w-full" />
        </div>
      </div>
    );
  }

  if (!villa) {
    return (
      <div className="max-w-lg mx-auto py-24 text-center space-y-2">
        <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">Villa not found</p>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          This villa may have been removed. Please go back and choose another one.
        </p>
      </div>
    );
  }

  return (
    <section className="mx-auto max-w-6xl w-full grid gap-12 lg:grid-cols-[1fr_420px] items-start animate-fadeIn font-sans">
      {/* Left column: gallery, details, calendar, map */}
      <div className="space-y-12 w-full min-w-0">
        <VillaGallery villaName={villa.name} images={imagesAlbum} />

        {/* Villa info: plain section, no box */}
        <div className="space-y-8">
          <div className="space-y-3">
            {villa.category_type && villa.category_type.length > 0 && (
              <p className="eyebrow">{villa.category_type.join('  /  ')}</p>
            )}

            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
              {villa.name}
            </h2>

            <p className="text-base text-gray-600 dark:text-gray-300 leading-relaxed max-w-2xl">
              {villa.description}
            </p>
          </div>

          {villa.inclusions && villa.inclusions.length > 0 && (
            <div className="border-t border-gray-200 dark:border-gray-800 pt-8 space-y-5">
              <h3 className="hidden sm:block text-lg font-semibold text-gray-900 dark:text-gray-100">
                What&apos;s included
              </h3>

              <button
                type="button"
                onClick={() => setIsAmenitiesOpen(!isAmenitiesOpen)}
                aria-expanded={isAmenitiesOpen}
                className="flex sm:hidden w-full items-center justify-between py-1 text-lg font-semibold text-gray-900 dark:text-gray-100"
              >
                <span>What&apos;s included ({villa.inclusions.length})</span>
                {isAmenitiesOpen ? (
                  <ChevronUp className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                )}
              </button>

              <ul
                className={`grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3.5 ${
                  isAmenitiesOpen ? 'grid animate-fadeIn' : 'hidden sm:grid'
                }`}
              >
                {villa.inclusions.map((inclusion, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-3 text-sm text-gray-700 dark:text-gray-200"
                  >
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span className="leading-relaxed flex-1">{inclusion}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Availability Calendar */}
        <div className="border-t border-gray-200 dark:border-gray-800 pt-10 space-y-5">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Available dates
          </h3>
          <AvailabilityCalendar villaId={villa.id} />
        </div>

        {/* OpenFreeMap Interactive Location */}
        <div className="border-t border-gray-200 dark:border-gray-800 pt-10 space-y-5">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Venue location
          </h3>
          <OpenFreeMap
            latitude={Number(villa.latitude ?? 7.0915)}
            longitude={Number(villa.longitude ?? 125.5826)}
            zoom={Number(villa.map_zoom ?? 16)}
            title={villa.name}
            address={villa.address || 'Ma-a, Davao City, Philippines, 8000'}
            heightClass="h-72"
          />
        </div>
      </div>

      {/* Right column: sticky booking form */}
      <div className="w-full lg:sticky lg:top-24 pb-12">
        <BookingForm
          villaId={villa.id}
          villaTitle={villa.name}
          categoryType={villa.category_type || []}
          initialMinDepositPercent={Number(villa.min_deposit_percent ?? 50)}
          initialPackages={initialPackages}
          initialRateTiers={initialRateTiers}
        />
      </div>
    </section>
  );
}
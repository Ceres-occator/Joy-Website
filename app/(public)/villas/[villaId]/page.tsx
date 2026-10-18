'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';
import { CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { parseVillaImages } from '@/utils/formatters';
import type { Villa } from '@/types';
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
  const [loading, setLoading] = useState(true);
  const [imagesAlbum, setImagesAlbum] = useState<string[]>([]);
  const [isAmenitiesOpen, setIsAmenitiesOpen] = useState(false);

  useEffect(() => {
    async function loadVillaDetails() {
      const { data } = await supabase
        .from('villas')
        .select('*')
        .eq('id', villaId)
        .single();

      if (data) {
        setVilla(data as Villa);
        setImagesAlbum(parseVillaImages(data.image_url));
      }
      setLoading(false);
    }
    if (villaId) loadVillaDetails();
  }, [villaId, supabase]);

  if (loading) {
    return (
      <div
        className="mx-auto max-w-6xl px-2 py-6 grid gap-10 lg:grid-cols-[1fr_430px]"
        aria-busy="true"
      >
        <div className="space-y-6">
          <div className="neu-card p-4 space-y-3">
            <SkeletonBox className="h-[380px] w-full rounded-2xl" />
            <div className="flex gap-2.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <SkeletonBox key={i} className="h-14 w-20 rounded-xl" />
              ))}
            </div>
          </div>
          <div className="neu-card p-6 space-y-4">
            <SkeletonBox className="h-5 w-32" />
            <SkeletonBox className="h-8 w-64" />
            <SkeletonBox className="h-16 w-full" />
          </div>
        </div>
        <div className="neu-card p-6 space-y-5 h-[520px]">
          <SkeletonBox className="h-6 w-48" />
          <SkeletonBox className="h-10 w-full" />
          <SkeletonBox className="h-24 w-full" />
          <SkeletonBox className="h-44 w-full" />
          <SkeletonBox className="h-12 w-full" />
        </div>
      </div>
    );
  }

  if (!villa) {
    return (
      <div className="neu-card max-w-lg mx-auto p-10 text-center text-slate-600 font-bold">
        Villa not found.
      </div>
    );
  }

  return (
    <section className="mx-auto max-w-6xl w-full grid gap-10 lg:grid-cols-[1fr_430px] items-start px-1 sm:px-4 animate-fadeIn font-sans">
      {/* Left Column: Bento Gallery, Amenities, Calendar & OpenFreeMap */}
      <div className="space-y-8 w-full overflow-hidden">
        <VillaGallery villaName={villa.name} images={imagesAlbum} />

        {/* Villa Info & Amenities */}
        <div className="neu-card p-6 sm:p-8 space-y-6">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {villa.category_type?.map((cat: string) => (
                <span
                  key={cat}
                  className="text-[10px] uppercase tracking-wider font-bold text-emerald-700 px-3 py-1 neu-inset-sm"
                >
                  {cat}
                </span>
              ))}
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-slate-800">{villa.name}</h2>

            <p className="text-sm text-slate-600 leading-relaxed">{villa.description}</p>
          </div>

          {villa.inclusions && villa.inclusions.length > 0 && (
            <div className="border-t border-slate-300/60 pt-5 space-y-4">
              <h4 className="hidden sm:block text-xs font-bold text-slate-500 uppercase tracking-wider">
                What&apos;s Included
              </h4>

              <button
                type="button"
                onClick={() => setIsAmenitiesOpen(!isAmenitiesOpen)}
                className="flex sm:hidden w-full items-center justify-between p-3.5 neu-btn font-bold text-xs text-slate-700"
              >
                <span>What&apos;s Included ({villa.inclusions.length})</span>
                {isAmenitiesOpen ? (
                  <ChevronUp className="w-4 h-4 text-slate-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-500" />
                )}
              </button>

              <ul
                className={`grid grid-cols-1 sm:grid-cols-2 gap-3 ${
                  isAmenitiesOpen ? 'block animate-fadeIn' : 'hidden sm:grid'
                }`}
              >
                {villa.inclusions.map((inclusion, index) => (
                  <li
                    key={index}
                    className="flex items-start text-xs font-semibold text-slate-700 gap-2.5 neu-inset p-3.5"
                  >
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span className="leading-normal flex-1">{inclusion}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Availability Calendar */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-2">
            Available Dates
          </h4>
          <AvailabilityCalendar villaId={villa.id} />
        </div>

        {/* OpenFreeMap Interactive Location */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-2">
            Venue Location &amp; Map
          </h4>
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

      {/* Right Column: Sticky 3-Step Booking Wizard */}
      <div className="w-full lg:sticky lg:top-24 pb-12">
        <BookingForm
          villaId={villa.id}
          villaTitle={villa.name}
          categoryType={villa.category_type || []}
          initialMinDepositPercent={Number(villa.min_deposit_percent ?? 50)}
        />
      </div>
    </section>
  );
}
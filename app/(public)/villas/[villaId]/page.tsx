'use client'

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import BookingForm from "@/app/book/components/BookingForm";
import AvailabilityCalendar from "./components/AvailabilityCalendar";

interface Villa {
  id: string;
  name: string;
  description: string | null;
  category_type: string[] | null;
  image_url: string | null;
  inclusions: string[] | null;
}

export default function VillaDetailPage() {
  const params = useParams();
  const router = useRouter();
  const villaId = params.villaId as string;
  const supabase = createClient();

  const [villa, setVilla] = useState<Villa | null>(null);
  const [loading, setLoading] = useState(true);
  const [imagesAlbum, setImagesAlbum] = useState<string[]>([]);
  const [activeImgIdx, setActiveImgIdx] = useState<number>(0);
  const [isInclusionsOpen, setIsInclusionsOpen] = useState<boolean>(false);

  useEffect(() => {
    async function loadVillaSpecs() {
      const { data } = await supabase.from('villas').select('*').eq('id', villaId).single();
      if (data) {
        setVilla(data);
        try {
          const parsed = data.image_url ? JSON.parse(data.image_url) : [];
          setImagesAlbum(Array.isArray(parsed) ? parsed : [data.image_url]);
        } catch {
          setImagesAlbum(data.image_url ? [data.image_url] : []);
        }
      }
      setLoading(false);
    }
    if (villaId) loadVillaSpecs();
  }, [villaId]);

  if (loading) return <div className="p-12 text-center text-zinc-400 italic text-xs animate-pulse">Synchronizing luxury portfolio details...</div>;
  if (!villa) return <div className="p-12 text-center text-zinc-500">Specified asset matrix parameter row not found.</div>;

  return (
    <section className="mx-auto max-w-7xl w-full max-w-full overflow-x-hidden grid gap-8 lg:grid-cols-[1fr_420px] items-start px-2 sm:px-4 animate-fadeIn">
      
      {/* LEFT COLUMN: INTERACTIVE MEDIA ALBUM & SPECS */}
      <div className="space-y-6 w-full max-w-full overflow-x-hidden">
        
        {/* INTERACTIVE PHOTO ALBUM VIEW COMPONENT */}
        <div className="space-y-3 w-full max-w-full overflow-hidden">
          <div className="w-full max-w-full aspect-[4/3] sm:aspect-[16/9] rounded-2xl sm:rounded-[2rem] bg-zinc-900 overflow-hidden relative border shadow-md group">
            {imagesAlbum.length > 0 ? (
              <img src={imagesAlbum[activeImgIdx]} alt="" className="w-full h-full max-w-full object-cover transition-all duration-500" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-500 text-sm">No property photos loaded</div>
            )}

            {imagesAlbum.length > 1 && (
              <>
                <button type="button" onClick={() => setActiveImgIdx(p => p === 0 ? imagesAlbum.length - 1 : p - 1)} className="absolute left-3 top-1/2 -translate-y-1/2 h-8 w-8 sm:h-10 sm:w-10 bg-zinc-950/60 text-white font-bold rounded-full border border-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-zinc-900 transition text-xs sm:text-sm">◀</button>
                <button type="button" onClick={() => setActiveImgIdx(p => p === imagesAlbum.length - 1 ? 0 : p + 1)} className="absolute right-3 top-1/2 -translate-y-1/2 h-8 w-8 sm:h-10 sm:w-10 bg-zinc-950/60 text-white font-bold rounded-full border border-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-zinc-900 transition text-xs sm:text-sm">▶</button>
              </>
            )}
          </div>

          {/* FLUID MOBILE SWIPABLE THUMBNAIL TRACK */}
          {imagesAlbum.length > 1 && (
            <div className="w-full flex gap-2 overflow-x-auto pb-2 px-1 scrollbar-none snap-x snap-mandatory max-w-full">
              {imagesAlbum.map((img, idx) => (
                <button 
                  key={idx} 
                  type="button"
                  onClick={() => setActiveImgIdx(idx)}
                  className={`relative h-12 w-20 sm:h-16 sm:w-24 rounded-xl overflow-hidden border-2 shrink-0 transition-all snap-start ${idx === activeImgIdx ? 'border-emerald-600 ring-2 ring-emerald-500/10 scale-102 shadow-sm' : 'border-zinc-200 opacity-60'}`}
                >
                  <img src={img} className="w-full h-full object-cover pointer-events-none" alt="" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Text Description Box */}
        <div className="bg-white p-5 sm:p-8 rounded-3xl border space-y-5 max-w-full">
          <div className="space-y-2">
            <h2 className="text-xl sm:text-3xl font-black text-zinc-900 tracking-tight">{villa.name}</h2>
            <div className="flex flex-wrap gap-1">
              {villa.category_type?.map((cat: string) => (
                <span key={cat} className="text-[8px] sm:text-[9px] uppercase font-extrabold tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-100 px-2.5 py-0.5 rounded-lg">{cat}</span>
              ))}
            </div>
            <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed font-medium pt-1">{villa.description}</p>
          </div>

          {/* COLLAPSIBLE TOGGLE DROP-DOWN ACCORDION FOR INCLUSIONS */}
          {villa.inclusions && villa.inclusions.length > 0 && (
            <div className="border border-zinc-100 rounded-xl overflow-hidden shadow-sm">
              <button 
                type="button"
                onClick={() => setIsInclusionsOpen(!isInclusionsOpen)}
                className="w-full bg-zinc-50 hover:bg-zinc-100/70 px-4 py-3 flex items-center justify-between font-black text-zinc-700 text-[10px] sm:text-xs tracking-wider uppercase transition-colors"
              >
                <span>🎁 View Included Resort Amenities Inclusions</span>
                <span className={`text-xs transform transition-transform duration-300 font-bold ${isInclusionsOpen ? 'rotate-180 text-emerald-600' : 'text-zinc-400'}`}>▼</span>
              </button>

              <div className={`transition-all duration-300 overflow-hidden ${isInclusionsOpen ? 'max-h-[1000px] border-t bg-white p-4' : 'max-h-0'}`}>
                {/* 🌟 LAYOUT REPAIR: Adjusted padding rules and layout alignments */}
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {villa.inclusions.map((inclusion, index) => (
                    <li key={index} className="flex items-start text-xs font-bold text-zinc-700 gap-2.5 bg-zinc-50 border p-3 rounded-xl shadow-sm/5">
                      {/* mt-0.5 centers checkmark icon against wrapping multi-line sentences */}
                      <span className="h-4 w-4 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-[10px] border border-emerald-200 shrink-0 mt-0.5">✓</span>
                      {/* 🌟 RESPONSIVE WRAPPING FIX: Removed truncate, added flexible wrap token parameters */}
                      <span className="whitespace-normal break-words leading-normal flex-1">
                        {inclusion}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Calendar Grid Container */}
        <div className="space-y-2 max-w-full">
          <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-1">Check Live Vacancy Windows</h4>
          <AvailabilityCalendar villaId={villa.id} />
        </div>
      </div>

      {/* RIGHT COLUMN: STICKY COUNTERFORM CARRIER MODULE */}
      <div className="w-full lg:sticky lg:top-24 pb-12">
        <div className="shadow-xl rounded-3xl border overflow-hidden bg-white">
          <BookingForm 
            villaId={villa.id} 
            villaTitle={villa.name} 
            categoryType={villa.category_type || []} 
          />
        </div>
      </div>

    </section>
  );
}
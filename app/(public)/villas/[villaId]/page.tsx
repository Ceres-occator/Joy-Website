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
  
  // 🌟 NEW STATE: Controls the animated toggle accordion drop-down section
  const [isInclusionsOpen, setIsInclusionsOpen] = useState<boolean>(false);

  useEffect(() => {
    async function loadVillaSpecs() {
      const { data, error } = await supabase.from('villas').select('*').eq('id', villaId).single();
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
    <section className="mx-auto max-w-7xl w-full grid gap-8 lg:grid-cols-[1fr_420px] items-start px-2 sm:px-4 animate-fadeIn">
      
      {/* LEFT COLUMN: INTERACTIVE MEDIA ALBUM GRAPH & SPECS */}
      <div className="space-y-6 w-full">
        
        {/* 🌟 NEW FEATURE: FULL INTERACTIVE PHOTO ALBUM VIEW COMPONENT */}
        <div className="space-y-3">
          <div className="w-full aspect-[16/9] rounded-[2rem] bg-zinc-900 overflow-hidden relative border shadow-md group">
            {imagesAlbum.length > 0 ? (
              <img src={imagesAlbum[activeImgIdx]} alt="" className="w-full h-full object-cover transition-all duration-500" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-500 text-sm">No property photos loaded</div>
            )}

            {/* Album Navigation Arrow Overlays */}
            {imagesAlbum.length > 1 && (
              <>
                <button type="button" onClick={() => setActiveImgIdx(p => p === 0 ? imagesAlbum.length - 1 : p - 1)} className="absolute left-4 top-1/2 -translate-y-1/2 h-10 w-10 bg-zinc-950/60 text-white font-bold rounded-full border border-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-zinc-900 transition">◀</button>
                <button type="button" onClick={() => setActiveImgIdx(p => p === imagesAlbum.length - 1 ? 0 : p + 1)} className="absolute right-4 top-1/2 -translate-y-1/2 h-10 w-10 bg-zinc-950/60 text-white font-bold rounded-full border border-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-zinc-900 transition">▶</button>
              </>
            )}
          </div>

          {/* Album Thumbnail Directory Track Component */}
          {imagesAlbum.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1.5 px-1 scrollbar-thin">
              {imagesAlbum.map((img, idx) => (
                <button 
                  key={idx} 
                  type="button"
                  onClick={() => setActiveImgIdx(idx)}
                  className={`relative h-16 w-24 rounded-xl overflow-hidden border-2 shrink-0 transition-all ${idx === activeImgIdx ? 'border-emerald-600 ring-2 ring-emerald-500/10 scale-102 shadow-sm' : 'border-zinc-200 opacity-60 hover:opacity-100'}`}
                >
                  <img src={img} className="w-full h-full object-cover" alt="" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Text Description Box */}
        <div className="bg-white p-6 md:p-8 rounded-[2rem] shadow-sm border space-y-5">
          <div className="space-y-2">
            <h2 className="text-2xl md:text-3xl font-black text-zinc-900 tracking-tight">{villa.name}</h2>
            <div className="flex flex-wrap gap-1">
              {villa.category_type?.map(cat => (
                <span key={cat} className="text-[9px] uppercase font-extrabold tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-100 px-2.5 py-0.5 rounded-lg">{cat}</span>
              ))}
            </div>
            <p className="text-xs md:text-sm text-zinc-600 leading-relaxed font-medium pt-2">{villa.description}</p>
          </div>

          {/* 🌟 NEW FEATURE: COLLAPSIBLE TOGGLE DROP-DOWN ACCORDION FOR INCLUSIONS */}
          {villa.inclusions && villa.inclusions.length > 0 && (
            <div className="border border-zinc-100 rounded-2xl overflow-hidden shadow-sm">
              <button 
                type="button"
                onClick={() => setIsInclusionsOpen(!isInclusionsOpen)}
                className="w-full bg-zinc-50 hover:bg-zinc-100/70 px-4 py-3.5 flex items-center justify-between font-black text-zinc-700 text-xs tracking-wider uppercase transition-colors"
              >
                <span>🎁 View Included Resort Amenities Inclusions</span>
                <span className={`text-sm transform transition-transform duration-300 font-bold ${isInclusionsOpen ? 'rotate-180 text-emerald-600' : 'text-zinc-400'}`}>▼</span>
              </button>

              <div className={`transition-all duration-300 overflow-hidden ${isInclusionsOpen ? 'max-h-[500px] border-t bg-white p-4' : 'max-h-0'}`}>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {villa.inclusions.map((inclusion, index) => (
                    <li key={index} className="flex items-center text-xs font-bold text-zinc-700 gap-2 bg-zinc-50 border p-2.5 rounded-xl">
                      <span className="h-4 w-4 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-[10px] border border-emerald-200 shrink-0">✓</span>
                      <span className="truncate">{inclusion}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Centralized Availability Scheduling View Calendar Row */}
        <div className="space-y-2">
          <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-1">Check Live Vacancy Windows</h4>
          <AvailabilityCalendar villaId={villa.id} />
        </div>
      </div>

      {/* RIGHT COLUMN: STICKY COUNTERFORM CARRIER MODULE */}
      <div className="w-full lg:sticky lg:top-24 pb-12">
        <div className="shadow-xl rounded-[2rem] border overflow-hidden bg-white">
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
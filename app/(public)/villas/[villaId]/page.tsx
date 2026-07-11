'use client'

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import BookingForm from "@/app/book/components/BookingForm";
import AvailabilityCalendar from "./components/AvailabilityCalendar";
import { ChevronLeft, ChevronRight, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";

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
  
  const [isAmenitiesOpen, setIsAmenitiesOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
  }, [villaId, supabase]);

  // SERVER HYDRATION GUARD FALLBACK
  if (!mounted || loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12 animate-pulse grid gap-12 lg:grid-cols-[1fr_420px] font-sans opacity-50">
        <div className="space-y-6">
          <div className="w-full aspect-[21/13] rounded-[2.5rem] bg-zinc-200" />
          <div className="h-32 bg-white rounded-3xl border border-zinc-200 p-6 space-y-3">
            <div className="h-6 bg-zinc-200 rounded-xl w-1/3" />
            <div className="h-4 bg-zinc-200 rounded-xl w-2/3" />
          </div>
        </div>
        <div className="h-[500px] bg-white rounded-[2.5rem] border border-zinc-200" />
      </div>
    );
  }

  if (!villa) return <div className="p-12 text-center text-zinc-500 font-sans font-bold">Specified estate listing row context not found.</div>;

  return (
    <section className="mx-auto max-w-6xl w-full grid gap-12 lg:grid-cols-[1fr_420px] items-start px-2 sm:px-4 animate-fadeIn font-sans antialiased text-zinc-800">
      
      {/* 💻 LEFT COLUMN: INTERACTIVE DESIGN ALBUM & CONTENT ECOSYSTEM */}
      <div className="space-y-10 w-full max-w-full overflow-hidden">
        
        {/* PHOTO COMPONENT FRAME */}
        <div className="space-y-4 w-full max-w-full overflow-hidden">
          {/* 🔍 ELEVATED IMAGE HERO CANVAS VIEWPORT */}
          <div className="w-full aspect-[21/13] rounded-[2.5rem] bg-zinc-900 overflow-hidden relative border border-zinc-200 shadow-xl group">
            {imagesAlbum.length > 0 ? (
              <img src={imagesAlbum[activeImgIdx]} alt={villa.name} className="w-full h-full object-cover select-none pointer-events-none" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-500 text-sm">No property photos loaded</div>
            )}

            {imagesAlbum.length > 1 && (
              <>
                <button type="button" onClick={() => setActiveImgIdx(p => p === 0 ? imagesAlbum.length - 1 : p - 1)} className="absolute left-4 top-1/2 -translate-y-1/2 h-10 w-10 bg-zinc-950/70 text-white rounded-xl border border-white/10 backdrop-blur-sm flex items-center justify-center hover:bg-emerald-600 transition-colors duration-300">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button type="button" onClick={() => setActiveImgIdx(p => p === imagesAlbum.length - 1 ? 0 : p + 1)} className="absolute right-4 top-1/2 -translate-y-1/2 h-10 w-10 bg-zinc-950/70 text-white rounded-xl border border-white/10 backdrop-blur-sm flex items-center justify-center hover:bg-emerald-600 transition-colors duration-300">
                  <ChevronRight className="w-5 h-5" />
                </button>
              </>
            )}
          </div>

          {/* 📜 FIXED: FLUID NON-WRAPPING HORIZONTAL SCROLLBELT RUNWAY */}
          {imagesAlbum.length > 1 && (
            <div className="w-full overflow-x-auto flex flex-nowrap gap-3 pb-3 pt-1 px-1 snap-x snap-mandatory scroll-smooth min-w-full">
              {imagesAlbum.map((img, idx) => (
                <button 
                  key={idx} 
                  type="button"
                  onClick={() => setActiveImgIdx(idx)}
                  className={`relative h-16 w-28 rounded-xl overflow-hidden border-2 shrink-0 transition-all duration-300 snap-start ${idx === activeImgIdx ? 'border-emerald-600 ring-4 ring-emerald-600/10 scale-102 shadow-md' : 'border-zinc-200 opacity-60 hover:opacity-100'}`}
                >
                  <img src={img} className="w-full h-full object-cover pointer-events-none" alt="" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* METADATA OVERVIEW CARD */}
        <div className="bg-white p-6 sm:p-8 rounded-[2.5rem] border border-zinc-200/80 space-y-6 relative shadow-sm">
          
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {villa.category_type?.map((cat: string) => (
                <span key={cat} className="text-[8px] uppercase tracking-widest font-black bg-zinc-900 text-white border border-transparent px-2.5 py-0.5 rounded-md">
                  {cat}
                </span>
              ))}
            </div>
            
            <h2 className="text-3xl font-black text-zinc-950 uppercase tracking-tight leading-none">
              {villa.name}
            </h2>
            
            <p className="text-sm text-zinc-500 leading-relaxed font-medium pt-1">
              {villa.description}
            </p>
          </div>

          {/* CURATED RESORT INCLUSIONS LAYOUT */}
          {villa.inclusions && villa.inclusions.length > 0 && (
            <div className="border-t border-zinc-100 pt-6 space-y-4">
              
              <h4 className="hidden sm:block text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                Included Estate Amenities
              </h4>

              <button 
                type="button"
                onClick={() => setIsAmenitiesOpen(!isAmenitiesOpen)}
                className="flex sm:hidden w-full items-center justify-between p-3 bg-zinc-50 rounded-xl border border-zinc-200 font-black text-[10px] uppercase tracking-widest text-zinc-700 active:bg-zinc-100 transition-colors"
              >
                <span>Included Estate Amenities ({villa.inclusions.length})</span>
                {isAmenitiesOpen ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
              </button>

              <ul className={`grid grid-cols-1 sm:grid-cols-2 gap-3 sm:!flex sm:flex-col lg:grid lg:grid-cols-2 ${isAmenitiesOpen ? 'block animate-fadeIn' : 'hidden sm:grid'}`}>
                {villa.inclusions.map((inclusion, index) => (
                  <li key={index} className="flex items-start text-xs font-bold text-zinc-700 gap-3 bg-zinc-50 border border-zinc-100/60 p-3.5 rounded-xl shadow-inner/5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span className="leading-normal flex-1 break-words">{inclusion}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Minimal Design Accent Grid */}
          <div className="absolute top-6 right-6 grid grid-cols-2 gap-1.5 opacity-20 select-none pointer-events-none">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
          </div>
        </div>

        {/* CALENDAR DISPLAY BLOCK */}
        <div className="space-y-3">
          <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-2">
            Check Live Vacancy Windows
          </h4>
          <AvailabilityCalendar villaId={villa.id} />
        </div>
      </div>

      {/* 📋 RIGHT COLUMN: FIXED BOOKING INTERACTION PANEL CARD */}
      <div className="w-full lg:sticky lg:top-24 pb-12">
        <div className="shadow-2xl rounded-[2.5rem] border border-zinc-200 bg-white overflow-hidden">
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
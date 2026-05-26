// app/(public)/villas/[villaId]/page.tsx
import { createClient } from "@/utils/supabase/server";
import BookingForm from "@/app/book/components/BookingForm";
import AvailabilityCalendar from "./components/AvailabilityCalendar";

interface VillaDetailPageProps {
  params: Promise<{
    villaId: string;
  }>;
}

export default async function VillaDetailPage({ params }: VillaDetailPageProps) {
  const { villaId } = await params;
  const supabase = await createClient();

  const { data: villa, error } = await supabase
    .from("villas")
    .select("id, name, description, category_type, image_url, inclusions") 
    .eq("id", villaId)
    .single();

  if (error || !villa) {
    return <div className="p-6 text-center text-zinc-500">Property not found.</div>;
  }

  const typedVilla = villa as {
    id: string;
    name: string;
    description: string | null;
    category_type: string[] | null;
    image_url: string | null;
    inclusions: string[] | null;
  };

  return (
    // 🌟 DESKTOP OPTIMIZATION: Max-width expanded to 7xl, split side-by-side layout on larger viewports
    <section className="mx-auto max-w-7xl w-full grid gap-8 lg:grid-cols-[1fr_420px] items-start px-2 sm:px-4">
      
      {/* LEFT COMPONENT COLUMN: Media & Core Information Content */}
      <div className="space-y-8 w-full">
        {/* Aspect ratio scales dynamically for deep widescreen desktop immersion */}
        <div className="w-full aspect-[16/8] md:aspect-[16/7] rounded-[2rem] bg-zinc-100 overflow-hidden relative border border-zinc-200/60 shadow-md">
          {typedVilla.image_url && (
            <img src={typedVilla.image_url} alt={typedVilla.name} className="w-full h-full object-cover" />
          )}
        </div>

        {/* Text Metadata Container */}
        <div className="bg-white p-6 md:p-8 rounded-[2rem] shadow-sm border border-zinc-200/50 space-y-6">
          <div>
            <h2 className="text-3xl md:text-4xl font-black text-zinc-900 tracking-tight">{typedVilla.name}</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {typedVilla.category_type?.map(cat => (
                <span key={cat} className="text-[10px] uppercase font-extrabold tracking-wider bg-emerald-50 text-emerald-700 px-3 py-1 rounded-lg border border-emerald-100">
                  {cat}
                </span>
              ))}
            </div>
            <p className="mt-5 text-sm md:text-base text-zinc-600 leading-relaxed font-medium">{typedVilla.description}</p>
          </div>

          {/* Inclusions Array mapping Grid */}
          {typedVilla.inclusions && typedVilla.inclusions.length > 0 && (
            <div className="pt-6 border-t border-zinc-100">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4">What's Included in this Stay</h3>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {typedVilla.inclusions.map((inclusion, index) => (
                  <li key={index} className="flex items-center text-sm font-semibold text-zinc-700 gap-2.5 bg-zinc-50 border p-3 rounded-xl shadow-sm/5">
                    <span className="h-5 w-5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center text-xs shrink-0">✓</span>
                    <span className="truncate">{inclusion}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Availability Calendar Wrapper */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest px-1">Check Availability Calendar</h4>
          <AvailabilityCalendar villaId={typedVilla.id} />
        </div>
      </div>

      {/* RIGHT COMPONENT COLUMN: Sticky Intake Form (Follows scrolling behavior perfectly) */}
      <div className="w-full lg:sticky lg:top-24 pb-12">
        <div className="shadow-xl rounded-[2rem] border border-zinc-200/60 overflow-hidden bg-white">
          <BookingForm 
            villaId={typedVilla.id} 
            villaTitle={typedVilla.name} 
            categoryType={typedVilla.category_type || []} 
          />
        </div>
      </div>

    </section>
  );
}
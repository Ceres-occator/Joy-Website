// app/(public)/villas/[villaId]/page.tsx
import { createClient } from "@/utils/supabase/server";
import BookingForm from "@/app/book/components/BookingForm";
import AvailabilityCalendar from "./components/AvailabilityCalendar"; // 👈 Import the calendar

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
    return <div className="p-6 text-center">Property not found.</div>;
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
    <section className="mx-auto max-w-5xl grid gap-6 md:grid-cols-[1fr_400px]">
      <div className="space-y-6">
        {/* Hero Banner Image Container */}
        <div className="w-full aspect-[16/9] rounded-3xl bg-zinc-100 overflow-hidden relative border border-zinc-200 shadow-sm">
          {typedVilla.image_url && (
            <img src={typedVilla.image_url} alt={typedVilla.name} className="w-full h-full object-cover" />
          )}
        </div>

        {/* Text Details Description Card */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-zinc-100 space-y-6">
          <div>
            <h2 className="text-3xl font-black text-zinc-900 tracking-tight">{typedVilla.name}</h2>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {typedVilla.category_type?.map(cat => (
                <span key={cat} className="text-[10px] uppercase font-extrabold tracking-wider bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-md">
                  {cat}
                </span>
              ))}
            </div>
            <p className="mt-4 text-sm text-zinc-600 leading-relaxed">{typedVilla.description}</p>
          </div>

          {/* Inclusions Block */}
          {typedVilla.inclusions && typedVilla.inclusions.length > 0 && (
            <div className="pt-6 border-t border-zinc-100">
              <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider mb-3">What's Included</h3>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {typedVilla.inclusions.map((inclusion, index) => (
                  <li key={index} className="flex items-center text-sm text-zinc-600 gap-2">
                    <span className="text-emerald-500 text-xs">✓</span>
                    {inclusion}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* 🌟 NEW: Availability Tracker Calendar Section */}
        <div className="space-y-2">
          <h4 className="text-sm font-bold text-zinc-800 uppercase tracking-wider px-1">Check Availability Calendar</h4>
          <AvailabilityCalendar villaId={typedVilla.id} />
        </div>
      </div>

      {/* Sticky Right Side-Rail Booking Panel Form */}
      <div className="h-fit md:sticky md:top-6">
        <BookingForm 
          villaId={typedVilla.id} 
          villaTitle={typedVilla.name} 
          categoryType={typedVilla.category_type || []} 
        />
      </div>
    </section>
  );
}
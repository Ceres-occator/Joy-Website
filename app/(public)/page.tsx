import { createClient } from "@/utils/supabase/server";
import Link from "next/navigation";

export default async function HomePage() {
  const supabase = await createClient();

  const { data: villas, error } = await supabase
    .from("villas")
    .select("id, name, description, category_type, image_url")
    .order("name", { ascending: true });

  return (
    <section className="mx-auto max-w-6xl space-y-6 sm:space-y-8 animate-fadeIn">
      <div className="rounded-2xl bg-white p-6 shadow-sm sm:rounded-3xl sm:p-8 border">
        <p className="text-xs uppercase tracking-[0.3em] text-emerald-600 font-extrabold">Welcome to BOOK Portal</p>
        <h2 className="mt-2 text-2xl font-black text-zinc-900 sm:text-4xl tracking-tight">Explore Our Premium Villas Stays</h2>
        <p className="text-xs text-zinc-400 mt-1">Select from our verified luxury rentals for events, vacations, and overnight accommodations.</p>
      </div>

      {error && <p className="text-sm text-red-500 bg-red-50 border p-4 rounded-xl">Failed loading catalog assets: {error.message}</p>}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {villas?.map((villa) => {
          let thumbnail = "";
          try {
            const parsed = villa.image_url ? JSON.parse(villa.image_url) : [];
            thumbnail = Array.isArray(parsed) ? parsed[0] : villa.image_url;
          } catch { thumbnail = villa.image_url || ""; }

          return (
            <article key={villa.id} className="flex flex-col justify-between border border-zinc-200 bg-white p-5 rounded-2xl shadow-sm hover:shadow-md transition">
              <div className="w-full aspect-[4/3] rounded-xl bg-zinc-50 overflow-hidden mb-4 relative border">
                {thumbnail ? (
                  <img src={thumbnail} alt={villa.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-300 text-2xl">🖼️</div>
                )}
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-black text-zinc-900 tracking-tight">{villa.name}</h3>
                  <div className="flex gap-1">
                    {villa.category_type?.map((cat: string) => (
                      <span key={cat} className="text-[8px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded border border-emerald-100">{cat}</span>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-zinc-500 line-clamp-3 leading-relaxed">{villa.description}</p>
              </div>
              <a href={`/villas/${villa.id}`} className="mt-5 inline-flex w-full justify-center rounded-xl bg-emerald-600 hover:bg-emerald-700 py-2.5 text-xs font-bold text-white transition shadow-sm uppercase tracking-wider">View Details & Book</a>
            </article>
          );
        })}
      </div>
    </section>
  );
}
// app/(public)/page.tsx
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();

  // Fetch locations from Supabase
  const { data: locations, error } = await supabase
    .from("locations")
    .select("id, name, address")
    .order("name", { ascending: true });

  return (
    <section className="mx-auto max-w-6xl space-y-6 sm:space-y-8">
      <div className="rounded-2xl bg-white p-6 shadow-sm sm:rounded-3xl sm:p-8">
        <p className="text-xs uppercase tracking-[0.3em] text-zinc-500 sm:text-sm">
          Welcome to Maro Airbnb
        </p>
        <h2 className="mt-3 text-2xl font-semibold leading-tight text-zinc-900 sm:mt-4 sm:text-4xl">
          Find stays by location
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-600 sm:mt-4 sm:text-base">
          Select a premier region or destination below to browse luxury accommodations managed by our team.
        </p>
      </div>

      {error && <p className="text-sm text-red-500">Failed to load locations: {error.message}</p>}

      <div className="grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {locations?.map((location) => (
          <article 
            key={location.id} 
            className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition-all hover:shadow-md sm:rounded-3xl p-6"
          >
            <div>
              <div className="text-3xl mb-3">📍</div>
              <h3 className="text-xl font-semibold text-zinc-900">{location.name}</h3>
              {location.address && (
                <p className="mt-2 text-sm text-zinc-500">{location.address}</p>
              )}
            </div>
            <Link
              href={`/locations/${location.id}`}
              className="mt-6 inline-flex w-full justify-center rounded-full bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 transition"
            >
              Explore Stays
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
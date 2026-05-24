// app/(public)/page.tsx
import { createClient } from "@/utils/supabase/server";
import LocationBrowserClient from "./LocationBrowserClient";

export default async function HomePage() {
  const supabase = await createClient();

  // Added image_url to the locations select string 💸
  const { data: locations, error } = await supabase
    .from("locations")
    .select(`
      id,
      name,
      address,
      image_url, 
      villas (
        category_type
      )
    `)
    .order("name", { ascending: true });

  const formattedLocations = locations?.map(loc => {
    const rawCategories = loc.villas?.flatMap(v => v.category_type || []) || [];
    const uniqueCategories = Array.from(new Set(rawCategories));

    return {
      id: loc.id,
      name: loc.name,
      address: loc.address,
      image_url: loc.image_url, // Make sure it passes down to the client component here!
      categories: uniqueCategories
    };
  }) || [];

  return (
    <section className="mx-auto max-w-6xl space-y-6 sm:space-y-8">
      <div className="rounded-2xl bg-white p-6 shadow-sm sm:rounded-3xl sm:p-8">
        <p className="text-xs uppercase tracking-[0.3em] text-zinc-500 sm:text-sm">
          Welcome to Maro Airbnb
        </p>
        <h2 className="mt-3 text-2xl font-semibold leading-tight text-zinc-900 sm:mt-4 sm:text-4xl">
          Find stays by category
        </h2>
      </div>

      {error && <p className="text-sm text-red-500">Failed to load locations: {error.message}</p>}

      <LocationBrowserClient initialLocations={formattedLocations} />
    </section>
  );
}
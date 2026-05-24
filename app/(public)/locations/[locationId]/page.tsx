// app/(public)/locations/[locationId]/page.tsx
import { createClient } from "@/utils/supabase/server";
import VillaBrowserClient from "./VillaBrowserClient";

interface LocationPageProps {
  params: Promise<{
    locationId: string;
  }>;
}

export default async function LocationVillasPage({ params }: LocationPageProps) {
  const { locationId } = await params;
  const supabase = await createClient();

  const { data: location } = await supabase
    .from("locations")
    .select("name")
    .eq("id", locationId)
    .single();

  // Added image_url to the villas select query string 💸
  const { data: villas, error } = await supabase
    .from("villas")
    .select("id, name, description, category_type, image_url")
    .eq("location_id", locationId)
    .order("name", { ascending: true });

  return (
    <section className="mx-auto max-w-6xl space-y-6">
      <div className="rounded-2xl bg-white p-6 shadow-sm sm:rounded-3xl sm:p-8">
        <h2 className="text-2xl font-semibold text-zinc-900 sm:text-3xl">
          Available Stays in {location?.name || "Location"}
        </h2>
      </div>

      {error && <p className="text-red-500">Error: {error.message}</p>}

      <VillaBrowserClient initialVillas={villas || []} />
    </section>
  );
}
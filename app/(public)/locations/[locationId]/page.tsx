import Link from "next/link";
import { createClient } from "@/utils/supabase/server";

interface LocationPageProps {
  params: Promise<{
    locationId: string;
  }>;
}

export default async function LocationVillasPage({ params }: LocationPageProps) {
  // CRITICAL: Await the params promise first
  const { locationId } = await params;
  const supabase = await createClient();

  const { data: location } = await supabase
    .from("locations")
    .select("name")
    .eq("id", locationId)
    .single();

  const { data: villas, error } = await supabase
    .from("villas")
    .select("id, name, description")
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {villas?.map((villa) => (
          <article key={villa.id} className="border border-zinc-200 bg-white p-6 rounded-2xl shadow-sm">
            <h3 className="text-lg font-semibold text-zinc-900">{villa.name}</h3>
            <p className="mt-2 text-sm text-zinc-600 line-clamp-2">{villa.description}</p>
            <Link
              href={`/villas/${villa.id}`}
              className="mt-4 inline-flex w-full justify-center rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
            >
              View Details
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
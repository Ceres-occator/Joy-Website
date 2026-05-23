import { createClient } from "@/utils/supabase/server";
import BookingForm from "@/app/book/components/BookingForm";

interface VillaDetailPageProps {
  params: Promise<{
    villaId: string;
  }>;
}

export default async function VillaDetailPage({ params }: VillaDetailPageProps) {
  // CRITICAL: Await the params promise first
  const { villaId } = await params;
  const supabase = await createClient();

  const { data: villa, error } = await supabase
    .from("villas")
    .select("id, name, description")
    .eq("id", villaId)
    .single();

  if (error || !villa) {
    return <div className="p-6 text-center">Property not found.</div>;
  }

  return (
    <section className="mx-auto max-w-5xl grid gap-6 md:grid-cols-[1fr_400px]">
      <div className="bg-white p-6 rounded-2xl shadow-sm">
        <h2 className="text-2xl font-bold text-zinc-900">{villa.name}</h2>
        <p className="mt-4 text-sm text-zinc-600">{villa.description}</p>
      </div>
      <div>
        <BookingForm villaId={villa.id} villaTitle={villa.name} />
      </div>
    </section>
  );
}
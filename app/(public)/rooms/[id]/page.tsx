import Link from "next/link";
import Image from "next/image";
import { propertyImages } from "../../../../utils/images";

interface RoomPageProps {
  params: {
    id: string;
  };
}

const roomDetails: Record<string, { title: string; description: string; price: string }> = {
  "sunset-villa": {
    title: "Sunset Villa",
    description: "A premium beachfront home with sweeping ocean views, large terraces, and luxury finishes.",
    price: "$260/night",
  },
  "city-loft": {
    title: "City Loft",
    description: "Modern downtown loft near restaurants, cafes, and nightlife with premium workspace options.",
    price: "$190/night",
  },
  "forest-cabin": {
    title: "Forest Cabin",
    description: "Cozy cabin retreat with forest views, private deck, and easy access to hiking trails.",
    price: "$145/night",
  },
};

export default function RoomDetailPage({ params }: RoomPageProps) {
  const room = roomDetails[params.id] ?? {
    title: "Unknown room",
    description: "This property is not available right now.",
    price: "Contact us",
  };

  return (
    <section className="mx-auto max-w-4xl space-y-6">
      <div className="aspect-[16/9] overflow-hidden rounded-2xl bg-zinc-100 sm:rounded-3xl">
        <Image
          src={propertyImages[params.id as keyof typeof propertyImages] || "/images/placeholder.jpg"}
          alt={room.title}
          width={800}
          height={450}
          className="h-full w-full object-cover"
          priority
        />
      </div>

      <div className="space-y-4 rounded-2xl bg-white p-6 shadow-sm sm:rounded-3xl sm:p-8">
        <div className="space-y-3">
          <h2 className="text-2xl font-semibold text-zinc-900 sm:text-3xl">{room.title}</h2>
          <p className="text-sm text-zinc-600 sm:text-base">{room.description}</p>
          <p className="text-xl font-semibold text-zinc-900 sm:text-2xl">{room.price}</p>
        </div>

        <div className="grid gap-4 sm:gap-6 sm:grid-cols-[1fr_300px]">
          <div className="space-y-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 sm:rounded-3xl sm:p-6">
            <h3 className="text-lg font-semibold text-zinc-900 sm:text-xl">Booking information</h3>
            <p className="text-sm text-zinc-600">Select your dates, guest count, and confirm availability for this property.</p>
            <button className="w-full rounded-full bg-zinc-900 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-700 sm:px-5">
              Request booking
            </button>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:rounded-3xl sm:p-6">
            <h3 className="text-base font-semibold text-zinc-900 sm:text-lg">Need help?</h3>
            <p className="mt-2 text-sm text-zinc-600 sm:mt-3">Our team can assist with custom stays, group bookings, or longer visits.</p>
            <Link href="/contact" className="mt-4 inline-flex text-sm font-medium text-zinc-900 underline sm:mt-5">
              Contact support
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

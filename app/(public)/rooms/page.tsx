import Link from "next/link";
import Image from "next/image";
import { propertyImages } from "../../../utils/images";


const rooms = [
  { id: "sunset-villa", title: "Sunset Villa", price: "$260/night" },
  { id: "city-loft", title: "City Loft", price: "$190/night" },
  { id: "forest-cabin", title: "Forest Cabin", price: "$145/night" },
];

export default function RoomsPage() {
  return (
    <section className="mx-auto max-w-6xl space-y-6">
      <div className="rounded-2xl bg-white p-6 shadow-sm sm:rounded-3xl sm:p-8">
        <h2 className="text-2xl font-semibold text-zinc-900 sm:text-3xl">Available rentals</h2>
        <p className="mt-2 text-sm text-zinc-600 sm:mt-3 sm:text-base">
          Browse our current room inventory and choose the best property for your stay.
        </p>
      </div>

      <div className="grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {rooms.map((room) => (
          <article key={room.id} className="group overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition-all hover:shadow-md sm:rounded-3xl">
            <div className="aspect-[4/3] overflow-hidden bg-zinc-100">
              <Image
                src={propertyImages[room.id as keyof typeof propertyImages]}
                alt={room.title}
                width={400}
                height={300}
                className="h-full w-full object-cover transition-transform group-hover:scale-105"
                unoptimized // Allow SVG files to be used directly
              />
            </div>
            <div className="p-4 sm:p-6">
              <h3 className="text-lg font-semibold text-zinc-900 sm:text-xl">{room.title}</h3>
              <p className="mt-2 text-lg font-semibold text-zinc-900 sm:mt-3">{room.price}</p>
              <Link
                href={`/rooms/${room.id}`}
                className="mt-4 inline-flex w-full justify-center rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 sm:mt-6 sm:px-5 sm:py-3"
              >
                View room
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

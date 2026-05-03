import Link from "next/link";
import Image from "next/image";
import { propertyImages } from "../../utils/images";

const sampleProperties = [
  { id: "sunset-villa", title: "Sunset Villa", description: "Beachfront retreat with modern amenities." },
  { id: "city-loft", title: "City Loft", description: "Downtown apartment minutes from restaurants." },
  { id: "forest-cabin", title: "Forest Cabin", description: "Quiet escape with hiking access." },
];

export default function HomePage() {
  return (
    <section className="mx-auto max-w-6xl space-y-6 sm:space-y-8">
      <div className="rounded-2xl bg-white p-6 shadow-sm sm:rounded-3xl sm:p-8">
        <p className="text-xs uppercase tracking-[0.3em] text-zinc-500 sm:text-sm">
          Welcome to Maro Airbnb
        </p>
        <h2 className="mt-3 text-2xl font-semibold leading-tight text-zinc-900 sm:mt-4 sm:text-4xl">
          Showcase of our best company properties
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-600 sm:mt-4 sm:text-base">
          Browse high-quality rentals, compare accommodations, and book your next stay with confidence.
        </p>
      </div>

      <div className="grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {sampleProperties.map((property) => (
          <article key={property.id} className="group overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition-all hover:shadow-md sm:rounded-3xl">
            <div className="aspect-[4/3] overflow-hidden bg-zinc-100">
              <Image
                src={propertyImages[property.id as keyof typeof propertyImages]}
                alt={property.title}
                width={400}
                height={300}
                className="h-full w-full object-cover transition-transform group-hover:scale-105"
                priority={property.id === "sunset-villa"}
              />
            </div>
            <div className="p-4 sm:p-6">
              <h3 className="text-lg font-semibold text-zinc-900 sm:text-xl">{property.title}</h3>
              <p className="mt-2 text-sm text-zinc-600 sm:mt-3">{property.description}</p>
              <Link
                href={`/rooms/${property.id}`}
                className="mt-4 inline-flex rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 sm:mt-6 sm:px-5 sm:py-3"
              >
                View details
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

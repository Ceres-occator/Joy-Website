import Link from "next/link";
import Image from "next/image";
import { propertyImages } from "../utils/images";

const branch = {
  id: "ma-a-branch",
  title: "Ma-a Branch",
  description: "Joy's Events and Party Place is located at Ma-a Branch, with two premium villa options ready for booking.",
  featuredVilla: "Sandy's Villa",
};

export default function HomePage() {
  return (
    <section className="mx-auto max-w-6xl space-y-6 sm:space-y-8">
      <div className="rounded-2xl bg-white p-6 shadow-sm sm:rounded-3xl sm:p-8">
        <p className="text-xs uppercase tracking-[0.3em] text-zinc-500 sm:text-sm">Location</p>
        <h2 className="mt-3 text-2xl font-semibold leading-tight text-zinc-900 sm:mt-4 sm:text-4xl">
          Available location: Ma-a Branch
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-600 sm:mt-4 sm:text-base">
          Click the branch below to view the two villas available at Ma-a Branch, then select a villa and book with your event details.
        </p>
      </div>

      <article className="group mx-auto max-w-4xl overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm transition-all hover:shadow-md">
        <div className="grid gap-0 lg:grid-cols-[360px_1fr]">
          <div className="aspect-[4/3] overflow-hidden bg-zinc-100 lg:aspect-auto">
            {propertyImages[branch.featuredVilla as keyof typeof propertyImages] ? (
              <Image
                src={propertyImages[branch.featuredVilla as keyof typeof propertyImages]}
                alt={branch.title}
                width={600}
                height={450}
                className="h-full w-full object-cover"
                priority
              />
            ) : (
              <div className="h-full w-full bg-zinc-200" />
            )}
          </div>
          <div className="p-6 sm:p-8">
            <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Branch</p>
            <h3 className="mt-2 text-2xl font-semibold text-zinc-900 sm:text-3xl">{branch.title}</h3>
            <p className="mt-4 text-sm leading-relaxed text-zinc-600 sm:text-base">{branch.description}</p>
            <Link
              href="/rooms"
              className="mt-6 inline-flex rounded-full bg-emerald-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600"
            >
              View villas in Ma-a Branch
            </Link>
          </div>
        </div>
      </article>
    </section>
  );
}

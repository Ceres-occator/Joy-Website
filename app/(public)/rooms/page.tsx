import Link from 'next/link'
import Image from 'next/image'
import { propertyImages } from '../../utils/images'
import { getVillas, VillaListItem } from '@/actions/villas'

export default async function RoomsPage() {
  const villas = await getVillas()

  return (
    <section className="mx-auto max-w-6xl space-y-6">
      <div className="rounded-2xl bg-white p-6 shadow-sm sm:rounded-3xl sm:p-8">
        <p className="text-xs uppercase tracking-[0.3em] text-zinc-500 sm:text-sm">Ma-a Branch</p>
        <h2 className="text-2xl font-semibold text-zinc-900 sm:text-3xl">Villas at Ma-a Branch</h2>
        <p className="mt-2 text-sm text-zinc-600 sm:mt-3 sm:text-base">
          Choose one of the available villas at Ma-a Branch, then complete the booking form for your event.
        </p>
      </div>

      <div className="grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-2">
        {villas.map((villa: VillaListItem) => (
          <article key={villa.id} className="group overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition-all hover:shadow-md sm:rounded-3xl">
            <div className="aspect-[4/3] overflow-hidden bg-zinc-100">
              <Image
                src={propertyImages[villa.name] ?? '/room images/placeholder.jpg'}
                alt={villa.name}
                width={400}
                height={300}
                className="h-full w-full object-cover transition-transform group-hover:scale-105"
                unoptimized
              />
            </div>
            <div className="p-4 sm:p-6">
              <h3 className="text-lg font-semibold text-zinc-900 sm:text-xl">{villa.name}</h3>
              <p className="mt-2 text-sm text-zinc-600">{villa.location?.[0]?.name ?? 'Ma-a Branch'}</p>
              <p className="mt-3 text-sm text-zinc-600 line-clamp-3">{villa.description ?? 'A premium event villa at Ma-a Branch.'}</p>
              <Link
                href={`/rooms/${villa.id}`}
                className="mt-4 inline-flex w-full justify-center rounded-full bg-emerald-500 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600 sm:mt-6 sm:px-5 sm:py-3"
              >
                Book this villa
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

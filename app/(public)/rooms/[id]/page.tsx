import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import BookingForm from '@/book/components/Bookingform'
import { propertyImages } from '@/utils/images'
import { getVillaById, getVillaStartingPrice } from '@/actions/villas'

interface RoomPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function RoomDetailPage({ params: paramsPromise }: RoomPageProps) {
  const params = await paramsPromise
  const room = await getVillaById(params.id)

  if (!room) {
    notFound()
  }

  const startingPrice = await getVillaStartingPrice(params.id)

  return (
    <section className="mx-auto max-w-6xl space-y-6">
      <div className="space-y-4 rounded-2xl bg-white p-6 shadow-sm sm:rounded-3xl sm:p-8">
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Location</p>
          <p className="text-sm text-zinc-600">{room.location?.[0]?.name ?? 'Ma-a Branch'}</p>
          <h2 className="text-3xl font-semibold text-zinc-900 sm:text-4xl">{room.name}</h2>
          <p className="text-sm text-zinc-600 sm:text-base">{room.description ?? 'Plan your event with our premium villa.'}</p>
          {startingPrice !== null && (
            <p className="text-lg font-semibold text-emerald-600">Starting from ₱{startingPrice.toLocaleString()}</p>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_460px]">
        <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-zinc-900 sm:text-xl">About this villa</h3>
            <p className="text-sm text-zinc-600">Complete the booking form below with your event name, schedule, guest count, and contact details, then continue to payment.</p>
            <ul className="space-y-3 text-sm text-zinc-600">
              <li>• Booking is specific to the selected villa at Ma-a Branch</li>
              <li>• Upload your valid ID and proof of payment on the next page</li>
              <li>• Pricing updates automatically once your core event details are entered</li>
            </ul>
          </div>

          <div className="rounded-2xl overflow-hidden bg-zinc-100">
            <Image
              src={propertyImages[room.name] ?? '/room images/placeholder.jpg'}
              alt={room.name}
              width={1200}
              height={700}
              className="h-full w-full object-cover"
              priority
            />
          </div>

          <Link href="/rooms" className="inline-flex text-sm font-medium text-zinc-900 underline">
            Back to Ma-a villas
          </Link>
        </div>

        <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-6 shadow-sm">
          <div className="mb-6 space-y-2">
            <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Book this villa</p>
            <h3 className="text-2xl font-semibold text-zinc-900">Booking form</h3>
            <p className="text-sm text-zinc-600">Fill in your event details, upload your documents, and review your quote.</p>
          </div>
          <BookingForm villaId={room.id} villaTitle={room.name} />
        </div>
      </div>
    </section>
  )
}

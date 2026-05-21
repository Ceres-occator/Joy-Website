'use client'

import { useMemo, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'

export default function PaymentPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()

  const villaId = Array.isArray(params?.id) ? params.id[0] : params?.id || ''
  const villaTitle = searchParams.get('villaTitle') ?? 'Selected villa'
  const eventName = searchParams.get('eventName') ?? ''
  const fullName = searchParams.get('fullName') ?? ''
  const phone = searchParams.get('phone') ?? ''
  const schedule = searchParams.get('schedule') ?? ''
  const eventType = searchParams.get('eventType') ?? ''
  const paxCount = Number(searchParams.get('paxCount') ?? '0')
  const packageOption = searchParams.get('packageOption') ?? ''
  const basePrice = Number(searchParams.get('basePrice') ?? '0')
  const price = Number(searchParams.get('price') ?? '0')

  const [validIdFile, setValidIdFile] = useState<File | null>(null)
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [referenceId, setReferenceId] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = Boolean(validIdFile && receiptFile && referenceId.trim() && fullName && phone && schedule)

  const bookingSummary = useMemo(
    () => [
      { label: 'Villa', value: villaTitle },
      { label: 'Event name', value: eventName || 'Not specified' },
      { label: 'Full name', value: fullName },
      { label: 'Contact', value: phone },
      { label: 'Schedule', value: schedule },
      { label: 'Event type', value: eventType },
      { label: 'Pax count', value: paxCount ? String(paxCount) : 'Not specified' },
      { label: 'Package option', value: packageOption || 'Not specified' },
      { label: 'Base price', value: `₱${basePrice.toLocaleString()}` },
      { label: 'Estimated total', value: `₱${price.toLocaleString()}` },
    ],
    [villaTitle, eventName, fullName, phone, schedule, eventType, paxCount, packageOption, basePrice, price]
  )

  const handleSubmit = async () => {
    if (!canSubmit) return

    setLoading(true)
    setError(null)
    setMessage(null)

    try {
      const formData = new FormData()
      formData.append('villaId', villaId)
      formData.append('referenceId', referenceId.trim())
      if (validIdFile) formData.append('validId', validIdFile)
      if (receiptFile) formData.append('receipt', receiptFile)

      const response = await fetch('/api/booking/complete', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()
      if (!response.ok) {
        throw new Error(result?.error || 'Failed to complete booking')
      }

      setMessage(result.message || 'Payment details submitted successfully.')
      router.push('/rooms')
    } catch (err: any) {
      setError(err.message || 'Unable to submit payment details')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6">
      <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Payment details</p>
          <h1 className="text-3xl font-semibold text-zinc-900">Confirm your payment</h1>
          <p className="text-sm text-zinc-600">Upload your valid ID, payment receipt, and enter the reference code.</p>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-5">
              <h2 className="text-lg font-semibold text-zinc-900">Booking summary</h2>
              <div className="mt-4 space-y-3 text-sm text-zinc-700">
                {bookingSummary.map((item) => (
                  <div key={item.label} className="flex justify-between border-b border-zinc-200 py-2 last:border-b-0">
                    <span>{item.label}</span>
                    <span className="font-medium text-zinc-900">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-zinc-200 bg-white p-5">
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-zinc-900">Valid ID</label>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(event) => setValidIdFile(event.target.files?.[0] ?? null)}
                    className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-3 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                  {validIdFile && <p className="mt-2 text-xs text-zinc-500">Selected: {validIdFile.name}</p>}
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold text-zinc-900">Online Receipt</label>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(event) => setReceiptFile(event.target.files?.[0] ?? null)}
                    className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-3 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                  {receiptFile && <p className="mt-2 text-xs text-zinc-500">Selected: {receiptFile.name}</p>}
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold text-zinc-900">Reference ID</label>
                  <input
                    type="text"
                    value={referenceId}
                    onChange={(event) => setReferenceId(event.target.value)}
                    placeholder="Payment reference ID"
                    className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!canSubmit || loading}
                  className={`w-full rounded-full px-5 py-3 text-sm font-semibold text-white transition ${
                    canSubmit && !loading ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-zinc-300 text-zinc-500 cursor-not-allowed'
                  }`}
                >
                  {loading ? 'Submitting...' : 'Submit Payment Details'}
                </button>

                {message && <p className="text-sm text-emerald-600">{message}</p>}
                {error && <p className="text-sm text-red-500">{error}</p>}
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-6">
            <h2 className="text-lg font-semibold text-zinc-900">What happens next?</h2>
            <p className="mt-3 text-sm text-zinc-600">
              After you submit the valid ID, online receipt, and reference ID, our team will verify your payment and confirm your villa booking.
            </p>
            <div className="mt-6 space-y-3 text-sm text-zinc-700">
              <div>
                <p className="font-semibold text-zinc-900">1. Review documents</p>
                <p>We will validate the file uploads and reference code.</p>
              </div>
              <div>
                <p className="font-semibold text-zinc-900">2. Confirm payment</p>
                <p>Once verified, your booking will be reserved for the scheduled date.</p>
              </div>
              <div>
                <p className="font-semibold text-zinc-900">3. Receive confirmation</p>
                <p>We will contact you using the phone number provided.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

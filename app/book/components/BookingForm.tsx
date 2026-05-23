'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

interface BookingFormProps {
  villaId: string
  villaTitle: string
}

interface DbQuoteResponse {
  base_tier_used: number
  base_rate_price: number
  excess_pax_count: number
  excess_pax_price: number
  overnight_price: number
  total_price: number
  is_slot_available: boolean
}

export default function BookingForm({ villaId, villaTitle }: BookingFormProps) {
  const router = useRouter()
  const [eventName, setEventName] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  
  // Explicit isolated booking slots 
  const [eventDate, setEventDate] = useState('')
  const [timeSlot, setTimeSlot] = useState<'day' | 'evening'>('day')
  
  const [eventType, setEventType] = useState('Birthday')
  const [paxCount, setPaxCount] = useState(50)
  const [packageOption, setPackageOption] = useState<'with_catering' | 'venue_only'>('with_catering')
  
  const [includeOvernight, setIncludeOvernight] = useState(false)
  const [overnightPaxCount, setOvernightPaxCount] = useState(0)

  const [quote, setQuote] = useState<DbQuoteResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canRequestQuote = Boolean(villaId && eventDate && timeSlot && paxCount > 0)

  // Automatically turn off overnights safely if user picks the Day slot
  useEffect(() => {
    if (timeSlot === 'day') {
      setIncludeOvernight(false)
      setOvernightPaxCount(0)
    }
  }, [timeSlot])

  useEffect(() => {
    if (!canRequestQuote) {
      setQuote(null)
      setError(null)
      return
    }

    const controller = new AbortController()

    const fetchQuote = async () => {
      setError(null)
      setLoading(true)
      try {
        const response = await fetch('/api/booking/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            villaId,
            eventDate,
            timeSlot,
            paxCount,
            packageOption,
            includeOvernight,
            overnightPaxCount: includeOvernight ? overnightPaxCount : 0
          }),
          signal: controller.signal,
        })

        const body = await response.json().catch(() => null)

        if (!response.ok) {
          throw new Error(body?.error || 'Could not compute calculation values.')
        }

        setQuote(body as DbQuoteResponse)
      } catch (err: any) {
        if (err.name === 'AbortError') return
        setQuote(null)
        setError(err.message || 'Unable to calculate price')
      } finally {
        setLoading(false)
      }
    }

    fetchQuote()
    return () => controller.abort()
  }, [villaId, eventDate, timeSlot, paxCount, packageOption, includeOvernight, overnightPaxCount, canRequestQuote])

  const submitDisabled = !fullName.trim() || !phone.trim() || !eventDate || !quote || Boolean(error)

  const paymentUrl = useMemo(() => {
    const params = new URLSearchParams({
      villaTitle,
      eventName,
      fullName,
      phone,
      eventDate,
      timeSlot,
      eventType,
      paxCount: String(paxCount),
      packageOption,
      includeOvernight: String(includeOvernight),
      overnightPaxCount: String(overnightPaxCount),
      price: String(quote?.total_price ?? 0),
    })
    return `/villas/${villaId}/payment?${params.toString()}`
  }, [villaId, villaTitle, eventName, fullName, phone, eventDate, timeSlot, eventType, paxCount, packageOption, includeOvernight, overnightPaxCount, quote])

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="space-y-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Booking information</p>
            <h2 className="mt-2 text-xl font-semibold text-zinc-900">{villaTitle}</h2>
            <p className="text-sm text-zinc-600">Provide details to generate real-time booking quotes.</p>
          </div>

          <div className="grid gap-4">
            <div>
              <label className="mb-1 block text-sm font-semibold text-zinc-900">Event Name (Optional)</label>
              <input type="text" value={eventName} onChange={(e) => setEventName(e.target.value)} placeholder="Text" className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none" />
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-zinc-900">Full Name</label>
              <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Text" className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none" />
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-zinc-900">Contact Information</label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number" className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none" />
            </div>

            {/* In-Sync Date and Slot Selection Controls */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-semibold text-zinc-900">Select Date</label>
                <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-zinc-900">Time Slot Choice</label>
                <select value={timeSlot} onChange={(e) => setTimeSlot(e.target.value as any)} className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none">
                  <option value="day">Day Slot (4 Hrs, 11 AM - 3 PM)</option>
                  <option value="evening">Evening Slot (5 Hrs, 5 PM - 10 PM)</option>
                </select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-semibold text-zinc-900">Event Type</label>
                <select value={eventType} onChange={(e) => setEventType(e.target.value)} className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none">
                  <option>Birthday</option>
                  <option>Wedding</option>
                  <option>Corporate</option>
                  <option>Private party</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-zinc-900">Catering Choice</label>
                <select value={packageOption} onChange={(e) => setPackageOption(e.target.value as any)} className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none">
                  <option value="with_catering">With catering support</option>
                  <option value="venue_only">Venue only (No catering)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-zinc-900">Total Event Guests</label>
              <input type="number" min={1} value={paxCount} onChange={(e) => setPaxCount(Number(e.target.value))} className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none" />
            </div>

            {/* Dynamic Overnight Stay Selection */}
            {timeSlot === 'evening' && (
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 space-y-3">
                <label className="flex items-center space-x-2 cursor-pointer select-none">
                  <input type="checkbox" checked={includeOvernight} onChange={(e) => setIncludeOvernight(e.target.checked)} className="accent-emerald-600 h-4 w-4" />
                  <span className="text-sm font-semibold text-zinc-900">Add Optional Overnight Stay Add-on</span>
                </label>
                
                {includeOvernight && (
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-zinc-700">Overnight Guest Headcount</label>
                    <input type="number" min={0} value={overnightPaxCount} onChange={(e) => setOvernightPaxCount(Number(e.target.value))} className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none" />
                  </div>
                )}
              </div>
            )}
          </div>

          {loading && <p className="text-sm text-zinc-500 animate-pulse">Checking slot availability & rates...</p>}
          {error && <p className="text-sm text-red-500 bg-red-50 border border-red-200 p-3 rounded-xl font-medium">{error}</p>}
        </div>

        {quote && !error && (
          <div className="mt-6 rounded-3xl border border-emerald-200 bg-emerald-950/5 p-5">
            <h3 className="text-lg font-semibold text-zinc-900">Estimated price breakdown</h3>
            <p className="mt-1 text-xs text-zinc-500">Calculated via live matrix tier: {quote.base_tier_used} Pax Base</p>
            
            <div className="mt-4 space-y-3 text-sm text-zinc-700">
              <div className="flex justify-between">
                <span>Base Tier Package Price</span>
                <span>₱{quote.base_rate_price.toLocaleString()}</span>
              </div>
              
              {quote.excess_pax_count > 0 && (
                <div className="flex justify-between text-zinc-600">
                  <span>Excess Pax Fee (+{quote.excess_pax_count} Pax)</span>
                  <span>₱{quote.excess_pax_price.toLocaleString()}</span>
                </div>
              )}

              {quote.overnight_price > 0 && (
                <div className="flex justify-between text-zinc-600">
                  <span>Overnight Stay Add-on Fee</span>
                  <span>₱{quote.overnight_price.toLocaleString()}</span>
                </div>
              )}

              <hr className="border-zinc-200 my-2" />

              <div className="flex justify-between text-base">
                <span className="font-medium text-zinc-900">Total Price</span>
                <span className="font-bold text-emerald-600">₱{quote.total_price.toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}

        <button
          type="button"
          disabled={submitDisabled}
          onClick={() => router.push(paymentUrl)}
          className={`w-full mt-4 rounded-full px-5 py-3 text-sm font-semibold text-white transition ${
            submitDisabled ? 'bg-zinc-300 text-zinc-500 cursor-not-allowed' : 'bg-emerald-500 hover:bg-emerald-600'
          }`}
        >
          Proceed to Payment
        </button>
      </div>
    </div>
  )
}
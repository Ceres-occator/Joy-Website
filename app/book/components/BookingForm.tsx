'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

interface BookingFormProps {
  villaId: string
  villaTitle: string
  categoryType: string[] // Pass the array directly from Supabase row
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

export default function BookingForm({ villaId, villaTitle, categoryType = [] }: BookingFormProps) {
  const router = useRouter()
  
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [agreePrivacy, setAgreePrivacy] = useState(false)

  const [eventName, setEventName] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [timeSlot, setTimeSlot] = useState<'day' | 'evening'>('day')
  const [eventType, setEventType] = useState('Birthday')
  const [paxCount, setPaxCount] = useState(50)

  // --- Dynamic Category Evaluator Logic ---
  const offersEvents = categoryType.some(cat => cat.toLowerCase() === 'events')
  const offersAccommodation = categoryType.some(cat => cat.toLowerCase() === 'accommodation')
  const offersBoth = offersEvents && offersAccommodation

  // Determine the default layout mode based on what this specific villa supports
  const [bookingPurpose, setBookingPurpose] = useState<'events' | 'accommodation'>(() => {
    if (offersAccommodation && !offersEvents) return 'accommodation'
    return 'events' // Default fallback for events-only or multi-purpose spaces
  })
  
  const [packageOption, setPackageOption] = useState<string>('with_catering')
  const [includeOvernight, setIncludeOvernight] = useState(false)
  const [overnightPaxCount, setOvernightPaxCount] = useState(0)

  const [quote, setQuote] = useState<DbQuoteResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canRequestQuote = Boolean(villaId && eventDate && timeSlot && paxCount > 0)

  // Sync state values automatically when switching purposes
  useEffect(() => {
    if (bookingPurpose === 'accommodation') {
      setPackageOption('accommodation_only')
      setIncludeOvernight(false)
      setOvernightPaxCount(0)
      if (paxCount > 20 || paxCount < 8) setPaxCount(8) // Sane limits for standard accommodation grids
    } else {
      setPackageOption('with_catering')
      if (paxCount < 50) setPaxCount(50) // Reset to standard event minimums
    }
  }, [bookingPurpose])

  // 🧹 FIX: Instantly strip out overnight allocations if slot assignment variables drop to 'day' OR 'evening' for events
  useEffect(() => {
    if (timeSlot === 'day' || (timeSlot === 'evening' && bookingPurpose === 'events')) {
      setIncludeOvernight(false)
      setOvernightPaxCount(0)
    }
  }, [timeSlot, bookingPurpose])

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
        if (!response.ok) throw new Error(body?.error || 'Could not compute calculation values.')

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

  const submitDisabled = !fullName.trim() || !phone.trim() || !eventDate || !quote || Boolean(error) || !agreeTerms || !agreePrivacy

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
          </div>

          <div className="grid gap-4">
            {offersBoth && (
              <div className="grid grid-cols-2 gap-2 p-1 bg-zinc-100 rounded-xl animate-fadeIn">
                <button
                  type="button"
                  onClick={() => setBookingPurpose('events')}
                  className={`py-2 text-xs font-bold rounded-lg transition-all ${bookingPurpose === 'events' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500'}`}
                >
                  Event Venue
                </button>
                <button
                  type="button"
                  onClick={() => setBookingPurpose('accommodation')}
                  className={`py-2 text-xs font-bold rounded-lg transition-all ${bookingPurpose === 'accommodation' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500'}`}
                >
                  Accommodation Stay
                </button>
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm font-semibold text-zinc-900">Full Name</label>
              <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Text" className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none" />
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-zinc-900">Contact Information</label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number" className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none" />
            </div>

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

            {bookingPurpose === 'events' ? (
              <div className="grid gap-4 sm:grid-cols-2 animate-fadeIn">
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
            ) : (
              <div className="text-xs text-zinc-500 bg-zinc-50 p-3 rounded-xl border border-dashed animate-fadeIn">
                🏡 Accommodation stay includes access to all 4 premium airconditioned bedrooms with full kitchen utilities.
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm font-semibold text-zinc-900">
                {bookingPurpose === 'events' ? 'Total Event Guests' : 'Total Overnight Stayer Pax (Range: 8 - 20)'}
              </label>
              <input type="number" min={bookingPurpose === 'events' ? 1 : 8} max={bookingPurpose === 'events' ? 200 : 20} value={paxCount} onChange={(e) => setPaxCount(Number(e.target.value))} className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none" />
            </div>

            {/* 🌟 FIXED GUARD-RAIL: Only display the overnight card when timeSlot is 'evening' AND bookingPurpose is NOT 'events' (Meaning it only triggers for explicit custom accommodations slots if needed) */}
            {timeSlot === 'evening' && bookingPurpose !== 'events' && (
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
            <div className="mt-4 space-y-3 text-sm text-zinc-700">
              <div className="flex justify-between">
                <span>Base Package Price ({quote.base_tier_used} Pax Base)</span>
                <span>₱{quote.base_rate_price.toLocaleString()}</span>
              </div>
              {quote.excess_pax_count > 0 && (
                <div className="flex justify-between text-zinc-600">
                  <span>Excess Pax Surcharge Fee</span>
                  <span>₱{quote.excess_pax_price.toLocaleString()}</span>
                </div>
              )}
              {quote.overnight_price > 0 && (
                <div className="flex justify-between text-zinc-600">
                  <span>Overnight Stay Add-on Surcharge</span>
                  <span>₱{quote.overnight_price.toLocaleString()}</span>
                </div>
              )}
              {packageOption === 'accommodation_only' && (
                <div className="flex justify-between text-zinc-600">
                  <span>Mandatory Cleaning Surcharge</span>
                  <span>₱500</span>
                </div>
              )}
              <hr className="border-zinc-200 my-2" />
              <div className="flex justify-between text-base">
                <span className="font-medium text-zinc-900">Total Price</span>
                <span className="font-bold text-emerald-600">
                  ₱{(quote?.total_price ?? 0).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 border-t border-zinc-100 pt-5 space-y-4 text-xs text-zinc-500">
          <div className="flex flex-col space-y-0.5 pl-7">
            <span className="font-semibold text-zinc-700">Frequently Asked Questions</span>
            <a 
              href="/faq" 
              target="_blank" 
              className="text-emerald-600 font-medium hover:underline tracking-wide cursor-pointer w-fit"
            >
              Read our FAQ
            </a>
          </div>

          <label className="flex items-start space-x-3 cursor-pointer select-none group">
            <input 
              type="checkbox" 
              checked={agreeTerms}
              onChange={(e) => setAgreeTerms(e.target.checked)}
              className="accent-emerald-600 h-4 w-4 rounded border-zinc-300 mt-0.5 focus:ring-emerald-500"
            />
            <div className="flex flex-col space-y-0.5">
              <span className="font-semibold text-zinc-700 group-hover:text-zinc-900 transition-colors">
                Agreement*
              </span>
              <a 
                href="/terms-and-conditions" 
                target="_blank" 
                onClick={(e) => e.stopPropagation()} 
                className="text-zinc-400 underline hover:text-emerald-600 transition-colors w-fit"
              >
                Digital Agreement
              </a>
            </div>
          </label>

          <label className="flex items-start space-x-3 cursor-pointer select-none group">
            <input 
              type="checkbox" 
              checked={agreePrivacy}
              onChange={(e) => setAgreePrivacy(e.target.checked)}
              className="accent-emerald-600 h-4 w-4 rounded border-zinc-300 mt-0.5 focus:ring-emerald-500"
            />
            <div className="flex flex-col space-y-0.5">
              <span className="font-semibold text-zinc-700 group-hover:text-zinc-900 transition-colors">
                Data Privacy*
              </span>
              <a 
                href="/privacy-policy" 
                target="_blank" 
                onClick={(e) => e.stopPropagation()} 
                className="text-zinc-400 underline hover:text-emerald-600 transition-colors w-fit"
              >
                Info
              </a>
            </div>
          </label>
        </div>

        <button
          type="button"
          disabled={submitDisabled}
          onClick={() => router.push(paymentUrl)}
          className={`w-full mt-4 rounded-full px-5 py-3 text-sm font-semibold text-white transition ${submitDisabled ? 'bg-zinc-300 text-zinc-500 cursor-not-allowed' : 'bg-emerald-500 hover:bg-emerald-600'}`}
        >
          Proceed to Payment
        </button>
      </div>
    </div>
  )
}
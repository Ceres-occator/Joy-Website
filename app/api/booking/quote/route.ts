import { NextRequest, NextResponse } from 'next/server'
import { getBookingQuote } from '@/actions/booking'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { villaId, schedule, paxCount, packageOption, includeOvernight, overnightPaxCount } = body
    const paxNumber = Number(paxCount)

    if (!villaId || !schedule || !packageOption || !Number.isFinite(paxNumber) || paxNumber <= 0) {
      return NextResponse.json({ error: 'Missing request data', body }, { status: 400 })
    }

    const timeOfDay = new Date(schedule).getHours() >= 18 ? 'evening' : 'day'

    const quote = await getBookingQuote({
      villaId,
      packageName: packageOption,
      timeOfDay,
      eventDate: schedule,
      paxCount: paxNumber,
      includeOvernight: Boolean(includeOvernight),
      overnightPaxCount: Number(overnightPaxCount) || 0,
    })

    if (!quote) {
      return NextResponse.json({ error: 'Could not calculate quote' }, { status: 500 })
    }

    return NextResponse.json({
      villaName: quote.villaName,
      basePrice: quote.base_rate_price,
      calculatedPrice: quote.total_price,
      quoteBreakdown: {
        base_price: quote.base_rate_price,
        excess_guest_price: quote.excess_pax_price,
        overnight_price: quote.overnight_price,
        total_price: quote.total_price,
      },
    })
  } catch (error: any) {
    console.error('Quote API error:', error)
    return NextResponse.json({ error: error?.message || 'Failed to calculate quote' }, { status: 500 })
  }
}

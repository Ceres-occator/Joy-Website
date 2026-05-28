'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

interface BookingFormProps {
  villaId: string
  villaTitle: string
  categoryType: string[]
}

interface RateTierRow {
  id: string
  package_id: string
  base_pax: number
  time_of_day: 'day' | 'evening'
  day_group: 'weekday' | 'weekend_holiday'
  price: number
}

interface PackageRow {
  id: string
  villa_id: string
  name: 'venue_only' | 'with_catering' | 'accommodation_only'
  excess_pax_rate: number
}

export default function BookingForm({ villaId, villaTitle, categoryType = [] }: BookingFormProps) {
  const router = useRouter()
  const supabase = createClient()
  
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [agreePrivacy, setAgreePrivacy] = useState(false)

  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  
  // --- Structural Unified Date States ---
  const [eventDate, setEventDate] = useState('') 
  const [checkInDate, setCheckInDate] = useState('') 
  const [checkOutDate, setCheckOutDate] = useState('') 
  
  const [timeSlot, setTimeSlot] = useState<'day' | 'evening'>('day')
  const [eventType, setEventType] = useState('Birthday')
  
  // --- Relational DB Storage states ---
  const [dbPackages, setDbPackages] = useState<PackageRow[]>([])
  const [dbRateTiers, setDbRateTiers] = useState<RateTierRow[]>([])
  const [fetchingDb, setFetchingDb] = useState(true)

  // --- Guest Counter Input States ---
  const [selectedBasePaxTier, setSelectedBasePaxTier] = useState<number>(0)
  const [excessPaxInput, setExcessPaxInput] = useState<number>(0)
  const [accommodationGuestCount, setAccommodationGuestCount] = useState<number>(1)

  // --- Optional Event Overnight Stay States ---
  const [addOptionalOvernight, setAddOptionalOvernight] = useState<boolean>(false)
  const [overnightGuestsCount, setOvernightGuestsCount] = useState<number>(1)

  const [availabilityMap, setAvailabilityMap] = useState<Record<string, string[]>>({})
  const [activePopup, setActivePopup] = useState<'faq' | 'terms' | 'privacy' | null>(null)

  const offersEvents = categoryType.some(cat => cat.toLowerCase() === 'events')
  const offersAccommodation = categoryType.some(cat => cat.toLowerCase() === 'accommodation')
  const offersBoth = offersEvents && offersAccommodation

  const [bookingPurpose, setBookingPurpose] = useState<'events' | 'accommodation'>(() => {
    if (offersAccommodation && !offersEvents) return 'accommodation'
    return 'events'
  })
  
  const [packageOption, setPackageOption] = useState<string>('with_catering')

  // Flyer property rules matrix profiles
  const staticVillaRules = useMemo(() => {
    const isSuki = villaTitle.toLowerCase().includes('suki');
    return {
      isSuki,
      basePax: isSuki ? 8 : 16,
      maxPax: isSuki ? 25 : 30,
      accommodationExcessRate: isSuki ? 500 : 600, 
      eventVisitorRate: isSuki ? 300 : 400,
      
      overnightAddonBasePrice: isSuki ? 10000 : 12000,
      overnightAddonBasePax: 15,
      overnightAddonExcessRate: isSuki ? 500 : 600
    }
  }, [villaTitle]);

  // Reset conditional fields when toggling slots
  useEffect(() => {
    if (timeSlot !== 'evening') {
      setAddOptionalOvernight(false);
    }
  }, [timeSlot]);

  // 📡 ASYNCHRONOUS DATABASE RELATIONAL CRAWLER
  useEffect(() => {
    async function fetchRelationalDataMatrix() {
      setFetchingDb(true)
      try {
        const { data: pkgs } = await supabase.from('packages').select('*').eq('villa_id', villaId)
        if (!pkgs) return
        setDbPackages(pkgs)

        const pkgIds = pkgs.map(p => p.id)
        if (pkgIds.length > 0) {
          const { data: tiers } = await supabase.from('rate_tiers').select('*').in('package_id', pkgIds)
          if (tiers) {
            setDbRateTiers(tiers)
            const defaultTier = tiers.find(t => t.time_of_day === timeSlot)?.base_pax || tiers[0]?.base_pax
            setSelectedBasePaxTier(defaultTier)
          }
        }

        const currentYear = new Date().getFullYear();
        const res = await fetch(`/api/villas/${villaId}/availability?year=${currentYear}&month=all`);
        const blockData = await res.json();
        if (blockData?.availability) {
          setAvailabilityMap(blockData.availability);
        }
      } catch (err) {
        console.error("Failed executing structural pipeline: ", err)
      } finally {
        setFetchingDb(false)
      }
    }
    if (villaId) fetchRelationalDataMatrix()
  }, [villaId, timeSlot, supabase])

  useEffect(() => {
    if (bookingPurpose === 'accommodation') {
      setPackageOption('accommodation_only')
      setAccommodationGuestCount(staticVillaRules.basePax)
      setExcessPaxInput(0)
    } else {
      setPackageOption('with_catering')
      setExcessPaxInput(0)
    }
  }, [bookingPurpose, staticVillaRules])

  const isPhoneValid = useMemo(() => {
    const cleaned = phone.replace(/\s+/g, '');
    return /^(09|\+639)\d{9}$/.test(cleaned);
  }, [phone]);

  const calculatedNightsCount = useMemo(() => {
    if (bookingPurpose !== 'accommodation' || !checkInDate || !checkOutDate) return 1;
    const start = new Date(checkInDate);
    const end = new Date(checkOutDate);
    const diff = end.getTime() - start.getTime();
    const totalNights = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return totalNights > 0 ? totalNights : 1;
  }, [bookingPurpose, checkInDate, checkOutDate]);

  const currentDayGroupFlag = useMemo(() => {
    const checkTarget = bookingPurpose === 'events' ? eventDate : checkInDate;
    if (!checkTarget) return 'weekday';
    const day = new Date(checkTarget).getDay();
    return (day === 0 || day === 5 || day === 6) ? 'weekend_holiday' : 'weekday';
  }, [bookingPurpose, eventDate, checkInDate]);

  const currentActivePackageRow = useMemo(() => {
    return dbPackages.find(p => p.name === packageOption);
  }, [dbPackages, packageOption]);

  // 🧮 DYNAMIC REVENUE CALCULATION COMPUTATION ENGINE
  const priceCalculation = useMemo(() => {
    let fixedPackagePrice = 0
    let excessPaxSurcharge = 0
    let mandatoryCleaningFee = 0
    let optionalOvernightAddonPrice = 0
    let aggregateTotalCost = 0

    if (bookingPurpose === 'events') {
      const matchingTierRow = dbRateTiers.find(t => 
        t.package_id === currentActivePackageRow?.id &&
        t.base_pax === selectedBasePaxTier &&
        t.time_of_day === timeSlot &&
        t.day_group === currentDayGroupFlag
      );
      
      fixedPackagePrice = matchingTierRow ? Number(matchingTierRow.price) : 0;
      excessPaxSurcharge = excessPaxInput * staticVillaRules.eventVisitorRate;
      mandatoryCleaningFee = 0; 

      if (addOptionalOvernight && timeSlot === 'evening') {
        let excessOvernightGuestsPrice = 0;
        if (overnightGuestsCount > staticVillaRules.overnightAddonBasePax) {
          const excessOvernightCount = overnightGuestsCount - staticVillaRules.overnightAddonBasePax;
          excessOvernightGuestsPrice = excessOvernightCount * staticVillaRules.overnightAddonExcessRate;
        }
        optionalOvernightAddonPrice = staticVillaRules.overnightAddonBasePrice + excessOvernightGuestsPrice;
      }
    } else {
      const standardNightlyPrice = currentDayGroupFlag === 'weekend_holiday' 
        ? (staticVillaRules.isSuki ? 14000 : 22000)
        : (staticVillaRules.isSuki ? 12000 : 20000);

      fixedPackagePrice = standardNightlyPrice * calculatedNightsCount;
      excessPaxSurcharge = excessPaxInput * staticVillaRules.accommodationExcessRate * calculatedNightsCount;
      mandatoryCleaningFee = 500; 
    }

    aggregateTotalCost = fixedPackagePrice + excessPaxSurcharge + mandatoryCleaningFee + optionalOvernightAddonPrice;

    return {
      fixedPackagePrice,
      excessPaxSurcharge,
      mandatoryCleaningFee,
      optionalOvernightAddonPrice,
      aggregateTotalCost
    };
  }, [bookingPurpose, dbRateTiers, currentActivePackageRow, selectedBasePaxTier, timeSlot, currentDayGroupFlag, excessPaxInput, staticVillaRules, calculatedNightsCount, addOptionalOvernight, overnightGuestsCount]);

  const isDateRangeConflict = useMemo(() => {
    if (bookingPurpose === 'events') {
      if (!eventDate) return false;
      const activeSlots = availabilityMap[eventDate] || [];
      return activeSlots.includes(timeSlot);
    }

    if (!checkInDate || !checkOutDate) return false;
    const start = new Date(checkInDate);
    const end = new Date(checkOutDate);

    while (start < end) {
      const targetString = start.toISOString().split('T')[0];
      const activeSlots = availabilityMap[targetString] || [];
      if (activeSlots.length > 0) return true;
      start.setDate(start.getDate() + 1);
    }
    return false;
  }, [bookingPurpose, eventDate, timeSlot, checkInDate, checkOutDate, availabilityMap]);

  const uniqueAvailableBasePaxOptions = useMemo(() => {
    const filteredTiers = dbRateTiers.filter(t => t.package_id === currentActivePackageRow?.id && t.time_of_day === timeSlot);
    const setPax = new Set(filteredTiers.map(t => t.base_pax));
    return Array.from(setPax).sort((a, b) => a - b);
  }, [dbRateTiers, currentActivePackageRow, timeSlot]);

  const isDateFilled = bookingPurpose === 'events' ? Boolean(eventDate) : Boolean(checkInDate && checkOutDate);
  const submitDisabled = !fullName.trim() || !isPhoneValid || !isDateFilled || !agreeTerms || !agreePrivacy || fetchingDb || isDateRangeConflict;

  const paymentUrl = useMemo(() => {
    const totalHeadcountRegistry = bookingPurpose === 'events' ? (selectedBasePaxTier + excessPaxInput) : accommodationGuestCount;
    const targetDateSpanValue = bookingPurpose === 'events' ? eventDate : `${checkInDate} to ${checkOutDate}`;
    
    const finalTimeLabel = bookingPurpose === 'events' 
      ? (addOptionalOvernight ? `${timeSlot} Slot + Overnight Extended` : `${timeSlot} Slot`)
      : 'Overnight Stay';

    const params = new URLSearchParams({
      villaTitle, fullName, eventDate: targetDateSpanValue, timeSlot: finalTimeLabel,
      eventType: bookingPurpose === 'events' ? eventType : 'Leisure Accommodation',
      paxCount: String(totalHeadcountRegistry), packageOption,
      price: String(priceCalculation.aggregateTotalCost), phone: phone.replace(/\s+/g, '')
    })
    return `/villas/${villaId}/payment?${params.toString()}`
  }, [villaId, villaTitle, fullName, phone, eventDate, checkInDate, checkOutDate, timeSlot, eventType, selectedBasePaxTier, excessPaxInput, accommodationGuestCount, packageOption, bookingPurpose, priceCalculation, addOptionalOvernight]);

  return (
    <div className="space-y-6 font-sans">
      <div className="rounded-3xl border border-zinc-200 bg-white p-5 sm:p-6 shadow-sm space-y-4">
        
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Booking configuration</p>
          <h2 className="mt-1 text-lg font-black text-zinc-900 tracking-tight">{villaTitle}</h2>
        </div>

        {offersBoth && (
          <div className="grid grid-cols-2 gap-2 p-1 bg-zinc-100 rounded-xl">
            <button type="button" onClick={() => setBookingPurpose('events')} className={`py-2 text-xs font-black rounded-lg transition-all ${bookingPurpose === 'events' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500'}`}>Event Venue</button>
            <button type="button" onClick={() => setBookingPurpose('accommodation')} className={`py-2 text-xs font-black rounded-lg transition-all ${bookingPurpose === 'accommodation' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500'}`}>Accommodation Stay</button>
          </div>
        )}

        <div className="space-y-3.5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-bold text-zinc-700 uppercase">Full Name</label>
              <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Enter full name" className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-semibold focus:border-emerald-500 focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-zinc-700 uppercase">Contact Mobile</label>
              {/* 🌟 LOOKUP REPAIR: Placeholder updated cleanly here to show standard 09xxxxxxxxx notation */}
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="09xxxxxxxxx" className={`w-full rounded-xl border px-3 py-2 text-xs bg-zinc-50 focus:outline-none transition font-mono ${phone && !isPhoneValid ? 'border-red-400 focus:border-red-500' : 'border-zinc-200 focus:border-emerald-500'}`} />
            </div>
          </div>

          {bookingPurpose === 'events' ? (
            <div className="grid gap-3 sm:grid-cols-2 animate-fadeIn">
              <div>
                <label className="mb-1 block text-xs font-bold text-zinc-700 uppercase">Select Event Date</label>
                <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-bold focus:border-emerald-500 focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-zinc-700 uppercase">Time Slot Frame</label>
                <select value={timeSlot} onChange={(e) => setTimeSlot(e.target.value as any)} className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-bold focus:border-emerald-500 focus:outline-none">
                  <option value="day">Day Slot (11:00 AM - 3:00 PM)</option>
                  <option value="evening">Evening Slot (5:00 PM - 10:00 PM)</option>
                </select>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 animate-fadeIn">
              <div>
                <label className="mb-1 block text-xs font-bold text-zinc-700 uppercase">Check-In Date (3:00 PM)</label>
                <input type="date" value={checkInDate} onChange={(e) => setCheckInDate(e.target.value)} className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-bold focus:border-emerald-500 focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-zinc-700 uppercase">Check-Out Date (9:00 AM)</label>
                <input type="date" value={checkOutDate} onChange={(e) => setCheckOutDate(e.target.value)} className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-bold focus:border-emerald-500 focus:outline-none" />
              </div>
            </div>
          )}

          {/* 🌟 LOOKUP REPAIR: Encapsulated strictly to run only inside accommodation flows */}
          {bookingPurpose === 'accommodation' && (
            <div className="bg-zinc-50 border border-zinc-200/60 p-3 rounded-xl space-y-1.5 text-[11px] font-medium text-zinc-500 animate-fadeIn">
              <span className="block text-[9px] font-black text-zinc-400 uppercase tracking-wider">🗓️ Stay Schedules & Official Rules:</span>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 list-disc pl-4 text-zinc-500">
                <li>Check-in time starts at: <span className="font-bold text-zinc-800">3:00 PM</span></li>
                <li>Check-out strictly set at: <span className="font-bold text-zinc-800">9:00 AM</span></li>
                <li className="sm:col-span-2">Includes full exclusive access to linens, towels, and room assets.</li>
                <li className="sm:col-span-2 text-amber-700 font-bold">Only declared headcount allowed entry. Excess visitors assessed at check-in.</li>
              </ul>
            </div>
          )}

          {bookingPurpose === 'events' ? (
            <div className="space-y-3.5 border-t pt-3 border-dashed border-zinc-200 animate-fadeIn">
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-bold text-zinc-700 uppercase">Event Context</label>
                  <select value={eventType} onChange={(e) => setEventType(e.target.value)} className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-2.5 py-2 text-xs font-bold">
                    <option>Birthday</option><option>Wedding</option><option>Corporate</option><option>Private Party</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-zinc-700 uppercase">DB Package Option</label>
                  <select value={packageOption} onChange={(e) => setPackageOption(e.target.value)} className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-2.5 py-2 text-xs font-bold">
                    <option value="with_catering">With Catering</option>
                    <option value="venue_only">Venue Only</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-zinc-700 uppercase">Select Base Pax Tier</label>
                  {fetchingDb ? (
                    <div className="text-xs text-zinc-400 italic py-2 animate-pulse">Reading tables...</div>
                  ) : (
                    <select value={selectedBasePaxTier} onChange={(e) => setSelectedBasePaxTier(Number(e.target.value))} className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-2.5 py-2 text-xs font-black text-emerald-700">
                      {uniqueAvailableBasePaxOptions.map(pax => (
                        <option key={pax} value={pax}>{pax} Pax Base Tier</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-zinc-700 uppercase">Additional Event Visitors Count</label>
                <input type="number" min={0} value={excessPaxInput} onChange={(e) => setExcessPaxInput(Math.max(0, Number(e.target.value)))} placeholder="Number of extra visitor heads" className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-mono font-bold text-zinc-800" />
                <p className="text-[10px] text-zinc-400 mt-1">Surcharge rate: ₱{staticVillaRules.eventVisitorRate}/pax for additional daytime guests.</p>
              </div>

              {timeSlot === 'evening' && (
                <div className="bg-emerald-50/50 border border-emerald-100 p-4 rounded-xl space-y-3 animate-fadeIn">
                  <label className="flex items-center space-x-2.5 cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      checked={addOptionalOvernight} 
                      onChange={(e) => setAddOptionalOvernight(e.target.checked)} 
                      className="accent-emerald-600 h-4 w-4 rounded" 
                    />
                    <div className="text-xs font-black text-emerald-900 uppercase tracking-wide">
                      🌙 Avail Optional Overnight Extension stay (+ ₱{staticVillaRules.overnightAddonBasePrice.toLocaleString()})
                    </div>
                  </label>
                  <p className="text-[11px] text-emerald-700 leading-normal pl-6 font-medium">
                    Extends your checkout limit to **9:00 AM the following morning**. Base fee includes up to **15 overnight guests**.
                  </p>

                  {addOptionalOvernight && (
                    <div className="pl-6 pt-1 grid gap-2 sm:grid-cols-2 items-center animate-fadeIn">
                      <div>
                        <label className="mb-1 block text-[10px] font-black text-zinc-600 uppercase">Actual Overnight Sleepers Headcount</label>
                        <input 
                          type="number" 
                          min={1} 
                          value={overnightGuestsCount} 
                          onChange={(e) => setOvernightGuestsCount(Math.max(1, Number(e.target.value)))} 
                          className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-mono font-bold text-zinc-800" 
                        />
                      </div>
                      <div className="text-[10px] text-zinc-500 font-semibold self-end pb-2">
                        {overnightGuestsCount > staticVillaRules.overnightAddonBasePax ? (
                          <span className="text-amber-700 font-bold">
                            ⚠️ {overnightGuestsCount - staticVillaRules.overnightAddonBasePax} excess guests (+₱{staticVillaRules.overnightAddonExcessRate}/head)
                          </span>
                        ) : (
                          <span className="text-emerald-700">✓ Within the 15-pax inclusion tier</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 border-t pt-3 border-dashed animate-fadeIn">
              <div>
                <label className="mb-1 block text-xs font-bold text-zinc-700 uppercase">Input Total Guests Headcount</label>
                <input type="number" min={1} max={staticVillaRules.maxPax} value={accommodationGuestCount} 
                  onChange={(e) => {
                    const val = Math.max(1, Number(e.target.value));
                    setAccommodationGuestCount(val);
                    if (val > staticVillaRules.basePax) {
                      setExcessPaxInput(val - staticVillaRules.basePax);
                    } else {
                      setExcessPaxInput(0);
                    }
                  }} 
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-mono font-bold text-zinc-800" 
                />
                <p className="text-[10px] text-zinc-400 mt-1">Base allowance tier package limits: {staticVillaRules.basePax} Pax.</p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-zinc-700 uppercase">Calculated Excess Surcharge</label>
                <div className="w-full bg-zinc-100 border rounded-xl px-3 py-2 text-xs font-mono font-black text-zinc-500">
                  {excessPaxInput} Overnight Head(s) (+₱{staticVillaRules.accommodationExcessRate}/each)
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Price Breakdown Display Card */}
        <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-950/5 p-4 space-y-2.5 text-xs font-semibold text-zinc-700">
          <div className="flex justify-between items-center border-b pb-1.5 mb-1">
            <h3 className="text-sm font-black text-zinc-900 uppercase tracking-wider">Price Breakdown</h3>
            {bookingPurpose === 'accommodation' && checkInDate && checkOutDate && (
              <span className="bg-emerald-600 text-white font-black text-[9px] px-2 py-0.5 rounded-md uppercase tracking-wide">
                ⏳ Duration: {calculatedNightsCount} Night(s)
              </span>
            )}
          </div>
          
          <div className="flex justify-between">
            <span>Fix Pax Package Price ({bookingPurpose === 'events' ? `${selectedBasePaxTier} Pax` : `${staticVillaRules.basePax} Pax Base`})</span>
            <span className="font-mono text-zinc-900 font-bold">₱{priceCalculation.fixedPackagePrice.toLocaleString()}</span>
          </div>

          {excessPaxInput > 0 && (
            <div className="flex justify-between text-zinc-600">
              <span>Excess Pax Surcharge [{excessPaxInput} Pax]</span>
              <span className="font-mono text-zinc-900 font-bold">₱{priceCalculation.excessPaxSurcharge.toLocaleString()}</span>
            </div>
          )}

          {priceCalculation.optionalOvernightAddonPrice > 0 && (
            <div className="flex justify-between text-emerald-800 font-bold bg-emerald-600/5 p-2 rounded-lg border border-emerald-100 animate-fadeIn">
              <span>Optional Overnight Extension Add-on Suite</span>
              <span className="font-mono">₱{priceCalculation.optionalOvernightAddonPrice.toLocaleString()}</span>
            </div>
          )}

          {priceCalculation.mandatoryCleaningFee > 0 && (
            <div className="flex justify-between text-zinc-600">
              <span>Mandatory Housekeeping Cleaning Fee</span>
              <span className="font-mono text-zinc-900 font-bold">
                ₱{priceCalculation.mandatoryCleaningFee.toLocaleString()}
              </span>
            </div>
          )}

          <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] leading-relaxed font-semibold">
            📌 <strong>Refundable Security Bond Note:</strong> A mandatory refundable security cash bond deposit of <strong>₱3,000</strong> for potential property damages is payable straight upon check-in clearance.
          </div>

          <div className="border-t pt-2 flex justify-between text-sm font-black text-zinc-900">
            <span>TOTAL GROSS COST:</span>
            <span className="font-mono text-emerald-600 text-base font-black">₱{priceCalculation.aggregateTotalCost.toLocaleString()}</span>
          </div>
        </div>

        {/* Agreement Handshakes */}
        <div className="mt-4 pt-4 border-t border-zinc-100 grid gap-3 text-[11px] text-zinc-500">
          <div className="flex items-center justify-between bg-zinc-50 p-2 rounded-xl border">
            <span>Need assistance or have policy questions?</span>
            <button type="button" onClick={() => setActivePopup('faq')} className="text-emerald-600 font-bold hover:underline">Read Our FAQ</button>
          </div>

          <div className="flex gap-4">
            <label className="flex items-center space-x-2 cursor-pointer group flex-1">
              <input type="checkbox" checked={agreeTerms} onChange={(e) => setAgreeTerms(e.target.checked)} className="accent-emerald-600 h-4 w-4 rounded" />
              <div className="text-[10px]">I read and agree to the <button type="button" onClick={() => setActivePopup('terms')} className="underline font-bold text-zinc-700 hover:text-emerald-600">Digital Agreement</button></div>
            </label>

            <label className="flex items-center space-x-2 cursor-pointer group flex-1">
              <input type="checkbox" checked={agreePrivacy} onChange={(e) => setAgreePrivacy(e.target.checked)} className="accent-emerald-600 h-4 w-4 rounded" />
              <div className="text-[10px]">I consent to the <button type="button" onClick={() => setActivePopup('privacy')} className="underline font-bold text-zinc-700 hover:text-emerald-600">Privacy Info Policy</button></div>
            </label>
          </div>
        </div>

        {isDateRangeConflict && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-bold rounded-xl animate-fadeIn leading-normal">
            ⚠️ <strong>Schedule Collision:</strong> The selected dates are already fully booked or undergoing verification. Please pick another timeframe on the availability calendar.
          </div>
        )}

        <button type="button" disabled={submitDisabled} onClick={() => router.push(paymentUrl)} className={`w-full mt-3 rounded-xl py-3 text-xs font-black text-white transition uppercase tracking-wider shadow-sm ${submitDisabled ? 'bg-zinc-200 text-zinc-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700'}`}>Proceed to Checkout Settle</button>
      </div>

      {/* Pop-up Info Overlay Modals */}
      {activePopup && (
        <div className="fixed inset-0 bg-zinc-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn" onClick={() => setActivePopup(null)}>
          <div className="bg-white rounded-[2rem] p-6 max-w-lg w-full max-h-[80vh] flex flex-col justify-between shadow-2xl border border-zinc-100 text-xs text-zinc-600" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b pb-3 mb-4 shrink-0">
              <h3 className="font-black text-zinc-900 text-sm uppercase tracking-wide">
                {activePopup === 'faq' && "🙋 FAQ Information Desk"}
                {activePopup === 'terms' && "📜 Digital Rental Framework Agreement"}
                {activePopup === 'privacy' && "🔒 Data Security Governance"}
              </h3>
              <button type="button" onClick={() => setActivePopup(null)} className="h-6 w-6 flex items-center justify-center rounded-full bg-zinc-100 font-bold text-zinc-500 hover:bg-zinc-200">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 space-y-4 font-medium text-zinc-600">
              {activePopup === 'faq' && (
                <div className="space-y-3">
                  {[
                    { q: "How do I secure my reservation slot?", a: "We require a mandatory 50% deposit down payment via GCash or bank transfer. You can upload your reference verification slip right on our checkout platform." },
                    { q: "Is there a security bond deposit fee?", a: "Yes. All property stays require a refundable bond deposit of ₱3,000 paid in cash upon check-in to cover potential property damages. This will be returned completely upon successful checkout clearance." },
                    { q: "What happens if our headcount exceeds the package limit?", a: "Extra visitors are subject to an excess pax surcharge fee of ₱500 per person for Suki's and ₱600 per person for Sandy's Villa during accommodations. Please ensure you declare accurate numbers during booking registration." }
                  ].map((faq, idx) => (
                    <div key={idx} className="bg-zinc-50 border p-3 rounded-xl space-y-1">
                      <p className="font-black text-zinc-900 text-xs"><span className="text-emerald-600">Q:</span> {faq.q}</p>
                      <p className="text-zinc-500 pl-4">{faq.a}</p>
                    </div>
                  ))}
                </div>
              )}

              {activePopup === 'terms' && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <h4 className="font-bold text-zinc-900">1. Booking & Cancellation Rules</h4>
                    <p className="text-zinc-500 leading-normal">
                      We require a mandatory 50% deposit down payment of the total rate to secure a reservation. Down payments are strictly non-refundable but remain re-schedulable up to fourteen (14) days prior to the selected check-in slot.
                    </p>
                  </div>
                  
                  <div className="space-y-1">
                    <h4 className="font-bold text-zinc-900">2. Surcharges & Excess Headcounts</h4>
                    <p className="text-zinc-500 leading-normal">
                      Only the declared headcount of guests is permitted entry. Excess occupants are subject to strict property tier charges: 
                      <span className="block mt-1 pl-2 border-l-2 border-emerald-500 text-[11px] font-semibold text-zinc-600">
                        • Accommodation: +₱600/pax (Sandy's) or +₱500/pax (Suki's)<br />
                        • Daytime Events: +₱400/pax (Sandy's) or +₱300/pax (Suki's)<br />
                        • Evening Event Overnight: Base includes 15 pax; extra guests are +₱600/pax (Sandy's) or +₱500/pax (Suki's).
                      </span>
                    </p>
                  </div>
                  
                  <div className="space-y-1">
                    <h4 className="font-bold text-zinc-900">3. Care of Property Premises & Fees</h4>
                    <p className="text-zinc-500 leading-normal">
                      A mandatory refundable ₱3,000 security cash bond and any remaining contract balance are due upon arrival. Overnight accommodations include a one-off ₱500 housekeeping cleaning fee. The client assumes full financial liability for any damage inflicted upon resort infrastructure, pool filtration systems, electronic appliances, or linens during their occupancy.
                    </p>
                  </div>
                </div>
              )}

              {activePopup === 'privacy' && (
                <div className="space-y-3">
                  <p>In accordance with data security standards, we outline how your registration details are handled across our portal network ecosystem.</p>
                  <h4 className="font-bold text-zinc-900">Information We Collect:</h4>
                  <ul className="list-disc pl-5 space-y-1 text-zinc-500">
                    <li>Full name and dynamic contact mobile numbers.</li>
                    <li>Government issued identification card snapshots for security check verification.</li>
                    <li>Transaction reference tracking codes and matching receipt images.</li>
                  </ul>
                </div>
              )}
            </div>

            <div className="pt-3 border-t mt-4 shrink-0">
              <button type="button" onClick={() => setActivePopup(null)} className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-bold py-2 rounded-xl text-center uppercase tracking-wider text-[10px]">Close Window</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
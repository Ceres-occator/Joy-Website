'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Calendar,
  Users,
  Receipt,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  AlertTriangle,
  Banknote,
  CreditCard,
} from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { calculateNights, getDayGroup } from '@/utils/dateHelpers';
import { formatCurrency } from '@/utils/formatters';
import { calculateBookingPrice, getVillaPricingRules } from '@/utils/pricing';
import type {
  BookingPurpose,
  PackageOption,
  PackageRow,
  RateTierRow,
  SystemSettings,
  TimeSlot,
} from '@/types';
import FloatingInput, { EMAIL_REGEX } from '@/components/ui/FloatingInput';
import PhoneInput from '@/components/ui/PhoneInput';
import { SkeletonBox } from '@/components/ui/Skeleton';
import BookingPolicyModal from './BookingPolicyModal';

interface BookingFormProps {
  villaId: string;
  villaTitle: string;
  categoryType: string[];
  initialMinDepositPercent?: number;
  /** When true, enables the unified Admin Walk-In Cash/Online checkout directly in Step 3 */
  isWalkInMode?: boolean;
  onWalkInSuccess?: (booking: any) => void;
}

export default function BookingForm({
  villaId,
  villaTitle,
  categoryType = [],
  initialMinDepositPercent,
  isWalkInMode = false,
  onWalkInSuccess,
}: BookingFormProps) {
  const router = useRouter();
  const supabase = createClient();

  // Wizard Step (1: Schedule & Package, 2: Guests & Contact, 3: Review & Payment)
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [agreeTerms, setAgreeTerms] = useState(isWalkInMode);
  const [agreePrivacy, setAgreePrivacy] = useState(isWalkInMode);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('+63');
  const [email, setEmail] = useState('');

  const [eventDate, setEventDate] = useState('');
  const [checkInDate, setCheckInDate] = useState('');
  const [checkOutDate, setCheckOutDate] = useState('');

  const [timeSlot, setTimeSlot] = useState<TimeSlot>('day');
  const [eventType, setEventType] = useState('Birthday');

  const [dbPackages, setDbPackages] = useState<PackageRow[]>([]);
  const [dbRateTiers, setDbRateTiers] = useState<RateTierRow[]>([]);
  const [fetchingDb, setFetchingDb] = useState(true);
  const [villaMinDepositPercent, setVillaMinDepositPercent] = useState<number>(
    Number(initialMinDepositPercent ?? 50)
  );

  const [systemSettings, setSystemSettings] = useState<SystemSettings>({
    id: 'default',
    min_deposit_percent: 50,
    forfeiture_days: 7,
    catering_required_amount: 10000,
    catering_deadline_days: 7,
    catering_auto_action: 'flagged_unpaid',
    admin_alert_phone: null,
    admin_alert_email: null,
  });

  const [selectedBasePaxTier, setSelectedBasePaxTier] = useState<number>(0);
  const [excessPaxInput, setExcessPaxInput] = useState<number>(0);
  const [accommodationGuestCount, setAccommodationGuestCount] = useState<number>(1);

  const [addOptionalOvernight, setAddOptionalOvernight] = useState<boolean>(false);
  const [overnightGuestsCount, setOvernightGuestsCount] = useState<number>(1);

  const [availabilityMap, setAvailabilityMap] = useState<Record<string, string[]>>({});
  const [activePopup, setActivePopup] = useState<'faq' | 'terms' | 'privacy' | null>(null);

  // Admin Walk-In Direct Payment States
  const [walkInGateway, setWalkInGateway] = useState<'cash' | 'paymongo' | 'manual'>('cash');
  const [walkInPaymentPlan, setWalkInPaymentPlan] = useState<'half' | 'full' | 'custom'>('full');
  const [walkInCustomAmount, setWalkInCustomAmount] = useState<string>('');
  const [walkInRefNumber, setWalkInRefNumber] = useState<string>('');
  const [walkInSubmitting, setWalkInSubmitting] = useState(false);

  const offersEvents = categoryType.some((cat) => cat.toLowerCase() === 'events');
  const offersAccommodation = categoryType.some((cat) => cat.toLowerCase() === 'accommodation');
  const offersBoth = offersEvents && offersAccommodation;

  const [bookingPurpose, setBookingPurpose] = useState<BookingPurpose>(() => {
    if (offersAccommodation && !offersEvents) return 'accommodation';
    return 'events';
  });

  const [packageOption, setPackageOption] = useState<PackageOption>('with_catering');

  const villaRules = useMemo(() => getVillaPricingRules(villaTitle), [villaTitle]);

  useEffect(() => {
    if (timeSlot !== 'evening') {
      setAddOptionalOvernight(false);
    }
  }, [timeSlot]);

  useEffect(() => {
    async function loadPackagesAndSettings() {
      setFetchingDb(true);
      try {
        const [villaRes, pkgsRes, availRes, settingsRes] = await Promise.all([
          supabase.from('villas').select('*').eq('id', villaId).maybeSingle(),
          supabase.from('packages').select('*').eq('villa_id', villaId),
          fetch(`/api/villas/${villaId}/availability?year=${new Date().getFullYear()}&month=all`),
          fetch('/api/system-settings'),
        ]);

        if (villaRes.data && villaRes.data.min_deposit_percent != null) {
          setVillaMinDepositPercent(Number(villaRes.data.min_deposit_percent));
        }

        const pkgs = pkgsRes.data;
        if (pkgs) {
          setDbPackages(pkgs as PackageRow[]);
          const pkgIds = pkgs.map((p) => p.id);
          if (pkgIds.length > 0) {
            const { data: tiers } = await supabase
              .from('rate_tiers')
              .select('*')
              .in('package_id', pkgIds);

            if (tiers) {
              setDbRateTiers(tiers as RateTierRow[]);
              const defaultTier =
                tiers.find((t) => t.time_of_day === timeSlot)?.base_pax ||
                tiers[0]?.base_pax ||
                0;
              setSelectedBasePaxTier(defaultTier);
            }
          }
        }

        if (availRes.ok) {
          const blockData = await availRes.json();
          if (blockData?.availability) setAvailabilityMap(blockData.availability);
        }

        if (settingsRes.ok) {
          const sData = await settingsRes.json();
          if (sData?.settings) setSystemSettings(sData.settings);
        }
      } catch (err) {
        console.error('Failed to load booking rates or settings:', err);
      } finally {
        setFetchingDb(false);
      }
    }
    if (villaId) loadPackagesAndSettings();
  }, [villaId, timeSlot, supabase]);

  useEffect(() => {
    if (bookingPurpose === 'accommodation') {
      setPackageOption('accommodation_only');
      setAccommodationGuestCount(villaRules.basePax);
      setExcessPaxInput(0);
    } else {
      setPackageOption('with_catering');
      setExcessPaxInput(0);
    }
  }, [bookingPurpose, villaRules]);

  const isPhoneValid = useMemo(() => {
    const digitsOnly = phone.replace(/\D/g, '');
    return digitsOnly.length >= 9;
  }, [phone]);

  const isEmailValid = useMemo(() => {
    if (!email.trim()) return true;
    return EMAIL_REGEX.test(email.trim());
  }, [email]);

  const isDateOrderValid = useMemo(() => {
    if (bookingPurpose === 'events') return true;
    if (!checkInDate || !checkOutDate) return true;
    return new Date(checkOutDate) > new Date(checkInDate);
  }, [bookingPurpose, checkInDate, checkOutDate]);

  const nightsCount = useMemo(
    () => (bookingPurpose === 'accommodation' ? calculateNights(checkInDate, checkOutDate) : 1),
    [bookingPurpose, checkInDate, checkOutDate]
  );

  const dayGroup = useMemo(() => {
    const targetDate = bookingPurpose === 'events' ? eventDate : checkInDate;
    return getDayGroup(targetDate);
  }, [bookingPurpose, eventDate, checkInDate]);

  const activePackage = useMemo(
    () => dbPackages.find((p) => p.name === packageOption),
    [dbPackages, packageOption]
  );

  const priceBreakdown = useMemo(
    () =>
      calculateBookingPrice({
        bookingPurpose,
        rateTiers: dbRateTiers,
        activePackage,
        selectedBasePaxTier,
        timeSlot,
        dayGroup,
        excessPaxCount: excessPaxInput,
        rules: villaRules,
        nightsCount,
        addOptionalOvernight,
        overnightGuestsCount,
      }),
    [
      bookingPurpose,
      dbRateTiers,
      activePackage,
      selectedBasePaxTier,
      timeSlot,
      dayGroup,
      excessPaxInput,
      villaRules,
      nightsCount,
      addOptionalOvernight,
      overnightGuestsCount,
    ]
  );

  const isDateRangeConflict = useMemo(() => {
    if (bookingPurpose === 'events') {
      if (!eventDate) return false;
      const activeSlots = availabilityMap[eventDate] || [];
      return activeSlots.includes(timeSlot);
    }

    if (!checkInDate || !checkOutDate || !isDateOrderValid) return false;
    const [inY, inM, inD] = checkInDate.split('-').map(Number);
    const [outY, outM, outD] = checkOutDate.split('-').map(Number);
    const cur = new Date(Date.UTC(inY, inM - 1, inD));
    const end = new Date(Date.UTC(outY, outM - 1, outD));

    while (cur < end) {
      const dateStr = cur.toISOString().split('T')[0];
      const activeSlots = availabilityMap[dateStr] || [];
      if (activeSlots.length > 0) return true;
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    return false;
  }, [bookingPurpose, eventDate, timeSlot, checkInDate, checkOutDate, isDateOrderValid, availabilityMap]);

  const availableBasePaxOptions = useMemo(() => {
    const filteredTiers = dbRateTiers.filter(
      (t) => t.package_id === activePackage?.id && t.time_of_day === timeSlot
    );
    const unique = new Set(filteredTiers.map((t) => t.base_pax));
    return Array.from(unique).sort((a, b) => a - b);
  }, [dbRateTiers, activePackage, timeSlot]);

  const isDateFilled =
    bookingPurpose === 'events'
      ? Boolean(eventDate)
      : Boolean(checkInDate && checkOutDate && isDateOrderValid);

  const canAdvanceFromStep1 = isDateFilled && !isDateRangeConflict && !fetchingDb;
  const canAdvanceFromStep2 = Boolean(fullName.trim()) && isPhoneValid && isEmailValid;

  const minDepositPercent = Number(villaMinDepositPercent || 50);
  const minimumDepositAmount = Math.round(
    priceBreakdown.aggregateTotalCost * (minDepositPercent / 100)
  );

  const cateringDeadlinePreview = useMemo(() => {
    if (packageOption !== 'with_catering' || !eventDate) return null;
    const d = new Date(`${eventDate}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - Number(systemSettings.catering_deadline_days || 7));
    return d.toISOString().split('T')[0];
  }, [packageOption, eventDate, systemSettings.catering_deadline_days]);

  const totalGuests =
    bookingPurpose === 'events'
      ? selectedBasePaxTier + excessPaxInput
      : accommodationGuestCount;

  const paymentUrl = useMemo(() => {
    const dateRangeValue =
      bookingPurpose === 'events' ? eventDate : `${checkInDate} to ${checkOutDate}`;
    const slotValue = bookingPurpose === 'events' ? timeSlot : 'evening';

    const params = new URLSearchParams({
      villaTitle,
      fullName: fullName.trim(),
      eventDate: dateRangeValue,
      timeSlot: slotValue,
      eventType: bookingPurpose === 'events' ? eventType : 'Overnight Stay',
      paxCount: String(totalGuests),
      packageOption,
      price: String(priceBreakdown.aggregateTotalCost),
      minDepositPercent: String(minDepositPercent),
      phone: phone.replace(/\s+/g, ''),
      email: email.trim(),
      includeOvernight: String(addOptionalOvernight),
      overnightPaxCount: String(addOptionalOvernight ? overnightGuestsCount : 0),
    });

    return `/villas/${villaId}/payment?${params.toString()}`;
  }, [
    villaId,
    villaTitle,
    fullName,
    phone,
    email,
    eventDate,
    checkInDate,
    checkOutDate,
    timeSlot,
    eventType,
    totalGuests,
    packageOption,
    bookingPurpose,
    priceBreakdown.aggregateTotalCost,
    minDepositPercent,
    addOptionalOvernight,
    overnightGuestsCount,
  ]);

  const handleWalkInSubmit = async () => {
    if (!canAdvanceFromStep1 || !canAdvanceFromStep2) return;
    setWalkInSubmitting(true);

    try {
      const totalCost = priceBreakdown.aggregateTotalCost;
      const paidNow =
        walkInPaymentPlan === 'full'
          ? totalCost
          : walkInPaymentPlan === 'custom'
          ? Math.min(totalCost, Math.max(0, Number(walkInCustomAmount || 0)))
          : minimumDepositAmount;

      const dateRangeValue =
        bookingPurpose === 'events' ? eventDate : `${checkInDate} to ${checkOutDate}`;
      const slotValue = bookingPurpose === 'events' ? timeSlot : 'evening';

      const res = await fetch('/api/booking/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          villaId,
          fullName: fullName.trim(),
          phone: phone.replace(/\s+/g, ''),
          email: email.trim() || null,
          eventDate: dateRangeValue,
          timeSlot: slotValue,
          paxCount: totalGuests,
          packageOption,
          includeOvernight: addOptionalOvernight,
          overnightPaxCount: addOptionalOvernight ? overnightGuestsCount : 0,
          totalPrice: totalCost,
          paymentMode: paidNow >= totalCost ? 'full' : 'half',
          paymentGateway: walkInGateway,
          paymentChannel: walkInGateway === 'cash' ? 'cash' : walkInGateway,
          amountPaid: paidNow,
          remainingBalance: Math.max(0, totalCost - paidNow),
          accountName: fullName.trim(),
          referenceNumber:
            walkInRefNumber.trim() ||
            (walkInGateway === 'cash'
              ? `WALKIN-CASH-${Date.now().toString().slice(-6)}`
              : `WALKIN-${Date.now().toString().slice(-6)}`),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not create walk-in booking.');

      // If admin selected PayMongo during Walk-In, launch PayMongo Checkout session
      if (walkInGateway === 'paymongo' && data.booking?.id) {
        const pmRes = await fetch('/api/paymongo/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bookingId: data.booking.id,
            amount: paidNow,
            phase: paidNow >= totalCost ? 'full_payment' : 'downpayment',
            preferredChannel: 'chinabank',
            successRedirectPath: '/admin/bookings',
            cancelRedirectPath: '/admin/bookings',
          }),
        });
        const pmData = await pmRes.json();
        if (pmRes.ok && pmData.checkoutUrl) {
          window.open(pmData.checkoutUrl, '_blank');
        }
      }

      if (onWalkInSuccess) {
        onWalkInSuccess(data.booking);
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setWalkInSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      <div className="neu-card p-5 sm:p-7 space-y-6">
        {/* Header & Step Progress Indicator */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-widest text-emerald-700 font-bold">
                {isWalkInMode ? 'Unified Walk-In Reservation' : 'Easy 3-Step Reservation'}
              </p>
              <h2 className="mt-0.5 text-xl font-extrabold text-slate-800">{villaTitle}</h2>
            </div>
            <span className="neu-inset-sm px-3 py-1 text-xs font-extrabold text-emerald-700">
              Step {step} of 3
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              { num: 1, title: 'Schedule', icon: Calendar },
              { num: 2, title: 'Guests & Info', icon: Users },
              { num: 3, title: 'Review & Pay', icon: Receipt },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = step === item.num;
              const isDone = step > item.num;
              return (
                <button
                  key={item.num}
                  type="button"
                  onClick={() => {
                    if (item.num === 1) setStep(1);
                    if (item.num === 2 && canAdvanceFromStep1) setStep(2);
                    if (item.num === 3 && canAdvanceFromStep1 && canAdvanceFromStep2) setStep(3);
                  }}
                  className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-bold transition-all ${
                    isActive
                      ? 'neu-btn-primary'
                      : isDone
                      ? 'neu-card-sm text-emerald-700'
                      : 'neu-inset-sm text-slate-400'
                  }`}
                >
                  {isDone ? (
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  ) : (
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span className="truncate">{item.title}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ============================================================
            STEP 1: SCHEDULE & PACKAGE
           ============================================================ */}
        {step === 1 && (
          <div className="space-y-4 animate-fadeIn">
            {offersBoth && (
              <div className="grid grid-cols-2 gap-2 p-1.5 neu-inset">
                <button
                  type="button"
                  onClick={() => setBookingPurpose('events')}
                  className={`py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                    bookingPurpose === 'events'
                      ? 'neu-btn-primary'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Event / Party Venue
                </button>
                <button
                  type="button"
                  onClick={() => setBookingPurpose('accommodation')}
                  className={`py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                    bookingPurpose === 'accommodation'
                      ? 'neu-btn-primary'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Overnight Stay
                </button>
              </div>
            )}

            {bookingPurpose === 'events' ? (
              <div className="grid gap-3.5 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">
                    Event Date *
                  </label>
                  <input
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="neu-input w-full px-3.5 py-3 text-xs font-semibold text-slate-800"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">
                    Time Slot *
                  </label>
                  <select
                    value={timeSlot}
                    onChange={(e) => setTimeSlot(e.target.value as TimeSlot)}
                    className="neu-input w-full px-3.5 py-3 text-xs font-semibold text-slate-800"
                  >
                    <option value="day">Daytime (8:00 AM – 5:00 PM)</option>
                    <option value="evening">Evening (6:00 PM – 7:00 AM)</option>
                  </select>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="grid gap-3.5 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-slate-700">
                      Check-In Date (2:00 PM) *
                    </label>
                    <input
                      type="date"
                      value={checkInDate}
                      onChange={(e) => setCheckInDate(e.target.value)}
                      className="neu-input w-full px-3.5 py-3 text-xs font-semibold text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-slate-700">
                      Check-Out Date (9:00 AM) *
                    </label>
                    <input
                      type="date"
                      min={checkInDate || undefined}
                      value={checkOutDate}
                      onChange={(e) => setCheckOutDate(e.target.value)}
                      className="neu-input w-full px-3.5 py-3 text-xs font-semibold text-slate-800"
                    />
                  </div>
                </div>
                {!isDateOrderValid && (
                  <p className="text-xs font-semibold text-red-600">
                    Check-out date must be after the check-in date.
                  </p>
                )}
              </div>
            )}

            {bookingPurpose === 'events' && (
              <div className="grid gap-3 sm:grid-cols-3 pt-1">
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">
                    Celebration Type
                  </label>
                  <select
                    value={eventType}
                    onChange={(e) => setEventType(e.target.value)}
                    className="neu-input w-full px-3 py-3 text-xs font-semibold text-slate-800"
                  >
                    <option>Birthday</option>
                    <option>Wedding</option>
                    <option>Corporate</option>
                    <option>Private Party</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">Package</label>
                  <select
                    value={packageOption}
                    onChange={(e) => setPackageOption(e.target.value as PackageOption)}
                    className="neu-input w-full px-3 py-3 text-xs font-semibold text-slate-800"
                  >
                    <option value="with_catering">Venue + Catering</option>
                    <option value="venue_only">Venue Only</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">
                    Included Guests
                  </label>
                  {fetchingDb ? (
                    <SkeletonBox className="h-10 w-full" />
                  ) : (
                    <select
                      value={selectedBasePaxTier}
                      onChange={(e) => setSelectedBasePaxTier(Number(e.target.value))}
                      className="neu-input w-full px-3 py-3 text-xs font-extrabold text-emerald-700"
                    >
                      {availableBasePaxOptions.map((pax) => (
                        <option key={pax} value={pax}>
                          Up to {pax} Guests
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            )}

            {bookingPurpose === 'events' && packageOption === 'with_catering' && (
              <div className="neu-inset p-3.5 text-xs text-amber-800 space-y-1">
                <p className="font-extrabold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  Catering Payment Rule
                </p>
                <p className="text-[11px] leading-relaxed text-slate-600">
                  Bookings with catering require at least{' '}
                  <strong className="text-slate-800">
                    {formatCurrency(systemSettings.catering_required_amount || 10000)}
                  </strong>{' '}
                  paid at least{' '}
                  <strong className="text-slate-800">
                    {systemSettings.catering_deadline_days || 7} days (1 week)
                  </strong>{' '}
                  before the event
                  {cateringDeadlinePreview ? ` (by ${cateringDeadlinePreview})` : ''}. Unpaid
                  catering arrangements are automatically flagged or cancelled.
                </p>
              </div>
            )}

            {isDateRangeConflict && (
              <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl animate-fadeIn">
                <strong>Date Unavailable:</strong> This date or time slot is already booked. Please
                pick another date from the calendar.
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <div>
                <span className="text-[11px] text-slate-500 block">Estimated Total</span>
                <span className="text-lg font-extrabold font-mono text-emerald-700">
                  {formatCurrency(priceBreakdown.aggregateTotalCost)}
                </span>
              </div>
              <button
                type="button"
                disabled={!canAdvanceFromStep1}
                onClick={() => setStep(2)}
                className="neu-btn-primary inline-flex items-center gap-2 px-6 py-3 text-xs font-bold uppercase tracking-wider"
              >
                Next: Guest Info <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ============================================================
            STEP 2: GUEST COUNT & CONTACT DETAILS
           ============================================================ */}
        {step === 2 && (
          <div className="space-y-4 animate-fadeIn">
            {bookingPurpose === 'events' ? (
              <div className="space-y-4">
                <FloatingInput
                  label="Extra Guests (Leave blank if none)"
                  value={excessPaxInput}
                  numericOnly
                  zeroAsEmpty
                  onChange={(val) => setExcessPaxInput(val === '' ? 0 : Math.max(0, Number(val)))}
                  helperText={`Your package includes ${selectedBasePaxTier} guests. Extra event visitors are ${formatCurrency(
                    villaRules.eventVisitorRate
                  )} per person.`}
                />

                {timeSlot === 'evening' && (
                  <div className="neu-inset p-4 space-y-3">
                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={addOptionalOvernight}
                        onChange={(e) => setAddOptionalOvernight(e.target.checked)}
                        className="accent-emerald-600 h-4 w-4 rounded"
                      />
                      <span className="text-xs font-bold text-emerald-700">
                        Add Overnight Stay (+{formatCurrency(villaRules.overnightAddonBasePrice)})
                      </span>
                    </label>
                    <p className="text-[11px] text-slate-500 pl-6">
                      Stay until 9:00 AM the next morning (includes up to 15 sleeping guests).
                    </p>

                    {addOptionalOvernight && (
                      <div className="pl-6 pt-1">
                        <FloatingInput
                          label="Number of Overnight Guests"
                          value={overnightGuestsCount}
                          numericOnly
                          onChange={(val) =>
                            setOvernightGuestsCount(Math.max(1, Number(val || 1)))
                          }
                          helperText={
                            overnightGuestsCount > villaRules.overnightAddonBasePax
                              ? `+${
                                  overnightGuestsCount - villaRules.overnightAddonBasePax
                                } extra overnight guests (+${formatCurrency(
                                  villaRules.overnightAddonExcessRate
                                )}/person)`
                              : 'Included within the 15-guest overnight allowance.'
                          }
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="grid gap-3.5 sm:grid-cols-2">
                <FloatingInput
                  label={`Total Overnight Guests (Max ${villaRules.maxPax})`}
                  value={accommodationGuestCount}
                  numericOnly
                  onChange={(val) => {
                    const num = Math.min(villaRules.maxPax, Math.max(1, Number(val || 1)));
                    setAccommodationGuestCount(num);
                    setExcessPaxInput(Math.max(0, num - villaRules.basePax));
                  }}
                  helperText={`Base rate covers up to ${villaRules.basePax} guests.`}
                />
                <div className="neu-inset p-3.5 flex flex-col justify-center text-xs">
                  <span className="text-slate-500 font-bold text-[10px] uppercase">
                    Extra Guest Surcharge
                  </span>
                  <span className="font-mono font-bold text-slate-800 mt-0.5">
                    {excessPaxInput} extra ({formatCurrency(villaRules.accommodationExcessRate)}/each)
                  </span>
                </div>
              </div>
            )}

            <div className="border-t border-slate-300/60 pt-4 space-y-3.5">
              <FloatingInput
                label="Guest Full Name"
                value={fullName}
                onChange={setFullName}
                required
              />

              <PhoneInput
                label="Mobile Number"
                value={phone}
                onChange={setPhone}
                required
                helperText="We will send your SMS booking receipt and updates to this number."
              />

              <FloatingInput
                label="Email Address (Optional)"
                type="email"
                value={email}
                onChange={setEmail}
                helperText="Recommended for international guests. We will email a complete, printable receipt."
              />
            </div>

            <div className="flex items-center justify-between pt-2 gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="neu-btn inline-flex items-center gap-1.5 px-4 py-3 text-xs font-bold"
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              <button
                type="button"
                disabled={!canAdvanceFromStep2}
                onClick={() => setStep(3)}
                className="neu-btn-primary inline-flex items-center gap-2 px-6 py-3 text-xs font-bold uppercase tracking-wider"
              >
                Next: Review & Pay <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ============================================================
            STEP 3: REVIEW PRICE BREAKDOWN & CHECKOUT
           ============================================================ */}
        {step === 3 && (
          <div className="space-y-5 animate-fadeIn">
            <div className="neu-inset p-4 space-y-2.5 text-xs font-medium text-slate-700">
              <div className="flex justify-between items-center border-b border-slate-300/60 pb-2">
                <h3 className="text-sm font-extrabold text-slate-800">Complete Booking Summary</h3>
                <span className="neu-card-sm px-2.5 py-0.5 text-[10px] font-bold text-emerald-700">
                  {totalGuests} Guests
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-slate-500">Guest:</span>
                <span className="font-bold text-slate-800">
                  {fullName} ({phone})
                </span>
              </div>
              {email && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Email Receipt:</span>
                  <span className="font-semibold text-slate-800">{email}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">Schedule:</span>
                <span className="font-bold text-slate-800">
                  {bookingPurpose === 'events'
                    ? `${eventDate} (${timeSlot === 'day' ? 'Daytime' : 'Evening'})`
                    : `${checkInDate} to ${checkOutDate} (${nightsCount} night${
                        nightsCount > 1 ? 's' : ''
                      })`}
                </span>
              </div>

              <div className="border-t border-slate-300/50 pt-2 flex justify-between">
                <span>
                  Base Rate (
                  {bookingPurpose === 'events'
                    ? `${selectedBasePaxTier} Guests`
                    : `${villaRules.basePax} Guests`}
                  )
                </span>
                <span className="font-mono text-slate-800 font-bold">
                  {formatCurrency(priceBreakdown.fixedPackagePrice)}
                </span>
              </div>

              {excessPaxInput > 0 && (
                <div className="flex justify-between">
                  <span>Extra Guests ({excessPaxInput})</span>
                  <span className="font-mono text-slate-800 font-bold">
                    {formatCurrency(priceBreakdown.excessPaxSurcharge)}
                  </span>
                </div>
              )}

              {priceBreakdown.optionalOvernightAddonPrice > 0 && (
                <div className="flex justify-between text-emerald-700 font-bold">
                  <span>Overnight Stay Add-on</span>
                  <span className="font-mono">
                    {formatCurrency(priceBreakdown.optionalOvernightAddonPrice)}
                  </span>
                </div>
              )}

              {priceBreakdown.mandatoryCleaningFee > 0 && (
                <div className="flex justify-between">
                  <span>Mandatory Cleaning Fee</span>
                  <span className="font-mono text-slate-800 font-bold">
                    {formatCurrency(priceBreakdown.mandatoryCleaningFee)}
                  </span>
                </div>
              )}

              <div className="border-t border-slate-300/60 pt-2.5 flex justify-between items-center text-sm font-extrabold text-slate-800">
                <span>Total Reservation Cost</span>
                <span className="font-mono text-emerald-700 text-base">
                  {formatCurrency(priceBreakdown.aggregateTotalCost)}
                </span>
              </div>

              <div className="flex justify-between items-center text-xs text-slate-600 pt-1">
                <span>Minimum Required Deposit ({minDepositPercent}%):</span>
                <span className="font-mono font-extrabold text-slate-800">
                  {formatCurrency(minimumDepositAmount)}
                </span>
              </div>
            </div>

            {/* Policy Reminder Box */}
            <div className="neu-inset-sm p-3.5 text-[11px] text-slate-600 space-y-1">
              <p>
                • <strong>Cancellation Forfeiture Rule:</strong> Cancelling within{' '}
                <strong>{systemSettings.forfeiture_days} days</strong> of the reservation date
                forfeits your payment (no refund).
              </p>
              {packageOption === 'with_catering' && (
                <p>
                  • <strong>Catering Deadline:</strong> At least{' '}
                  <strong>{formatCurrency(systemSettings.catering_required_amount)}</strong> must be
                  paid 1 week before your appointment.
                </p>
              )}
            </div>

            {isWalkInMode ? (
              /* UNIFIED ADMIN WALK-IN CHECKOUT PANEL */
              <div className="neu-card-sm p-4 space-y-4">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-emerald-700">
                  Admin Walk-In Payment Collection
                </h4>

                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'cash', label: 'Cash Payment', icon: Banknote },
                    { id: 'paymongo', label: 'PayMongo Link', icon: CreditCard },
                    { id: 'manual', label: 'Manual Transfer', icon: Receipt },
                  ].map((gw) => (
                    <button
                      key={gw.id}
                      type="button"
                      onClick={() => setWalkInGateway(gw.id as any)}
                      className={`py-2.5 px-2 text-xs font-bold rounded-xl transition ${
                        walkInGateway === gw.id ? 'neu-btn-primary' : 'neu-btn'
                      }`}
                    >
                      {gw.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setWalkInPaymentPlan('half')}
                    className={`py-2 px-2 text-xs font-bold rounded-xl ${
                      walkInPaymentPlan === 'half' ? 'neu-btn-primary' : 'neu-btn'
                    }`}
                  >
                    {minDepositPercent}% Deposit ({formatCurrency(minimumDepositAmount)})
                  </button>
                  <button
                    type="button"
                    onClick={() => setWalkInPaymentPlan('full')}
                    className={`py-2 px-2 text-xs font-bold rounded-xl ${
                      walkInPaymentPlan === 'full' ? 'neu-btn-primary' : 'neu-btn'
                    }`}
                  >
                    100% Full ({formatCurrency(priceBreakdown.aggregateTotalCost)})
                  </button>
                  <button
                    type="button"
                    onClick={() => setWalkInPaymentPlan('custom')}
                    className={`py-2 px-2 text-xs font-bold rounded-xl ${
                      walkInPaymentPlan === 'custom' ? 'neu-btn-primary' : 'neu-btn'
                    }`}
                  >
                    Custom Amount
                  </button>
                </div>

                {walkInPaymentPlan === 'custom' && (
                  <FloatingInput
                    label="Custom Amount Collected (₱)"
                    value={walkInCustomAmount}
                    onChange={setWalkInCustomAmount}
                    numericOnly
                    allowDecimal
                    zeroAsEmpty
                  />
                )}

                <FloatingInput
                  label="Receipt / Reference Note (Optional for Cash)"
                  value={walkInRefNumber}
                  onChange={setWalkInRefNumber}
                />

                <div className="flex items-center justify-between gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="neu-btn inline-flex items-center gap-1 px-4 py-3 text-xs font-bold"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" /> Back
                  </button>
                  <button
                    type="button"
                    disabled={walkInSubmitting}
                    onClick={handleWalkInSubmit}
                    className="neu-btn-primary flex-1 py-3.5 text-xs font-bold uppercase tracking-wider"
                  >
                    {walkInSubmitting
                      ? 'Saving Walk-In Booking...'
                      : `Confirm Walk-In (${walkInGateway.toUpperCase()})`}
                  </button>
                </div>
              </div>
            ) : (
              /* PUBLIC GUEST AGREEMENTS & CHECKOUT REDIRECT */
              <div className="space-y-4">
                <div className="flex items-center justify-between neu-inset px-3.5 py-2.5 text-xs">
                  <span className="text-slate-600">Need help before paying?</span>
                  <button
                    type="button"
                    onClick={() => setActivePopup('faq')}
                    className="text-emerald-700 font-bold hover:underline"
                  >
                    View FAQs & Policies
                  </button>
                </div>

                <div className="grid gap-2 sm:grid-cols-2 text-xs text-slate-600">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={agreeTerms}
                      onChange={(e) => setAgreeTerms(e.target.checked)}
                      className="accent-emerald-600 h-4 w-4 rounded"
                    />
                    <span>
                      I agree to the{' '}
                      <button
                        type="button"
                        onClick={() => setActivePopup('terms')}
                        className="underline font-bold text-slate-800 hover:text-emerald-700"
                      >
                        Booking & Forfeiture Rules
                      </button>
                    </span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={agreePrivacy}
                      onChange={(e) => setAgreePrivacy(e.target.checked)}
                      className="accent-emerald-600 h-4 w-4 rounded"
                    />
                    <span>
                      I agree to the{' '}
                      <button
                        type="button"
                        onClick={() => setActivePopup('privacy')}
                        className="underline font-bold text-slate-800 hover:text-emerald-700"
                      >
                        Privacy Policy
                      </button>
                    </span>
                  </label>
                </div>

                <div className="flex items-center justify-between gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="neu-btn inline-flex items-center gap-1.5 px-4 py-3.5 text-xs font-bold"
                  >
                    <ChevronLeft className="w-4 h-4" /> Back
                  </button>
                  <button
                    type="button"
                    disabled={!agreeTerms || !agreePrivacy}
                    onClick={() => router.push(paymentUrl)}
                    className="neu-btn-primary flex-1 py-3.5 text-xs font-bold uppercase tracking-wider"
                  >
                    Proceed to Payment
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <BookingPolicyModal
        activePopup={activePopup}
        onClose={() => setActivePopup(null)}
        minDepositPercent={minDepositPercent}
        forfeitureDays={systemSettings.forfeiture_days}
        cateringRequiredAmount={systemSettings.catering_required_amount}
      />
    </div>
  );
}

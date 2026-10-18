import type { BookingPurpose, DayGroup, PackageRow, PriceBreakdown, RateTierRow, TimeSlot } from '@/types';

export interface VillaPricingRules {
  isSuki: boolean;
  basePax: number;
  maxPax: number;
  accommodationExcessRate: number;
  eventVisitorRate: number;
  overnightAddonBasePrice: number;
  overnightAddonBasePax: number;
  overnightAddonExcessRate: number;
}

export function getVillaPricingRules(villaTitle: string): VillaPricingRules {
  const isSuki = villaTitle.toLowerCase().includes('suki');
  return {
    isSuki,
    basePax: isSuki ? 8 : 16,
    maxPax: isSuki ? 25 : 30,
    accommodationExcessRate: isSuki ? 500 : 600,
    eventVisitorRate: isSuki ? 300 : 400,
    overnightAddonBasePrice: isSuki ? 10000 : 12000,
    overnightAddonBasePax: 15,
    overnightAddonExcessRate: isSuki ? 500 : 600,
  };
}

export function calculateBookingPrice(params: {
  bookingPurpose: BookingPurpose;
  rateTiers: RateTierRow[];
  activePackage?: PackageRow;
  selectedBasePaxTier: number;
  timeSlot: TimeSlot;
  dayGroup: DayGroup;
  excessPaxCount: number;
  rules: VillaPricingRules;
  nightsCount: number;
  addOptionalOvernight: boolean;
  overnightGuestsCount: number;
}): PriceBreakdown {
  const {
    bookingPurpose,
    rateTiers,
    activePackage,
    selectedBasePaxTier,
    timeSlot,
    dayGroup,
    excessPaxCount,
    rules,
    nightsCount,
    addOptionalOvernight,
    overnightGuestsCount,
  } = params;

  let fixedPackagePrice = 0;
  let excessPaxSurcharge = 0;
  let mandatoryCleaningFee = 0;
  let optionalOvernightAddonPrice = 0;

  if (bookingPurpose === 'events') {
    const pkgTiers = activePackage
      ? rateTiers.filter((t) => t.package_id === activePackage.id)
      : rateTiers;

    const matchingTier =
      pkgTiers.find(
        (t) =>
          Number(t.base_pax) === Number(selectedBasePaxTier) &&
          t.time_of_day === timeSlot &&
          t.day_group === dayGroup
      ) ||
      pkgTiers.find(
        (t) =>
          Number(t.base_pax) === Number(selectedBasePaxTier) &&
          t.time_of_day === timeSlot
      ) ||
      pkgTiers.find((t) => Number(t.base_pax) === Number(selectedBasePaxTier)) ||
      pkgTiers.find(
        (t) => t.time_of_day === timeSlot && t.day_group === dayGroup
      ) ||
      pkgTiers.find((t) => t.time_of_day === timeSlot) ||
      pkgTiers[0];

    const perExcessGuestRate =
      activePackage && Number(activePackage.excess_pax_rate) > 0
        ? Number(activePackage.excess_pax_rate)
        : rules.eventVisitorRate;

    fixedPackagePrice = matchingTier ? Number(matchingTier.price) : 0;
    excessPaxSurcharge = excessPaxCount * perExcessGuestRate;
    mandatoryCleaningFee = 0;

    if (addOptionalOvernight && timeSlot === 'evening') {
      const extraOvernightGuests = Math.max(0, overnightGuestsCount - rules.overnightAddonBasePax);
      const extraOvernightCost = extraOvernightGuests * rules.overnightAddonExcessRate;
      optionalOvernightAddonPrice = rules.overnightAddonBasePrice + extraOvernightCost;
    }
  } else {
    const nightlyRate =
      dayGroup === 'weekend_holiday'
        ? rules.isSuki ? 14000 : 22000
        : rules.isSuki ? 12000 : 20000;

    fixedPackagePrice = nightlyRate * nightsCount;
    excessPaxSurcharge = excessPaxCount * rules.accommodationExcessRate * nightsCount;
    mandatoryCleaningFee = 500;
  }

  const aggregateTotalCost =
    fixedPackagePrice + excessPaxSurcharge + mandatoryCleaningFee + optionalOvernightAddonPrice;

  return {
    fixedPackagePrice,
    excessPaxSurcharge,
    mandatoryCleaningFee,
    optionalOvernightAddonPrice,
    aggregateTotalCost,
  };
}


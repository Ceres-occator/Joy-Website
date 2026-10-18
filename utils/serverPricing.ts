import type { SupabaseClient } from '@supabase/supabase-js';
import { calculateNights, getDayGroup } from '@/utils/dateHelpers';
import { calculateBookingPrice, getVillaPricingRules } from '@/utils/pricing';
import type { BookingPurpose, PackageOption, PackageRow, RateTierRow, TimeSlot } from '@/types';

export interface ServerPricingInput {
  villaId: string;
  packageOption: PackageOption;
  startDate: string;
  endDate: string;
  timeSlot: TimeSlot;
  paxCount: number;
  selectedBasePaxTier?: number;
  extraGuests?: number;
  includeOvernight?: boolean;
  overnightPaxCount?: number;
}

export interface AuthoritativePricingResult {
  villaId: string;
  villaName: string;
  villaAddress: string | null;
  totalPrice: number;
  minDepositPercent: number;
  requiredDepositAmount: number;
  cateringRequiredAmount: number;
  cateringDeadlineDays: number;
  cateringDeadlineDate: string | null;
  resolvedPaxCount: number;
  resolvedBasePaxTier: number;
  excessPaxCount: number;
}

/**
 * Authoritatively computes a booking's total price, minimum deposit requirement,
 * and catering deadline rules on the backend directly from Supabase tables
 * (`villas`, `packages`, `rate_tiers`, `system_settings`).
 *
 * Never trusts client-provided price or deposit amounts.
 */
export async function computeAuthoritativeBookingPrice(
  supabase: SupabaseClient,
  input: ServerPricingInput
): Promise<AuthoritativePricingResult> {
  const {
    villaId,
    packageOption,
    startDate,
    endDate,
    timeSlot,
    paxCount,
    selectedBasePaxTier,
    extraGuests,
    includeOvernight = false,
    overnightPaxCount = 0,
  } = input;

  // 1. Fetch Villa (with nested packages & rate_tiers), Packages, and System Settings from Supabase
  const [{ data: villa, error: villaErr }, { data: pkgs, error: pkgsErr }, { data: sysSettings }] =
    await Promise.all([
      supabase
        .from('villas')
        .select('id, name, address, min_deposit_percent, packages(*, rate_tiers(*))')
        .eq('id', villaId)
        .maybeSingle(),
      supabase.from('packages').select('*, rate_tiers(*)').eq('villa_id', villaId),
      supabase.from('system_settings').select('*').eq('id', 'default').maybeSingle(),
    ]);

  if (villaErr || !villa) {
    throw new Error('Selected villa was not found in the database.');
  }

  const rawPkgs =
    pkgs && pkgs.length > 0
      ? pkgs
      : Array.isArray((villa as any).packages)
      ? (villa as any).packages
      : [];

  const dbPackages: PackageRow[] = rawPkgs.map((p: any) => ({
    id: p.id,
    villa_id: p.villa_id,
    name: p.name,
    excess_pax_rate: Number(p.excess_pax_rate ?? 0),
  }));

  let dbRateTiers: RateTierRow[] = rawPkgs.flatMap((p: any) =>
    Array.isArray(p.rate_tiers) ? p.rate_tiers : []
  );

  const pkgIds = dbPackages.map((p) => p.id);
  if (dbRateTiers.length === 0 && pkgIds.length > 0) {
    const { data: tiers } = await supabase
      .from('rate_tiers')
      .select('*')
      .in('package_id', pkgIds)
      .order('base_pax', { ascending: true });
    dbRateTiers = (tiers || []) as RateTierRow[];
  }

  const villaRules = getVillaPricingRules(villa.name || '');
  const bookingPurpose: BookingPurpose =
    packageOption === 'accommodation_only' ? 'accommodation' : 'events';
  const dayGroup = getDayGroup(startDate);
  const nightsCount =
    bookingPurpose === 'accommodation' ? calculateNights(startDate, endDate) : 1;

  const activePackage =
    dbPackages.find((p) => p.name === packageOption) ||
    dbPackages.find((p) => p.name !== 'accommodation_only') ||
    dbPackages[0];

  let resolvedBasePaxTier = selectedBasePaxTier || 0;
  let excessPaxCount = Math.max(0, Number(extraGuests || 0));
  let resolvedPaxCount = Math.max(1, Number(paxCount || 1));

  if (bookingPurpose === 'events') {
    let matchingTiers = dbRateTiers
      .filter(
        (t) =>
          t.package_id === activePackage?.id &&
          t.time_of_day === timeSlot &&
          t.day_group === dayGroup
      )
      .sort((a, b) => Number(a.base_pax) - Number(b.base_pax));

    if (matchingTiers.length === 0 && activePackage) {
      matchingTiers = dbRateTiers
        .filter((t) => t.package_id === activePackage.id && t.time_of_day === timeSlot)
        .sort((a, b) => Number(a.base_pax) - Number(b.base_pax));
    }

    if (matchingTiers.length === 0 && activePackage) {
      matchingTiers = dbRateTiers
        .filter((t) => t.package_id === activePackage.id)
        .sort((a, b) => Number(a.base_pax) - Number(b.base_pax));
    }

    if (matchingTiers.length === 0) {
      throw new Error(
        `No active rate tier found for ${packageOption} (${timeSlot}, ${dayGroup}). Please check your RLS policies on packages and rate_tiers.`
      );
    }

    const explicitMatch = resolvedBasePaxTier
      ? matchingTiers.find((t) => Number(t.base_pax) === Number(resolvedBasePaxTier))
      : undefined;

    if (explicitMatch) {
      resolvedBasePaxTier = Number(explicitMatch.base_pax);
      if (extraGuests !== undefined && extraGuests >= 0) {
        excessPaxCount = extraGuests;
        resolvedPaxCount = resolvedBasePaxTier + excessPaxCount;
      } else {
        excessPaxCount = Math.max(0, resolvedPaxCount - resolvedBasePaxTier);
      }
    } else {
      let chosenTier = matchingTiers[0];
      for (const tier of matchingTiers) {
        if (Number(tier.base_pax) <= resolvedPaxCount) {
          chosenTier = tier;
        } else {
          break;
        }
      }
      resolvedBasePaxTier = Number(chosenTier.base_pax);
      excessPaxCount = Math.max(0, resolvedPaxCount - resolvedBasePaxTier);
    }
  } else {
    resolvedBasePaxTier = villaRules.basePax;
    excessPaxCount = Math.max(0, resolvedPaxCount - villaRules.basePax);
  }

  const breakdown = calculateBookingPrice({
    bookingPurpose,
    rateTiers: dbRateTiers,
    activePackage,
    selectedBasePaxTier: resolvedBasePaxTier,
    timeSlot,
    dayGroup,
    excessPaxCount,
    rules: villaRules,
    nightsCount,
    addOptionalOvernight: Boolean(includeOvernight && timeSlot === 'evening'),
    overnightGuestsCount: Boolean(includeOvernight && timeSlot === 'evening')
      ? Math.max(1, Number(overnightPaxCount || 1))
      : 0,
  });

  const totalPrice = Number(breakdown.aggregateTotalCost);
  if (!Number.isFinite(totalPrice) || totalPrice <= 0) {
    throw new Error('Computed booking total price is invalid.');
  }

  const rawDepositPercent = Number(
    villa.min_deposit_percent ?? sysSettings?.min_deposit_percent ?? 50
  );
  const minDepositPercent = Math.min(100, Math.max(1, rawDepositPercent));
  const requiredDepositAmount = Math.round(totalPrice * (minDepositPercent / 100));

  const cateringRequiredAmount =
    packageOption === 'with_catering'
      ? Number(sysSettings?.catering_required_amount ?? 10000)
      : 0;
  const cateringDeadlineDays = Number(sysSettings?.catering_deadline_days ?? 7);

  let cateringDeadlineDate: string | null = null;
  if (packageOption === 'with_catering') {
    const startObj = new Date(`${startDate}T00:00:00Z`);
    startObj.setUTCDate(startObj.getUTCDate() - cateringDeadlineDays);
    cateringDeadlineDate = startObj.toISOString().split('T')[0];
  }

  return {
    villaId: villa.id,
    villaName: villa.name || 'Joy Events Venue',
    villaAddress: villa.address || null,
    totalPrice,
    minDepositPercent,
    requiredDepositAmount,
    cateringRequiredAmount,
    cateringDeadlineDays,
    cateringDeadlineDate,
    resolvedPaxCount,
    resolvedBasePaxTier,
    excessPaxCount,
  };
}


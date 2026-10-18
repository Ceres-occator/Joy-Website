/**
 * Parses a villa's `image_url` database column, which may contain either
 * a JSON-stringified array of URLs or a single URL string.
 */
export function parseVillaImages(imageUrl: string | null | undefined): string[] {
  if (!imageUrl) return [];
  try {
    const parsed = JSON.parse(imageUrl);
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
    }
    return typeof parsed === 'string' && parsed.trim() ? [parsed] : [];
  } catch {
    return imageUrl.trim() ? [imageUrl.trim()] : [];
  }
}

/**
 * Returns the first image of a villa or an empty string if none exist.
 */
export function getFirstVillaImage(imageUrl: string | null | undefined): string {
  const images = parseVillaImages(imageUrl);
  return images[0] || '';
}

/**
 * Formats a number as Philippine Peso (₱).
 */
export function formatCurrency(amount: number | string | null | undefined, showDecimals = false): string {
  const numericAmount = Number(amount || 0);
  return `₱${numericAmount.toLocaleString(undefined, {
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  })}`;
}

/**
 * Converts internal package codes into friendly human-readable labels.
 */
export function formatPackageLabel(packageOption: string | null | undefined): string {
  if (!packageOption) return 'Standard';
  const map: Record<string, string> = {
    with_catering: 'With Catering',
    venue_only: 'Venue Only',
    accommodation_only: 'Overnight Stay',
  };
  return map[packageOption] || packageOption.replace(/_/g, ' ');
}

/**
 * Converts internal booking status codes into simple, human-readable text.
 */
export function formatStatusLabel(status: string | null | undefined): string {
  if (!status) return 'Pending';
  const map: Record<string, string> = {
    pending_verification: 'Needs Review',
    confirmed: 'Confirmed',
    completed: 'Completed',
    rejected: 'Declined',
    cancelled: 'Cancelled',
    cancelled_request_pending: 'Cancellation Requested',
    archived: 'Archived',
  };
  return map[status] || status.replace(/_/g, ' ');
}

/**
 * Formats a booking's date or stay range for display.
 */
export function formatStayDates(
  startDateString: string | null | undefined,
  endDateString?: string | null,
  packageOption?: string
): string {
  if (!startDateString) return 'No date set';
  if (packageOption !== 'accommodation_only') return startDateString;

  try {
    const [startY, startM, startD] = startDateString.split('-').map(Number);
    const checkInDate = new Date(startY, startM - 1, startD);

    let checkOutDate: Date;
    if (endDateString && endDateString !== startDateString) {
      const [endY, endM, endD] = endDateString.split('-').map(Number);
      checkOutDate = new Date(endY, endM - 1, endD);
    } else {
      checkOutDate = new Date(startY, startM - 1, startD + 1);
    }

    const fmt: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
    return `${checkInDate.toLocaleDateString(undefined, fmt)} → ${checkOutDate.toLocaleDateString(undefined, fmt)}`;
  } catch {
    return startDateString;
  }
}

/**
 * Checks whether a YYYY-MM-DD date string is strictly in the past.
 */
export function isPastDate(dateString: string | null | undefined): boolean {
  if (!dateString) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [y, m, d] = dateString.split('-').map(Number);
  if (!y || !m || !d) return new Date(dateString) < today;
  return new Date(y, m - 1, d) < today;
}


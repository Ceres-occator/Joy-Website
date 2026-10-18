import type { DayGroup } from '@/types';

/**
 * Determines whether a YYYY-MM-DD date string falls on a weekend/holiday
 * (Friday, Saturday, Sunday) or a standard weekday (Monday–Thursday).
 * Uses local date parts to avoid UTC timezone shifts.
 */
export function getDayGroup(dateString: string): DayGroup {
  if (!dateString) return 'weekday';
  const parts = dateString.split('-').map(Number);
  const date = parts.length === 3
    ? new Date(parts[0], parts[1] - 1, parts[2])
    : new Date(dateString);
  const day = date.getDay(); // 0 = Sunday, 5 = Friday, 6 = Saturday

  if (day === 0 || day === 5 || day === 6) {
    return 'weekend_holiday';
  }

  return 'weekday';
}

/**
 * Calculates the number of nights between two YYYY-MM-DD date strings.
 */
export function calculateNights(checkInDate: string, checkOutDate: string): number {
  if (!checkInDate || !checkOutDate) return 1;
  const [inY, inM, inD] = checkInDate.split('-').map(Number);
  const [outY, outM, outD] = checkOutDate.split('-').map(Number);
  const start = new Date(inY, inM - 1, inD);
  const end = new Date(outY, outM - 1, outD);
  const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 1;
}
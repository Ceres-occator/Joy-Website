// utils/dateHelpers.ts
export function getDayGroup(dateString: string): 'weekend_holiday' | 'weekday' {
  const date = new Date(dateString);
  const day = date.getDay(); // 0 = Sunday, 5 = Friday, 6 = Saturday
  
  if (day === 0 || day === 5 || day === 6) {
    return 'weekend_holiday';
  }
  
  // Note: For actual production, you'll want to check against a public holidays array here
  return 'weekday';
}
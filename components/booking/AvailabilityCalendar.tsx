'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { SkeletonBox } from '@/components/ui/Skeleton';

interface AvailabilityCalendarProps {
  villaId: string;
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function AvailabilityCalendar({ villaId }: AvailabilityCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [availability, setAvailability] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  useEffect(() => {
    async function fetchAvailability() {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/villas/${villaId}/availability?year=${year}&month=${month + 1}`
        );
        const data = await res.json();
        if (data.availability) {
          setAvailability(data.availability);
        }
      } catch (err) {
        console.error('Failed to load calendar availability:', err);
      } finally {
        setLoading(false);
      }
    }
    if (villaId) fetchAvailability();
  }, [villaId, year, month]);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay();

  const handlePrevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  return (
    <div className="space-y-5 max-w-md">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-base">
          {MONTH_NAMES[month]} {year}
        </h4>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handlePrevMonth}
            aria-label="Previous month"
            className="p-2 rounded-full text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={handleNextMonth}
            aria-label="Next month"
            className="p-2 rounded-full text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-y-1 text-center text-xs font-medium text-gray-600 dark:text-gray-300">
        {WEEKDAYS.map((day) => (
          <div key={day}>{day}</div>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-7 gap-1.5" aria-busy="true">
          {Array.from({ length: 35 }).map((_, i) => (
            <SkeletonBox key={i} className="aspect-square w-full rounded-full" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: firstDayIndex }).map((_, i) => (
            <div key={`empty-${i}`} className="aspect-square" />
          ))}

          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(
              dayNum
            ).padStart(2, '0')}`;
            const slots = availability[dateString] || [];

            const isFullyBooked = slots.includes('day') && slots.includes('evening');
            const isDayOnly = slots.includes('day') && !slots.includes('evening');
            const isEveningOnly = !slots.includes('day') && slots.includes('evening');

            let statusClass = 'text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800';
            let statusLabel = 'Available all day';

            if (isFullyBooked) {
              statusClass = 'bg-rose-600 text-white font-semibold';
              statusLabel = 'Fully booked';
            } else if (isDayOnly) {
              statusClass = 'bg-amber-400 text-amber-950 font-semibold';
              statusLabel = 'Daytime booked (Evening open)';
            } else if (isEveningOnly) {
              statusClass = 'bg-orange-500 text-white font-semibold';
              statusLabel = 'Evening booked (Daytime open)';
            }

            return (
              <div
                key={`day-${dayNum}`}
                className={`aspect-square flex items-center justify-center rounded-full text-sm select-none transition-colors ${statusClass}`}
                title={statusLabel}
              >
                {dayNum}
              </div>
            );
          })}
        </div>
      )}

      <ul className="pt-4 border-t border-gray-200 dark:border-gray-800 flex flex-wrap gap-x-5 gap-y-2 text-xs text-gray-900 dark:text-gray-100">
        <li className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full border border-gray-400 dark:border-gray-500 inline-block" />
          <span>Available</span>
        </li>
        <li className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400 inline-block" />
          <span>Day booked</span>
        </li>
        <li className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-orange-500 inline-block" />
          <span>Night booked</span>
        </li>
        <li className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-600 inline-block" />
          <span>Fully booked</span>
        </li>
      </ul>
    </div>
  );
}

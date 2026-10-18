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
    <div className="neu-card p-6 space-y-5">
      <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-gray-800">
        <h3 className="font-bold text-gray-900 dark:text-gray-100 text-base">
          {MONTH_NAMES[month]} {year}
        </h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrevMonth}
            aria-label="Previous month"
            className="neu-btn p-2 text-gray-900 dark:text-gray-100"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleNextMonth}
            aria-label="Next month"
            className="neu-btn p-2 text-gray-900 dark:text-gray-100"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2 text-center text-[11px] font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
        {WEEKDAYS.map((day) => (
          <div key={day}>{day}</div>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-7 gap-2" aria-busy="true">
          {Array.from({ length: 35 }).map((_, i) => (
            <SkeletonBox key={i} className="aspect-square w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-2">
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

            let statusClass =
              'neu-card-sm text-gray-900 dark:text-gray-100 font-semibold';
            let statusLabel = 'Available all day';

            if (isFullyBooked) {
              statusClass = 'bg-rose-600 text-white font-bold shadow-sm';
              statusLabel = 'Fully booked';
            } else if (isDayOnly) {
              statusClass = 'bg-amber-400 text-amber-950 font-bold shadow-sm';
              statusLabel = 'Daytime booked (Evening open)';
            } else if (isEveningOnly) {
              statusClass = 'bg-orange-500 text-white font-bold shadow-sm';
              statusLabel = 'Evening booked (Daytime open)';
            }

            return (
              <div
                key={`day-${dayNum}`}
                className={`aspect-square flex items-center justify-center rounded-lg text-xs select-none transition-all ${statusClass}`}
                title={statusLabel}
              >
                {dayNum}
              </div>
            );
          })}
        </div>
      )}

      <div className="pt-4 border-t border-gray-200 dark:border-gray-800 grid grid-cols-2 gap-2.5 text-xs font-medium text-gray-900 dark:text-gray-100">
        <div className="flex items-center gap-2">
          <span className="h-3.5 w-3.5 rounded-sm neu-card-sm inline-block" />
          <span className="text-gray-900 dark:text-gray-100">Available</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3.5 w-3.5 rounded-sm bg-amber-400 inline-block" />
          <span className="text-gray-900 dark:text-gray-100">Day Booked</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3.5 w-3.5 rounded-sm bg-orange-500 inline-block" />
          <span className="text-gray-900 dark:text-gray-100">Night Booked</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3.5 w-3.5 rounded-sm bg-rose-600 inline-block" />
          <span className="text-gray-900 dark:text-gray-100">Fully Booked</span>
        </div>
      </div>
    </div>
  );
}

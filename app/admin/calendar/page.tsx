'use client';

import { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import type { VillaLookup } from '@/types';
import { CalendarSkeleton, SkeletonBox } from '@/components/ui/Skeleton';

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

export default function AdminCalendarPage() {
  const [villasList, setVillasList] = useState<VillaLookup[]>([]);
  const [selectedVillaId, setSelectedVillaId] = useState<string>('');
  const [currentYear, setCurrentYear] = useState<number>(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(new Date().getMonth() + 1);
  const [availabilityMap, setAvailabilityMap] = useState<Record<string, string[]>>({});
  const [calendarLoading, setCalendarLoading] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    async function fetchVillas() {
      const supabase = createClient();
      const { data } = await supabase.from('villas').select('id, name').order('name');
      if (data && data.length > 0) {
        setVillasList(data);
        setSelectedVillaId(data[0].id);
      }
    }
    fetchVillas();
  }, []);

  useEffect(() => {
    if (!selectedVillaId) return;

    async function loadAvailability() {
      setCalendarLoading(true);
      try {
        const res = await fetch(
          `/api/villas/${selectedVillaId}/availability?year=${currentYear}&month=${currentMonth}`
        );
        const data = await res.json();
        if (data.availability) setAvailabilityMap(data.availability);
      } catch (err) {
        console.error('Failed to load calendar availability:', err);
      } finally {
        setCalendarLoading(false);
      }
    }
    loadAvailability();
  }, [selectedVillaId, currentYear, currentMonth]);

  const daysInMonthArray = useMemo(() => {
    const totalDays = new Date(currentYear, currentMonth, 0).getDate();
    const startDayOfWeek = new Date(currentYear, currentMonth - 1, 1).getDay();
    return [
      ...Array(startDayOfWeek).fill(null),
      ...Array.from({ length: totalDays }, (_, i) => i + 1),
    ];
  }, [currentYear, currentMonth]);

  const handleMonthNavigation = (direction: 'next' | 'prev') => {
    if (direction === 'prev') {
      if (currentMonth === 1) {
        setCurrentMonth(12);
        setCurrentYear((prev) => prev - 1);
      } else {
        setCurrentMonth((prev) => prev - 1);
      }
    } else {
      if (currentMonth === 12) {
        setCurrentMonth(1);
        setCurrentYear((prev) => prev + 1);
      } else {
        setCurrentMonth((prev) => prev + 1);
      }
    }
  };

  if (!mounted) {
    return <CalendarSkeleton />;
  }

  return (
    <section className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
            Schedule
          </p>
          <h2 className="text-2xl font-extrabold text-gray-900 dark:text-gray-100 sm:text-3xl">
            Booking Calendar
          </h2>
          <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">
            View open and booked dates for each room or event venue.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedVillaId}
            onChange={(e) => setSelectedVillaId(e.target.value)}
            className="neu-input px-4 py-2.5 text-xs font-semibold text-gray-900 dark:text-gray-100 cursor-pointer min-w-[180px]"
          >
            {villasList.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>

          <div className="neu-inset-sm inline-flex items-center p-1 text-xs font-bold text-gray-900 dark:text-gray-100">
            <button
              type="button"
              onClick={() => handleMonthNavigation('prev')}
              className="neu-btn p-1.5 text-gray-900 dark:text-gray-100"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-4 min-w-[135px] text-center font-bold text-gray-900 dark:text-gray-100">
              {MONTH_NAMES[currentMonth - 1]} {currentYear}
            </span>
            <button
              type="button"
              onClick={() => handleMonthNavigation('next')}
              className="neu-btn p-1.5 text-gray-900 dark:text-gray-100"
              aria-label="Next month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Legend Bar (Readable in both Light & Dark Mode) */}
      <div className="neu-card-sm px-4 py-3 flex flex-wrap items-center gap-6 text-xs font-medium text-gray-900 dark:text-gray-100">
        <span className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300">
          Status Legend:
        </span>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm bg-emerald-500 inline-block" />
          <span className="text-gray-900 dark:text-gray-100">Day Open / Night Open</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm bg-amber-500 inline-block" />
          <span className="text-gray-900 dark:text-gray-100">Day Booked</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm bg-orange-500 inline-block" />
          <span className="text-gray-900 dark:text-gray-100">Night Booked</span>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="neu-card p-4 sm:p-6">
        <div className="grid grid-cols-7 gap-2 text-center text-xs">
          {WEEKDAYS.map((day) => (
            <div
              key={day}
              className="py-2 font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider text-xs"
            >
              {day}
            </div>
          ))}

          {calendarLoading ? (
            Array.from({ length: 35 }).map((_, i) => (
              <SkeletonBox key={i} className="min-h-[90px] w-full rounded-lg" />
            ))
          ) : (
            daysInMonthArray.map((dayNum, idx) => {
              if (dayNum === null) {
                return (
                  <div
                    key={`empty-${idx}`}
                    className="neu-inset-sm opacity-40 min-h-[90px]"
                  />
                );
              }

              const dateKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(
                dayNum
              ).padStart(2, '0')}`;
              const activeSlots = availabilityMap[dateKey] || [];
              const isDayBooked = activeSlots.includes('day');
              const isEveningBooked = activeSlots.includes('evening');

              return (
                <div
                  key={dateKey}
                  className="neu-card-sm p-2.5 flex flex-col justify-between items-center min-h-[90px]"
                >
                  <span className="font-bold text-gray-900 dark:text-gray-100 text-xs self-start pl-1">
                    {dayNum}
                  </span>
                  <div className="w-full space-y-1.5 mt-2">
                    <span
                      className={`block text-xs font-semibold px-1.5 py-0.5 rounded text-center border ${
                        isDayBooked
                          ? 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/70 dark:text-amber-200 dark:border-amber-800/70'
                          : 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/70 dark:text-emerald-200 dark:border-emerald-800/70'
                      }`}
                    >
                      {isDayBooked ? 'Day Booked' : 'Day Open'}
                    </span>
                    <span
                      className={`block text-xs font-semibold px-1.5 py-0.5 rounded text-center border ${
                        isEveningBooked
                          ? 'bg-orange-50 text-orange-800 border-orange-200 dark:bg-orange-950/70 dark:text-orange-200 dark:border-orange-800/70'
                          : 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/70 dark:text-emerald-200 dark:border-emerald-800/70'
                      }`}
                    >
                      {isEveningBooked ? 'Night Booked' : 'Night Open'}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}
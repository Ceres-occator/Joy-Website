'use client'

import { useEffect, useState } from "react";

interface AvailabilityCalendarProps {
  villaId: string;
}

export default function AvailabilityCalendar({ villaId }: AvailabilityCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [availability, setAvailability] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed

  useEffect(() => {
    async function fetchAvailability() {
      setLoading(true);
      try {
        const res = await fetch(`/api/villas/${villaId}/availability?year=${year}&month=${month + 1}`);
        const data = await res.json();
        if (data.availability) setAvailability(data.availability);
      } catch (err) {
        console.error("Failed to fetch availability calendar tracking data", err);
      } finally {
        setLoading(false);
      }
    }
    fetchAvailability();
  }, [villaId, year, month]);

  // Calendar generation helpers
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay();
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const handlePrevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  return (
    <div className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm space-y-4">
      {/* Calendar Header Nav Controls */}
      <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
        <h3 className="font-bold text-zinc-900 text-base">{monthNames[month]} {year}</h3>
        <div className="flex space-x-1">
          <button onClick={handlePrevMonth} className="p-2 rounded-xl border hover:bg-zinc-50 text-sm font-bold">←</button>
          <button onClick={handleNextMonth} className="p-2 rounded-xl border hover:bg-zinc-50 text-sm font-bold">→</button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-xs text-zinc-400 animate-pulse">Syncing calendar parameters...</div>
      ) : (
        <>
          {/* Days of the Week Title Bars */}
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-zinc-400 tracking-wider uppercase">
            <div>Su</div><div>Mo</div><div>Tu</div><div>We</div><div>Th</div><div>Fr</div><div>Sa</div>
          </div>

          {/* Day Grid Matrix Board */}
          <div className="grid grid-cols-7 gap-1">
            {/* Pad preceding spaces for proper day alignment */}
            {Array.from({ length: firstDayIndex }).map((_, i) => (
              <div key={`empty-${i}`} className="aspect-square" />
            ))}

            {/* Render real days */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              // Build precise string lookup token matching standard SQL formats: YYYY-MM-DD
              const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
              const slots = availability[dateString] || [];

              // Determine styling rules according to your color specification schema logic
              let dayColorStyles = "bg-zinc-50 border border-zinc-100 text-zinc-800 hover:bg-zinc-100/70";
              
              if (slots.includes('day') && slots.includes('evening')) {
                dayColorStyles = "bg-rose-500 border border-rose-600 text-white font-bold"; // Red: Completely Booked
              } else if (slots.includes('day')) {
                dayColorStyles = "bg-amber-400 border border-amber-500 text-amber-950 font-medium"; // Yellow: Day Slot Occupied
              } else if (slots.includes('evening')) {
                dayColorStyles = "bg-orange-500 border border-orange-600 text-white font-medium"; // Orange: Evening Slot Occupied
              }

              return (
                <div
                  key={`day-${dayNum}`}
                  className={`aspect-square flex items-center justify-center rounded-xl text-xs transition-colors relative select-none ${dayColorStyles}`}
                  title={slots.length > 0 ? `Occupied: ${slots.join(' & ')}` : 'Available'}
                >
                  {dayNum}
                </div>
              );
            })}
          </div>

          {/* Color Indicator Legend Map Trackers */}
          <div className="mt-4 pt-3 border-t border-zinc-100 grid grid-cols-2 gap-2 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-md bg-zinc-100 border border-zinc-200 block" />
              <span>Available</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-md bg-amber-400 border border-amber-500 block" />
              <span>Day Occupied</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-md bg-orange-500 border border-orange-600 block" />
              <span>Night Occupied</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-md bg-rose-500 border border-rose-600 block" />
              <span>Fully Booked</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
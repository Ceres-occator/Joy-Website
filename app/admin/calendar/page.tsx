'use client'

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/utils/supabase/client';

interface VillaLookup {
  id: string;
  name: string;
}

export default function AdminCalendarPage() {
  const [villasList, setVillasList] = useState<VillaLookup[]>([]);
  const [selectedVillaId, setSelectedVillaId] = useState<string>('');
  const [currentYear, setCurrentYear] = useState<number>(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(new Date().getMonth() + 1);
  const [availabilityMap, setAvailabilityMap] = useState<Record<string, string[]>>({});
  const [calendarLoading, setCalendarLoading] = useState<boolean>(false);

  // 1. Fetch live villas list on mount
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

  // 2. Re-fetch calendar matrix metrics when dependencies shift
  useEffect(() => {
    if (!selectedVillaId) return;

    async function loadAvailability() {
      setCalendarLoading(true);
      try {
        const res = await fetch(`/api/villas/${selectedVillaId}/availability?year=${currentYear}&month=${currentMonth}`);
        const data = await res.json();
        if (data.availability) setAvailabilityMap(data.availability);
      } catch (err) {
        console.error("Failed to load active schedule mapping matrices:", err);
      } finally {
        setCalendarLoading(false);
      }
    }
    loadAvailability();
  }, [selectedVillaId, currentYear, currentMonth]);

  // 3. Grid positioning array math generators
  const daysInMonthArray = useMemo(() => {
    const totalDays = new Date(currentYear, currentMonth, 0).getDate();
    const startDayOfWeek = new Date(currentYear, currentMonth - 1, 1).getDay();
    return [...Array(startDayOfWeek).fill(null), ...Array.from({ length: totalDays }, (_, i) => i + 1)];
  }, [currentYear, currentMonth]);

  const handleMonthNavigation = (direction: 'next' | 'prev') => {
    if (direction === 'prev') {
      if (currentMonth === 1) { setCurrentMonth(12); setCurrentYear(prev => prev - 1); }
      else { setCurrentMonth(prev => prev - 1); }
    } else {
      if (currentMonth === 12) { setCurrentMonth(1); setCurrentYear(prev => prev + 1); }
      else { setCurrentMonth(prev => prev + 1); }
    }
  };

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  return (
    <section className="space-y-4 sm:space-y-6">
      {/* Header Context Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-200 pb-4">
        <div className="flex flex-col gap-1">
          <p className="text-xs uppercase tracking-[0.3em] text-zinc-500 sm:text-sm">Booking Calendar</p>
          <h2 className="text-2xl font-semibold text-zinc-900 sm:text-3xl">Central Scheduling View</h2>
        </div>

        {/* Dynamic Controls Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <select 
            value={selectedVillaId} 
            onChange={(e) => setSelectedVillaId(e.target.value)}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-bold text-zinc-700 focus:outline-none focus:border-emerald-500 cursor-pointer shadow-sm"
          >
            {villasList.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>

          <div className="inline-flex items-center border border-zinc-200 rounded-xl overflow-hidden bg-white text-xs font-bold text-zinc-700 shadow-sm">
            <button onClick={() => handleMonthNavigation('prev')} className="px-3 py-2 hover:bg-zinc-50 border-r border-zinc-200">◀</button>
            <span className="px-4 min-w-[125px] text-center">{monthNames[currentMonth - 1]} {currentYear}</span>
            <button onClick={() => handleMonthNavigation('next')} className="px-3 py-2 hover:bg-zinc-50 border-l border-zinc-200">▶</button>
          </div>
        </div>
      </div>

      {/* Main Grid Workspace Box */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 sm:rounded-3xl sm:p-6 shadow-sm">
        <div className="grid grid-cols-7 gap-1.5 text-center text-xs">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
            <div key={day} className="py-2 font-black text-zinc-400 uppercase tracking-widest text-[10px]">{day}</div>
          ))}

          {calendarLoading ? (
            <div className="col-span-7 py-32 text-center text-zinc-400 italic text-xs animate-pulse">Syncing schedule parameters...</div>
          ) : (
            daysInMonthArray.map((dayNum, idx) => {
              if (dayNum === null) return <div key={`empty-${idx}`} className="bg-zinc-50/40 rounded-2xl min-h-[80px]" />;

              const dateKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
              const activeSlots = availabilityMap[dateKey] || [];
              const isDayBooked = activeSlots.includes('day');
              const isEveningBooked = activeSlots.includes('evening');

              return (
                <div key={dateKey} className="border border-zinc-100 bg-zinc-50/20 rounded-2xl p-2.5 flex flex-col justify-between items-center min-h-[85px] group hover:border-zinc-300 hover:bg-white transition-all shadow-sm/5">
                  <span className="font-bold text-zinc-800 text-xs self-start pl-0.5">{dayNum}</span>
                  <div className="w-full space-y-1 mt-2">
                    <span className={`block text-[9px] font-black px-1.5 py-0.5 rounded text-center tracking-wide border transition-all ${
                      isDayBooked ? 'bg-amber-100 border-amber-200 text-amber-800 shadow-sm/5' : 'bg-emerald-50 border-emerald-100 text-emerald-700 group-hover:bg-emerald-100/30'
                    }`}>
                      {isDayBooked ? '☀️ DAY SLOTS' : '✓ OPEN'}
                    </span>
                    <span className={`block text-[9px] font-black px-1.5 py-0.5 rounded text-center tracking-wide border transition-all ${
                      isEveningBooked ? 'bg-orange-100 border-orange-200 text-orange-800 shadow-sm/5' : 'bg-emerald-50 border-emerald-100 text-emerald-700 group-hover:bg-emerald-100/30'
                    }`}>
                      {isEveningBooked ? '🌙 EVE SLOTS' : '✓ OPEN'}
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
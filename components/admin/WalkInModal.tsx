'use client';

import { useState } from 'react';
import type { VillaLookup } from '@/types';
import BookingForm from '@/components/booking/BookingForm';
import AvailabilityCalendar from '@/components/booking/AvailabilityCalendar';

interface WalkInModalProps {
  isOpen: boolean;
  villas: VillaLookup[];
  selectedVillaId?: string;
  setSelectedVillaId?: (v: string) => void;
  onClose: () => void;
  onSuccess?: () => void;
  // Optional legacy props kept for backward compatibility
  [key: string]: any;
}

export default function WalkInModal({
  isOpen,
  villas,
  selectedVillaId,
  setSelectedVillaId,
  onClose,
  onSuccess,
}: WalkInModalProps) {
  const [internalVillaId, setInternalVillaId] = useState('');
  if (!isOpen) return null;

  const effectiveVillaId = selectedVillaId || internalVillaId || villas[0]?.id || '';
  const handleSelectVilla = (id: string) => {
    setInternalVillaId(id);
    setSelectedVillaId?.(id);
  };

  const activeVilla =
    villas.find((v) => v.id === effectiveVillaId) || villas[0] || { id: '', name: 'Venue' };

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="neu-card p-5 sm:p-7 max-w-5xl w-full max-h-[90vh] overflow-y-auto space-y-5 text-xs"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header & Venue Selector */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-300/60 pb-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">
              Admin Walk-In Portal
            </p>
            <h3 className="font-extrabold text-slate-800 text-lg">
              Create Walk-In Cash or Online Booking
            </h3>
            <p className="text-xs text-slate-500">
              Uses the exact public 3-step booking calculator with immediate Cash, PayMongo, or
              Manual payment collection.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={activeVilla.id}
              onChange={(e) => handleSelectVilla(e.target.value)}
              className="neu-input px-4 py-2.5 text-xs font-extrabold text-slate-800 cursor-pointer"
            >
              {villas.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={onClose}
              className="neu-btn px-3 h-9 flex items-center justify-center font-bold text-slate-600 shrink-0"
            >
              Close
            </button>
          </div>
        </div>

        {/* Unified Public Booking Flow + Live Availability Calendar */}
        {activeVilla.id && (
          <div className="grid gap-6 lg:grid-cols-12 items-start">
            <div className="lg:col-span-5">
              <AvailabilityCalendar villaId={activeVilla.id} />
            </div>
            <div className="lg:col-span-7">
              <BookingForm
                key={activeVilla.id}
                villaId={activeVilla.id}
                villaTitle={activeVilla.name}
                categoryType={['Events', 'Accommodation']}
                isWalkInMode={true}
                onWalkInSuccess={() => {
                  alert('Walk-in booking confirmed and customer receipt sent!');
                  if (onSuccess) onSuccess();
                  onClose();
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

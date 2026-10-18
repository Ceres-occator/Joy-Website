'use client';

import { DollarSign, PieChart, Layers } from 'lucide-react';
import { formatCurrency } from '@/utils/formatters';

interface BusinessSummaryModalProps {
  isOpen: boolean;
  filterVilla: string;
  filterMonth: string;
  totalGrossContractCost: number;
  displayedRevenueCollected: number;
  displayedUnpaidReceivables: number;
  displayedTotalCount: number;
  displayedEventCount: number;
  displayedAccommodationCount: number;
  displayedWithCateringCount: number;
  displayedVenueOnlyCount: number;
  onClose: () => void;
}

export default function BusinessSummaryModal({
  isOpen,
  filterVilla,
  filterMonth,
  totalGrossContractCost,
  displayedRevenueCollected,
  displayedUnpaidReceivables,
  displayedTotalCount,
  displayedEventCount,
  displayedAccommodationCount,
  displayedWithCateringCount,
  displayedVenueOnlyCount,
  onClose,
}: BusinessSummaryModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="neu-card p-6 sm:p-7 max-w-lg w-full space-y-5 text-xs"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-300/60 pb-3">
          <div>
            <h3 className="font-black text-slate-900 text-base">Business Summary</h3>
            <p className="text-[11px] font-medium text-slate-500 mt-0.5">
              {filterVilla === 'all' ? 'All Villas' : filterVilla} •{' '}
              {filterMonth === 'all' ? 'All Months' : `Month ${filterMonth}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="neu-btn px-2.5 h-8 flex items-center justify-center font-bold text-slate-600"
          >
            Close
          </button>
        </div>

        <div className="space-y-4 font-medium text-slate-700">
          <div className="space-y-2">
            <p className="font-bold uppercase tracking-wider text-slate-500 text-[11px] flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-emerald-600" /> Revenue Breakdown
            </p>
            <div className="neu-inset p-4 space-y-2.5 font-mono text-xs">
              <div className="flex justify-between border-b border-slate-300/60 pb-1.5">
                <span className="text-slate-600">Total Booking Value:</span>
                <span className="font-black text-slate-900">
                  {formatCurrency(totalGrossContractCost, true)}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-300/60 pb-1.5">
                <span className="text-slate-600">Amount Collected:</span>
                <span className="font-bold text-emerald-700">
                  {formatCurrency(displayedRevenueCollected, true)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Unpaid Balances:</span>
                <span className="font-bold text-amber-700">
                  {formatCurrency(displayedUnpaidReceivables, true)}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <p className="font-bold uppercase tracking-wider text-slate-500 text-[11px] flex items-center gap-1.5">
              <PieChart className="w-3.5 h-3.5 text-blue-600" /> Booking Types
            </p>
            <div className="neu-inset p-4 space-y-2.5 font-mono text-xs">
              <div className="flex justify-between border-b border-slate-300/60 pb-1.5">
                <span className="text-slate-600">Total Bookings:</span>
                <span className="font-black text-slate-900">{displayedTotalCount}</span>
              </div>
              <div className="flex justify-between border-b border-slate-300/60 pb-1.5">
                <span className="text-slate-600">Event Bookings:</span>
                <span className="font-bold text-amber-700">
                  {displayedTotalCount > 0
                    ? ((displayedEventCount / displayedTotalCount) * 100).toFixed(1)
                    : '0.0'}
                  %
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Overnight Stays:</span>
                <span className="font-bold text-purple-700">
                  {displayedTotalCount > 0
                    ? ((displayedAccommodationCount / displayedTotalCount) * 100).toFixed(1)
                    : '0.0'}
                  %
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <p className="font-bold uppercase tracking-wider text-slate-500 text-[11px] flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-purple-600" /> Packages Chosen
            </p>
            <div className="grid grid-cols-3 gap-3 text-center text-xs">
              <div className="neu-inset p-3">
                <span className="block text-[10px] uppercase font-bold text-slate-500">
                  With Catering
                </span>
                <span className="block text-lg font-black text-slate-900 mt-1">
                  {displayedWithCateringCount}
                </span>
              </div>
              <div className="neu-inset p-3">
                <span className="block text-[10px] uppercase font-bold text-slate-500">
                  Venue Only
                </span>
                <span className="block text-lg font-black text-slate-900 mt-1">
                  {displayedVenueOnlyCount}
                </span>
              </div>
              <div className="neu-inset p-3">
                <span className="block text-[10px] uppercase font-bold text-slate-500">
                  Overnight
                </span>
                <span className="block text-lg font-black text-slate-900 mt-1">
                  {displayedAccommodationCount}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


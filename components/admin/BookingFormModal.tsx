'use client';

import { formatCurrency } from '@/utils/formatters';
import type { VillaLookup } from '@/types';
import { Send } from 'lucide-react';

interface BookingFormModalProps {
  isOpen: boolean;
  editId: string | null;
  villasList: VillaLookup[];
  formVillaId: string;
  setFormVillaId: (v: string) => void;
  formName: string;
  setFormName: (v: string) => void;
  formPhone: string;
  setFormPhone: (v: string) => void;
  formEmail?: string;
  setFormEmail?: (v: string) => void;
  formAccName?: string;
  setFormAccName?: (v: string) => void;
  formRefNum?: string;
  setFormRefNum?: (v: string) => void;
  formGateway?: string;
  setFormGateway?: (v: string) => void;
  formChannel?: string;
  setFormChannel?: (v: string) => void;
  formCateringStatus?: string;
  setFormCateringStatus?: (v: string) => void;
  formRefundStatus?: string;
  setFormRefundStatus?: (v: string) => void;
  formRefundAmount?: number;
  setFormRefundAmount?: (v: number) => void;
  formDate: string;
  setFormDate: (v: string) => void;
  formSlot: string;
  setFormSlot: (v: string) => void;
  formPkg: string;
  setFormPkg: (v: string) => void;
  formPax: number;
  setFormPax: (v: number) => void;
  formTotal: number;
  setFormTotal: (v: number) => void;
  formPaid: number;
  setFormPaid: (v: number) => void;
  formStatus: string;
  setFormStatus: (v: string) => void;
  isSaving: boolean;
  onResendReceipt?: () => void;
  isResendingReceipt?: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export default function BookingFormModal({
  isOpen,
  editId,
  villasList,
  formVillaId,
  setFormVillaId,
  formName,
  setFormName,
  formPhone,
  setFormPhone,
  formEmail = '',
  setFormEmail,
  formAccName = '',
  setFormAccName,
  formRefNum = '',
  setFormRefNum,
  formGateway = 'manual',
  setFormGateway,
  formChannel = 'gcash',
  setFormChannel,
  formCateringStatus = 'not_applicable',
  setFormCateringStatus,
  formRefundStatus = 'none',
  setFormRefundStatus,
  formRefundAmount = 0,
  setFormRefundAmount,
  formDate,
  setFormDate,
  formSlot,
  setFormSlot,
  formPkg,
  setFormPkg,
  formPax,
  setFormPax,
  formTotal,
  setFormTotal,
  formPaid,
  setFormPaid,
  formStatus,
  setFormStatus,
  isSaving,
  onResendReceipt,
  isResendingReceipt,
  onClose,
  onSubmit,
}: BookingFormModalProps) {
  if (!isOpen) return null;

  const remainingBalance = Math.max(0, formTotal - formPaid);

  return (
    <div
      className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="neu-card p-6 sm:p-7 max-w-2xl w-full space-y-4 text-xs"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-300/60 pb-3">
          <div>
            <h3 className="font-bold text-slate-900 text-base">
              {editId ? 'Edit Booking & Payment Details' : 'Add Manual Booking'}
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Update guest details, payment records, catering deadline status, or refund info.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {editId && onResendReceipt && (
              <button
                type="button"
                disabled={isResendingReceipt}
                onClick={onResendReceipt}
                className="neu-btn px-3 py-1.5 text-[11px] font-bold text-emerald-700 flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                {isResendingReceipt ? 'Sending...' : 'Send Receipt (SMS/Email)'}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="neu-btn px-2.5 h-8 flex items-center justify-center font-bold text-slate-600"
            >
              Close
            </button>
          </div>
        </div>

        <form
          onSubmit={onSubmit}
          className="space-y-4 text-slate-700 max-h-[75vh] overflow-y-auto pr-1"
        >
          {!editId && (
            <div>
              <label className="block font-bold text-slate-700 mb-1.5">Villa</label>
              <select
                value={formVillaId}
                onChange={(e) => setFormVillaId(e.target.value)}
                className="neu-input w-full px-3.5 py-2.5 text-sm font-semibold"
              >
                {villasList.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Guest Details */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label className="block mb-1.5 text-slate-700 font-bold">Guest Name</label>
              <input
                type="text"
                required
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Full name"
                className="neu-input w-full px-3.5 py-2.5 text-sm font-semibold"
              />
            </div>
            <div>
              <label className="block mb-1.5 text-slate-700 font-bold">Phone Number</label>
              <input
                type="text"
                required
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
                placeholder="+639171234567"
                className="neu-input w-full px-3.5 py-2.5 text-sm font-mono font-semibold"
              />
            </div>
            <div>
              <label className="block mb-1.5 text-slate-700 font-bold">Email (Optional)</label>
              <input
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail?.(e.target.value)}
                placeholder="guest@example.com"
                className="neu-input w-full px-3.5 py-2.5 text-sm font-semibold"
              />
            </div>
          </div>

          {/* Stay Schedule & Package */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5">
            <div>
              <label className="block mb-1.5 text-slate-700 font-bold">Date</label>
              <input
                type="date"
                required
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="neu-input w-full px-3 py-2.5 text-xs font-semibold"
              />
            </div>
            <div>
              <label className="block mb-1.5 text-slate-700 font-bold">Time Slot</label>
              <select
                value={formSlot}
                onChange={(e) => setFormSlot(e.target.value)}
                className="neu-input w-full px-3 py-2.5 text-xs font-semibold"
              >
                <option value="day">Daytime</option>
                <option value="evening">Evening</option>
              </select>
            </div>
            <div>
              <label className="block mb-1.5 text-slate-700 font-bold">Package</label>
              <select
                value={formPkg}
                onChange={(e) => setFormPkg(e.target.value)}
                className="neu-input w-full px-3 py-2.5 text-xs font-semibold"
              >
                <option value="with_catering">With Catering</option>
                <option value="venue_only">Venue Only</option>
                <option value="accommodation_only">Overnight Stay</option>
              </select>
            </div>
            <div>
              <label className="block mb-1.5 text-slate-700 font-bold">Guests</label>
              <input
                type="number"
                required
                min={1}
                value={formPax || ''}
                placeholder="1"
                onChange={(e) => setFormPax(Number(e.target.value) || 0)}
                className="neu-input w-full px-3 py-2.5 text-xs font-mono font-semibold"
              />
            </div>
          </div>

          {/* Payment Record & Gateway Details */}
          <div className="border-t border-slate-300/60 pt-4 space-y-3.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
              Payment Transaction Record
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5">
              <div>
                <label className="block mb-1 text-slate-700 font-bold">Payment Gateway</label>
                <select
                  value={formGateway}
                  onChange={(e) => setFormGateway?.(e.target.value)}
                  className="neu-input w-full px-3 py-2 text-xs font-bold"
                >
                  <option value="paymongo">PayMongo (Online)</option>
                  <option value="manual">Manual Transfer</option>
                  <option value="cash">Walk-In Cash</option>
                </select>
              </div>
              <div>
                <label className="block mb-1 text-slate-700 font-bold">Channel / Bank</label>
                <input
                  type="text"
                  value={formChannel}
                  onChange={(e) => setFormChannel?.(e.target.value)}
                  placeholder="gcash / chinabank / cash"
                  className="neu-input w-full px-3 py-2 text-xs font-semibold"
                />
              </div>
              <div>
                <label className="block mb-1 text-slate-700 font-bold">Sender / Account</label>
                <input
                  type="text"
                  value={formAccName}
                  onChange={(e) => setFormAccName?.(e.target.value)}
                  placeholder="Account holder name"
                  className="neu-input w-full px-3 py-2 text-xs font-semibold"
                />
              </div>
              <div>
                <label className="block mb-1 text-slate-700 font-bold">Reference #</label>
                <input
                  type="text"
                  value={formRefNum}
                  onChange={(e) => setFormRefNum?.(e.target.value)}
                  placeholder="Reference number"
                  className="neu-input w-full px-3 py-2 text-xs font-mono font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block mb-1.5 text-slate-700 font-bold">Total Price (₱)</label>
                <input
                  type="number"
                  required
                  min={0}
                  value={formTotal === 0 ? '' : formTotal}
                  placeholder="0"
                  onChange={(e) => setFormTotal(Number(e.target.value) || 0)}
                  className="neu-input w-full px-3.5 py-2.5 text-sm font-mono font-bold text-slate-900"
                />
              </div>
              <div>
                <label className="block mb-1.5 text-slate-700 font-bold">Amount Paid (₱)</label>
                <input
                  type="number"
                  required
                  min={0}
                  value={formPaid === 0 ? '' : formPaid}
                  placeholder="0"
                  onChange={(e) => setFormPaid(Number(e.target.value) || 0)}
                  className="neu-input w-full px-3.5 py-2.5 text-sm font-mono font-bold text-emerald-700"
                />
              </div>
            </div>

            <div className="neu-inset p-3.5 flex justify-between font-mono text-xs font-bold text-amber-800">
              <span>Remaining Balance:</span>
              <span>{formatCurrency(remainingBalance)}</span>
            </div>
          </div>

          {/* Status, Catering Deadline & Refund Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5 border-t border-slate-300/60 pt-4">
            <div>
              <label className="block mb-1.5 text-slate-700 font-bold">Booking Status</label>
              <select
                value={formStatus}
                onChange={(e) => setFormStatus(e.target.value)}
                className="neu-input w-full px-3 py-2.5 text-xs font-bold text-slate-900"
              >
                <option value="pending_verification">Needs Review</option>
                <option value="confirmed">Confirmed</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
                <option value="rejected">Declined</option>
              </select>
            </div>

            <div>
              <label className="block mb-1.5 text-slate-700 font-bold">Catering Status</label>
              <select
                value={formCateringStatus}
                onChange={(e) => setFormCateringStatus?.(e.target.value)}
                className="neu-input w-full px-3 py-2.5 text-xs font-bold"
              >
                <option value="not_applicable">N/A</option>
                <option value="pending_payment">Pending Catering Fee</option>
                <option value="paid">Catering Paid</option>
                <option value="flagged">Flagged (Overdue)</option>
                <option value="cancelled">Catering Cancelled</option>
              </select>
            </div>

            <div>
              <label className="block mb-1.5 text-slate-700 font-bold">Refund Status</label>
              <select
                value={formRefundStatus}
                onChange={(e) => setFormRefundStatus?.(e.target.value)}
                className="neu-input w-full px-3 py-2.5 text-xs font-bold"
              >
                <option value="none">No Refund</option>
                <option value="requested">Refund Requested</option>
                <option value="approved">Refund Approved</option>
                <option value="refunded">Refunded</option>
                <option value="forfeited">Forfeited (No Refund)</option>
                <option value="rejected">Refund Declined</option>
              </select>
            </div>

            <div>
              <label className="block mb-1.5 text-slate-700 font-bold">Refund Amount (₱)</label>
              <input
                type="number"
                min={0}
                value={formRefundAmount === 0 ? '' : formRefundAmount}
                placeholder="0"
                onChange={(e) => setFormRefundAmount?.(Number(e.target.value) || 0)}
                className="neu-input w-full px-3 py-2.5 text-xs font-mono font-bold text-slate-900"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="neu-btn-primary w-full font-bold py-3.5 text-xs uppercase tracking-wider"
          >
            {isSaving ? 'Saving...' : 'Save Booking & Payment Changes'}
          </button>
        </form>
      </div>
    </div>
  );
}

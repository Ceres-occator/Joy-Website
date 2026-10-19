'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, CheckCircle2, XCircle, Eye } from 'lucide-react';
import { formatCurrency, formatPackageLabel } from '@/utils/formatters';
import type { BookingRecord } from '@/types';

interface BookingHistoryDrawerProps {
  booking: BookingRecord | null;
  logs: any[];
  loading: boolean;
  processingId: string | null;
  onClose: () => void;
  onOpenImage: (filePath: string, title: string) => void;
  onOwnerDecision: (requestId: string, action: 'approve' | 'reject') => void;
  onVerifyPayment: (
    logId: string,
    action: 'approved' | 'rejected',
    amount: number,
    referenceNumber?: string
  ) => void;
}

export default function BookingHistoryDrawer({
  booking,
  logs,
  loading,
  processingId,
  onClose,
  onOpenImage,
  onOwnerDecision,
  onVerifyPayment,
}: BookingHistoryDrawerProps) {
  const [collapsedIds, setCollapsedIds] = useState<Record<string, boolean>>({});

  if (!booking) return null;

  const toggleCollapse = (id: string) => {
    setCollapsedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-end animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="neu-bg h-screen max-w-lg w-full p-6 shadow-2xl flex flex-col justify-between border-l border-gray-200 dark:border-gray-800 text-xs font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-5 flex-1 overflow-y-auto pr-1">
          <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 pb-3">
            <div>
              <h3 className="font-black text-gray-900 dark:text-gray-100 text-base">
                Booking History &amp; Approvals
              </h3>
              <p className="text-gray-600 dark:text-gray-300 text-xs mt-0.5">
                Code: #{booking.guest_id || 'Manual Entry'} • {booking.customer_name}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="neu-btn px-2.5 h-8 flex items-center justify-center font-bold text-gray-600 dark:text-gray-300"
            >
              Close
            </button>
          </div>

          <div className="neu-inset p-4 font-mono space-y-2">
            <p className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase">
              Current Approved Payment Summary
            </p>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-300">Total Price:</span>
              <span className="text-gray-900 dark:text-gray-100 font-bold">
                {formatCurrency(booking.total_price)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-300">Approved Paid So Far:</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                {formatCurrency(booking.amount_paid)}
              </span>
            </div>
            <div className="flex justify-between border-t border-gray-200 dark:border-gray-800 pt-2">
              <span className="text-gray-900 dark:text-gray-100 font-bold">Remaining Balance:</span>
              <span className="text-amber-600 dark:text-amber-400 font-black">
                {formatCurrency(booking.remaining_balance)}
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
              Follow-Up Payments &amp; Edited Details
            </h4>

            {loading ? (
              <p className="text-gray-600 dark:text-gray-300 animate-pulse py-4">
                Loading history...
              </p>
            ) : logs.length === 0 ? (
              <div className="neu-inset p-6 text-center text-gray-600 dark:text-gray-300">
                No follow-up payments or booking change requests for this reservation yet.
              </div>
            ) : (
              <div className="space-y-3">
                {logs.map((log) => {
                  const isPendingProposal =
                    log.status === 'pending_approval' && log.isProposalTicket;
                  const isExpanded = !collapsedIds[log.id];
                  const before = log.proposed_before || booking;
                  const after = log.proposed_details || null;

                  return (
                    <div
                      key={log.id}
                      className="neu-card-sm p-4 space-y-2.5 text-gray-700 dark:text-gray-200"
                    >
                      <div className="flex justify-between items-center text-xs font-bold">
                        <span
                          className={
                            log.type === 'payment_installment'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : log.type === 'cancellation_request'
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-purple-600 dark:text-purple-400'
                          }
                        >
                          {log.type === 'payment_installment'
                            ? 'Follow-Up / Balance Payment'
                            : log.type === 'cancellation_request'
                            ? 'Cancellation Request'
                            : log.type === 'ADMIN_RECORD_UPDATE'
                            ? 'Admin Update'
                            : 'Edited Booking Details'}
                        </span>
                        <span className="text-gray-500 dark:text-gray-400 font-mono">
                          {log.created_at
                            ? new Date(log.created_at).toLocaleString([], {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : ''}
                        </span>
                      </div>

                      {log.type === 'data_edit' || log.type === 'cancellation_request' ? (
                        <div className="space-y-2.5">
                          <button
                            type="button"
                            onClick={() => toggleCollapse(log.id)}
                            className="w-full flex items-center justify-between text-gray-900 dark:text-gray-100 font-bold neu-inset px-3 py-2 text-xs cursor-pointer"
                          >
                            <span className="text-left">{log.summary}</span>
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 shrink-0" />
                            ) : (
                              <ChevronDown className="w-4 h-4 shrink-0" />
                            )}
                          </button>

                          {isExpanded && after && (
                            <div className="p-3 neu-inset text-xs text-gray-700 dark:text-gray-200 space-y-2 animate-fadeIn">
                              <p className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase">
                                Edited Details (Current → Requested):
                              </p>
                              <div className="divide-y divide-gray-200 dark:divide-gray-800 space-y-1.5">
                                {after.customer_name &&
                                  before.customer_name !== after.customer_name && (
                                    <div className="pt-1.5">
                                      <span className="text-xs text-gray-500 font-bold block">
                                        Guest Name
                                      </span>
                                      <span className="line-through text-gray-400 mr-2">
                                        {before.customer_name}
                                      </span>
                                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                        → {after.customer_name}
                                      </span>
                                    </div>
                                  )}
                                {after.customer_phone &&
                                  before.customer_phone !== after.customer_phone && (
                                    <div className="pt-1.5">
                                      <span className="text-xs text-gray-500 font-bold block">
                                        Mobile Phone
                                      </span>
                                      <span className="line-through text-gray-400 mr-2">
                                        {before.customer_phone}
                                      </span>
                                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                        → {after.customer_phone}
                                      </span>
                                    </div>
                                  )}
                                {after.email !== undefined &&
                                  (before.email || '') !== (after.email || '') && (
                                    <div className="pt-1.5">
                                      <span className="text-xs text-gray-500 font-bold block">
                                        Email Address
                                      </span>
                                      <span className="line-through text-gray-400 mr-2">
                                        {before.email || 'None'}
                                      </span>
                                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                        → {after.email || 'None'}
                                      </span>
                                    </div>
                                  )}
                                {after.event_date && before.event_date !== after.event_date && (
                                  <div className="pt-1.5">
                                    <span className="text-xs text-gray-500 font-bold block">
                                      Reservation Date
                                    </span>
                                    <span className="line-through text-gray-400 mr-2">
                                      {before.event_date}
                                    </span>
                                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                      → {after.event_date}
                                    </span>
                                  </div>
                                )}
                                {after.slot_assignment &&
                                  before.slot_assignment !== after.slot_assignment && (
                                    <div className="pt-1.5">
                                      <span className="text-xs text-gray-500 font-bold block">
                                        Time Slot
                                      </span>
                                      <span className="line-through text-gray-400 mr-2">
                                        {before.slot_assignment}
                                      </span>
                                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                        → {after.slot_assignment}
                                      </span>
                                    </div>
                                  )}
                                {after.pax_count !== undefined &&
                                  Number(before.pax_count) !== Number(after.pax_count) && (
                                    <div className="pt-1.5">
                                      <span className="text-xs text-gray-500 font-bold block">
                                        Guests (Pax)
                                      </span>
                                      <span className="line-through text-gray-400 mr-2">
                                        {before.pax_count}
                                      </span>
                                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                        → {after.pax_count}
                                      </span>
                                    </div>
                                  )}
                                {after.package_option &&
                                  before.package_option !== after.package_option && (
                                    <div className="pt-1.5">
                                      <span className="text-xs text-gray-500 font-bold block">
                                        Package
                                      </span>
                                      <span className="line-through text-gray-400 mr-2">
                                        {formatPackageLabel(before.package_option)}
                                      </span>
                                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                        → {formatPackageLabel(after.package_option)}
                                      </span>
                                    </div>
                                  )}
                                {after.total_price !== undefined &&
                                  Number(before.total_price) !== Number(after.total_price) && (
                                    <div className="pt-1.5">
                                      <span className="text-xs text-gray-500 font-bold block">
                                        Recalculated Total Price
                                      </span>
                                      <span className="line-through text-gray-400 mr-2">
                                        {formatCurrency(before.total_price)}
                                      </span>
                                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                        → {formatCurrency(after.total_price)}
                                      </span>
                                    </div>
                                  )}
                              </div>
                            </div>
                          )}

                          <p className="text-xs">
                            Status:{' '}
                            <span
                              className={`font-bold ${
                                log.status === 'approved'
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : log.status === 'rejected'
                                  ? 'text-rose-600 dark:text-rose-400'
                                  : 'text-amber-600 dark:text-amber-400'
                              }`}
                            >
                              {log.status === 'pending_approval'
                                ? 'PENDING ADMIN APPROVAL'
                                : log.status.replace(/_/g, ' ').toUpperCase()}
                            </span>
                          </p>

                          {isPendingProposal && (
                            <div className="flex gap-2 pt-1">
                              <button
                                type="button"
                                disabled={processingId !== null}
                                onClick={() => onOwnerDecision(log.raw_ticket_id, 'reject')}
                                className="flex-1 neu-btn text-rose-600 py-2 text-xs font-bold flex items-center justify-center gap-1"
                              >
                                <XCircle className="w-3.5 h-3.5" /> Decline Changes
                              </button>
                              <button
                                type="button"
                                disabled={processingId !== null}
                                onClick={() => onOwnerDecision(log.raw_ticket_id, 'approve')}
                                className="flex-1 neu-btn-primary py-2 text-xs font-bold flex items-center justify-center gap-1"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" /> Approve Changes
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2 text-xs">
                          <p className="font-bold text-gray-900 dark:text-gray-100">
                            {log.summary}
                          </p>
                          <div className="neu-inset p-3 text-gray-600 dark:text-gray-300 space-y-1">
                            {Number(log.amount_paid || 0) > 0 && (
                              <p className="flex justify-between">
                                <span>Amount Submitted:</span>
                                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                  {formatCurrency(Number(log.amount_paid))}
                                </span>
                              </p>
                            )}
                            {log.reference_number && (
                              <p className="flex justify-between">
                                <span>Reference #:</span>
                                <span className="font-mono font-bold text-gray-900 dark:text-gray-100">
                                  {log.reference_number}
                                </span>
                              </p>
                            )}
                            {log.account_name && (
                              <p className="flex justify-between">
                                <span>Sender Name:</span>
                                <span className="font-semibold text-gray-900 dark:text-gray-100">
                                  {log.account_name}
                                </span>
                              </p>
                            )}
                            <p className="flex justify-between pt-1 border-t border-gray-200 dark:border-gray-800">
                              <span>Status:</span>
                              <span
                                className={`font-bold ${
                                  log.status === 'approved'
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : log.status === 'rejected'
                                    ? 'text-rose-600 dark:text-rose-400'
                                    : 'text-amber-600 dark:text-amber-400'
                                }`}
                              >
                                {log.status === 'pending_approval'
                                  ? 'PENDING ADMIN APPROVAL'
                                  : log.status.replace(/_/g, ' ').toUpperCase()}
                              </span>
                            </p>
                          </div>

                          {log.receipt_file_path && (
                            <button
                              type="button"
                              onClick={() =>
                                onOpenImage(log.receipt_file_path!, 'Follow-Up Payment Receipt')
                              }
                              className="text-emerald-600 dark:text-emerald-400 hover:underline font-bold inline-flex items-center gap-1 pt-0.5 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" /> View Receipt Screenshot
                            </button>
                          )}

                          {log.status === 'pending_approval' &&
                            log.type === 'payment_installment' && (
                              <div className="flex gap-2 pt-1">
                                <button
                                  type="button"
                                  disabled={processingId !== null}
                                  onClick={() =>
                                    onVerifyPayment(
                                      log.id,
                                      'rejected',
                                      Number(log.amount_paid || 0),
                                      log.reference_number
                                    )
                                  }
                                  className="flex-1 neu-btn text-rose-600 py-2 text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-50"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                  {processingId === log.id ? 'Processing...' : 'Decline'}
                                </button>
                                <button
                                  type="button"
                                  disabled={processingId !== null}
                                  onClick={() =>
                                    onVerifyPayment(
                                      log.id,
                                      'approved',
                                      Number(log.amount_paid || 0),
                                      log.reference_number
                                    )
                                  }
                                  className="flex-1 neu-btn-primary py-2 text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-50"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  {processingId === log.id ? 'Approving...' : 'Approve Payment'}
                                </button>
                              </div>
                            )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="neu-btn-primary w-full font-bold py-3 text-xs mt-4"
        >
          Close
        </button>
      </div>
    </div>
  );
}

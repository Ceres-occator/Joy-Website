'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
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
  onVerifyPayment: (logId: string, action: 'approved' | 'rejected', amount: number) => void;
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
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  if (!booking) return null;

  const toggleAccordion = (id: string) => {
    setExpandedLogId((prev) => (prev === id ? null : id));
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-end animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="neu-bg h-screen max-w-lg w-full p-6 shadow-2xl flex flex-col justify-between border-l border-white/60 text-xs font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-5 flex-1 overflow-y-auto pr-1">
          <div className="flex items-center justify-between border-b border-slate-300/60 pb-3">
            <div>
              <h3 className="font-black text-slate-900 text-base">Booking History</h3>
              <p className="text-slate-500 text-xs mt-0.5">
                Code: #{booking.guest_id || 'Manual Entry'} • {booking.customer_name}
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

          <div className="neu-inset p-4 font-mono space-y-2">
            <p className="text-xs font-bold text-slate-500 uppercase">Payment Summary</p>
            <div className="flex justify-between">
              <span className="text-slate-600">Total Price:</span>
              <span className="text-slate-900 font-bold">
                {formatCurrency(booking.total_price)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Paid So Far:</span>
              <span className="text-emerald-700 font-bold">
                {formatCurrency(booking.amount_paid)}
              </span>
            </div>
            <div className="flex justify-between border-t border-slate-300/60 pt-2">
              <span className="text-slate-800 font-bold">Remaining Balance:</span>
              <span className="text-amber-700 font-black">
                {formatCurrency(booking.remaining_balance)}
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Payments &amp; Change Requests
            </h4>

            {loading ? (
              <p className="text-slate-500 animate-pulse py-4">Loading history...</p>
            ) : logs.length === 0 ? (
              <div className="neu-inset p-6 text-center text-slate-500">
                No extra payments or change requests for this booking yet.
              </div>
            ) : (
              <div className="space-y-3">
                {logs.map((log) => {
                  const isExpanded = expandedLogId === log.id;
                  const isPendingProposal =
                    log.status === 'pending_approval' && log.isProposalTicket;

                  return (
                    <div key={log.id} className="neu-card-sm p-4 space-y-2 text-slate-700">
                      <div className="flex justify-between items-center text-xs font-bold">
                        <span
                          className={
                            log.type === 'payment_installment'
                              ? 'text-emerald-700'
                              : log.type === 'cancellation_request'
                                ? 'text-rose-600'
                                : 'text-purple-700'
                          }
                        >
                          {log.type === 'payment_installment'
                            ? 'Balance Payment'
                            : log.type === 'cancellation_request'
                              ? 'Cancellation Request'
                              : 'Change Request'}
                        </span>
                        <span className="text-slate-500 font-mono">
                          {new Date(log.created_at).toLocaleDateString()}
                        </span>
                      </div>

                      {log.type === 'data_edit' || log.type === 'cancellation_request' ? (
                        <div className="space-y-2">
                          <button
                            type="button"
                            onClick={() => toggleAccordion(log.id)}
                            className="w-full flex items-center justify-between text-slate-900 font-bold neu-inset px-3 py-2 text-xs cursor-pointer"
                          >
                            <span className="text-left">{log.summary}</span>
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 shrink-0" />
                            ) : (
                              <ChevronDown className="w-4 h-4 shrink-0" />
                            )}
                          </button>

                          {isExpanded && log.proposed_details && (
                            <div className="p-3 neu-inset text-xs text-slate-700 space-y-2 animate-fadeIn">
                              <p className="text-xs font-bold text-slate-500 uppercase">
                                Requested Changes (Before → After):
                              </p>
                              <div className="divide-y divide-slate-300/60 space-y-1.5">
                                {booking.customer_name !== log.proposed_details.customer_name &&
                                  log.proposed_details.customer_name && (
                                    <div className="pt-1.5">
                                      <span className="text-xs text-slate-500 font-bold block">
                                        Guest Name
                                      </span>
                                      <span className="line-through text-slate-400 mr-2">
                                        {booking.customer_name}
                                      </span>
                                      <span className="font-bold text-emerald-700">
                                        → {log.proposed_details.customer_name}
                                      </span>
                                    </div>
                                  )}
                                {booking.event_date !== log.proposed_details.event_date &&
                                  log.proposed_details.event_date && (
                                    <div className="pt-1.5">
                                      <span className="text-xs text-slate-500 font-bold block">
                                        Date
                                      </span>
                                      <span className="line-through text-slate-400 mr-2">
                                        {booking.event_date}
                                      </span>
                                      <span className="font-bold text-emerald-700">
                                        → {log.proposed_details.event_date}
                                      </span>
                                    </div>
                                  )}
                                {booking.slot_assignment !==
                                  log.proposed_details.slot_assignment &&
                                  log.proposed_details.slot_assignment && (
                                    <div className="pt-1.5">
                                      <span className="text-xs text-slate-500 font-bold block">
                                        Time Slot
                                      </span>
                                      <span className="line-through text-slate-400 mr-2">
                                        {booking.slot_assignment}
                                      </span>
                                      <span className="font-bold text-emerald-700">
                                        → {log.proposed_details.slot_assignment}
                                      </span>
                                    </div>
                                  )}
                                {Number(booking.pax_count) !==
                                  Number(log.proposed_details.pax_count) &&
                                  log.proposed_details.pax_count !== undefined && (
                                    <div className="pt-1.5">
                                      <span className="text-xs text-slate-500 font-bold block">
                                        Guests
                                      </span>
                                      <span className="line-through text-slate-400 mr-2">
                                        {booking.pax_count}
                                      </span>
                                      <span className="font-bold text-emerald-700">
                                        → {log.proposed_details.pax_count}
                                      </span>
                                    </div>
                                  )}
                                {booking.package_option !== log.proposed_details.package_option &&
                                  log.proposed_details.package_option && (
                                    <div className="pt-1.5">
                                      <span className="text-xs text-slate-500 font-bold block">
                                        Package
                                      </span>
                                      <span className="line-through text-slate-400 mr-2">
                                        {formatPackageLabel(booking.package_option)}
                                      </span>
                                      <span className="font-bold text-emerald-700">
                                        → {formatPackageLabel(log.proposed_details.package_option)}
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
                                  ? 'text-emerald-700'
                                  : log.status === 'rejected'
                                    ? 'text-rose-600'
                                    : 'text-purple-700'
                              }`}
                            >
                              {log.status.replace(/_/g, ' ').toUpperCase()}
                            </span>
                          </p>

                          {isPendingProposal && (
                            <div className="flex gap-2 pt-1">
                              <button
                                type="button"
                                disabled={processingId !== null}
                                onClick={() => onOwnerDecision(log.raw_ticket_id, 'reject')}
                                className="flex-1 neu-btn text-rose-600 py-2 text-xs font-bold"
                              >
                                Decline
                              </button>
                              <button
                                type="button"
                                disabled={processingId !== null}
                                onClick={() => onOwnerDecision(log.raw_ticket_id, 'approve')}
                                className="flex-1 neu-btn-primary py-2 text-xs font-bold"
                              >
                                Approve
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-1.5 text-xs">
                          <p className="font-bold text-slate-900">{log.summary}</p>
                          <div className="text-slate-600 space-y-1">
                            <p>
                              Reference:{' '}
                              <span className="font-mono font-bold text-slate-800">
                                {log.reference_number}
                              </span>
                            </p>
                            <p>
                              Sender: <span className="font-semibold">{log.account_name}</span>
                            </p>
                            <p>
                              Status:{' '}
                              <span
                                className={`font-bold ${
                                  log.status === 'approved'
                                    ? 'text-emerald-700'
                                    : log.status === 'rejected'
                                      ? 'text-rose-600'
                                      : 'text-amber-700'
                                }`}
                              >
                                {log.status.replace(/_/g, ' ').toUpperCase()}
                              </span>
                            </p>

                            {log.receipt_file_path && (
                              <button
                                type="button"
                                onClick={() =>
                                  onOpenImage(log.receipt_file_path!, 'Payment Receipt')
                                }
                                className="text-emerald-700 hover:underline font-bold block pt-1 cursor-pointer"
                              >
                                View Receipt
                              </button>
                            )}

                            {log.status === 'pending_approval' && (
                              <div className="flex gap-2 pt-2">
                                <button
                                  type="button"
                                  disabled={processingId !== null}
                                  onClick={() =>
                                    onVerifyPayment(log.id, 'rejected', log.amount_paid)
                                  }
                                  className="flex-1 neu-btn text-rose-600 py-2 text-xs font-bold"
                                >
                                  Decline
                                </button>
                                <button
                                  type="button"
                                  disabled={processingId !== null}
                                  onClick={() =>
                                    onVerifyPayment(log.id, 'approved', log.amount_paid)
                                  }
                                  className="flex-1 neu-btn-primary py-2 text-xs font-bold"
                                >
                                  Approve Payment
                                </button>
                              </div>
                            )}
                          </div>
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


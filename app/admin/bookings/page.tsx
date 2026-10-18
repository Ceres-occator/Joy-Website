'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/utils/supabase/client';
import {
  formatCurrency,
  formatPackageLabel,
  formatStayDates,
  isPastDate,
} from '@/utils/formatters';
import type { BookingRecord, VillaLookup } from '@/types';
import BookingFormModal from '@/components/admin/BookingFormModal';
import BookingHistoryDrawer from '@/components/admin/BookingHistoryDrawer';
import WalkInModal from '@/components/admin/WalkInModal';
import { AdminTableSkeleton } from '@/components/ui/Skeleton';
import { Calendar, Users, Moon, AlertTriangle, RotateCcw, CreditCard } from 'lucide-react';

export default function AdminVerificationDashboard() {
  const [activeTab, setActiveTab] = useState<
    'pending' | 'approved' | 'directory' | 'refunds' | 'approvals'
  >('pending');
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeModalImg, setActiveModalImg] = useState<{ src: string; title: string } | null>(
    null
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [villasList, setVillasList] = useState<VillaLookup[]>([]);
  const [showCrudModal, setShowCrudModal] = useState(false);
  const [showWalkInModal, setShowWalkInModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const [formVillaId, setFormVillaId] = useState('');
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formAccName, setFormAccName] = useState('Manual Admin Entry');
  const [formRefNum, setFormRefNum] = useState('');
  const [formGateway, setFormGateway] = useState('manual');
  const [formChannel, setFormChannel] = useState('gcash');
  const [formCateringStatus, setFormCateringStatus] = useState('not_applicable');
  const [formRefundStatus, setFormRefundStatus] = useState('none');
  const [formRefundAmount, setFormRefundAmount] = useState<number>(0);
  const [formTotal, setFormTotal] = useState<number>(0);
  const [formPaid, setFormPaid] = useState<number>(0);
  const [formDate, setFormDate] = useState('');
  const [formSlot, setFormSlot] = useState('day');
  const [formPax, setFormPax] = useState<number>(10);
  const [formPkg, setFormPkg] = useState('with_catering');
  const [formStatus, setFormStatus] = useState('confirmed');
  const [resendingReceipt, setResendingReceipt] = useState(false);

  const [userRole, setUserRole] = useState<string | null>(null);
  const [approvalRequests, setApprovalRequests] = useState<any[]>([]);

  const [selectedAuditBooking, setSelectedAuditBooking] = useState<BookingRecord | null>(null);
  const [historicalLogs, setHistoricalLogs] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const formRemaining = Math.max(0, formTotal - formPaid);

  async function reloadActiveDataset() {
    setLoading(true);
    try {
      if (activeTab === 'directory') {
        const res = await fetch('/api/admin/bookings/directory');
        const data = await res.json();
        if (data.bookings) setBookings(data.bookings);
      } else if (activeTab === 'approvals') {
        const res = await fetch('/api/admin/bookings/approvals');
        const data = await res.json();
        if (data.requests) setApprovalRequests(data.requests);
      } else if (activeTab === 'refunds') {
        const res = await fetch('/api/admin/bookings?status=refunds');
        const data = await res.json();
        if (data.bookings) setBookings(data.bookings);
      } else {
        const targetStatus = activeTab === 'pending' ? 'pending_verification' : 'confirmed';
        const res = await fetch(`/api/admin/bookings?status=${targetStatus}`);
        const data = await res.json();
        if (data.bookings) setBookings(data.bookings);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    async function loadRoleAndVillas() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const role = user?.app_metadata?.role || user?.user_metadata?.role;
      if (role) setUserRole(role);

      const { data } = await supabase.from('villas').select('id, name').order('name');
      if (data) setVillasList(data);
    }
    loadRoleAndVillas();
  }, []);

  useEffect(() => {
    reloadActiveDataset();
  }, [activeTab]);

  const handleOpenHistoryLog = async (booking: BookingRecord) => {
    setSelectedAuditBooking(booking);
    setLoadingHistory(true);
    const supabase = createClient();
    try {
      const [{ data: historyData }, { data: proposalData }, { data: txData }] = await Promise.all([
        supabase
          .from('booking_audit_history')
          .select('*')
          .eq('booking_id', booking.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('booking_changes_approval')
          .select('*')
          .eq('booking_id', booking.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('payment_transactions')
          .select('*')
          .eq('booking_id', booking.id)
          .in('phase', ['follow_up', 'balance_settlement', 'catering_payment'])
          .order('created_at', { ascending: false }),
      ]);

      const normalizedProposals = (proposalData || []).map((p) => {
        const after = p.proposed_changes?.after || p.proposed_changes || {};
        const before = p.proposed_changes?.before || null;
        const isCancel = after.status === 'cancelled_request_pending';
        return {
          id: p.id || p.request_id,
          booking_id: p.booking_id,
          type: isCancel ? 'cancellation_request' : 'data_edit',
          status: p.status === 'pending' ? 'pending_approval' : p.status,
          summary: isCancel
            ? 'Requested booking cancellation'
            : 'Requested booking details change (Pending Admin Approval)',
          isProposalTicket: true,
          raw_ticket_id: p.request_id || p.id,
          proposed_before: before,
          proposed_details: after,
          created_at: p.created_at,
        };
      });

      const normalizedHistory = (historyData || [])
        .filter((h) => {
          const matchingProposalExists = normalizedProposals.some(
            (p) => p.type === h.type && p.status === 'pending_approval'
          );
          return !matchingProposalExists;
        })
        .map((h) => {
          const normType =
            h.type === 'payment_upload' || h.type === 'payment_installment'
              ? 'payment_installment'
              : h.type;
          const normStatus =
            h.status === 'pending' || h.status === 'pending_verification'
              ? 'pending_approval'
              : h.status;
          return {
            ...h,
            type: normType,
            status: normStatus,
            isProposalTicket: false,
          };
        });

      const historyRefSet = new Set(
        normalizedHistory
          .filter((h) => h.reference_number)
          .map((h) => String(h.reference_number))
      );

      const fallbackFollowUpTxs = (txData || [])
        .filter((tx) => !tx.reference_number || !historyRefSet.has(String(tx.reference_number)))
        .map((tx) => ({
          id: `tx_${tx.id}`,
          raw_tx_id: tx.id,
          booking_id: tx.booking_id,
          type: 'payment_installment',
          status:
            tx.status === 'pending' || tx.status === 'pending_verification'
              ? 'pending_approval'
              : tx.status === 'paid' || tx.status === 'verified'
              ? 'approved'
              : tx.status,
          amount_paid: Number(tx.amount || 0),
          account_name: tx.account_name,
          reference_number: tx.reference_number,
          receipt_file_path: tx.receipt_file_path,
          summary:
            tx.notes ||
            `Follow-up payment of ₱${Number(tx.amount || 0).toLocaleString()} via ${(
              tx.payment_channel || 'manual'
            ).toUpperCase()}`,
          isProposalTicket: false,
          created_at: tx.created_at,
        }));

      const unifiedTimeline = [
        ...normalizedProposals,
        ...normalizedHistory,
        ...fallbackFollowUpTxs,
      ].sort(
        (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      );

      setHistoricalLogs(unifiedTimeline);
    } catch (err) {
      console.error('Failed to load booking history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleVerifyInstallmentPayment = async (
    logId: string,
    action: 'approved' | 'rejected',
    amount: number,
    referenceNumber?: string
  ) => {
    if (!selectedAuditBooking) return;
    setProcessingId(logId);
    const supabase = createClient();

    try {
      if (action === 'approved') {
        const updatedPaid = Number(selectedAuditBooking.amount_paid || 0) + Number(amount || 0);
        const updatedRemaining = Math.max(
          0,
          Number(selectedAuditBooking.total_price || 0) - updatedPaid
        );
        const cateringReq = Number(selectedAuditBooking.catering_required_amount || 10000);
        const nextCateringStatus =
          selectedAuditBooking.package_option === 'with_catering' && updatedPaid >= cateringReq
            ? 'confirmed'
            : selectedAuditBooking.catering_status;

        const { error: mainErr } = await supabase
          .from('bookings')
          .update({
            amount_paid: updatedPaid,
            remaining_balance: updatedRemaining,
            payment_mode: updatedRemaining <= 0 ? 'full' : 'half',
            ...(nextCateringStatus ? { catering_status: nextCateringStatus } : {}),
            updated_at: new Date().toISOString(),
          })
          .eq('id', selectedAuditBooking.id);

        if (mainErr) throw mainErr;
      }

      if (logId.startsWith('tx_')) {
        const rawTxId = logId.replace(/^tx_/, '');
        await supabase
          .from('payment_transactions')
          .update({
            status: action === 'approved' ? 'paid' : 'rejected',
            updated_at: new Date().toISOString(),
          })
          .eq('id', rawTxId);
      } else {
        await supabase
          .from('booking_audit_history')
          .update({ status: action })
          .eq('id', logId);

        if (referenceNumber) {
          await supabase
            .from('payment_transactions')
            .update({
              status: action === 'approved' ? 'paid' : 'rejected',
              updated_at: new Date().toISOString(),
            })
            .eq('booking_id', selectedAuditBooking.id)
            .eq('reference_number', referenceNumber);
        }
      }

      alert(
        `Follow-up payment ${
          action === 'approved'
            ? 'approved and applied to booking balance'
            : 'declined'
        }!`
      );
      setSelectedAuditBooking(null);
      reloadActiveDataset();
    } catch (err) {
      console.error(err);
      alert('Could not update payment status.');
    } finally {
      setProcessingId(null);
    }
  };

  const processedDirectoryList = useMemo(() => {
    if (!searchQuery.trim()) return bookings;
    const cleanQuery = searchQuery.toLowerCase().trim();
    return bookings.filter(
      (b) =>
        b.customer_name?.toLowerCase().includes(cleanQuery) ||
        b.reference_number?.toLowerCase().includes(cleanQuery) ||
        b.customer_phone?.includes(cleanQuery) ||
        b.customer_email?.toLowerCase().includes(cleanQuery) ||
        b.guest_id?.toLowerCase().includes(cleanQuery)
    );
  }, [bookings, searchQuery]);

  const handleAction = async (
    bookingId: string,
    action: 'approve' | 'reject' | 'complete'
  ) => {
    setProcessingId(bookingId);
    try {
      const res = await fetch('/api/admin/bookings/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId, action }),
      });
      if (res.ok) setBookings((prev) => prev.filter((b) => b.id !== bookingId));
    } catch (err) {
      console.error(err);
    } finally {
      setProcessingId(null);
    }
  };

  const handleRefundAction = async (
    booking: BookingRecord,
    action: 'approve_refund' | 'process_refund' | 'reject_refund' | 'force_forfeit'
  ) => {
    let refundAmount = Number(booking.refund_amount || booking.amount_paid || 0);
    let refundNotes = booking.refund_notes || '';

    if (action === 'process_refund' || action === 'approve_refund') {
      const inputAmt = prompt(
        `Enter refund amount in PHP (Paid: ₱${booking.amount_paid}):`,
        String(refundAmount || booking.amount_paid)
      );
      if (inputAmt === null) return;
      refundAmount = Number(inputAmt) || 0;
    } else if (action === 'reject_refund' || action === 'force_forfeit') {
      const note = prompt('Enter reason or note for forfeiture / declining refund:', refundNotes);
      if (note === null) return;
      refundNotes = note;
    }

    setProcessingId(booking.id);
    try {
      const res = await fetch('/api/admin/bookings/refunds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: booking.id,
          action,
          refundAmount,
          refundNotes,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message || 'Refund record updated.');
        reloadActiveDataset();
      } else {
        alert(data.error || 'Could not update refund status.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setProcessingId(null);
    }
  };

  const handleOwnerDecision = async (requestId: string, action: 'approve' | 'reject') => {
    let reason = '';
    if (action === 'reject') {
      reason = prompt('Please enter a brief reason for declining this request:') || '';
      if (!reason.trim()) return;
    }

    setProcessingId(requestId);
    try {
      const res = await fetch('/api/admin/bookings/approve-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, action, reason }),
      });
      const result = await res.json();
      if (res.ok) {
        setApprovalRequests((prev) =>
          prev.filter((r) => (r.request_id || r.id) !== requestId)
        );
        if (result.isForfeited) {
          alert(`Cancellation approved. Note: ${result.forfeitureReason}`);
        } else {
          alert(`Request ${action === 'approve' ? 'approved' : 'declined'}.`);
        }
        setSelectedAuditBooking(null);
        reloadActiveDataset();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setProcessingId(null);
    }
  };

  const handlePurgeRecord = async (id: string) => {
    if (!confirm('Are you sure you want to permanently delete this booking?')) return;
    try {
      const res = await fetch(`/api/admin/bookings/directory?bookingId=${id}`, {
        method: 'DELETE',
      });
      if (res.ok) setBookings((prev) => prev.filter((b) => b.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const handleResendReceipt = async () => {
    if (!editId) return;
    setResendingReceipt(true);
    try {
      const res = await fetch('/api/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: editId,
          eventLabel: 'Updated Booking Receipt',
        }),
      });
      if (res.ok) {
        alert('SMS & Email receipt dispatched to guest!');
      } else {
        alert('Could not send notification. Check your Textbee/Resend configuration.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setResendingReceipt(false);
    }
  };

  const handleCrudSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessingId('saving');
    const payload = {
      bookingId: editId,
      customerName: formName,
      customerPhone: formPhone,
      customerEmail: formEmail,
      accountName: formAccName,
      referenceNumber: formRefNum || `MGMT-${Date.now().toString().slice(-5)}`,
      paymentGateway: formGateway,
      paymentChannel: formChannel,
      cateringStatus: formCateringStatus,
      refundStatus: formRefundStatus,
      refundAmount: formRefundAmount,
      totalPrice: formTotal,
      amountPaid: formPaid,
      remainingBalance: formRemaining,
      eventDate: formDate,
      slotAssignment: formSlot,
      paxCount: formPax,
      packageOption: formPkg,
      status: formStatus,
    };

    try {
      if (editId) {
        const res = await fetch('/api/admin/bookings/directory', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const result = await res.json();
        if (res.ok) {
          setShowCrudModal(false);
          if (result.requiresApproval) {
            alert('Changes submitted! They will take effect once approved by the owner.');
          } else {
            alert('Booking & payment details updated!');
          }
          reloadActiveDataset();
        }
      } else {
        const res = await fetch('/api/admin/dashboard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            villaId: formVillaId || villasList[0]?.id,
            customerName: formName,
            customerPhone: formPhone,
            eventDate: formDate,
            timeSlot: formSlot,
            packageOption: formPkg,
            paxCount: formPax,
            totalPrice: formTotal,
            paymentMode: formTotal === formPaid ? 'full' : 'half',
            amountPaid: formPaid,
            remainingBalance: formRemaining,
          }),
        });
        if (res.ok) {
          setShowCrudModal(false);
          reloadActiveDataset();
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setProcessingId(null);
    }
  };

  const openEditContextModal = (b: BookingRecord) => {
    setEditId(b.id);
    setFormVillaId(b.villas?.id || b.villa_id || '');
    setFormName(b.customer_name);
    setFormPhone(b.customer_phone);
    setFormEmail(b.customer_email || '');
    setFormAccName(b.account_name || '');
    setFormRefNum(b.reference_number || '');
    setFormGateway(b.payment_gateway || 'manual');
    setFormChannel(b.payment_channel || 'gcash');
    setFormCateringStatus(
      b.catering_status ||
        (b.package_option === 'with_catering' ? 'pending_payment' : 'not_applicable')
    );
    setFormRefundStatus(b.refund_status || 'none');
    setFormRefundAmount(Number(b.refund_amount || 0));
    setFormTotal(b.total_price);
    setFormPaid(b.amount_paid);
    setFormDate(b.event_date);
    setFormSlot(b.slot_assignment);
    setFormPax(b.pax_count);
    setFormPkg(b.package_option);
    setFormStatus(b.status);
    setShowCrudModal(true);
  };

  const openImageModal = (filePath: string, title: string) => {
    const cleanPath = filePath.trim();
    if (cleanPath.startsWith('http://') || cleanPath.startsWith('https://')) {
      setActiveModalImg({ src: cleanPath, title });
      return;
    }

    const supabase = createClient();
    const normalizedPath = cleanPath.startsWith('/') ? cleanPath.substring(1) : cleanPath;
    const { data } = supabase.storage
      .from('booking-attachments')
      .getPublicUrl(normalizedPath);
    if (data?.publicUrl) setActiveModalImg({ src: data.publicUrl, title });
  };

  const displayedBookings = activeTab === 'directory' ? processedDirectoryList : bookings;

  return (
    <div className="p-2 sm:p-4 w-full max-w-[1500px] mx-auto space-y-6 animate-fadeIn relative font-sans">
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-emerald-600 font-bold">
            Bookings &amp; Refunds
          </p>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900">Manage Bookings</h1>
          <p className="text-xs sm:text-sm text-slate-600">
            Verify manual payments (GCash &amp; Visa), manage catering deadlines, approve booking
            edits, and process refunds.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 p-1.5 neu-inset w-fit text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('pending')}
            className={`px-3.5 py-2 font-bold rounded-xl transition-all cursor-pointer ${
              activeTab === 'pending' ? 'neu-btn-primary' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Pending Review
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('approved')}
            className={`px-3.5 py-2 font-bold rounded-xl transition-all cursor-pointer ${
              activeTab === 'approved' ? 'neu-btn-primary' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Confirmed Stays
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('directory')}
            className={`px-3.5 py-2 font-bold rounded-xl transition-all cursor-pointer ${
              activeTab === 'directory' ? 'neu-btn-primary' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Bookings
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('refunds')}
            className={`px-3.5 py-2 font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'refunds'
                ? 'neu-btn-primary'
                : 'text-amber-700 hover:text-amber-900'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" /> Refunds &amp; Forfeitures
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('approvals')}
            className={`px-3.5 py-2 font-bold rounded-xl transition-all cursor-pointer ${
              activeTab === 'approvals'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-purple-700 hover:text-purple-900'
            }`}
          >
            Change Requests
          </button>
        </div>
      </div>

      {activeTab === 'directory' && (
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 neu-card-sm p-4 animate-fadeIn">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by guest name, phone, email, reference, or Booking Code..."
            className="neu-input w-full md:max-w-xl text-xs px-4 py-2.5 font-medium"
          />
          <button
            type="button"
            onClick={() => setShowWalkInModal(true)}
            className="w-full md:w-auto text-xs font-bold neu-btn-primary px-5 py-2.5 uppercase tracking-wide"
          >
            Add Walk-In Booking
          </button>
        </div>
      )}

      {activeTab === 'refunds' && (
        <div className="neu-card-sm p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-l-4 border-amber-500">
          <div className="text-xs space-y-0.5">
            <p className="font-black text-slate-900 flex items-center gap-1.5">
              <RotateCcw className="w-4 h-4 text-amber-600" />
              Refunds &amp; Dynamic Forfeiture Management
            </p>
            <p className="text-slate-600">
              Cancellations made within the admin-configured forfeiture window automatically forfeit
              their deposit (no refund allowed). Eligible cancellations can be approved and marked
              refunded here.
            </p>
          </div>
        </div>
      )}

      {activeTab === 'approvals' ? (
        <div className="space-y-4 neu-card p-6 animate-fadeIn">
          <div>
            <h3 className="text-base font-bold text-slate-900">Pending Change Requests</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Review booking edits and cancellation requests submitted by guests or staff.
            </p>
          </div>

          {loading ? (
            <AdminTableSkeleton rows={3} />
          ) : approvalRequests.length === 0 ? (
            <div className="neu-inset p-10 text-center text-xs text-slate-500">
              No pending change requests right now.
            </div>
          ) : (
            <div className="grid gap-5">
              {approvalRequests.map((req) => {
                const isCancellationTicket =
                  req.proposed_changes?.after?.status === 'cancelled_request_pending';
                const requesterGuestId = req.bookings?.guest_id || 'GUEST';

                return (
                  <div
                    key={req.request_id || req.id}
                    className="neu-card-sm p-5 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-5 animate-fadeIn"
                  >
                    <div className="flex-1 w-full space-y-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs font-bold uppercase px-2.5 py-0.5 rounded-lg ${
                            isCancellationTicket
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-purple-100 text-purple-800'
                          }`}
                        >
                          {isCancellationTicket ? 'Cancellation Request' : 'Booking Edit'}
                        </span>
                        <span className="text-xs font-mono font-bold text-slate-600 neu-inset-sm px-2.5 py-0.5">
                          Code: #{requesterGuestId}
                        </span>
                      </div>

                      {!isCancellationTicket && req.proposed_changes?.after && (
                        <div className="neu-inset p-3.5 font-mono text-xs text-slate-700 space-y-1 mt-2">
                          <p className="text-xs font-bold text-slate-500 uppercase">
                            Requested Details:
                          </p>
                          <p>
                            Guest:{' '}
                            <strong className="text-slate-900">
                              {req.proposed_changes.after.customer_name}
                            </strong>
                          </p>
                          <p>
                            Date:{' '}
                            <strong className="text-slate-900">
                              {req.proposed_changes.after.event_date}
                            </strong>
                          </p>
                          <p>
                            Time Slot:{' '}
                            <strong className="text-slate-900">
                              {req.proposed_changes.after.slot_assignment}
                            </strong>
                          </p>
                          <p>
                            Guests:{' '}
                            <strong className="text-slate-900">
                              {req.proposed_changes.after.pax_count}
                            </strong>
                          </p>
                        </div>
                      )}

                      {isCancellationTicket && (
                        <p className="text-rose-700 font-medium text-xs pt-1">
                          Approving this request will evaluate the dynamic forfeiture window, cancel
                          the booking, and open up the dates on the calendar.
                        </p>
                      )}
                    </div>

                    <div className="flex xl:flex-col gap-2.5 w-full xl:w-auto font-bold text-xs shrink-0">
                      <button
                        type="button"
                        disabled={processingId !== null}
                        onClick={() => handleOwnerDecision(req.request_id || req.id, 'reject')}
                        className="flex-1 xl:w-28 text-center px-4 py-2.5 neu-btn text-rose-600"
                      >
                        Decline
                      </button>
                      <button
                        type="button"
                        disabled={processingId !== null}
                        onClick={() => handleOwnerDecision(req.request_id || req.id, 'approve')}
                        className="flex-1 xl:w-28 text-center px-4 py-2.5 neu-btn-primary"
                      >
                        Approve
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : loading ? (
        <AdminTableSkeleton rows={6} />
      ) : (
        <div className="neu-card p-2 overflow-hidden animate-fadeIn">
          <div className="max-h-[72vh] overflow-y-auto overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700 min-w-[1200px] border-collapse">
              <thead className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-300/60">
                <tr>
                  <th className="p-4 w-[230px]">Guest</th>
                  <th className="p-4 w-[340px]">Stay &amp; Catering Rules</th>
                  <th className="p-4">Gateway &amp; Reference</th>
                  <th className="p-4">Uploaded Files</th>
                  <th className="p-4 text-center">
                    {activeTab === 'refunds' ? 'Paid / Refund Status' : 'Balance'}
                  </th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-300/50 text-xs font-semibold">
                {displayedBookings.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-16 text-center text-slate-500">
                      No bookings found in this view.
                    </td>
                  </tr>
                ) : (
                  displayedBookings.map((booking) => {
                    const past = isPastDate(booking.event_date);
                    const matchedVilla = villasList.find((v) => v.id === booking.villa_id);
                    const villaName =
                      booking.villas?.name || matchedVilla?.name || 'Villa';
                    const gateway = booking.payment_gateway || 'manual';

                    return (
                      <tr key={booking.id} className="hover:bg-white/30 transition-colors">
                        <td className="p-4">
                          <div className="font-bold text-slate-900 text-base">
                            {booking.customer_name}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-1 font-mono text-xs text-slate-600">
                            <span className="neu-inset-sm px-2 py-0.5 text-slate-800">
                              #{booking.guest_id || 'GUEST'}
                            </span>
                            <span>•</span>
                            <span>{booking.customer_phone}</span>
                          </div>
                          {booking.customer_email && (
                            <p className="text-xs text-slate-500 mt-1 truncate max-w-[210px]">
                              {booking.customer_email}
                            </p>
                          )}
                        </td>

                        <td className="p-4">
                          <div className="neu-inset p-3.5 space-y-2 text-slate-700">
                            <div className="flex items-center justify-between border-b border-slate-300/60 pb-1.5">
                              <span className="font-bold text-slate-900 text-sm">{villaName}</span>
                              <span className="text-xs uppercase font-bold px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-800">
                                {formatPackageLabel(booking.package_option)}
                              </span>
                            </div>

                            <div className="space-y-1 text-xs font-medium">
                              <div className="flex items-center gap-1.5 text-slate-800">
                                <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                <span>
                                  {booking.package_option === 'accommodation_only' ? (
                                    <span className="font-bold text-slate-900">
                                      {formatStayDates(
                                        booking.event_date,
                                        booking.end_date,
                                        booking.package_option
                                      )}
                                    </span>
                                  ) : (
                                    <>
                                      Date: <strong>{booking.event_date}</strong> (
                                      {booking.slot_assignment})
                                    </>
                                  )}
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5 text-slate-800">
                                <Users className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                <span>
                                  Guests: <strong>{booking.pax_count}</strong>
                                </span>
                              </div>

                              {(booking.include_overnight === true ||
                                String(booking.include_overnight) === 'true') && (
                                <div className="flex items-center gap-1.5 text-indigo-900 bg-indigo-100/80 p-1.5 rounded-lg text-xs font-bold mt-1">
                                  <Moon className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                  <span>
                                    Includes Overnight Stay (
                                    {booking.overnight_pax_count || booking.pax_count} guests)
                                  </span>
                                </div>
                              )}

                              {booking.package_option === 'with_catering' && (
                                <div
                                  className={`flex items-center justify-between gap-2 p-1.5 rounded-lg text-xs font-bold mt-1.5 ${
                                    booking.catering_status === 'paid'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : booking.catering_status === 'flagged' ||
                                          booking.catering_status === 'cancelled'
                                        ? 'bg-rose-100 text-rose-800'
                                        : 'bg-amber-100 text-amber-800'
                                  }`}
                                >
                                  <span className="flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3 shrink-0" />
                                    Catering:{' '}
                                    {(booking.catering_status || 'pending_payment')
                                      .replace(/_/g, ' ')
                                      .toUpperCase()}
                                  </span>
                                  {booking.catering_deadline_date && (
                                    <span>Due: {booking.catering_deadline_date}</span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="p-4 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={`text-xs font-black uppercase px-2 py-0.5 rounded-md inline-flex items-center gap-1 ${
                                gateway === 'cash'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              <CreditCard className="w-3 h-3" />
                              {gateway === 'cash' ? 'Walk-In Cash' : 'Manual'}
                            </span>
                            {booking.payment_channel && (
                              <span className="text-xs uppercase font-bold neu-inset-sm px-2 py-0.5 text-slate-600">
                                {booking.payment_channel}
                              </span>
                            )}
                          </div>
                          <div className="font-mono font-bold text-emerald-700 neu-inset-sm px-2.5 py-1 w-fit">
                            #{booking.reference_number}
                          </div>
                          <div className="text-xs text-slate-500">
                            Sender:{' '}
                            <span className="font-semibold text-slate-700">
                              {booking.account_name || 'N/A'}
                            </span>
                          </div>
                        </td>

                        <td className="p-4 space-y-1.5 whitespace-nowrap font-bold">
                          {booking.receipt_file_path &&
                          !booking.receipt_file_path.includes('null') ? (
                            <button
                              type="button"
                              onClick={() =>
                                openImageModal(
                                  booking.receipt_file_path!,
                                  `${booking.customer_name} - Receipt`
                                )
                              }
                              className="block text-emerald-700 hover:underline text-left cursor-pointer"
                            >
                              View Receipt
                            </button>
                          ) : (
                            <span className="block text-slate-400 font-normal italic">
                              No receipt
                            </span>
                          )}
                          {booking.id_file_path && !booking.id_file_path.includes('null') ? (
                            <button
                              type="button"
                              onClick={() =>
                                openImageModal(
                                  booking.id_file_path!,
                                  `${booking.customer_name} - Valid ID`
                                )
                              }
                              className="block text-slate-700 hover:underline text-left cursor-pointer"
                            >
                              View ID
                            </button>
                          ) : (
                            <span className="block text-slate-400 font-normal italic">No ID</span>
                          )}
                        </td>

                        <td className="p-4">
                          {activeTab === 'refunds' ? (
                            <div className="neu-inset p-3 space-y-1.5 text-center max-w-xs mx-auto">
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-slate-500">Paid:</span>
                                <span className="font-mono font-bold text-emerald-700">
                                  {formatCurrency(booking.amount_paid)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-slate-500">Refund:</span>
                                <span className="font-mono font-bold text-slate-900">
                                  {formatCurrency(booking.refund_amount || 0)}
                                </span>
                              </div>
                              <span
                                className={`block text-xs font-black uppercase px-2 py-1 rounded-lg ${
                                  booking.is_forfeited || booking.refund_status === 'forfeited'
                                    ? 'bg-rose-100 text-rose-800'
                                    : booking.refund_status === 'refunded'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {booking.is_forfeited || booking.refund_status === 'forfeited'
                                  ? 'Forfeited (No Refund)'
                                  : `Refund: ${(booking.refund_status || 'requested').toUpperCase()}`}
                              </span>
                              {booking.forfeiture_reason && (
                                <p className="text-xs text-slate-500 leading-tight text-left pt-1">
                                  {booking.forfeiture_reason}
                                </p>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-4 text-center font-mono text-xs max-w-xs mx-auto neu-inset p-3">
                              <div>
                                <p className="text-xs uppercase font-bold text-emerald-700">
                                  Paid
                                </p>
                                <p className="font-black text-emerald-600 text-sm">
                                  {formatCurrency(booking.amount_paid)}
                                </p>
                              </div>
                              <div className="border-l h-6 border-slate-300" />
                              <div>
                                <p className="text-xs uppercase font-bold text-amber-700">
                                  Balance
                                </p>
                                <p className="font-black text-amber-600 text-sm">
                                  {formatCurrency(booking.remaining_balance)}
                                </p>
                              </div>
                            </div>
                          )}
                        </td>

                        <td className="p-4 text-right whitespace-nowrap space-y-2">
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            {activeTab === 'refunds' ? (
                              <>
                                {!booking.is_forfeited &&
                                  booking.refund_status !== 'forfeited' &&
                                  booking.refund_status !== 'refunded' && (
                                    <button
                                      type="button"
                                      disabled={processingId !== null}
                                      onClick={() =>
                                        handleRefundAction(booking, 'process_refund')
                                      }
                                      className="neu-btn-primary px-3 py-1.5 font-bold text-xs"
                                    >
                                      Mark Refunded
                                    </button>
                                  )}
                                {booking.refund_status !== 'forfeited' &&
                                  booking.refund_status !== 'refunded' && (
                                    <button
                                      type="button"
                                      disabled={processingId !== null}
                                      onClick={() =>
                                        handleRefundAction(booking, 'force_forfeit')
                                      }
                                      className="neu-btn px-3 py-1.5 font-bold text-rose-600 text-xs"
                                    >
                                      Forfeit Deposit
                                    </button>
                                  )}
                                <button
                                  type="button"
                                  onClick={() => openEditContextModal(booking)}
                                  className="neu-btn px-3 py-1.5 font-bold text-slate-700 text-xs"
                                >
                                  Edit
                                </button>
                              </>
                            ) : activeTab === 'directory' ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => openEditContextModal(booking)}
                                  className="neu-btn px-3.5 py-1.5 font-bold text-slate-700"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handlePurgeRecord(booking.id)}
                                  className="neu-btn px-3.5 py-1.5 font-bold text-rose-600"
                                >
                                  Delete
                                </button>
                              </>
                            ) : activeTab === 'pending' ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => openEditContextModal(booking)}
                                  className="neu-btn px-3 py-1.5 font-bold text-slate-700"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  disabled={processingId !== null}
                                  onClick={() => handleAction(booking.id, 'reject')}
                                  className="neu-btn px-3.5 py-1.5 text-rose-600 font-bold"
                                >
                                  Decline
                                </button>
                                <button
                                  type="button"
                                  disabled={processingId !== null}
                                  onClick={() => handleAction(booking.id, 'approve')}
                                  className="neu-btn-primary px-4 py-1.5 font-bold"
                                >
                                  Approve
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => openEditContextModal(booking)}
                                  className="neu-btn px-3 py-1.5 font-bold text-slate-700"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  disabled={processingId !== null}
                                  onClick={() => handleAction(booking.id, 'complete')}
                                  className={`px-4 py-1.5 font-bold ${
                                    past ? 'neu-btn-primary' : 'neu-btn text-slate-700'
                                  }`}
                                >
                                  {processingId === booking.id ? 'Saving...' : 'Mark Completed'}
                                </button>
                              </>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleOpenHistoryLog(booking)}
                            className="text-xs font-bold text-slate-500 hover:text-emerald-600 block ml-auto underline cursor-pointer"
                          >
                            View History
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <BookingHistoryDrawer
        booking={selectedAuditBooking}
        logs={historicalLogs}
        loading={loadingHistory}
        processingId={processingId}
        onClose={() => setSelectedAuditBooking(null)}
        onOpenImage={openImageModal}
        onOwnerDecision={handleOwnerDecision}
        onVerifyPayment={handleVerifyInstallmentPayment}
      />

      <BookingFormModal
        isOpen={showCrudModal}
        editId={editId}
        villasList={villasList}
        formVillaId={formVillaId}
        setFormVillaId={setFormVillaId}
        formName={formName}
        setFormName={setFormName}
        formPhone={formPhone}
        setFormPhone={setFormPhone}
        formEmail={formEmail}
        setFormEmail={setFormEmail}
        formAccName={formAccName}
        setFormAccName={setFormAccName}
        formRefNum={formRefNum}
        setFormRefNum={setFormRefNum}
        formGateway={formGateway}
        setFormGateway={setFormGateway}
        formChannel={formChannel}
        setFormChannel={setFormChannel}
        formCateringStatus={formCateringStatus}
        setFormCateringStatus={setFormCateringStatus}
        formRefundStatus={formRefundStatus}
        setFormRefundStatus={setFormRefundStatus}
        formRefundAmount={formRefundAmount}
        setFormRefundAmount={setFormRefundAmount}
        formDate={formDate}
        setFormDate={setFormDate}
        formSlot={formSlot}
        setFormSlot={setFormSlot}
        formPkg={formPkg}
        setFormPkg={setFormPkg}
        formPax={formPax}
        setFormPax={setFormPax}
        formTotal={formTotal}
        setFormTotal={setFormTotal}
        formPaid={formPaid}
        setFormPaid={setFormPaid}
        formStatus={formStatus}
        setFormStatus={setFormStatus}
        isSaving={processingId === 'saving'}
        onResendReceipt={handleResendReceipt}
        isResendingReceipt={resendingReceipt}
        onClose={() => setShowCrudModal(false)}
        onSubmit={handleCrudSubmit}
      />

      <WalkInModal
        isOpen={showWalkInModal}
        villas={villasList}
        onClose={() => setShowWalkInModal(false)}
        onSuccess={reloadActiveDataset}
      />

      {activeModalImg && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setActiveModalImg(null)}
        >
          <div
            className="neu-card p-5 max-w-lg w-full relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-300/60 pb-3 px-1">
              <h3 className="font-bold text-slate-900 text-sm">{activeModalImg.title}</h3>
              <button
                type="button"
                onClick={() => setActiveModalImg(null)}
                className="neu-btn px-2.5 h-8 flex items-center justify-center text-slate-600 font-bold text-xs"
              >
                Close
              </button>
            </div>
            <div className="w-full neu-inset p-2 mt-3 max-h-[70vh] flex items-center justify-center overflow-hidden">
              <img
                src={activeModalImg.src}
                alt={activeModalImg.title}
                className="w-full h-auto max-h-[66vh] object-contain rounded-xl"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
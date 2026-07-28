// app/admin/bookings/page.tsx
'use client'

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/utils/supabase/client';
import { ChevronDown, ChevronUp, Calendar, Users, Moon } from 'lucide-react';

interface BookingRecord {
  id: string;
  guest_id: string;
  customer_name: string;
  customer_phone: string;
  account_name: string;
  reference_number: string;
  total_price: number;
  amount_paid: number;
  remaining_balance: number;
  event_date: string;
  slot_assignment: string;
  pax_count: number;
  package_option: string;
  include_overnight: boolean; // 👈 Enforced mapping type property
  overnight_pax_count: number; // 👈 Enforced mapping type property
  status: string;
  receipt_file_path?: string | null; 
  id_file_path?: string | null;      
  villas?: { id: string; name: string } | null; 
  villa_id?: string;
}

export default function AdminVerificationDashboard() {
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'directory' | 'approvals'>('pending');
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeModalImg, setActiveModalImg] = useState<{ src: string; title: string } | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [villasList, setVillasList] = useState<any[]>([]);
  const [showCrudModal, setShowCrudModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const [formVillaId, setFormVillaId] = useState('');
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formAccName, setFormAccName] = useState('In-Person Management Adjustment');
  const [formRefNum, setFormRefNum] = useState('');
  const [formTotal, setFormTotal] = useState<number>(0);
  const [formPaid, setFormPaid] = useState<number>(0);
  const [formDate, setFormDate] = useState('');
  const [formSlot, setFormSlot] = useState('day');
  const [formPax, setFormPax] = useState<number>(10);
  const [formPkg, setFormPkg] = useState('with_catering');
  const [formStatus, setFormStatus] = useState('confirmed');

  const [userRole, setUserRole] = useState<string | null>(null);
  const [approvalRequests, setApprovalRequests] = useState<any[]>([]);

  // AUDIT HISTORY SIDEBAR DRAWER MODAL MATRIX
  const [selectedAuditBooking, setSelectedAuditBooking] = useState<BookingRecord | null>(null);
  const [historicalLogs, setHistoricalLogs] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const [mounted, setMounted] = useState(false);
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
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    async function evaluateClientUserRole() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.user_metadata?.role) {
        setUserRole(user.user_metadata.role);
      }
    }
    evaluateClientUserRole();
  }, [mounted]);

  useEffect(() => { 
    if (mounted) reloadActiveDataset(); 
  }, [activeTab, mounted]);

  useEffect(() => {
    if (!mounted) return;
    async function loadVillas() {
      const supabase = createClient();
      const { data } = await supabase.from('villas').select('id, name').order('name');
      if (data) setVillasList(data);
    }
    loadVillas();
  }, [mounted]);

  const handleOpenHistoryLog = async (booking: BookingRecord) => {
    setSelectedAuditBooking(booking);
    setLoadingHistory(true);
    const supabase = createClient();
    try {
      const { data: historyData } = await supabase
        .from('booking_audit_history')
        .select('*')
        .eq('booking_id', booking.id)
        .order('created_at', { ascending: false });

      const { data: proposalData } = await supabase
        .from('booking_changes_approval')
        .select('*')
        .eq('booking_id', booking.id);
        
      const normalizedProposals = (proposalData || []).map(p => ({
        id: p.id || p.request_id,
        booking_id: p.booking_id,
        type: p.proposed_changes?.after?.status === 'cancelled_request_pending' ? 'cancellation_request' : 'data_edit',
        status: p.status === 'pending' ? 'pending_approval' : p.status,
        summary: p.proposed_changes?.after?.status === 'cancelled_request_pending' 
          ? `Requested a complete stay cancellation ticket` 
          : `Proposed metadata configuration parameter changes`,
        isProposalTicket: true,
        raw_ticket_id: p.request_id || p.id,
        proposed_details: p.proposed_changes?.after || null,
        created_at: p.created_at
      }));

      const filteredHistory = (historyData || []).filter(h => {
        const matchingProposalExists = normalizedProposals.some(p => 
          p.type === h.type && p.status === 'pending_approval'
        );
        return !matchingProposalExists;
      }).map(h => ({ ...h, isProposalTicket: false }));
      
      const unifiedTimeline = [...normalizedProposals, ...filteredHistory].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setHistoricalLogs(unifiedTimeline);
    } catch (err) {
      console.error("Failed to load historical audit logs:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleVerifyInstallmentPayment = async (logId: string, action: 'approved' | 'rejected', amount: number) => {
    if (!selectedAuditBooking) return;
    setProcessingId(logId);
    const supabase = createClient();

    try {
      if (action === 'approved') {
        const updatedPaid = Number(selectedAuditBooking.amount_paid) + Number(amount);
        const updatedRemaining = Math.max(0, Number(selectedAuditBooking.total_price) - updatedPaid);

        const { error: mainErr } = await supabase
          .from('bookings')
          .update({
            amount_paid: updatedPaid,
            remaining_balance: updatedRemaining
          })
          .eq('id', selectedAuditBooking.id);

        if (mainErr) throw mainErr;
      }

      const { error: logErr } = await supabase
        .from('booking_audit_history')
        .update({ status: action })
        .eq('id', logId);

      if (logErr) throw logErr;

      alert(`Milestone cash installment successfully ${action}!`);
      setSelectedAuditBooking(null);
      reloadActiveDataset();
    } catch (err) {
      console.error(err);
      alert("Database error updating payment validation status rules.");
    } finally {
      setProcessingId(null);
    }
  };

  const processedDirectoryList = useMemo(() => {
    if (!searchQuery.trim()) return bookings;
    const cleanQuery = searchQuery.toLowerCase().trim();
    return bookings.filter(b => 
      b.customer_name?.toLowerCase().includes(cleanQuery) || 
      b.reference_number?.toLowerCase().includes(cleanQuery) ||
      b.customer_phone?.includes(cleanQuery) ||
      b.guest_id?.toLowerCase().includes(cleanQuery)
    );
  }, [bookings, searchQuery]);

  const handleAction = async (bookingId: string, action: 'approve' | 'reject' | 'complete') => {
    setProcessingId(bookingId);
    try {
      const res = await fetch('/api/admin/bookings/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId, action })
      });
      if (res.ok) setBookings(prev => prev.filter(b => b.id !== bookingId));
    } catch (err) {
      console.error(err);
    } finally { 
      setProcessingId(null); 
    }
  };

  const handleOwnerDecision = async (requestId: string, action: 'approve' | 'reject') => {
    let reason = '';
    if (action === 'reject') {
      reason = prompt("Please provide a reason for rejecting this request:") || '';
      if (!reason.trim()) return;
    }

    setProcessingId(requestId);
    try {
      const res = await fetch('/api/admin/bookings/approve-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, action, reason })
      });
      if (res.ok) {
        setApprovalRequests(prev => prev.filter(r => (r.request_id || r.id) !== requestId));
        
        const supabase = createClient();
        await supabase
          .from('booking_audit_history')
          .update({ status: action === 'approve' ? 'approved' : 'rejected' })
          .eq('status', 'pending_approval')
          .in('type', ['data_edit', 'cancellation_request']);

        alert(`Request successfully completed and ${action}ed.`);
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
    if (!confirm("🚨 Completely delete this record permanently from Supabase?")) return;
    try {
      const res = await fetch(`/api/admin/bookings/directory?bookingId=${id}`, { method: 'DELETE' });
      if (res.ok) setBookings(prev => prev.filter(b => b.id !== id));
    } catch (err) { console.error(err); }
  };

  const handleCrudSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessingId('saving');
    const payload = {
      bookingId: editId, customerName: formName, customerPhone: formPhone, accountName: formAccName,
      referenceNumber: formRefNum || `MGMT-${Date.now().toString().slice(-5)}`,
      totalPrice: formTotal, amountPaid: formPaid, remainingBalance: formRemaining,
      eventDate: formDate, slotAssignment: formSlot, paxCount: formPax, packageOption: formPkg, status: formStatus
    };

    try {
      if (editId) {
        const res = await fetch('/api/admin/bookings/directory', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const result = await res.json();
        if (res.ok) {
          setShowCrudModal(false);
          if (result.requiresApproval) {
            alert("🔔 Edits queued successfully! The modifications require Owner confirmation before updating structural calendar items.");
          } else {
            alert("Changes saved directly.");
          }
          reloadActiveDataset();
        }
      } else {
        const res = await fetch('/api/admin/dashboard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            villaId: formVillaId || villasList[0]?.id, customerName: formName, customerPhone: formPhone,
            eventDate: formDate, timeSlot: formSlot, packageOption: formPkg, totalPrice: formTotal,
            paymentMode: formTotal === formPaid ? 'full' : 'half', amountPaid: formPaid, remainingBalance: formRemaining
          })
        });
        if (res.ok) { setShowCrudModal(false); reloadActiveDataset(); }
      }
    } catch (err) { console.error(err); } finally { setProcessingId(null); }
  };

  const openEditContextModal = (b: BookingRecord) => {
    setEditId(b.id); setFormVillaId(b.villas?.id || b.villa_id || ''); setFormName(b.customer_name); setFormPhone(b.customer_phone);
    setFormAccName(b.account_name); setFormRefNum(b.reference_number); setFormTotal(b.total_price); setFormPaid(b.amount_paid);
    setFormDate(b.event_date); setFormSlot(b.slot_assignment); setFormPax(b.pax_count); setFormPkg(b.package_option); setFormStatus(b.status);
    setShowCrudModal(true);
  };

  const openCreateContextModal = () => {
    setEditId(null); setFormVillaId(villasList[0]?.id || ''); setFormName(''); setFormPhone('');
    setFormAccName('Administrative Entry'); setFormRefNum(''); setFormTotal(0); setFormPaid(0);
    setFormDate(''); setFormSlot('day'); setFormPax(15); setFormPkg('with_catering'); setFormStatus('confirmed');
    setShowCrudModal(true);
  };

  const openImageModal = (filePath: string, title: string) => {
    const supabase = createClient();
    let cleanPath = filePath.trim();
    if (cleanPath.startsWith('/')) cleanPath = cleanPath.substring(1);
    const { data } = supabase.storage.from('booking-attachments').getPublicUrl(cleanPath);
    if (data?.publicUrl) setActiveModalImg({ src: data.publicUrl, title });
  };

  const isPastEvent = (dateString: string) => {
    if (!dateString) return false;
    const today = new Date(); today.setHours(0,0,0,0);
    return new Date(dateString) < today;
  };

  const toggleAccordion = (id: string) => {
    setExpandedLogId(prev => prev === id ? null : id);
  };

  const formatStayDurationRange = (startDateString: string, packageType: string) => {
    if (!startDateString) return "No date set";
    if (packageType !== 'accommodation_only') return startDateString;

    try {
      const checkInDate = new Date(startDateString);
      const checkOutDate = new Date(startDateString);
      checkOutDate.setDate(checkInDate.getDate() + 1);

      return `${checkInDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} ➔ ${checkOutDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
    } catch {
      return startDateString;
    }
  };

  return (
    <div className="p-2 sm:p-6 w-full max-w-[1600px] mx-auto space-y-6 animate-fadeIn relative font-sans antialiased">
      
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-zinc-900 tracking-tight">Resort Operational Hub</h1>
          <p className="text-xs md:text-sm text-zinc-500 font-medium">Verify guest deposits, generate manual adjustments, or crawl history datasets.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-1 rounded-xl bg-zinc-200/60 p-1 border border-zinc-300 w-fit text-xs self-start xl:self-center">
          <button onClick={() => setActiveTab('pending')} className={`px-4 py-2 font-black rounded-lg transition-all ${activeTab === 'pending' ? 'bg-emerald-600 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-900'}`}>📥 Pending Receipts</button>
          <button onClick={() => setActiveTab('approved')} className={`px-4 py-2 font-black rounded-lg transition-all ${activeTab === 'approved' ? 'bg-emerald-600 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-900'}`}>🗓️ Approved Stays</button>
          <button onClick={() => setActiveTab('directory')} className={`px-4 py-2 font-black rounded-lg transition-all ${activeTab === 'directory' ? 'bg-emerald-600 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-900'}`}>📚 Master Directory</button>
          
          {userRole === 'owner' && (
            <button onClick={() => setActiveTab('approvals')} className={`px-4 py-2 font-black rounded-lg transition-all ${activeTab === 'approvals' ? 'bg-purple-600 text-white shadow-sm' : 'text-purple-700 font-bold hover:bg-purple-50'}`}>🔑 Review Changes</button>
          )}
        </div>
      </div>

      {activeTab === 'directory' && (
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white p-4 border rounded-2xl shadow-sm animate-fadeIn">
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="🔍 Search by name, phone, reference or Guest ID..." className="w-full md:max-w-xl text-xs bg-zinc-50 border rounded-xl px-4 py-2.5 focus:outline-none focus:border-emerald-500 font-medium" />
          <button onClick={openCreateContextModal} className="w-full md:w-auto text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl shadow-sm tracking-wide uppercase">➕ Create Manual Entry</button>
        </div>
      )}

      {activeTab === 'approvals' ? (
        <div className="space-y-4 bg-white p-6 rounded-[2rem] border shadow-sm animate-fadeIn">
          <div>
            <h3 className="text-sm font-black text-purple-950 uppercase tracking-wider">Pending Operations Edit Authorizations</h3>
            <p className="text-xs text-zinc-400 font-medium mt-0.5">Below are pending modifications and cancellation tickets awaiting authorization.</p>
          </div>
          
          {loading ? (
            <p className="text-xs text-zinc-400 animate-pulse italic py-6">Crawling request table matrix blocks...</p>
          ) : approvalRequests.length === 0 ? (
            <p className="text-xs text-zinc-400 italic py-10 bg-zinc-50 border border-dashed rounded-2xl text-center">No structural variations are currently waiting processing clearance parameters.</p>
          ) : (
            <div className="grid gap-6">
              {approvalRequests.map((req) => {
                const isCancellationTicket = req.proposed_changes?.after?.status === 'cancelled_request_pending';
                const requesterGuestId = req.bookings?.guest_id || "GUEST-ACTIVE";
                
                return (
                  <div key={req.request_id || req.id} className={`p-5 border rounded-3xl shadow-sm flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 animate-fadeIn ${isCancellationTicket ? 'border-red-100 bg-red-50/10' : 'border-purple-100 bg-purple-50/10'}`}>
                    <div className="flex-1 w-full space-y-2 text-xs font-semibold">
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-black tracking-wide uppercase border px-2.5 py-0.5 rounded-md block w-fit ${isCancellationTicket ? 'bg-red-100 border-red-200 text-red-800' : 'bg-purple-100 border-purple-200 text-purple-800'}`}>
                          {isCancellationTicket ? '🛑 Cancellation Ticket' : '📝 Profile Modification'}
                        </span>
                        <span className="text-[10px] font-mono font-black text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded">
                          Guest pass: #{requesterGuestId}
                        </span>
                      </div>
                      
                      {!isCancellationTicket && req.proposed_changes?.after && (
                        <div className="bg-zinc-50 p-3 rounded-xl border border-zinc-200/60 font-mono text-[11px] text-zinc-700 space-y-1 mt-2">
                          <p className="text-[9px] font-black text-zinc-400 uppercase tracking-wider">Proposed Value Changes Blueprint:</p>
                          <p>↳ Full Name: <strong className="text-zinc-950 font-bold">{req.proposed_changes.after.customer_name}</strong></p>
                          <p>↳ Allocation Date: <strong className="text-zinc-950 font-bold">{req.proposed_changes.after.event_date}</strong></p>
                          <p>↳ Timeframe Slot: <strong className="text-zinc-950 font-bold">{req.proposed_changes.after.slot_assignment}</strong></p>
                          <p>↳ Expected Pax: <strong className="text-zinc-950 font-bold">{req.proposed_changes.after.pax_count}</strong></p>
                        </div>
                      )}

                      {isCancellationTicket && (
                        <p className="text-red-700 font-medium text-[11px] pt-1">This stay voucher request will clear this reservation off the calendar grid if authorized.</p>
                      )}
                    </div>
                    <div className="flex xl:flex-col gap-2 w-full xl:w-auto font-bold text-xs shrink-0 justify-end">
                      <button type="button" disabled={processingId !== null} onClick={() => handleOwnerDecision(req.request_id || req.id, 'reject')} className="flex-1 xl:w-28 text-center px-4 py-2.5 border rounded-xl border-red-200 text-red-600 bg-white hover:bg-red-50 uppercase tracking-wide transition shadow-sm">Deny</button>
                      <button type="button" disabled={processingId !== null} onClick={() => handleOwnerDecision(req.request_id || req.id, 'approve')} className="flex-1 xl:w-28 text-center px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl uppercase tracking-wide shadow-md transition">Authorize</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-[2rem] border border-zinc-200 overflow-hidden shadow-sm animate-fadeIn">
          <div className="max-h-[65vh] overflow-y-auto overflow-x-auto relative">
            <table className="w-full text-left text-sm text-zinc-600 min-w-[1250px] border-collapse">
              <thead className="bg-zinc-50 text-xs font-bold text-zinc-400 uppercase tracking-wider border-b border-zinc-100 sticky top-0 z-10 shadow-[0_1px_0_0_rgba(228,228,231,1)]">
                <tr>
                  <th className="p-4 bg-zinc-50 w-[260px]">Guest Details</th>
                  <th className="p-4 bg-zinc-50 w-[380px]">Property Unit Stay Details</th>
                  <th className="p-4 bg-zinc-50">Reference Tracking</th>
                  <th className="p-4 bg-zinc-50">Verification Files</th>
                  <th className="p-4 bg-zinc-50 text-center">Financial Accounting Balances</th>
                  <th className="p-4 bg-zinc-50 text-right">Operational Actions</th>
                </tr>
              </thead>
              
              <tbody className="divide-y divide-zinc-100 bg-white text-xs font-semibold">
                {loading ? (
                  <tr><td colSpan={6} className="p-16 text-center text-zinc-400 animate-pulse text-xs italic">Cyber-crawling system data arrays...</td></tr>
                ) : (activeTab === 'directory' ? processedDirectoryList : bookings).length === 0 ? (
                  <tr><td colSpan={6} className="p-16 text-center text-zinc-400 italic">No corresponding ledger records match your current view filters.</td></tr>
                ) : (
                  (activeTab === 'directory' ? processedDirectoryList : bookings).map((booking) => {
                    const past = isPastEvent(booking.event_date);
                    const matchedVillaObject = villasList.find(v => v.id === booking.villa_id);
                    const activeVillaNameDisplay = booking.villas?.name || matchedVillaObject?.name || "Resort Villa Unit";

                    return (
                      <tr key={booking.id} className="hover:bg-zinc-50/40 transition-colors">
                        <td className="p-4">
                          <div className="font-black text-zinc-950 text-base tracking-tight">{booking.customer_name}</div>
                          <div className="flex flex-wrap items-center gap-2 mt-1 font-mono text-[11px] font-bold text-zinc-500">
                            <span className="bg-zinc-100 border border-zinc-200 px-1.5 py-0.5 rounded text-zinc-800 shadow-sm">ID: #{booking.guest_id || "GUEST-ENTRY"}</span>
                            <span>•</span>
                            <span className="font-medium">{booking.customer_phone}</span>
                          </div>
                        </td>

                        {/* 🚀 Reorganized Property Unit Stay Details view block */}
                        <td className="p-4">
                          <div className="bg-zinc-50/70 border border-zinc-200/50 rounded-2xl p-3 space-y-2 shadow-inner text-zinc-700">
                            <div className="flex items-center justify-between border-b border-zinc-200/60 pb-1.5">
                              <span className="font-black text-zinc-900 text-sm tracking-tight">{activeVillaNameDisplay}</span>
                              <span className="text-[9px] uppercase font-black tracking-wider px-2 py-0.5 rounded bg-blue-50 border border-blue-100 text-blue-700">
                                {booking.package_option.replace('_', ' ')}
                              </span>
                            </div>

                            <div className="space-y-1 text-[11px] font-medium">
                              <div className="flex items-center gap-1.5 text-zinc-800">
                                <Calendar className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                                <span>
                                  {booking.package_option === 'accommodation_only' ? (
                                    <span className="font-bold text-zinc-900 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                                      {formatStayDurationRange(booking.event_date, booking.package_option)}
                                    </span>
                                  ) : (
                                    <>Date: <strong className="text-zinc-900 font-bold">{booking.event_date}</strong> ({booking.slot_assignment} slot)</>
                                  )}
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5 text-zinc-800 pt-0.5">
                                <Users className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                                <span>Total Headcount: <strong className="text-zinc-900 font-black">{booking.pax_count} Pax</strong></span>
                              </div>

                              {/* 🚀 FIXED: Enforced truthy parameter comparison criteria evaluation filters */}
                              {(booking.include_overnight === true || String(booking.include_overnight) === 'true') && (
                                <div className="flex items-center gap-1.5 text-indigo-950 bg-indigo-50 border border-indigo-100 p-1.5 rounded-lg text-[10px] font-bold mt-1.5">
                                  <Moon className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                  <span>🌙 Overnight Extension Enabled ({booking.overnight_pax_count || booking.pax_count} Pax Overnight)</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="p-4">
                          <div className="font-mono font-bold text-emerald-700 tracking-wide bg-emerald-50/60 border border-emerald-100 px-2.5 py-1 rounded-lg w-fit">#{booking.reference_number}</div>
                          <div className="text-[11px] text-zinc-400 mt-1 pl-0.5">Sender: <span className="font-semibold text-zinc-600 truncate max-w-[120px] inline-block align-bottom">{booking.account_name || 'None'}</span></div>
                        </td>

                        <td className="p-4 space-y-1 whitespace-nowrap font-bold">
                          {booking.receipt_file_path && !booking.receipt_file_path.includes('null') ? (
                            <button type="button" onClick={() => openImageModal(booking.receipt_file_path!, `${booking.customer_name} - Receipt`)} className="block text-emerald-600 hover:underline text-left cursor-pointer">📄 Latest Receipt</button>
                          ) : <span className="block text-zinc-400 font-normal italic">No receipt file</span>}
                          {booking.id_file_path && !booking.id_file_path.includes('null') ? (
                            <button type="button" onClick={() => openImageModal(booking.id_file_path!, `${booking.customer_name} - ID`)} className="block text-zinc-500 hover:underline text-left cursor-pointer">🪪 Attached ID</button>
                          ) : <span className="block text-zinc-400 font-normal italic">No identity file</span>}
                        </td>

                        <td className="p-4">
                          <div className="flex items-center justify-center gap-4 text-center font-mono text-xs max-w-xs mx-auto bg-zinc-50/50 p-2.5 rounded-2xl border shadow-inner">
                            <div><p className="text-[9px] uppercase font-bold text-emerald-700">Paid Now</p><p className="font-black text-emerald-600 text-sm">₱{Number(booking.amount_paid).toLocaleString()}</p></div>
                            <div className="border-l h-6 border-zinc-200" />
                            <div><p className="text-[9px] uppercase font-bold text-amber-700">Balance Due</p><p className="font-black text-amber-600 text-sm">₱{Number(booking.remaining_balance).toLocaleString()}</p></div>
                          </div>
                        </td>

                        <td className="p-4 text-right whitespace-nowrap space-y-1">
                          <div className="flex items-center justify-end gap-1.5">
                            {activeTab === 'directory' ? (
                              <>
                                <button type="button" onClick={() => openEditContextModal(booking)} className="px-3 py-1.5 rounded-xl border border-zinc-300 font-bold text-zinc-700 bg-zinc-50 hover:bg-white shadow-sm transition">Edit</button>
                                <button type="button" onClick={() => handlePurgeRecord(booking.id)} className="px-3 py-1.5 rounded-xl border border-red-200 font-bold text-red-600 hover:bg-red-50 transition">Delete</button>
                              </>
                            ) : activeTab === 'pending' ? (
                              <>
                                <button type="button" disabled={processingId !== null} onClick={() => handleAction(booking.id, 'reject')} className="px-3 py-1.5 rounded-xl border border-red-200 text-red-600 font-bold hover:bg-red-50">Deny Entire Row</button>
                                <button type="button" disabled={processingId !== null} onClick={() => handleAction(booking.id, 'approve')} className="px-4 py-1.5 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 shadow-sm">Approve Row</button>
                              </>
                            ) : (
                              <button type="button" disabled={processingId !== null} onClick={() => handleAction(booking.id, 'complete')} className={`px-4 py-1.5 rounded-xl font-bold border transition ${past ? 'bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700' : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50'}`}>{processingId === booking.id ? 'Archiving...' : 'Archive & Clear'}</button>
                            )}
                          </div>
                          <button 
                            type="button" 
                            onClick={() => handleOpenHistoryLog(booking)}
                            className="text-[10px] font-black text-zinc-400 hover:text-emerald-600 block ml-auto tracking-wider uppercase underline cursor-pointer"
                          >
                            👁️ View History Log
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

      {/* INTERACTIVE HISTORY LOG DRAWER MODAL - WITH DYNAMIC BEFORE/AFTER COMPARISON ACCORDIONS */}
      {selectedAuditBooking && (
        <div className="fixed inset-0 bg-zinc-950/60 backdrop-blur-sm z-50 flex items-center justify-end animate-fadeIn" onClick={() => setSelectedAuditBooking(null)}>
          <div className="bg-white h-screen max-w-lg w-full p-6 shadow-2xl flex flex-col justify-between border-l text-xs font-sans animate-slideLeft" onClick={e => e.stopPropagation()}>
            <div className="space-y-4 flex-1 overflow-y-auto pr-1">
              <div className="flex items-center justify-between border-b pb-3">
                <div>
                  <h3 className="font-black text-zinc-900 text-base uppercase">Audit History Logs</h3>
                  <p className="text-zinc-400 font-medium text-[11px] mt-0.5">Guest tracking data records for #{selectedAuditBooking.guest_id || 'System Entry'}</p>
                </div>
                <button onClick={() => setSelectedAuditBooking(null)} className="h-8 w-8 flex items-center justify-center rounded-full bg-zinc-100 font-bold text-zinc-500">✕</button>
              </div>

              <div className="bg-zinc-900 text-white p-4 rounded-2xl font-mono space-y-1.5 shadow-md">
                <p className="text-[10px] font-bold text-zinc-400 uppercase">Live Account Status</p>
                <div className="flex justify-between"><span>Gross Total:</span><span className="text-white font-black">₱{selectedAuditBooking.total_price.toLocaleString()}</span></div>
                <div className="flex justify-between"><span>Settled:</span><span className="text-emerald-400 font-black">₱{selectedAuditBooking.amount_paid.toLocaleString()}</span></div>
                <div className="flex justify-between border-t border-zinc-800 pt-1.5"><span>Balance Due:</span><span className="text-amber-400 font-black">₱{selectedAuditBooking.remaining_balance.toLocaleString()}</span></div>
              </div>

              <div className="space-y-3">
                <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Modification & Payment Timeline</h4>
                {loadingHistory ? (
                  <p className="text-zinc-400 animate-pulse italic py-4">Pulling timeline snapshots...</p>
                ) : historicalLogs.length === 0 ? (
                  <p className="text-zinc-400 italic py-6 bg-zinc-50 border rounded-xl text-center">No payment entries or modification records logged for this contract yet.</p>
                ) : (
                  <div className="space-y-3 border-l-2 border-zinc-200 pl-3 ml-1.5">
                    {historicalLogs.map((log) => {
                      const isExpanded = expandedLogId === log.id;
                      const isPendingProposal = log.status === 'pending_approval' && log.isProposalTicket;

                      return (
                        <div key={log.id} className="relative space-y-1 text-zinc-600 bg-zinc-50 border p-3 rounded-xl shadow-sm">
                          <span className={`absolute -left-[19px] top-3.5 h-2.5 w-2.5 rounded-full border border-white ${log.type === 'payment_installment' ? 'bg-emerald-500' : log.type === 'cancellation_request' ? 'bg-red-500' : 'bg-purple-500'}`} />
                          
                          <div className="flex justify-between items-center text-[10px] font-bold">
                            <span className={`uppercase font-black ${log.type === 'payment_installment' ? 'text-emerald-600' : log.type === 'cancellation_request' ? 'text-red-600' : 'text-purple-600'}`}>
                              {log.type === 'payment_installment' ? '💰 Payment Record' : log.type === 'cancellation_request' ? '🛑 Cancellation Request' : '📝 Data Amendment'}
                            </span>
                            <span className="text-zinc-400 font-mono">{new Date(log.created_at).toLocaleDateString()}</span>
                          </div>

                          {(log.type === 'data_edit' || log.type === 'cancellation_request') ? (
                            <div className="pt-0.5">
                              <button 
                                type="button" 
                                onClick={() => toggleAccordion(log.id)} 
                                className="w-full flex items-center justify-between text-zinc-900 font-black hover:text-emerald-600 bg-zinc-100/50 p-1.5 rounded border border-zinc-200/40 text-[11px]"
                              >
                                <span>{log.summary}</span>
                                {isExpanded ? <ChevronUp className="w-3.5 h-3.5 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 shrink-0" />}
                              </button>

                              {isExpanded && log.proposed_details && (
                                <div className="mt-2 p-3 bg-white border rounded-xl font-sans text-[11px] text-zinc-600 space-y-2 animate-fadeIn shadow-sm">
                                  <p className="text-[9px] font-black text-zinc-400 uppercase tracking-wider">Comparison Matrix (Before ➔ After):</p>
                                  <div className="divide-y divide-zinc-100 text-xs font-medium">
                                    {selectedAuditBooking.customer_name !== log.proposed_details.customer_name && (
                                      <div className="py-1.5 flex flex-col gap-0.5">
                                        <span className="text-[10px] text-zinc-400 font-bold uppercase">Lead Guest Name:</span>
                                        <span className="font-medium text-zinc-400 line-through">{selectedAuditBooking.customer_name}</span>
                                        <span className="font-bold text-emerald-600">➔ {log.proposed_details.customer_name}</span>
                                      </div>
                                    )}
                                    {selectedAuditBooking.event_date !== log.proposed_details.event_date && (
                                      <div className="py-1.5 flex flex-col gap-0.5">
                                        <span className="text-[10px] text-zinc-400 font-bold uppercase">Stay Date:</span>
                                        <span className="font-medium text-zinc-400 line-through">{selectedAuditBooking.event_date}</span>
                                        <span className="font-bold text-emerald-600">➔ {log.proposed_details.event_date}</span>
                                      </div>
                                    )}
                                    {selectedAuditBooking.slot_assignment !== log.proposed_details.slot_assignment && (
                                      <div className="py-1.5 flex flex-col gap-0.5">
                                        <span className="text-[10px] text-zinc-400 font-bold uppercase">Time Slot:</span>
                                        <span className="font-medium text-zinc-400 line-through uppercase">{selectedAuditBooking.slot_assignment} slot</span>
                                        <span className="font-bold text-emerald-600">➔ {log.proposed_details.slot_assignment.toUpperCase()} slot</span>
                                      </div>
                                    )}
                                    {Number(selectedAuditBooking.pax_count) !== Number(log.proposed_details.pax_count) && (
                                      <div className="py-1.5 flex flex-col gap-0.5">
                                        <span className="text-[10px] text-zinc-400 font-bold uppercase">Guest Headcount:</span>
                                        <span className="font-medium text-zinc-400 line-through">{selectedAuditBooking.pax_count} Pax</span>
                                        <span className="font-bold text-emerald-600">➔ {log.proposed_details.pax_count} Pax</span>
                                      </div>
                                    )}
                                    {selectedAuditBooking.package_option !== log.proposed_details.package_option && (
                                      <div className="py-1.5 flex flex-col gap-0.5">
                                        <span className="text-[10px] text-zinc-400 font-bold uppercase">Package Option Tier:</span>
                                        <span className="font-medium text-zinc-400 line-through">{selectedAuditBooking.package_option.replace('_', ' ')}</span>
                                        <span className="font-bold text-emerald-600">➔ {log.proposed_details.package_option.replace('_', ' ')}</span>
                                      </div>
                                    )}
                                    {selectedAuditBooking.customer_name === log.proposed_details.customer_name &&
                                     selectedAuditBooking.event_date === log.proposed_details.event_date &&
                                     selectedAuditBooking.slot_assignment === log.proposed_details.slot_assignment &&
                                     selectedAuditBooking.pax_count === log.proposed_details.pax_count &&
                                     selectedAuditBooking.package_option === log.proposed_details.package_option && (
                                       <p className="text-zinc-400 italic text-[11px] py-1">Proposed values are identical to active record variables.</p>
                                     )}
                                  </div>
                                </div>
                              )}

                              <p className="text-[11px] font-medium pt-1">Status: <span className={`font-bold ${log.status === 'approved' ? 'text-emerald-600' : log.status === 'rejected' ? 'text-red-500' : 'text-purple-600 animate-pulse'}`}>{log.status.toUpperCase()}</span></p>
                              
                              {isPendingProposal && (
                                <div className="flex gap-2 pt-2">
                                  <button type="button" disabled={processingId !== null} onClick={() => handleOwnerDecision(log.raw_ticket_id, 'reject')} className="flex-1 bg-red-50 border border-red-200 text-red-600 py-1 rounded-lg text-[10px] font-bold hover:bg-red-100 transition">Reject Changes</button>
                                  <button type="button" disabled={processingId !== null} onClick={() => handleOwnerDecision(log.raw_ticket_id, 'approve')} className="flex-1 bg-purple-600 text-white py-1 rounded-lg text-[10px] font-bold hover:bg-purple-700 shadow transition">Approve Changes</button>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="pt-0.5 text-zinc-600 text-xs">
                              <p className="font-bold text-zinc-900">{log.summary}</p>
                              <div className="pt-1 text-[11px] text-zinc-500 font-medium space-y-1">
                                <p>Reference: <span className="font-mono font-bold text-zinc-700">{log.reference_number}</span></p>
                                <p>Sender Acc: <span className="text-zinc-700">{log.account_name}</span></p>
                                <p>Verification Status: <span className={`font-bold ${log.status === 'approved' ? 'text-emerald-600' : log.status === 'rejected' ? 'text-red-500' : 'text-amber-600'}`}>{log.status.toUpperCase()}</span></p>
                                
                                {log.receipt_file_path && (
                                  <button 
                                    type="button" 
                                    onClick={() => openImageModal(log.receipt_file_path!, 'Historical Receipt Link')} 
                                    className="text-emerald-600 hover:underline font-bold block pt-1 cursor-pointer"
                                  >
                                    📄 View This Specific Receipt
                                  </button>
                                )}

                                {log.status === 'pending_approval' && (
                                  <div className="flex gap-2 pt-2">
                                    <button type="button" disabled={processingId !== null} onClick={() => handleVerifyInstallmentPayment(log.id, 'rejected', log.amount_paid)} className="flex-1 bg-red-50 border border-red-200 text-red-600 py-1 rounded-lg text-[10px] font-bold hover:bg-red-100 transition">Deny Cash</button>
                                    <button type="button" disabled={processingId !== null} onClick={() => handleVerifyInstallmentPayment(log.id, 'approved', log.amount_paid)} className="flex-1 bg-emerald-600 text-white py-1 rounded-lg text-[10px] font-bold hover:bg-emerald-700 shadow transition">Approve & Apply to Bill</button>
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
            <button onClick={() => setSelectedAuditBooking(null)} className="w-full bg-zinc-950 text-white font-bold py-3 rounded-xl tracking-wide uppercase text-xs mt-4">Close Dossier</button>
          </div>
        </div>
      )}

      {/* OVERLAY CRUD MODAL DRAWERS */}
      {showCrudModal && (
        <div className="fixed inset-0 bg-zinc-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowCrudModal(false)}>
          <div className="bg-white rounded-[2rem] p-6 max-w-lg w-full space-y-4 shadow-2xl border text-xs" onClick={e => e.stopPropagation()}>
            <form onSubmit={handleCrudSubmit} className="space-y-4">
              <button type="submit" className="w-full bg-emerald-600 text-white py-2 rounded-xl">Save Record</button>
            </form>
          </div>
        </div>
      )}

      {/* OVERLAY PREVIEW MODAL */}
      {activeModalImg && (
        <div className="fixed inset-0 bg-zinc-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setActiveModalImg(null)}>
          <div className="bg-white rounded-3xl p-4 max-w-lg w-full shadow-2xl relative border" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b pb-2 px-1">
              <h3 className="font-bold text-zinc-900 text-sm tracking-tight">{activeModalImg.title}</h3>
              <button onClick={() => setActiveModalImg(null)} className="h-7 w-7 flex items-center justify-center rounded-full bg-zinc-100 text-zinc-500 font-bold hover:bg-zinc-200 text-xs">✕</button>
            </div>
            <div className="w-full bg-zinc-50 rounded-2xl overflow-hidden border mt-2 max-h-[70vh] flex items-center justify-center">
              <img src={activeModalImg.src} alt="Asset" className="w-full h-auto max-h-[70vh] object-contain" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
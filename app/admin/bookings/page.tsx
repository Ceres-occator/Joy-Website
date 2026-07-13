// app/admin/bookings/page.tsx
'use client'

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/utils/supabase/client';

interface BookingRecord {
  id: string;
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
  include_overnight: boolean;
  overnight_pax_count: number;
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

  const processedDirectoryList = useMemo(() => {
    if (!searchQuery.trim()) return bookings;
    const cleanQuery = searchQuery.toLowerCase().trim();
    return bookings.filter(b => 
      b.customer_name?.toLowerCase().includes(cleanQuery) || 
      b.reference_number?.toLowerCase().includes(cleanQuery) ||
      b.customer_phone?.includes(cleanQuery)
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
      reason = prompt("Please provide a reason for rejecting this change tracking request:") || '';
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
        setApprovalRequests(prev => prev.filter(r => r.request_id !== requestId));
        alert(`Modification request successfully ${action}ed.`);
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

  // 🚀 FIXED: URL Construction Parser
  const openImageModal = (filePath: string, title: string) => {
    const supabase = createClient();
    
    // Clean up double slashes or leading path parameters if present
    let cleanPath = filePath.trim();
    if (cleanPath.startsWith('/')) {
      cleanPath = cleanPath.substring(1);
    }
    
    const { data } = supabase.storage.from('booking-attachments').getPublicUrl(cleanPath);
    if (data?.publicUrl) {
      setActiveModalImg({ src: data.publicUrl, title });
    }
  };

  const isPastEvent = (dateString: string) => {
    if (!dateString) return false;
    const today = new Date(); today.setHours(0,0,0,0);
    return new Date(dateString) < today;
  };

  if (!mounted) {
    return (
      <div className="p-6 text-center text-xs text-zinc-400 font-sans italic animate-pulse">
        Initializing Verification Operations...
      </div>
    );
  }

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
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="🔍 Fast search by customer name, mobile digits, or reference ticket hash..." className="w-full md:max-w-xl text-xs bg-zinc-50 border rounded-xl px-4 py-2.5 focus:outline-none focus:border-emerald-500 font-medium" />
          <button onClick={openCreateContextModal} className="w-full md:w-auto text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl shadow-sm tracking-wide uppercase">➕ Create Manual Entry</button>
        </div>
      )}

      {/* CONDITIONAL BRANCH INTERFACE LAYER */}
      {activeTab === 'approvals' ? (
        <div className="space-y-4 bg-white p-6 rounded-[2rem] border shadow-sm animate-fadeIn">
          <div>
            <h3 className="text-sm font-black text-purple-950 uppercase tracking-wider">Pending Operations Edit Authorizations</h3>
            <p className="text-xs text-zinc-400 font-medium mt-0.5">Below are pending modifications generated by staff accounts awaiting authorization.</p>
          </div>
          
          {loading ? (
            <p className="text-xs text-zinc-400 animate-pulse italic py-6">Crawling request table matrix blocks...</p>
          ) : approvalRequests.length === 0 ? (
            <p className="text-xs text-zinc-400 italic py-10 bg-zinc-50 border border-dashed rounded-2xl text-center">No structural variations are currently waiting processing clearance parameters.</p>
          ) : (
            <div className="grid gap-6">
              {approvalRequests.map((req) => {
                const hasNestedHistory = req.proposed_changes && req.proposed_changes.after;
                const before = hasNestedHistory ? req.proposed_changes.before : {};
                const after = hasNestedHistory ? req.proposed_changes.after : req.proposed_changes;

                return (
                  <div key={req.request_id} className="p-5 border border-purple-100 bg-purple-50/10 rounded-3xl shadow-sm flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 animate-fadeIn">
                    <div className="flex-1 w-full space-y-3">
                      <span className="text-[9px] font-black tracking-wide uppercase bg-purple-100 border border-purple-200 text-purple-800 px-2.5 py-0.5 rounded-md block w-fit">Ticket ID: {req.request_id}</span>
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
            <table className="w-full text-left text-sm text-zinc-600 min-w-[1100px] border-collapse">
              <thead className="bg-zinc-50 text-xs font-bold text-zinc-400 uppercase tracking-wider border-b border-zinc-100 sticky top-0 z-10 shadow-[0_1px_0_0_rgba(228,228,231,1)]">
                <tr>
                  <th className="p-4 bg-zinc-50">Guest Contact Info</th>
                  <th className="p-4 bg-zinc-50">Property Unit Stay Details</th>
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
                  <tr><td colSpan={6} className="p-16 text-center text-zinc-400 italic">No corresponding ledger records match your current view configuration filters.</td></tr>
                ) : (
                  (activeTab === 'directory' ? processedDirectoryList : bookings).map((booking) => {
                    const past = isPastEvent(booking.event_date);
                    const matchedVillaObject = villasList.find(v => v.id === booking.villa_id);
                    const activeVillaNameDisplay = booking.villas?.name || matchedVillaObject?.name || "Resort Villa Unit";

                    return (
                      <tr key={booking.id} className="hover:bg-zinc-50/40 transition-colors">
                        <td className="p-4">
                          <div className="font-bold text-zinc-900 text-sm">{booking.customer_name}</div>
                          <div className="text-zinc-400 font-medium font-mono mt-0.5">{booking.customer_phone}</div>
                        </td>

                        <td className="p-4 space-y-1.5">
                          <div>
                            <span className="font-black text-zinc-900 text-sm block">{activeVillaNameDisplay}</span>
                            <span className="font-bold text-zinc-500 text-xs block mt-0.5">📆 Scheduled: {booking.event_date}</span>
                          </div>
                        </td>

                        <td className="p-4">
                          <div className="font-mono font-bold text-emerald-700 tracking-wide bg-emerald-50/60 border border-emerald-100 px-2.5 py-1 rounded-lg w-fit">#{booking.reference_number}</div>
                        </td>

                        <td className="p-4 space-y-1 whitespace-nowrap font-bold">
                          {booking.receipt_file_path && !booking.receipt_file_path.includes('null') ? (
                            <button type="button" onClick={() => openImageModal(booking.receipt_file_path!, `${booking.customer_name} - Receipt`)} className="block text-emerald-600 hover:underline text-left cursor-pointer">📄 Receipt Slip</button>
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

                        <td className="p-4 text-right whitespace-nowrap">
                          {activeTab === 'directory' ? (
                            <div className="inline-flex items-center space-x-1.5">
                              <button type="button" onClick={() => openEditContextModal(booking)} className="px-3 py-1.5 rounded-xl border border-zinc-300 font-bold text-zinc-700 bg-zinc-50 hover:bg-white shadow-sm transition">Edit</button>
                              <button type="button" onClick={() => handlePurgeRecord(booking.id)} className="px-3 py-1.5 rounded-xl border border-red-200 font-bold text-red-600 hover:bg-red-50 transition">Delete</button>
                            </div>
                          ) : activeTab === 'pending' ? (
                            <div className="inline-flex items-center space-x-2">
                              <button type="button" disabled={processingId !== null} onClick={() => handleAction(booking.id, 'reject')} className="px-3 py-1.5 rounded-xl border border-red-200 text-red-600 font-bold hover:bg-red-50">Deny</button>
                              <button type="button" disabled={processingId !== null} onClick={() => handleAction(booking.id, 'approve')} className="px-4 py-1.5 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 shadow-sm">Approve</button>
                            </div>
                          ) : (
                            <button type="button" disabled={processingId !== null} onClick={() => handleAction(booking.id, 'complete')} className={`px-4 py-1.5 rounded-xl font-bold border transition ${past ? 'bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700' : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50'}`}>{processingId === booking.id ? 'Archiving...' : 'Archive & Clear'}</button>
                          )}
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

      {/* 🚀 OVERLAY PREVIEW MODAL FRAME */}
      {activeModalImg && (
        <div className="fixed inset-0 bg-zinc-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setActiveModalImg(null)}>
          <div className="bg-white rounded-3xl p-4 max-w-lg w-full shadow-2xl relative border" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b pb-2 px-1">
              <h3 className="font-bold text-zinc-900 text-sm tracking-tight">{activeModalImg.title}</h3>
              <button onClick={() => setActiveModalImg(null)} className="h-7 w-7 flex items-center justify-center rounded-full bg-zinc-100 text-zinc-500 font-bold hover:bg-zinc-200 text-xs">✕</button>
            </div>
            <div className="w-full bg-zinc-50 rounded-2xl overflow-hidden border mt-2 max-h-[70vh] flex items-center justify-center">
              <img src={activeModalImg.src} alt="Uploaded Asset File" className="w-full h-auto max-h-[70vh] object-contain" />
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
'use client'

import { useState, useEffect } from 'react';
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
  villas?: { name: string } | null; 
}

export default function AdminVerificationDashboard() {
  const [activeTab, setActiveTab] = useState<'pending' | 'approved'>('pending');
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeModalImg, setActiveModalImg] = useState<{ src: string; title: string } | null>(null);

  useEffect(() => {
    async function loadBookings() {
      setLoading(true);
      try {
        const targetStatus = activeTab === 'pending' ? 'pending_verification' : 'confirmed';
        const res = await fetch(`/api/admin/bookings?status=${targetStatus}`);
        const data = await res.json();
        if (data.bookings) setBookings(data.bookings);
      } catch (err) {
        console.error("Failed to sync structural booking array lines:", err);
      } finally {
        setLoading(false);
      }
    }
    loadBookings();
  }, [activeTab]);

  const handleAction = async (bookingId: string, action: 'approve' | 'reject' | 'complete') => {
    setProcessingId(bookingId);
    try {
      const res = await fetch('/api/admin/bookings/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId, action })
      });

      if (res.ok) {
        setBookings(prev => prev.filter(b => b.id !== bookingId));
      } else {
        const errData = await res.json();
        alert(`Action rejection error: ${errData.error}`);
      }
    } catch (err) {
      console.error("Action pipeline failed:", err);
    } finally {
      setProcessingId(null);
    }
  };

  const openImageModal = (filePath: string, title: string) => {
    const supabase = createClient();
    const { data } = supabase.storage.from('booking-attachments').getPublicUrl(filePath);
    if (data?.publicUrl) setActiveModalImg({ src: data.publicUrl, title });
  };

  const isPastEvent = (dateString: string) => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const target = new Date(dateString);
    return target < today;
  };

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6 animate-fadeIn relative">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-zinc-900 tracking-tight">Bookings Operational Hub</h1>
          <p className="text-sm text-zinc-500">Review incoming transaction codes or clear out finished rental stays.</p>
        </div>
        
        <div className="inline-flex rounded-xl bg-zinc-100 p-1 border border-zinc-200 w-fit">
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'pending' ? 'bg-emerald-600 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-900'}`}
          >
            📥 Pending Receipts
          </button>
          <button
            onClick={() => setActiveTab('approved')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'approved' ? 'bg-emerald-600 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-900'}`}
          >
            🗓️ Approved & Upcoming
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-zinc-200 overflow-hidden shadow-sm">
        <div className="max-h-[60vh] overflow-y-auto overflow-x-auto relative">
          <table className="w-full text-left text-sm text-zinc-600 min-w-[1000px] border-collapse">
            <thead className="bg-zinc-50 text-xs font-bold text-zinc-400 uppercase tracking-wider border-b border-zinc-100 sticky top-0 z-10 shadow-[0_1px_0_0_rgba(244,244,245,1)]">
              <tr>
                <th className="p-4 bg-zinc-50">Customer Details</th>
                <th className="p-4 bg-zinc-50">Stay & Target Property Details</th>
                <th className="p-4 bg-zinc-50">Ledger Reference</th>
                <th className="p-4 bg-zinc-50">Verification Files</th>
                <th className="p-4 bg-zinc-50 text-center">Financial Spread (Paid / Debt / Gross)</th>
                <th className="p-4 bg-zinc-50 text-right">Actions</th>
              </tr>
            </thead>
            
            <tbody className="divide-y divide-zinc-100 bg-white text-xs">
              {loading ? (
                <tr><td colSpan={6} className="p-12 text-center text-zinc-400 animate-pulse">Synchronizing database...</td></tr>
              ) : bookings.length === 0 ? (
                <tr><td colSpan={6} className="p-12 text-center text-zinc-400 italic">No active bookings found in this operational stack.</td></tr>
              ) : (
                bookings.map((booking) => {
                  const past = isPastEvent(booking.event_date);
                  
                  return (
                    <tr key={booking.id} className="hover:bg-zinc-50/40 transition-colors">
                      <td className="p-4">
                        <div className="font-bold text-zinc-900 text-sm">{booking.customer_name}</div>
                        <div className="text-zinc-500 font-medium font-mono mt-0.5">{booking.customer_phone}</div>
                      </td>

                      <td className="p-4 space-y-1.5">
                        <div>
                          <span className="font-black text-zinc-900 text-sm block">
                            {booking.villas?.name || "Premium Resort Property Unit"}
                          </span>
                          <span className="font-semibold text-zinc-500 text-xs block mt-0.5">
                            📆 Scheduled: {booking.event_date}
                          </span>
                        </div>
                        
                        <div className="flex flex-wrap gap-1 items-center font-bold text-[9px] uppercase tracking-wide">
                          <span className={`px-2 py-0.5 rounded border ${booking.slot_assignment === 'day' ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-orange-50 border-orange-200 text-orange-700'}`}>
                            ⏳ {booking.slot_assignment} Slot
                          </span>
                          <span className="px-2 py-0.5 rounded border bg-zinc-100 text-zinc-600">
                            👥 {booking.pax_count} Pax Guests
                          </span>
                          <span className="px-2 py-0.5 rounded border bg-blue-50 border-blue-100 text-blue-700">
                            📦 {booking.package_option.replace('_', ' ')}
                          </span>
                          {booking.include_overnight && (
                            <span className="px-2 py-0.5 rounded border bg-purple-50 border-purple-200 text-purple-700 animate-pulse">
                              🌙 Overnight ({booking.overnight_pax_count} Stayers)
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="p-4">
                        <div className="font-mono font-bold text-emerald-700 tracking-wide bg-emerald-50/60 border border-emerald-100 px-2.5 py-1 rounded-lg w-fit">
                          #{booking.reference_number}
                        </div>
                        <div className="text-[11px] text-zinc-400 mt-1 pl-0.5">
                          Sender: <span className="font-semibold text-zinc-600 truncate max-w-[120px] inline-block align-bottom">{booking.account_name}</span>
                        </div>
                      </td>

                      <td className="p-4 space-y-1 whitespace-nowrap font-bold">
                        {booking.receipt_file_path ? (
                          <button type="button" onClick={() => openImageModal(booking.receipt_file_path!, `${booking.customer_name} - Receipt`)} className="block text-emerald-600 hover:underline text-left cursor-pointer">📄 Receipt Slip</button>
                        ) : (
                          <span className="block text-zinc-400 italic font-normal">No receipt attachment</span>
                        )}
                        {booking.id_file_path ? (
                          <button type="button" onClick={() => openImageModal(booking.id_file_path!, `${booking.customer_name} - Valid ID`)} className="block text-zinc-500 hover:underline text-left cursor-pointer">🪪 Attached ID Card</button>
                        ) : (
                          <span className="block text-zinc-400 italic font-normal">No ID attachment</span>
                        )}
                      </td>

                      <td className="p-4">
                        <div className="flex items-center justify-center gap-3 text-center font-mono text-xs max-w-xs mx-auto bg-zinc-50 p-2 rounded-2xl border border-zinc-100 shadow-inner">
                          <div>
                            <p className="text-[9px] uppercase font-bold text-emerald-700">Paid Now</p>
                            <p className="font-black text-emerald-600">₱{Number(booking.amount_paid || booking.total_price * 0.5).toLocaleString()}</p>
                          </div>
                          <div className="border-l h-6 border-zinc-200" />
                          <div>
                            <p className="text-[9px] uppercase font-bold text-amber-700">Balance Due</p>
                            <p className="font-black text-amber-600">₱{Number(booking.remaining_balance ?? booking.total_price * 0.5).toLocaleString()}</p>
                          </div>
                          <div className="border-l h-6 border-zinc-200" />
                          <div>
                            <p className="text-[9px] uppercase font-bold text-zinc-400">Gross Total</p>
                            <p className="font-black text-zinc-900">₱{Number(booking.total_price).toLocaleString()}</p>
                          </div>
                        </div>
                      </td>

                      <td className="p-4 text-right whitespace-nowrap">
                        {activeTab === 'pending' ? (
                          <div className="inline-flex items-center space-x-2">
                            <button type="button" disabled={processingId !== null} onClick={() => handleAction(booking.id, 'reject')} className="px-3 py-1.5 rounded-xl border border-red-200 text-red-600 font-bold hover:bg-red-50 transition">Deny</button>
                            {/* 🌟 GREEN BUTTON */}
                            <button type="button" disabled={processingId !== null} onClick={() => handleAction(booking.id, 'approve')} className="px-4 py-1.5 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition shadow-sm">Approve</button>
                          </div>
                        ) : (
                          /* 🌟 GREEN ARCHIVE BUTTON WHEN PAST STAY */
                          <button type="button" disabled={processingId !== null} onClick={() => handleAction(booking.id, 'complete')} className={`px-4 py-1.5 rounded-xl font-bold border transition ${past ? 'bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700' : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50'}`}>
                            {processingId === booking.id ? 'Archiving...' : 'Archive & Clear'}
                          </button>
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

      {/* OVERLAY PREVIEW MODAL */}
      {activeModalImg && (
        <div className="fixed inset-0 bg-zinc-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6 animate-fadeIn" onClick={() => setActiveModalImg(null)}>
          <div className="bg-white rounded-3xl p-4 max-w-lg w-full space-y-3 shadow-2xl relative border border-zinc-100" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b pb-2 px-1">
              <h3 className="font-bold text-zinc-900 text-sm tracking-tight">{activeModalImg.title}</h3>
              <button onClick={() => setActiveModalImg(null)} className="h-7 w-7 flex items-center justify-center rounded-full bg-zinc-100 text-zinc-500 font-bold hover:bg-zinc-200 text-xs">✕</button>
            </div>
            <div className="w-full bg-zinc-50 rounded-2xl overflow-hidden border border-zinc-200 max-h-[70vh] flex items-center justify-center">
              <img src={activeModalImg.src} alt="Verification Asset" className="w-full h-auto max-h-[70vh] object-contain" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
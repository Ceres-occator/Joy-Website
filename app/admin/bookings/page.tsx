'use client'

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client'; // 👈 Import your client factory utility

interface PendingBooking {
  id: string;
  customer_name: string;
  customer_phone: string;
  account_name: string;
  reference_number: string;
  total_price: number;
  event_date: string;
  slot_assignment: string;
  pax_count: number;
  status: string;
  receipt_file_path?: string | null; 
  id_file_path?: string | null;      
}

export default function AdminVerificationDashboard() {
  const [bookings, setBookings] = useState<PendingBooking[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [activeModalImg, setActiveModalImg] = useState<{ src: string; title: string } | null>(null);

  useEffect(() => {
    async function loadPending() {
      setLoading(true);
      try {
        const res = await fetch('/api/admin/bookings?status=pending_verification');
        const data = await res.json();
        if (data.bookings) setBookings(data.bookings);
      } catch (err) {
        console.error("Failed to load active verification tickers:", err);
      } finally {
        setLoading(false);
      }
    }
    loadPending();
  }, []);

  const handleAction = async (bookingId: string, action: 'approve' | 'reject') => {
    setProcessingId(bookingId);
    try {
      const res = await fetch('/api/admin/bookings/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId, action })
      });

      if (res.ok) {
        setBookings(prev => prev.filter(b => b.id !== bookingId));
      }
    } catch (err) {
      console.error("Action pipeline execution failed:", err);
    } finally {
      setProcessingId(null);
    }
  };

  // 🛠️ NEW: Helper utility function to parse paths into real URLs dynamically
  const openImageModal = (filePath: string, title: string) => {
    const supabase = createClient();
    
    // Generates a fully qualified public URL pointing to your actual live project instance domain
    const { data } = supabase.storage
      .from('booking-attachments')
      .getPublicUrl(filePath);

    if (data?.publicUrl) {
      setActiveModalImg({ src: data.publicUrl, title });
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6 animate-fadeIn relative">
      <div>
        <h1 className="text-2xl font-black text-zinc-900 tracking-tight">Incoming Payment Approvals</h1>
        <p className="text-sm text-zinc-500">Cross-reference submitted customer transactions against your real banking ledgers.</p>
      </div>

      <div className="bg-white rounded-3xl border border-zinc-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-zinc-600 min-w-[900px]">
            <thead className="bg-zinc-50 text-xs font-bold text-zinc-400 uppercase tracking-wider border-b border-zinc-100">
              <tr>
                <th className="p-4">Customer Details</th>
                <th className="p-4">Target Schedule</th>
                <th className="p-4">Payment Tracking</th>
                <th className="p-4">Verification Files</th>
                <th className="p-4">50% Deposit Due</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-zinc-400 animate-pulse text-xs">
                    Synchronizing incoming transactional tickets...
                  </td>
                </tr>
              ) : bookings.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-zinc-400 italic">
                    No incoming verification tickets waiting in queue.
                  </td>
                </tr>
              ) : (
                bookings.map((booking) => (
                  <tr key={booking.id} className="hover:bg-zinc-50/40 transition-colors">
                    
                    <td className="p-4">
                      <div className="font-bold text-zinc-900">{booking.customer_name}</div>
                      <div className="text-xs text-zinc-500 font-medium">{booking.customer_phone}</div>
                    </td>

                    <td className="p-4 space-y-1">
                      <div className="font-semibold text-zinc-800">{booking.event_date}</div>
                      <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-extrabold uppercase">
                        <span className={`px-2 py-0.5 rounded border ${
                          booking.slot_assignment === 'day' 
                            ? 'bg-amber-50 border-amber-200 text-amber-700' 
                            : 'bg-orange-50 border-orange-200 text-orange-700'
                        }`}>
                          ⏳ {booking.slot_assignment} Slot
                        </span>
                      </div>
                    </td>

                    <td className="p-4">
                      <div className="font-mono text-xs font-bold text-emerald-700 tracking-wide bg-emerald-50/60 border border-emerald-100 px-2.5 py-1 rounded-lg w-fit">
                        #{booking.reference_number}
                      </div>
                      <div className="text-xs text-zinc-400 mt-1 pl-1">
                        Sender: <span className="font-semibold text-zinc-600">{booking.account_name}</span>
                      </div>
                    </td>

                    {/* 🛠️ MODIFIED: Pass target paths straight into our dynamic helper function */}
                    <td className="p-4 space-y-1 whitespace-nowrap">
                      {booking.receipt_file_path ? (
                        <button
                          type="button"
                          onClick={() => openImageModal(booking.receipt_file_path!, `${booking.customer_name} - Payment Receipt`)}
                          className="block text-xs font-bold text-emerald-600 hover:underline text-left cursor-pointer"
                        >
                          📄 View Receipt Slip
                        </button>
                      ) : (
                        <span className="block text-xs text-zinc-400 italic">No receipt file path</span>
                      )}

                      {booking.id_file_path ? (
                        <button
                          type="button"
                          onClick={() => openImageModal(booking.id_file_path!, `${booking.customer_name} - Valid ID`)}
                          className="block text-xs font-bold text-zinc-500 hover:underline text-left cursor-pointer"
                        >
                          🪪 View Attached ID
                        </button>
                      ) : (
                        <span className="block text-xs text-zinc-400 italic">No verification ID path</span>
                      )}
                    </td>

                    <td className="p-4">
                      <div className="font-bold text-zinc-900 text-base">
                        ₱{(booking.total_price * 0.5).toLocaleString()}
                      </div>
                      <div className="text-[10px] font-medium text-zinc-400">
                        Total Contract: ₱{booking.total_price.toLocaleString()}
                      </div>
                    </td>

                    <td className="p-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center space-x-2">
                        <button
                          type="button"
                          disabled={processingId !== null}
                          onClick={() => handleAction(booking.id, 'reject')}
                          className="px-3 py-2 rounded-xl border border-red-200 text-red-600 text-xs font-bold hover:bg-red-50 transition"
                        >
                          Deny
                        </button>
                        <button
                          type="button"
                          disabled={processingId !== null}
                          onClick={() => handleAction(booking.id, 'approve')}
                          className="px-4 py-2 rounded-xl bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-600 transition shadow-sm"
                        >
                          {processingId === booking.id ? 'Updating...' : 'Approve & Confirm'}
                        </button>
                      </div>
                    </td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* OVERLAY PREVIEW MODAL */}
      {activeModalImg && (
        <div 
          className="fixed inset-0 bg-zinc-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6 animate-fadeIn"
          onClick={() => setActiveModalImg(null)}
        >
          <div 
            className="bg-white rounded-3xl p-4 max-w-lg w-full space-y-3 shadow-2xl relative border border-zinc-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b pb-2 px-1">
              <h3 className="font-bold text-zinc-900 text-sm tracking-tight">{activeModalImg.title}</h3>
              <button 
                onClick={() => setActiveModalImg(null)}
                className="h-7 w-7 flex items-center justify-center rounded-full bg-zinc-100 text-zinc-500 font-bold hover:bg-zinc-200 transition text-xs"
              >
                ✕
              </button>
            </div>
            
            <div className="w-full bg-zinc-50 rounded-2xl overflow-hidden border border-zinc-200 max-h-[70vh] flex items-center justify-center">
              <img 
                src={activeModalImg.src} 
                alt="Verification Proof Asset" 
                className="w-full h-auto max-h-[70vh] object-contain"
                onError={(e) => {
                  console.error("Image component failed to render target source address location:", activeModalImg.src);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
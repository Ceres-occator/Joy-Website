// app/(public)/my-bookings/page.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/utils/supabase/client';
import { CreditCard, Search, Key, Landmark, Calendar, FileText, CheckCircle2, Clock, AlertTriangle, Lock } from 'lucide-react';

interface ClientBooking {
  id: string;
  guest_id: string;
  customer_name: string;
  customer_phone: string;
  event_date: string;
  total_price: number;
  amount_paid: number;
  remaining_balance: number;
  status: string;
  package_option: string;
  pax_count: number;
  slot_assignment: string;
  villas?: { name: string };
  villa_id?: string;
}

export default function GuestPortalPage() {
  const supabase = createClient();
  
  const [inputToken, setInputToken] = useState('');
  const [booking, setBooking] = useState<ClientBooking | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isLocked, setIsLocked] = useState(false); // 🚀 NEW: State to catch archived lockout events
  
  // Active Invoice Form Editor Modifications States
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formPax, setFormPax] = useState<number>(10);
  const [formPkg, setFormPkg] = useState('with_catering');
  const [formSlot, setFormSlot] = useState('day');
  const [formDate, setFormDate] = useState(''); 

  // Dynamic Payment Parameters Fields States
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [refNum, setRefNum] = useState('');
  const [accName, setAccName] = useState('');
  const [selectedChannel, setSelectedChannel] = useState<'gcash' | 'bpi'>('gcash');

  // Live Gateway Configurations fetched from payment_settings table
  const [liveGateways, setLiveGateways] = useState<any[]>([]);
  const [fetchingGateways, setFetchingGateways] = useState(true);

  useEffect(() => {
    async function fetchGateways() {
      try {
        const { data } = await supabase.from('payment_settings').select('*');
        if (data) {
          const mapped = data.map(gate => {
            let fullUrl = null;
            if (gate.qr_file_path) {
              const { data: res } = supabase.storage.from('booking-attachments').getPublicUrl(gate.qr_file_path);
              fullUrl = res?.publicUrl;
            }
            return { ...gate, qrUrl: fullUrl };
          });
          setLiveGateways(mapped);
        }
      } catch (err) {
        console.error("Failed fetching payment gateways configuration:", err);
      } finally {
        setFetchingGateways(false);
      }
    }
    fetchGateways();
  }, [supabase]);

  const activeGateway = useMemo(() => {
    return liveGateways.find(gate => gate.id === selectedChannel);
  }, [liveGateways, selectedChannel]);

  const handleVerifyToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputToken.trim()) return;
    
    setLoading(true);
    setIsLocked(false);
    try {
      const { data, error } = await supabase
        .from("bookings")
        .select("id, guest_id, customer_name, customer_phone, event_date, total_price, amount_paid, remaining_balance, status, package_option, pax_count, slot_assignment, villas(name), villa_id")
        .eq("guest_id", inputToken.trim().toUpperCase())
        .maybeSingle();

      if (error) throw error;

      if (data) {
        const record = data as unknown as ClientBooking;
        
        // 🚀 CRITICAL CHECK: Verify if the management team has already archived or completed this ledger block
        if (['completed', 'archived', 'cancelled'].includes(record.status.toLowerCase())) {
          setIsLocked(true);
          setBooking(record); // Preserve references for the locked feedback viewport screen
          return;
        }

        setBooking(record);
        setFormName(record.customer_name);
        setFormPhone(record.customer_phone);
        setFormPax(record.pax_count);
        setFormPkg(record.package_option);
        setFormSlot(record.slot_assignment);
        setFormDate(record.event_date); 
      } else {
        alert("No active upcoming stay matching this verification Guest ID token hash found.");
      }
    } catch (err) {
      console.error(err);
      alert("Error tracking structural reservation reference parameters.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!booking || isLocked) return;
    setLoading(true);

    try {
      if (formDate !== booking.event_date || formSlot !== booking.slot_assignment) {
        const { data: conflicts, error: checkError } = await supabase
          .from("bookings")
          .select("id, slot_assignment, package_option")
          .eq("villa_id", booking.villa_id)
          .eq("event_date", formDate)
          .neq("id", booking.id) 
          .in("status", ["pending_verification", "confirmed"]);

        if (checkError) throw checkError;

        if (conflicts && conflicts.length > 0) {
          const isTargetAccomodation = formPkg === "accommodation_only";
          const hitOverlapConflict = conflicts.some(c => 
            isTargetAccomodation || 
            c.package_option === "accommodation_only" || 
            c.slot_assignment === formSlot
          );

          if (hitOverlapConflict) {
            alert("⚠️ Scheduling Lockout Conflict: The requested date or specific timeframe slot is already reserved or undergoing verification by another party.");
            setLoading(false);
            return;
          }
        }
      }

      const { error: approvalError } = await supabase
        .from("booking_changes_approval")
        .insert([
          {
            booking_id: booking.id,
            proposed_changes: {
              after: {
                customer_name: formName,
                customer_phone: formPhone,
                event_date: formDate,
                slot_assignment: formSlot,
                pax_count: Number(formPax),
                package_option: formPkg
              }
            },
            status: 'pending'
          }
        ]);

      if (approvalError) throw approvalError;

      await supabase
        .from("booking_audit_history")
        .insert([{
          booking_id: booking.id,
          type: "data_edit",
          status: "pending_approval",
          summary: `Proposed data edits: Name (${formName}), Date (${formDate}), Slot (${formSlot}), Pax (${formPax})`
        }]);

      alert("Modifications queued! Changes require Owner confirmation before updating your active voucher values.");
    } catch (err) {
      console.error(err);
      alert("Failed updating contract properties variables items maps parameters.");
    } finally {
      setLoading(false);
    }
  };

  const handleInstallmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!booking || isLocked || paymentAmount <= 0 || !refNum.trim() || !accName.trim()) {
      alert("Please ensure financial references parameters fields tokens are fully input.");
      return;
    }

    const fileInput = document.getElementById('receipt-file-picker') as HTMLInputElement;
    if (!fileInput?.files || fileInput.files.length === 0) {
      alert("Kindly attach the official online banking digital cash receipt snapshot screenshot file.");
      return;
    }

    setUploading(true);
    const file = fileInput.files[0];
    const fileExt = file.name.split('.').pop();
    const filePath = `receipts/installment-${booking.id}-${Date.now().toString().slice(-4)}.${fileExt}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from('booking-attachments')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { error: updateError } = await supabase
        .from("bookings")
        .update({ status: "pending_verification" })
        .eq("id", booking.id);

      if (updateError) throw updateError;

      await supabase
        .from("booking_audit_history")
        .insert([{
          booking_id: booking.id,
          type: "payment_installment",
          amount_paid: Number(paymentAmount),
          reference_number: refNum.trim(),
          account_name: accName.trim(),
          receipt_file_path: filePath,
          status: "pending_approval", 
          summary: `Submitted an installment payment request of ₱${Number(paymentAmount).toLocaleString()}`
        }]);

      alert(`Installment payment successfully submitted! Values will display once confirmed by resort management.`);
      window.location.reload();
    } catch (err) {
      console.error(err);
      alert("Failed processing network gateway transaction write ledger blocks.");
    } finally {
      setUploading(false);
    }
  };

  const handleInitiateCancellation = async () => {
    if (!booking || isLocked) return;

    const stayDate = new Date(booking.event_date);
    const today = new Date();
    const differenceInTime = stayDate.getTime() - today.getTime();
    const differenceInDays = Math.ceil(differenceInTime / (1000 * 3600 * 24));
    
    let warningMessage = "";
    if (differenceInDays < 7) {
      warningMessage = `⚠️ POLICY WARNING: Your scheduled stay is in ${differenceInDays} days (less than 7 days).\n\nCancelling now forfeits your 50% down payment deposit (₱${(booking.total_price * 0.5).toLocaleString()}).\n\n`;
    } else {
      warningMessage = `Your stay is in ${differenceInDays} days. You are eligible for a penalty-free cancellation review.\n\n`;
    }

    if (!confirm(`${warningMessage}Are you sure you want to request a cancellation for this booking? This will notify resort administrators.`)) {
      return;
    }

    setLoading(true);
    try {
      const { error: approvalError } = await supabase
        .from("booking_changes_approval")
        .insert([
          {
            booking_id: booking.id,
            proposed_changes: {
              after: {
                status: 'cancelled_request_pending'
              }
            },
            status: 'pending'
          }
        ]);

      if (approvalError) throw approvalError;

      await supabase
        .from("booking_audit_history")
        .insert([{
          booking_id: booking.id,
          type: "cancellation_request",
          status: "pending_approval",
          summary: `Requested a complete stay cancellation ticket (${differenceInDays} days before stay)`
        }]);

      alert("Your cancellation request has been submitted to management for verification.");
      window.location.reload();
    } catch (err) {
      console.error(err);
      alert("Failed to process cancellation request.");
    } finally {
      setLoading(false);
    }
  };

  // 🚀 NEW: RENDER LOCKOUT FEEDBACK IF DOSSIER IS COMPLETED OR ARCHIVED
  if (booking && isLocked) {
    return (
      <main className="max-w-md mx-auto px-4 py-24 font-sans antialiased text-zinc-800 space-y-6 text-center animate-fadeIn">
        <div className="rounded-[2.5rem] border bg-white p-8 shadow-xl space-y-5">
          <div className="h-16 w-16 bg-red-50 text-red-600 rounded-3xl flex items-center justify-center border border-red-100 mx-auto shadow-sm">
            <Lock className="w-6 h-6 animate-pulse" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-xl font-black text-zinc-950 uppercase tracking-tight">Voucher File Locked</h2>
            <p className="text-xs text-zinc-400 font-medium leading-relaxed max-w-xs mx-auto">
              This reservation dossier (Guest ID: <span className="font-mono font-bold text-zinc-700">#{booking.guest_id}</span>) has been marked as <span className="font-bold underline text-zinc-800 uppercase">{booking.status}</span> by the resort staff.
            </p>
          </div>
          <div className="p-3 bg-zinc-50 border rounded-xl text-[11px] font-mono text-zinc-500 text-left space-y-1">
            <p>• Lead Name: {booking.customer_name}</p>
            <p>• Stay Date: {booking.event_date}</p>
            <p>• File State: IMMUTABLE HISTORICAL ARCHIVE</p>
          </div>
          <p className="text-[11px] text-zinc-400 leading-normal px-2">
            To prevent accidental data corruption or layout conflicts, completed or cancelled records cannot be modified or updated by guests. Please contact our support team if you need further help.
          </p>
          <button 
            onClick={() => { setBooking(null); setIsLocked(false); setInputToken(''); }} 
            className="w-full bg-zinc-950 text-white font-black py-3 rounded-xl tracking-wider uppercase text-xs shadow hover:bg-emerald-600 transition"
          >
            Return to Verification Login
          </button>
        </div>
      </main>
    );
  }

  if (!booking) {
    return (
      <main className="max-w-md mx-auto px-4 py-24 font-sans antialiased text-zinc-800 space-y-6 animate-fadeIn">
        <div className="text-center space-y-2">
          <div className="h-12 w-12 bg-emerald-50 rounded-2xl border flex items-center justify-center text-emerald-600 mx-auto shadow-sm">
            <Key className="w-5 h-5" />
          </div>
          <h2 className="text-2xl font-black text-zinc-950 tracking-tight uppercase">Reservation Passkey</h2>
          <p className="text-xs text-zinc-400 font-medium max-w-xs mx-auto">Input the distinct Guest ID token issued during checkout or found on your printable stay voucher invoice.</p>
        </div>

        <form onSubmit={handleVerifyToken} className="bg-white border rounded-3xl p-5 shadow-sm space-y-4">
          <div>
            <label className="block text-[10px] uppercase font-black text-zinc-400 tracking-wider mb-1.5">Enter Guest ID Code</label>
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 pointer-events-none" />
              <input
                type="text"
                required
                value={inputToken}
                onChange={e => setInputToken(e.target.value)}
                placeholder="e.g., GUEST-73B91A"
                className="w-full border border-zinc-200 rounded-xl bg-zinc-50/50 pl-10 pr-4 py-3 text-sm font-black text-zinc-900 tracking-wider uppercase placeholder:normal-case placeholder:font-medium focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-zinc-950 text-white font-black py-3 rounded-xl hover:bg-emerald-600 transition shadow-md text-xs uppercase tracking-widest"
          >
            {loading ? 'Authorizing Crypt Block...' : 'Retrieve Stay Dossier'}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-4 py-12 font-sans antialiased text-zinc-800 space-y-8 animate-fadeIn">
      
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b pb-4">
        <div>
          <span className="text-xs font-black uppercase bg-emerald-50 border text-emerald-700 rounded-md px-2.5 py-0.5 tracking-wide font-mono inline-block mb-1">
            Active Authorization: #{booking.guest_id}
          </span>
          <h2 className="text-2xl font-black text-zinc-950 uppercase tracking-tight">Stay Management Portal</h2>
        </div>
        <button 
          onClick={() => setBooking(null)} 
          className="text-xs font-bold text-zinc-400 hover:text-red-500 border rounded-xl px-3 py-1.5 bg-white shadow-sm self-start transition"
        >
          🔒 Lock & Clear Session
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        
        <div className="space-y-6">
          <div className="bg-white border rounded-[2rem] p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-black uppercase text-zinc-400 tracking-wider flex items-center gap-1.5 border-b pb-2">
              <FileText className="w-4 h-4 text-emerald-600" /> Propose Stay Amendments
            </h3>

            <form onSubmit={handleSaveChanges} className="grid gap-4 sm:grid-cols-2 text-xs font-semibold">
              <div className="sm:col-span-2 p-3 bg-amber-50 border border-amber-100 rounded-xl text-amber-800 flex items-start gap-2 font-medium">
                <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>Modifying variables here will not change your actual active voucher parameters until resort managers verify the layout parameters manually.</span>
              </div>

              <div>
                <label className="block text-zinc-500 uppercase text-[10px] mb-1">Lead Guest Name</label>
                <input type="text" required value={formName} onChange={e => setFormName(e.target.value)} className="w-full border rounded-xl bg-zinc-50 px-3 py-2.5 text-sm font-bold text-zinc-900 focus:outline-none focus:border-emerald-500" />
              </div>

              <div>
                <label className="block text-zinc-500 uppercase text-[10px] mb-1">Contact Handset digits</label>
                <input type="text" required value={formPhone} onChange={e => setFormPhone(e.target.value)} className="w-full border rounded-xl bg-zinc-50 px-3 py-2.5 text-sm font-mono font-bold text-zinc-900 focus:outline-none focus:border-emerald-500" />
              </div>

              <div>
                <label className="block text-zinc-500 uppercase text-[10px] mb-1">Scheduled Stay Allocation Date</label>
                <input 
                  type="date" 
                  required 
                  value={formDate} 
                  onChange={e => setFormDate(e.target.value)} 
                  className="w-full border rounded-xl bg-zinc-50 px-3 py-2.5 text-sm font-bold text-zinc-900 focus:outline-none focus:border-emerald-500" 
                />
              </div>

              <div>
                <label className="block text-zinc-500 uppercase text-[10px] mb-1">Target Booking Time Slot</label>
                <select value={formSlot} onChange={e => setFormSlot(e.target.value)} className="w-full border rounded-xl bg-zinc-50 px-3 py-2.5 text-sm font-bold text-zinc-900 focus:outline-none focus:border-emerald-500">
                  <option value="day">Day Timeframe slot</option>
                  <option value="evening">Evening Timeframe slot</option>
                </select>
              </div>

              <div>
                <label className="block text-zinc-500 uppercase text-[10px] mb-1">Target Selected Package Tier</label>
                <select value={formPkg} onChange={e => setFormPkg(e.target.value)} className="w-full border rounded-xl bg-zinc-50 px-3 py-2.5 text-sm font-bold text-zinc-900 focus:outline-none focus:border-emerald-500">
                  <option value="with_catering">Package Matrix: With Catering</option>
                  <option value="venue_only">Package Matrix: Venue Space Only</option>
                  <option value="accommodation_only">Package Matrix: Accommodation stay unit</option>
                </select>
              </div>

              <div>
                <label className="block text-zinc-500 uppercase text-[10px] mb-1">Expected Guest Headcount</label>
                <input type="number" required value={formPax} onChange={e => setFormPax(Number(e.target.value))} className="w-full border rounded-xl bg-zinc-50 px-3 py-2.5 text-sm font-mono font-bold text-zinc-900 focus:outline-none focus:border-emerald-500" />
              </div>

              <div className="sm:col-span-2 pt-2">
                <button type="submit" disabled={loading} className="bg-zinc-900 text-white font-bold px-5 py-2.5 rounded-xl text-xs uppercase tracking-wider hover:bg-emerald-600 shadow-sm transition">
                  {loading ? 'Validating Availability...' : 'Submit Proposed Amendments'}
                </button>
              </div>
            </form>
          </div>

          <div className="bg-red-50/50 border border-red-100 rounded-[2rem] p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-black uppercase text-red-950 tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-red-600" /> Cancel Reservation
            </h3>
            <p className="text-xs text-red-800 leading-relaxed font-semibold">
              Reservations can be rescheduled free of charge up to 7 days before your scheduled stay, subject to availability. Cancellations made within 7 days of the event date forfeit the 50% deposit down payment.
            </p>
            <button
              type="button"
              onClick={handleInitiateCancellation}
              className="bg-red-600 hover:bg-red-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs uppercase tracking-wider shadow-sm transition"
            >
              Request Cancellation
            </button>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-zinc-950 text-white rounded-[2rem] p-6 shadow-xl space-y-4 relative overflow-hidden">
            <div className="space-y-0.5">
              <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest block mb-0.5">Confirmed Account Summary</span>
              <h4 className="text-xl font-black text-white tracking-tight">{booking.villas?.name || "Resort Villa Suite Room"}</h4>
              <p className="text-xs text-zinc-400 font-medium">Status Flag: <span className="font-bold text-white uppercase underline">{booking.status.replace('_', ' ')}</span></p>
            </div>

            <div className="border-t border-zinc-900 pt-4 space-y-2.5 font-mono text-xs">
              <div className="flex justify-between text-zinc-400">
                <span>Gross Value Contract:</span>
                <span className="font-bold text-white">₱{booking.total_price.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
              </div>
              <div className="flex justify-between text-zinc-500">
                <span>↳ Total Settled Ledger:</span>
                <span className="font-bold text-emerald-400">₱{booking.amount_paid.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
              </div>
              <div className="flex justify-between border-t border-dashed border-zinc-800 pt-2.5 text-sm">
                <span className="font-bold uppercase tracking-wide text-zinc-300">Remaining Balance:</span>
                <span className="font-black text-amber-400">₱{booking.remaining_balance.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
              </div>
            </div>
          </div>

          {booking.remaining_balance > 0 ? (
            <div className="space-y-6">
              
              <div className="bg-white border rounded-[2rem] p-5 shadow-sm space-y-4">
                <div>
                  <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Official Payment Terminal</h4>
                  <p className="text-[11px] text-zinc-500 mt-1">Please use the active configurations below to process your transfer:</p>
                </div>

                <div className="grid grid-cols-2 gap-2 p-1 bg-zinc-100 rounded-xl border text-xs font-bold">
                  <button type="button" onClick={() => setSelectedChannel('gcash')} className={`py-2 rounded-lg transition-all ${selectedChannel === 'gcash' ? 'bg-emerald-600 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-800'}`}>📱 GCash Wallet</button>
                  <button type="button" onClick={() => setSelectedChannel('bpi')} className={`py-2 rounded-lg transition-all ${selectedChannel === 'bpi' ? 'bg-emerald-600 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-800'}`}>🏦 Bank Transfer</button>
                </div>

                {fetchingGateways ? (
                  <p className="text-xs text-zinc-400 animate-pulse text-center py-4">Syncing payment endpoints...</p>
                ) : !activeGateway ? (
                  <p className="text-xs text-zinc-400 italic text-center py-4">Gateway configuration values empty.</p>
                ) : (
                  <div className="rounded-2xl border border-zinc-100 p-4 bg-zinc-50/50 flex flex-col items-center gap-4 text-center animate-fadeIn">
                    {activeGateway.qrUrl && (
                      <div className="w-full max-w-[180px] aspect-square bg-white border border-zinc-200 rounded-xl p-2 shadow-sm">
                        <img src={activeGateway.qrUrl} alt="Scan to pay" className="h-full w-full object-contain" />
                      </div>
                    )}
                    <div className="w-full text-xs font-semibold space-y-1">
                      <p className="text-[9px] uppercase tracking-wider text-zinc-400">Account Name:</p>
                      <p className="font-black text-zinc-900 uppercase text-sm">{activeGateway.account_name}</p>
                      <p className="text-[9px] uppercase tracking-wider text-zinc-400 pt-1">Account / Mobile Number:</p>
                      <p className="font-mono font-black text-zinc-900 bg-white border rounded-lg px-2.5 py-1 w-fit mx-auto select-all shadow-sm">{activeGateway.account_number}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-white border rounded-[2rem] p-5 shadow-sm space-y-4">
                <h3 className="text-sm font-black uppercase text-zinc-400 tracking-wider flex items-center gap-1.5 border-b pb-2">
                  <CreditCard className="w-4 h-4 text-emerald-600" /> Submit Remittance Parameters
                </h3>

                <form onSubmit={handleInstallmentSubmit} className="space-y-3.5 text-xs font-semibold">
                  <div>
                    <label className="block mb-1 text-zinc-500 uppercase text-[10px]">Installment Cash Value (PHP)</label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={booking.remaining_balance}
                      value={paymentAmount}
                      onChange={e => setPaymentAmount(Number(e.target.value))}
                      placeholder="Enter cash payment transaction value"
                      className="w-full border rounded-xl bg-zinc-50 px-3 py-2.5 font-mono font-bold text-emerald-600 text-sm focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block mb-1 text-zinc-500 uppercase text-[10px]">Reference Tracking ID Code *</label>
                    <input
                      type="text"
                      required
                      value={refNum}
                      onChange={e => setRefNum(e.target.value.replace(/\s+/g, ''))}
                      placeholder="Input reference hash/ID number token"
                      className="w-full border rounded-xl bg-zinc-50 px-3 py-2.5 font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block mb-1 text-zinc-500 uppercase text-[10px]">Sender Account Registered Name *</label>
                    <input
                      type="text"
                      required
                      value={accName}
                      onChange={e => setAccName(e.target.value)}
                      placeholder="Gcash or Bank Account Name"
                      className="w-full border rounded-xl bg-zinc-50 px-3 py-2.5 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block mb-1 text-zinc-500 uppercase text-[10px]">Attach Transaction Screenshot Receipt *</label>
                    <input
                      id="receipt-file-picker"
                      type="file"
                      required
                      accept="image/*"
                      className="w-full text-xs text-zinc-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={uploading || paymentAmount <= 0}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl transition shadow-md uppercase tracking-wider text-[11px]"
                  >
                    {uploading ? 'Uploading Transaction Attachments...' : 'Confirm Remittance Form'}
                  </button>
                </form>
              </div>

            </div>
          ) : (
            <div className="bg-emerald-50/60 border border-emerald-200 rounded-[2rem] p-6 text-center space-y-2 animate-fadeIn">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
              <div className="space-y-0.5">
                <p className="text-emerald-950 font-black uppercase tracking-wide text-xs">Stay Fully Settled</p>
                <p className="text-emerald-600 text-[11px] font-medium leading-normal max-w-xs mx-auto">Your account balance ledger is fully cleared. Thank you for processing your payments on time.</p>
              </div>
            </div>
          )}

        </div>

      </div>
    </main>
  );
}
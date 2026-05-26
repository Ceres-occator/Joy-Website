'use client'

import { useSearchParams, useRouter, useParams } from 'next/navigation';
import { useState, useRef, useEffect, useMemo } from 'react';
import { createClient } from "@/utils/supabase/client";

export default function PaymentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams();
  
  const villaId = params.villaId as string;

  const villaTitle = searchParams.get('villaTitle') || 'Selected Villa';
  const fullName = searchParams.get('fullName') || '';
  const phone = searchParams.get('phone') || '';
  const eventDate = searchParams.get('eventDate') || '';
  const timeSlot = searchParams.get('timeSlot') || 'day';
  const totalPrice = Number(searchParams.get('price') || 0);
  
  const paxCount = searchParams.get('paxCount') || '0';
  const packageOption = searchParams.get('packageOption') || '';
  const includeOvernight = searchParams.get('includeOvernight') || 'false';
  const overnightPaxCount = searchParams.get('overnightPaxCount') || '0';

  const [accountName, setAccountName] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [idFile, setIdFile] = useState<File | null>(null);
  const [paymentMode, setPaymentMode] = useState<'half' | 'full'>('half');

  // 🌟 NEW STATE: Tracks selected channel ('gcash' or 'bpi')
  const [selectedChannel, setSelectedChannel] = useState<'gcash' | 'bpi'>('gcash');

  const [liveGateways, setLiveGateways] = useState<any[]>([]);
  const [fetchingGateways, setFetchingGateways] = useState(true);

  const receiptInputRef = useRef<HTMLInputElement>(null);
  const idInputRef = useRef<HTMLInputElement>(null);

  const [submitting, setSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const computedAmountPaid = paymentMode === 'full' ? totalPrice : totalPrice * 0.5;
  const computedRemainingBalance = totalPrice - computedAmountPaid;

  const isReferenceValid = useMemo(() => referenceNumber.trim().length >= 7, [referenceNumber]);

  const canSubmit = 
    accountName.trim().length > 0 && 
    isReferenceValid && 
    receiptFile !== null && 
    idFile !== null && 
    !submitting;

  useEffect(() => {
    async function fetchGateways() {
      try {
        const supabase = createClient();
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
        console.error(err);
      } finally {
        setFetchingGateways(false);
      }
    }
    fetchGateways();
  }, []);

  // 🌟 COMPUTED FILTER: Only returns the gateway matching the selected active channel toggle
  const activeGateway = useMemo(() => {
    return liveGateways.find(gate => gate.id === selectedChannel);
  }, [liveGateways, selectedChannel]);

  const handleBookingVerificationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setApiError(null);

    try {
      const supabase = createClient();
      const receiptExt = receiptFile.name.split('.').pop();
      const receiptPath = `receipts/receipt_${villaId}_${Date.now()}.${receiptExt}`;
      const { error: rxErr } = await supabase.storage.from('booking-attachments').upload(receiptPath, receiptFile);
      if (rxErr) throw new Error(rxErr.message);

      const idExt = idFile.name.split('.').pop();
      const idPath = `ids/id_${villaId}_${Date.now()}.${idExt}`;
      const { error: idErr } = await supabase.storage.from('booking-attachments').upload(idPath, idFile);
      if (idErr) throw new Error(idErr.message);

      const response = await fetch('/api/booking/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          villaId, fullName, phone, eventDate, timeSlot, paxCount, packageOption,
          includeOvernight: String(includeOvernight) === 'true',
          overnightPaxCount: Number(overnightPaxCount),
          totalPrice, paymentMode, amountPaid: computedAmountPaid, remainingBalance: computedRemainingBalance,
          referenceNumber, accountName, receiptFilePath: receiptPath, idFilePath: idPath
        })
      });
      if (!response.ok) throw new Error('Failed parsing registry hooks.');
      setIsSuccess(true);
    } catch (err: any) {
      setApiError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="mx-auto max-w-2xl p-4 mt-6 animate-fadeIn">
        <div className="rounded-[2.5rem] border bg-white p-8 shadow-xl text-center space-y-6">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl">🎉</div>
          <h2 className="text-2xl font-black text-zinc-900 tracking-tight">Booking Registration Success!</h2>
          <div className="rounded-2xl bg-zinc-50 border p-6 text-left space-y-3.5 text-sm font-semibold">
            <div className="flex justify-between"><span>Renter Guest:</span><span className="text-zinc-900 font-bold">{fullName}</span></div>
            <div className="flex justify-between"><span>Property Unit:</span><span className="text-zinc-900 font-bold">{villaTitle}</span></div>
            <div className="flex justify-between"><span>Target Date:</span><span className="text-zinc-900 font-bold">{eventDate} ({timeSlot})</span></div>
            <div className="flex justify-between border-t pt-4"><span>Gross Contract total:</span><span className="text-zinc-900">₱{totalPrice.toLocaleString()}</span></div>
            <div className="flex justify-between text-base border-b pb-3 text-emerald-600 font-black"><span>Settled Now:</span><span>₱{computedAmountPaid.toLocaleString()}</span></div>
            <div className="flex justify-between bg-amber-50 p-3 rounded-xl border border-amber-200 text-amber-900 font-black"><span>Remaining Balance Due:</span><span>₱{computedRemainingBalance.toLocaleString()}</span></div>
          </div>
          <button onClick={() => router.push('/')} className="w-full rounded-full bg-emerald-600 py-3.5 text-xs font-bold text-white transition hover:bg-emerald-700 uppercase tracking-wider">Return to Home Catalog</button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl w-full p-2 sm:p-6 mt-2 animate-fadeIn">
      <div className="rounded-[2.5rem] border border-zinc-200 bg-white p-6 md:p-10 shadow-xl space-y-6">
        
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-zinc-400">Checkout Step</p>
          <h2 className="text-2xl md:text-3xl font-black text-zinc-900 tracking-tight">Settle Down Payment</h2>
        </div>

        {/* TOP LEVEL METRICS SELECTION GRID CODES */}
        <div className="grid gap-4 md:grid-cols-2 max-w-2xl">
          <div className="space-y-2">
            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider">Choose Payment Strategy</label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-zinc-100 rounded-xl border">
              <button type="button" onClick={() => setPaymentMode('half')} className={`py-2 text-xs font-bold rounded-lg transition-all ${paymentMode === 'half' ? 'bg-emerald-600 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-800'}`}>Pay 50% Deposit</button>
              <button type="button" onClick={() => setPaymentMode('full')} className={`py-2 text-xs font-bold rounded-lg transition-all ${paymentMode === 'full' ? 'bg-emerald-600 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-800'}`}>Pay Full Amount</button>
            </div>
          </div>

          {/* 🌟 NEW INTERACTIVE TOGGLE: SELECT CHANNELS HUB */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider">Select Payment Method</label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-zinc-100 rounded-xl border">
              <button type="button" onClick={() => setSelectedChannel('gcash')} className={`py-2 text-xs font-bold rounded-lg transition-all ${selectedChannel === 'gcash' ? 'bg-emerald-600 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-800'}`}>📱 GCash Wallet</button>
              <button type="button" onClick={() => setSelectedChannel('bpi')} className={`py-2 text-xs font-bold rounded-lg transition-all ${selectedChannel === 'bpi' ? 'bg-emerald-600 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-800'}`}>🏦 Bank Transfer</button>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-zinc-50 border p-4 text-xs font-bold flex justify-between items-center max-w-md shadow-inner">
          <span className="text-zinc-500">Amount Due Now:</span>
          <span className="text-emerald-600 text-xl font-black">₱{computedAmountPaid.toLocaleString()}</span>
        </div>

        <div className="grid gap-8 lg:grid-cols-2 pt-4 border-t items-start">
          
          {/* DYNAMIC ISOLATED PAYMENT GATEWAY VIEW */}
          <div className="space-y-4">
            <div>
              <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Official Payment Terminal</h4>
              <p className="text-xs text-zinc-500 mt-1">Please use the exact details generated below to complete your transfer:</p>
            </div>

            {fetchingGateways ? (
              <p className="text-xs text-zinc-400 animate-pulse py-6">Syncing payment endpoints...</p>
            ) : !activeGateway ? (
              <p className="text-xs text-zinc-400 italic py-6">Gateway terminal settings misconfigured in admin panel.</p>
            ) : (
              // 🌟 CONDITIONAL DYNAMIC DISPLAY CARD CONTAINER
              <div className="rounded-3xl border border-zinc-200/60 p-6 bg-gradient-to-br from-zinc-50/50 to-white flex flex-col items-center gap-5 text-center shadow-sm animate-fadeIn">
                <div className="w-full flex justify-start">
                  <span className={`font-extrabold tracking-wide uppercase text-[9px] px-2 py-0.5 rounded border ${activeGateway.id === 'gcash' ? 'text-blue-600 bg-blue-50 border-blue-100' : 'text-emerald-700 bg-emerald-50 border-emerald-100'}`}>
                    {activeGateway.id === 'gcash' ? '📱 ' : '🏦 '} {activeGateway.provider_name}
                  </span>
                </div>

                {activeGateway.qrUrl && (
                  <div className="w-full max-w-[250px] md:max-w-[320px] aspect-square bg-white border-2 border-zinc-200 rounded-2xl p-3 overflow-hidden shadow-md group relative hover:border-emerald-500 transition-all duration-300 ring-4 ring-emerald-600/5">
                    <a href={activeGateway.qrUrl} target="_blank" rel="noreferrer" className="block w-full h-full">
                      <img src={activeGateway.qrUrl} alt="Scan to pay" className="h-full w-full object-contain cursor-zoom-in" />
                    </a>
                  </div>
                )}
                
                <div className="w-full space-y-1 bg-zinc-50/60 p-3 rounded-xl border border-zinc-200/50">
                  <p className="text-zinc-400 text-[10px] uppercase font-bold tracking-wider">Official Account Name:</p>
                  <p className="font-black text-zinc-800 uppercase tracking-tight text-sm">{activeGateway.account_name}</p>
                  <p className="text-zinc-400 text-[10px] uppercase font-bold tracking-wider pt-1">Account / Reference Number (Tap to copy):</p>
                  <p className="font-mono font-black text-sm text-zinc-950 bg-white border border-zinc-200 px-3 py-1 mt-1 rounded-xl mx-auto w-fit select-all tracking-wider shadow-sm">{activeGateway.account_number}</p>
                </div>
              </div>
            )}
            
            {paymentMode === 'half' && (
              <div className="text-xs text-amber-800 bg-amber-50/60 p-4 rounded-xl border border-amber-200/60 leading-relaxed font-semibold">
                📌 <strong>Check-In Note:</strong> Your remaining unpaid bill component of ₱{computedRemainingBalance.toLocaleString()} will be securely collected in cash or check straight upon arrival key handover.
              </div>
            )}
          </div>

          {/* FORM UPLOAD INPUT COLUMN */}
          <form onSubmit={handleBookingVerificationSubmit} className="space-y-4 bg-zinc-50/30 border p-5 rounded-[2rem]">
            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">Submit Remittance Parameters</h4>
            
            <div>
              <label className="mb-1 block text-xs font-bold text-zinc-700 uppercase">Sender Account Name *</label>
              <input type="text" required value={accountName} onChange={e => setAccountName(e.target.value)} placeholder="Name printed on receipt source account" className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none" />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-zinc-700 uppercase">Reference Tracking ID Code *</label>
              <input type="text" required value={referenceNumber} onChange={e => setReferenceNumber(e.target.value.replace(/\s+/g, ''))} placeholder="Enter transaction reference string" className={`w-full rounded-xl border px-4 py-3 bg-white focus:outline-none text-sm font-mono tracking-wider ${referenceNumber && !isReferenceValid ? 'border-red-400 focus:border-red-500' : 'border-zinc-200 focus:border-emerald-500'}`} />
              {referenceNumber && !isReferenceValid && <p className="text-[11px] text-red-500 font-semibold mt-1">⚠️ System threshold requires at least 7 characters.</p>}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-bold text-zinc-700 uppercase">Proof Screenshot *</label>
                <input type="file" ref={receiptInputRef} accept="image/*" className="hidden" onChange={e => setReceiptFile(e.target.files?.[0] || null)} />
                <div onClick={() => receiptInputRef.current?.click()} className={`border-2 border-dashed rounded-xl p-4 text-center text-xs transition font-bold cursor-pointer select-none ${receiptFile ? 'border-emerald-400 bg-emerald-50 text-emerald-800' : 'border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-400'}`}>{receiptFile ? '✅ Loaded' : '📁 Upload Receipt'}</div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-zinc-700 uppercase">Valid Guest ID Card *</label>
                <input type="file" ref={idInputRef} accept="image/*" className="hidden" onChange={e => setIdFile(e.target.files?.[0] || null)} />
                <div onClick={() => idInputRef.current?.click()} className={`border-2 border-dashed rounded-xl p-4 text-center text-xs transition font-bold cursor-pointer select-none ${idFile ? 'border-emerald-400 bg-emerald-50 text-emerald-800' : 'border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-400'}`}>{idFile ? '✅ Attached ID' : '🆔 Upload ID picture'}</div>
              </div>
            </div>

            {apiError && <p className="text-xs font-semibold text-red-500 bg-red-50 border p-3 rounded-xl">⚠️ {apiError}</p>}

            <button type="submit" disabled={!canSubmit} className={`w-full rounded-full py-3.5 text-xs font-bold text-white transition uppercase tracking-wider shadow-md ${canSubmit ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-zinc-200 text-zinc-400 cursor-not-allowed shadow-none'}`}>
              {submitting ? 'Registering Transaction...' : 'Confirm Remittance Form'}
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}
'use client'

import { useSearchParams, useRouter, useParams } from 'next/navigation';
import { useState, useRef, useEffect, useMemo } from 'react';
import { createClient } from "@/utils/supabase/client";

export default function PaymentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams();
  
  const villaId = params.villaId as string;

  // --- UNPACK REVENUE PARAMETERS FROM THE URL ---
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

  // --- FORM INPUT STATES ---
  const [accountName, setAccountName] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [idFile, setIdFile] = useState<File | null>(null);
  
  // Payment Ratio Mode Tracking State
  const [paymentMode, setPaymentMode] = useState<'half' | 'full'>('half');

  // Dynamic Payment Gateway Channels State Array
  const [liveGateways, setLiveGateways] = useState<any[]>([]);
  const [fetchingGateways, setFetchingGateways] = useState(true);

  const receiptInputRef = useRef<HTMLInputElement>(null);
  const idInputRef = useRef<HTMLInputElement>(null);

  // --- ACTION MANAGEMENT STATES ---
  const [submitting, setSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Math Metrics Computations
  const computedAmountPaid = paymentMode === 'full' ? totalPrice : totalPrice * 0.5;
  const computedRemainingBalance = totalPrice - computedAmountPaid;

  // 🛡️ VALIDATION HOOKS: Reference verification pattern parameters
  const isReferenceValid = useMemo(() => referenceNumber.trim().length >= 7, [referenceNumber]);

  const canSubmit = 
    accountName.trim().length > 0 && 
    isReferenceValid && 
    receiptFile !== null && 
    idFile !== null && 
    !submitting;

  // Fetch Database Configured Accounts and QR Images on Mount
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
        console.error("Failed to load payment credentials from database rows:", err);
      } finally {
        setFetchingGateways(false);
      }
    }
    fetchGateways();
  }, []);

  // --- LIVE BACKEND API TRANSACTION CARRIER SUBMIT HANDLER ---
  const handleBookingVerificationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    
    setSubmitting(true);
    setApiError(null);

    try {
      const supabase = createClient();
      
      const receiptExt = receiptFile.name.split('.').pop();
      const receiptPath = `receipts/receipt_${villaId}_${Date.now()}.${receiptExt}`;
      
      const { error: receiptUploadError } = await supabase.storage
        .from('booking-attachments')
        .upload(receiptPath, receiptFile);

      if (receiptUploadError) throw new Error(`Receipt upload failure: ${receiptUploadError.message}`);

      const idExt = idFile.name.split('.').pop();
      const idPath = `ids/id_${villaId}_${Date.now()}.${idExt}`;
      
      const { error: idUploadError } = await supabase.storage
        .from('booking-attachments')
        .upload(idPath, idFile);

      if (idUploadError) throw new Error(`ID upload failure: ${idUploadError.message}`);

      const response = await fetch('/api/booking/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          villaId,
          fullName,
          phone,
          eventDate,
          timeSlot,
          paxCount,
          packageOption,
          includeOvernight: String(includeOvernight) === 'true',
          overnightPaxCount: Number(overnightPaxCount),
          totalPrice,
          paymentMode,
          amountPaid: computedAmountPaid,
          remainingBalance: computedRemainingBalance,
          referenceNumber,
          accountName,
          receiptFilePath: receiptPath,
          idFilePath: idPath
        })
      });

      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error || 'Failed to submit booking row parameters.');

      setIsSuccess(true);

    } catch (err: any) {
      console.error(err);
      setApiError(err.message || "An unexpected network pipeline error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  // --- WIZARD VIEW A: COMPREHENSIVE SUCCESS INVOICE RECEIPT ---
  if (isSuccess) {
    return (
      <div className="mx-auto max-w-md p-4 sm:p-6 mt-6">
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl space-y-6 text-center animate-fadeIn">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl">🎉</div>
          
          <div className="space-y-1">
            <h2 className="text-xl font-black text-zinc-900">Booking Registration Success!</h2>
            <p className="text-xs text-zinc-500">
              Your payment logs are routed to the verification queue. Review your printable receipt below:
            </p>
          </div>

          <div className="rounded-2xl bg-zinc-50 border border-zinc-200 p-5 text-left text-xs space-y-3 font-medium">
            <h3 className="font-bold border-b pb-2 text-[10px] uppercase tracking-wider text-zinc-400">Official Stay Invoice</h3>
            
            <div className="flex justify-between">
              <span className="text-zinc-500">Renter Guest:</span>
              <span className="font-bold text-zinc-900">{fullName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Property Unit:</span>
              <span className="font-bold text-zinc-900">{villaTitle}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Target Date:</span>
              <span className="font-bold text-zinc-900">{eventDate} ({timeSlot})</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Payment Strategy:</span>
              <span className="font-mono bg-zinc-200/60 px-2 py-0.5 rounded uppercase text-[10px] text-zinc-700">
                Paid in {paymentMode}
              </span>
            </div>

            <div className="border-t pt-3 space-y-2">
              <div className="flex justify-between text-zinc-500">
                <span>Total Gross Contract:</span>
                <span className="font-bold text-zinc-800">₱{totalPrice.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-base font-black border-b pb-2">
                <span className="text-zinc-900">Amount Paid Now:</span>
                <span className="text-emerald-600">₱{computedAmountPaid.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-zinc-900 font-bold pt-1 bg-amber-50 p-2 rounded-xl border border-amber-100">
                <span className="text-amber-800 font-bold">Remaining Bill Due:</span>
                <span className="font-mono text-amber-700 font-black">₱{computedRemainingBalance.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => router.push('/')}
            className="w-full rounded-full bg-zinc-950 py-3 text-xs font-bold text-white transition hover:bg-zinc-800 shadow-md uppercase tracking-wider"
          >
            Return to Home Catalog
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md p-4 sm:p-6 mt-2 space-y-6 animate-fadeIn">
      <form onSubmit={handleBookingVerificationSubmit} className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl space-y-6">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-zinc-400">Checkout Step</p>
          <h2 className="text-2xl font-bold text-zinc-900">Settle Payment</h2>
        </div>

        {/* INTERACTIVE FULL OR HALF CHOICE TOGGLE TABS */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider">Choose Payment Strategy</label>
          <div className="grid grid-cols-2 gap-2 p-1 bg-zinc-100 rounded-xl border">
            <button
              type="button"
              onClick={() => setPaymentMode('half')}
              className={`py-2 text-xs font-bold rounded-lg transition-all ${paymentMode === 'half' ? 'bg-emerald-600 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-800'}`}
            >
              Pay 50% Deposit
            </button>
            <button
              type="button"
              onClick={() => setPaymentMode('full')}
              className={`py-2 text-xs font-bold rounded-lg transition-all ${paymentMode === 'full' ? 'bg-emerald-600 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-800'}`}
            >
              Pay Full Amount
            </button>
          </div>
        </div>

        {/* Numerical Fee Overview Display Box */}
        <div className="rounded-2xl bg-zinc-50 border border-zinc-100 p-4 text-xs font-medium space-y-2">
          <div className="flex justify-between text-zinc-500">
            <span>Total Contract Settle Price:</span>
            <span>₱{totalPrice.toLocaleString()}</span>
          </div>
          <div className="flex justify-between font-bold text-zinc-900 text-sm border-t pt-2">
            <span>Total Amount Due Now:</span>
            <span className="text-emerald-600 text-base font-black">₱{computedAmountPaid.toLocaleString()}</span>
          </div>
          {paymentMode === 'half' && (
            <div className="text-[10px] text-amber-600 bg-amber-50 p-1.5 rounded-lg border border-amber-100 font-semibold">
              📌 A remaining bill of ₱{computedRemainingBalance.toLocaleString()} will be due in cash upon check-in.
            </div>
          )}
        </div>

        {/* CHANNELS WITH ENLARGED SCANNABLE QR CARDS */}
        <div className="space-y-3 pt-2 border-t border-zinc-100">
          <div>
            <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">Payment Account Channels</h4>
            <p className="text-[11px] text-zinc-500">Scan the QR code or use the account digits below to complete your transfer:</p>
          </div>

          {fetchingGateways ? (
            <p className="text-[11px] text-zinc-400 animate-pulse py-4 text-center">Syncing real-time payment terminal details...</p>
          ) : (
            <div className="grid gap-4 text-[11px]">
              {liveGateways.map((gate) => (
                <div 
                  key={gate.id} 
                  className={`rounded-2xl border p-4 space-y-4 shadow-sm bg-gradient-to-br flex flex-col items-center text-center ${
                    gate.id === 'gcash' 
                      ? 'border-blue-100 from-blue-50/10 to-white' 
                      : 'border-emerald-100 from-emerald-50/10 to-white'
                  }`}
                >
                  <div className="w-full flex justify-start">
                    <span className={`font-extrabold tracking-wide uppercase text-[9px] px-1.5 py-0.5 rounded border ${
                      gate.id === 'gcash' ? 'text-blue-600 bg-blue-50 border-blue-100' : 'text-emerald-700 bg-emerald-50 border-emerald-100'
                    }`}>
                      {gate.id === 'gcash' ? '📱 ' : '🏦 '} {gate.provider_name}
                    </span>
                  </div>

                  {gate.qrUrl && (
                    <div className="w-full max-w-[210px] aspect-square bg-white border-2 border-zinc-200 rounded-2xl p-2.5 overflow-hidden shadow-md group relative hover:border-emerald-500 transition-all duration-300 ring-4 ring-emerald-500/10 animate-pulse-slow">
                      <a href={gate.qrUrl} target="_blank" rel="noreferrer" className="block w-full h-full">
                        <img src={gate.qrUrl} alt="Scan to Pay QR Code" className="h-full w-full object-contain cursor-zoom-in group-hover:scale-[1.02] transition-transform duration-200" />
                      </a>
                    </div>
                  )}
                  
                  <div className="w-full space-y-1 bg-zinc-50/60 p-3 rounded-xl border border-zinc-100">
                    <p className="text-zinc-400 text-[10px]">Official Account Name:</p>
                    <p className="font-black text-zinc-800 uppercase tracking-tight text-xs">{gate.account_name}</p>
                    <p className="text-zinc-400 text-[10px] pt-1">Account / Mobile Number (Tap to copy):</p>
                    <p className="font-mono font-black text-zinc-950 text-sm bg-white border border-zinc-200 px-3 py-1 mt-1 rounded-xl mx-auto w-fit select-all tracking-wider shadow-sm">
                      {gate.account_number}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* INPUT ATTACHMENT UPLOADS */}
        <div className="space-y-4 text-sm pt-2 border-t border-zinc-100">
          <div>
            <label className="mb-1 block font-semibold text-zinc-700">Account Name *</label>
            <input type="text" required value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="Sender Account Name" className="w-full rounded-xl border border-zinc-200 px-4 py-3 bg-zinc-50 focus:border-emerald-500 focus:outline-none text-sm" />
          </div>

          {/* 🌟 UPGRADED VALIDATION CONTAINER CELL (REFERENCE NUMBER) */}
          <div>
            <label className="mb-1 block font-semibold text-zinc-700">Reference Number *</label>
            <input 
              type="text" 
              required 
              value={referenceNumber} 
              onChange={(e) => setReferenceNumber(e.target.value.replace(/\s+/g, ''))} // Strips spaces as they type
              placeholder="Enter reference tracking code" 
              className={`w-full rounded-xl border px-4 py-3 bg-zinc-50 focus:outline-none text-sm font-mono ${
                referenceNumber && !isReferenceValid ? 'border-red-400 focus:border-red-500' : 'border-zinc-200 focus:border-emerald-500'
              }`} 
            />
            {referenceNumber && !isReferenceValid && (
              <p className="text-[11px] text-red-500 font-semibold mt-1.5 pl-1 animate-fadeIn">
                ⚠️ Code appears incomplete. Reference keys require a baseline minimum threshold of 7 digits.
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block font-semibold text-zinc-700">Proof of Payment *</label>
            <input type="file" ref={receiptInputRef} accept="image/*" className="hidden" onChange={(e) => setReceiptFile(e.target.files?.[0] || null)} />
            <div onClick={() => receiptInputRef.current?.click()} className={`w-full border-2 border-dashed rounded-2xl p-4 text-center text-xs transition cursor-pointer select-none ${receiptFile ? 'border-emerald-400 bg-emerald-50 text-emerald-800' : 'border-zinc-200 bg-zinc-50 text-zinc-400 hover:bg-zinc-100'}`}>
              {receiptFile ? `✅ Selected: ${receiptFile.name}` : '📁 Upload payment receipt picture'}
            </div>
          </div>

          <div>
            <label className="mb-1 block font-semibold text-zinc-700">Valid ID Picture *</label>
            <input type="file" ref={idInputRef} accept="image/*" className="hidden" onChange={(e) => setIdFile(e.target.files?.[0] || null)} />
            <div onClick={() => idInputRef.current?.click()} className={`w-full border-2 border-dashed rounded-2xl p-4 text-center text-xs transition cursor-pointer select-none ${idFile ? 'border-emerald-400 bg-emerald-50 text-emerald-800' : 'border-zinc-200 bg-zinc-50 text-zinc-400 hover:bg-zinc-100'}`}>
              {idFile ? `🪪 Attached: ${idFile.name}` : '🆔 Upload valid ID picture'}
            </div>
          </div>
        </div>

        {apiError && <p className="text-xs font-semibold text-red-500 bg-red-50 border border-red-200 p-3 rounded-xl">⚠️ {apiError}</p>}

        <button type="submit" disabled={!canSubmit} className={`w-full rounded-full py-3 text-xs font-bold text-white transition uppercase tracking-wider shadow-md ${canSubmit ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-zinc-200 text-zinc-400 cursor-not-allowed shadow-none'}`}>
          {submitting ? 'Registering Booking...' : 'Confirm Payment Submission'}
        </button>
      </form>
    </div>
  );
}
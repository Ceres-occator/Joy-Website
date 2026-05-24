'use client'

import { useSearchParams, useRouter, useParams } from 'next/navigation';
import { useState, useRef } from 'react';
import { createClient } from "@/utils/supabase/client";

export default function PaymentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams();
  
  const villaId = params.villaId as string;

  // --- 🛠️ FIXED: UNPACK ALL REQUIRED REVENUE PARAMETERS FROM THE URL ---
  const villaTitle = searchParams.get('villaTitle') || 'Selected Villa';
  const fullName = searchParams.get('fullName') || '';
  const phone = searchParams.get('phone') || '';
  const eventDate = searchParams.get('eventDate') || '';
  const timeSlot = searchParams.get('timeSlot') || 'day';
  const totalPrice = Number(searchParams.get('price') || 0);
  
  // These were missing from your local scope, causing the TypeScript errors:
  const paxCount = searchParams.get('paxCount') || '0';
  const packageOption = searchParams.get('packageOption') || '';
  const includeOvernight = searchParams.get('includeOvernight') || 'false';
  const overnightPaxCount = searchParams.get('overnightPaxCount') || '0';

  // --- FORM INPUT STATES ---
  const [accountName, setAccountName] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [idFile, setIdFile] = useState<File | null>(null);

  const receiptInputRef = useRef<HTMLInputElement>(null);
  const idInputRef = useRef<HTMLInputElement>(null);

  // --- ACTION MANAGEMENT STATES ---
  const [submitting, setSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null); // 👈 Safely registered inside the component body

  const canSubmit = 
    accountName.trim().length > 0 && 
    referenceNumber.trim().length > 0 && 
    receiptFile !== null && 
    idFile !== null && 
    !submitting;

  // --- 🔗 LIVE BACKEND API TRANSACTION CARRIER SUBMIT HANDLER ---
  const handleBookingVerificationSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!canSubmit) return;
  
  setSubmitting(true);
  setApiError(null);

try {
  const supabase = createClient();
  
  // 📁 1. ROUTE INTO YOUR EXISTING RECEIPTS FOLDER
  const receiptExt = receiptFile.name.split('.').pop();
  // Prefixing with 'receipts/' pushes it straight into your existing folder!
  const receiptPath = `receipts/receipt_${villaId}_${Date.now()}.${receiptExt}`;
  
  const { error: receiptUploadError } = await supabase.storage
    .from('booking-attachments')
    .upload(receiptPath, receiptFile);

  if (receiptUploadError) throw new Error(`Receipt upload failure: ${receiptUploadError.message}`);

  // 📁 2. ROUTE INTO YOUR EXISTING IDS FOLDER
  const idExt = idFile.name.split('.').pop();
  // Prefixing with 'ids/' pushes it straight into your existing folder!
  const idPath = `ids/id_${villaId}_${Date.now()}.${idExt}`;
  
  const { error: idUploadError } = await supabase.storage
    .from('booking-attachments')
    .upload(idPath, idFile);

  if (idUploadError) throw new Error(`ID upload failure: ${idUploadError.message}`);

  // 🔗 3. SEND TEXT FIELDS + COMPATIBLE FILE PATH LINKS TO THE CONFIRM API
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
      referenceNumber,
      accountName,
      receiptFilePath: receiptPath, // Now passes e.g. "receipts/receipt_abc.png"
      idFilePath: idPath            // Now passes e.g. "ids/id_abc.png"
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
  // --- WIZARD VIEW A: TRANSACTION SUCCESS LAYOUT RECIPIENT ---
  if (isSuccess) {
    return (
      <div className="mx-auto max-w-md p-4 sm:p-6 mt-12">
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl space-y-6 text-center animate-fadeIn">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl">🎉</div>
          
          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-zinc-900">Booking Requested!</h2>
            <p className="text-sm text-zinc-500">
              Your transaction details and verification images are registered. Our admin team will verify your payment link code shortly.
            </p>
          </div>

          <div className="rounded-2xl bg-zinc-50 p-4 text-left text-sm space-y-3 border border-zinc-100">
            <h3 className="font-bold text-zinc-800 border-b pb-1 text-xs uppercase tracking-wider text-zinc-400">Receipt Invoice Details</h3>
            <div className="flex justify-between">
              <span className="text-zinc-500">Customer:</span>
              <span className="font-semibold text-zinc-900">{fullName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Venue Stay:</span>
              <span className="font-semibold text-zinc-900">{villaTitle}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Date Target:</span>
              <span className="font-semibold text-zinc-900">{eventDate}</span>
            </div>
            <div className="flex justify-between border-t pt-2 font-bold text-base text-zinc-900">
              <span>Total Settle Price:</span>
              <span className="text-emerald-600">₱{totalPrice.toLocaleString()}</span>
            </div>
          </div>

          <button
            onClick={() => router.push('/')}
            className="w-full rounded-full bg-zinc-900 py-3.5 text-sm font-semibold text-white transition hover:bg-zinc-800 shadow-md"
          >
            Return to Home Catalog
          </button>
        </div>
      </div>
    );
  }

  // --- WIZARD VIEW B: STANDARD CHECKOUT ATTACHMENT FORMS ---
  return (
    <div className="mx-auto max-w-md p-4 sm:p-6 mt-6 space-y-6 animate-fadeIn">
      <form onSubmit={handleBookingVerificationSubmit} className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl space-y-6">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-zinc-400">Checkout Step</p>
          <h2 className="text-2xl font-bold text-zinc-900">Upload Down Payment</h2>
        </div>

        <div className="rounded-2xl bg-zinc-50 border border-zinc-100 p-4 text-sm">
          <div className="flex justify-between font-bold text-zinc-800">
            <span>50% Required Deposit due:</span>
            <span className="text-emerald-600 text-base">₱{(totalPrice * 0.5).toLocaleString()}</span>
          </div>
        </div>

        <div className="space-y-4 text-sm">
          <div>
            <label className="mb-1 block font-semibold text-zinc-700">Account Name *</label>
            <input
              type="text"
              required
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="Sender Account Name"
              className="w-full rounded-xl border border-zinc-200 px-4 py-3 bg-zinc-50 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block font-semibold text-zinc-700">Reference Number *</label>
            <input
              type="text"
              required
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              placeholder="Enter receipt reference tracking code"
              className="w-full rounded-xl border border-zinc-200 px-4 py-3 bg-zinc-50 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block font-semibold text-zinc-700">Proof of Payment *</label>
            <input 
              type="file" 
              ref={receiptInputRef}
              accept="image/*"
              className="hidden" 
              onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
            />
            <div
              onClick={() => receiptInputRef.current?.click()}
              className={`w-full border-2 border-dashed rounded-2xl p-6 text-center transition cursor-pointer select-none ${
                receiptFile ? 'border-emerald-400 bg-emerald-50 text-emerald-800' : 'border-zinc-200 bg-zinc-50 text-zinc-400 hover:bg-zinc-100'
              }`}
            >
              {receiptFile ? `✅ Selected: ${receiptFile.name}` : '📁 Tap to upload receipt picture'}
            </div>
          </div>

          <div>
            <label className="mb-1 block font-semibold text-zinc-700">Valid ID Picture *</label>
            <input 
              type="file" 
              ref={idInputRef}
              accept="image/*"
              className="hidden" 
              onChange={(e) => setIdFile(e.target.files?.[0] || null)}
            />
            <div
              onClick={() => idInputRef.current?.click()}
              className={`w-full border-2 border-dashed rounded-2xl p-6 text-center transition cursor-pointer select-none ${
                idFile ? 'border-emerald-400 bg-emerald-50 text-emerald-800' : 'border-zinc-200 bg-zinc-50 text-zinc-400 hover:bg-zinc-100'
              }`}
            >
              {idFile ? `🪪 Attached: ${idFile.name}` : '🆔 Tap to upload valid ID picture'}
            </div>
          </div>
        </div>

        {/* 🛠️ API ERROR CONTAINER CONDITIONAL RENDERING */}
        {apiError && (
          <p className="text-xs font-semibold text-red-500 bg-red-50 border border-red-200 p-3 rounded-xl">
            ⚠️ {apiError}
          </p>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className={`w-full rounded-full py-3.5 text-sm font-semibold text-white transition shadow-md ${
            canSubmit ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-zinc-200 text-zinc-400 cursor-not-allowed shadow-none'
          }`}
        >
          {submitting ? 'Registering Booking Record...' : 'Confirm'}
        </button>
      </form>
    </div>
  );
}